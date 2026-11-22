// UC-007 reservar, UC-008 ver mis reservas, UC-009 cancelar; API-002-01..03. Cada operación es una sola transacción:
// o queda todo o no queda nada (INV-RES-004). La disponibilidad se calcula por día desde las reservas (ADR-001).
import { randomUUID } from 'node:crypto';
import { AVISOS, EXITOS, diasTexto, error, mensajeDe, rellenar } from '../mensajes.js';
import { estadoReserva } from '../dominio/estados.js';
import { libresEn } from '../dominio/disponibilidad.js';
import { diasEntre, esDia } from '../dominio/fechas.js';
import { diasRetraso, importeMulta } from '../dominio/multas.js';

// Límites de spec/VALUE-REGISTRY.md
export const LIMITES = { MAX_RESERVATION_DAYS: 14, MAX_UNITS_PER_RESERVATION: 5 };

/** API-002-01. Orden: multa (RN-016), entradas válidas (RN-034), fecha pasada, fin anterior, días, unidades, tipo y libres por día. */
export async function reserve(ctx, { materialId, cantidad, inicio, fin }) {
  const hoy = ctx.reloj.hoy();
  return ctx.store.transaccion((d) => {
    const pendientes = d.multas.filter((m) => m.accountId === ctx.sesion.cuentaId && m.status === 'Pendiente');
    if (pendientes.length) throw error('E_MULTA_PENDIENTE', { importe: pendientes.reduce((t, m) => t + m.amountEur, 0) });
    if (!Number.isInteger(cantidad) || cantidad < 1) throw error('E_CANTIDAD_INVALIDA');
    if (!esDia(inicio) || !esDia(fin)) throw error('E_FECHA_INVALIDA');
    if (inicio < hoy) throw error('E_FECHA_PASADA');
    if (fin < inicio) throw error('E_FECHA_FIN_ANTERIOR');
    const dias = diasEntre(inicio, fin);
    if (dias.length > LIMITES.MAX_RESERVATION_DAYS) throw error('E_MAX_DIAS');
    if (cantidad > LIMITES.MAX_UNITS_PER_RESERVATION) throw error('E_MAX_UNIDADES');
    const tipo = d.material.find((m) => m.id === materialId);
    if (!tipo) throw error('E_MATERIAL_NO_ENCONTRADO');
    for (const dia of dias) {
      const libres = libresEn(d.reservas, { id: tipo.id, totalUnits: tipo.totalUnits }, dia, hoy);
      if (libres < cantidad) throw error('E_SIN_UNIDADES', { libres: Math.max(libres, 0), material: tipo.name, día: dia });
    }
    const reserva = {
      id: `r-${randomUUID().slice(0, 8)}`, accountId: ctx.sesion.cuentaId, itemId: tipo.id, quantity: cantidad,
      startDate: inicio, endDate: fin, status: 'Reservada', deliveredOn: null, returnedOn: null,
    };
    d.reservas.push(reserva);
    return { id: reserva.id, mensaje: rellenar(EXITOS.reservaCreada, { cantidad, material: tipo.name, inicio, fin }) };
  });
}

/** API-002-02: las reservas de la sesión con su estado derivado y si se pueden cancelar (INV-RES-006, INV-RES-010). Solo lee. */
export async function listMyReservations(ctx) {
  const hoy = ctx.reloj.hoy();
  const d = await ctx.store.leer();
  const nombre = (id) => d.material.find((m) => m.id === id)?.name ?? '';
  const reservas = d.reservas
    .filter((r) => r.accountId === ctx.sesion.cuentaId)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))
    .map((r) => {
      const estado = estadoReserva(r, hoy);
      const cancelable = estado === 'Reservada' && hoy < r.startDate;
      const codigo = estado === 'Reservada' || estado === 'Prestada' ? (r.startDate === hoy ? 'E_EMPIEZA_HOY' : r.startDate < hoy ? 'E_YA_EMPEZADA' : null) : null;
      return {
        id: r.id, cantidad: r.quantity, material: nombre(r.itemId), inicio: r.startDate, fin: r.endDate, estado, cancelable,
        motivo: cancelable || !codigo ? null : mensajeDe(codigo),
      };
    });
  return reservas.length ? { reservas } : { reservas, mensaje: EXITOS.sinReservas };
}

/**
 * API-002-03. Orden: es suya (una ajena o inexistente da el mismo E_ACCESO_DENEGADO, INV-RES-010), ya Cancelada → aviso sin cambios
 * (INV-RES-009, ADR-005), empieza hoy, ya empezó (INV-RES-006). Cancelar libera las unidades porque la disponibilidad se calcula.
 */
export async function cancelReservation(ctx, { id }) {
  const hoy = ctx.reloj.hoy();
  return ctx.store.transaccion((d) => {
    const reserva = d.reservas.find((r) => r.id === id && r.accountId === ctx.sesion.cuentaId);
    if (!reserva) throw error('E_ACCESO_DENEGADO');
    if (reserva.status === 'Cancelada') return { aviso: { codigo: 'E_YA_CANCELADA', mensaje: AVISOS.E_YA_CANCELADA } };
    if (reserva.startDate === hoy) throw error('E_EMPIEZA_HOY');
    if (reserva.startDate < hoy) throw error('E_YA_EMPEZADA');
    reserva.status = 'Cancelada';
    return { mensaje: EXITOS.reservaCancelada };
  });
}

/**
 * API-002-04 (UC-010). Orden: existe, ya Prestada → aviso sin cambios (INV-RES-009, ADR-005, D-PA-005: el aviso gana a cualquier error),
 * Cancelada o Devuelta, fin pasado sin recoger (No recogida, INV-RES-008), antes del inicio (INV-RES-007). Solo pasa a Prestada la
 * Reservada con inicio ≤ hoy ≤ fin; sigue ocupando las mismas unidades (INV-RES-005).
 */
export async function deliverReservation(ctx, { id }) {
  const hoy = ctx.reloj.hoy();
  return ctx.store.transaccion((d) => {
    const reserva = d.reservas.find((r) => r.id === id);
    if (!reserva) throw error('E_RESERVA_NO_ENCONTRADA');
    if (reserva.status === 'Prestada') return { aviso: { codigo: 'E_YA_ENTREGADA', mensaje: AVISOS.E_YA_ENTREGADA } };
    if (reserva.status !== 'Reservada') throw error('E_RESERVA_NO_ENTREGABLE');
    if (reserva.endDate < hoy) throw error('E_NO_RECOGIDA');
    if (hoy < reserva.startDate) throw error('E_ANTES_DE_INICIO');
    reserva.status = 'Prestada';
    reserva.deliveredOn = hoy;
    const material = d.material.find((m) => m.id === reserva.itemId)?.name ?? '';
    const nombre = d.cuentas.find((c) => c.id === reserva.accountId)?.name ?? '';
    return { mensaje: rellenar(EXITOS.entregada, { cantidad: reserva.quantity, material, nombre }) };
  });
}

/**
 * API-002-05 (UC-011). Orden: existe, ya Devuelta → aviso sin cambios (ADR-005, D-PA-005: gana a E_NO_PRESTADA), no Prestada.
 * El retraso es devolución − fin (INV-MUL-004); si es > 0 la multa Pendiente se crea en esta misma transacción, una por préstamo
 * (INV-MUL-001, ADR-004).
 */
export async function returnLoan(ctx, { id }) {
  const hoy = ctx.reloj.hoy();
  return ctx.store.transaccion((d) => {
    const reserva = d.reservas.find((r) => r.id === id);
    if (!reserva) throw error('E_RESERVA_NO_ENCONTRADA');
    if (reserva.status === 'Devuelta') return { aviso: { codigo: 'E_YA_DEVUELTA', mensaje: AVISOS.E_YA_DEVUELTA } };
    if (reserva.status !== 'Prestada') throw error('E_NO_PRESTADA');
    const retraso = diasRetraso(reserva.endDate, hoy);
    reserva.status = 'Devuelta';
    reserva.returnedOn = hoy;
    if (retraso === 0) return { mensaje: EXITOS.devueltaATiempo };
    const importe = importeMulta(retraso);
    if (!d.multas.some((f) => f.reservationId === reserva.id)) {
      d.multas.push({
        id: `f-${randomUUID().slice(0, 8)}`, accountId: reserva.accountId, reservationId: reserva.id, lateDays: retraso,
        amountEur: importe, status: 'Pendiente', createdOn: hoy, paidOn: null,
      });
    }
    return { mensaje: rellenar(EXITOS.devueltaConRetraso, { retraso: diasTexto(retraso), importe }) };
  });
}
