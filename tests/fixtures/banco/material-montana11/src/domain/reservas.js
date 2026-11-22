// Reservas (API-002-01..04). Cada operación es una transacción del almacén, serializada (ADR-005, INV-SEC-003).
import { ErrorDominio } from './errores.js';
import { RESERVATION_MAX_DAYS } from './constantes.js';
import { validarTipo, validarFecha, diasEntre } from './validacion.js';
import { operar } from './cuentas.js';
import { aplicarNoRecogidas } from './prestamos.js';
import { siguienteId } from '../server/store.js';

const ocupa = (r) => r.estado === 'Reservada' || r.estado === 'Entregado';
// ADR-002: las fechas son días completos y ambos extremos cuentan; días contiguos no solapan.
const solapa = (r, inicio, fin) => r.inicio <= fin && r.fin >= inicio;

/** Unidades en Alta del tipo sin reserva que ocupe algún día del rango, por número (RN-001, INV-RES-009). */
function unidadesLibres(db, material, inicio, fin) {
  const ocupadas = new Set(db.reservas.filter((r) => ocupa(r) && solapa(r, inicio, fin)).map((r) => r.unidadId));
  return db.unidades
    .filter((u) => u.tipo === material && u.estado === 'Alta' && !ocupadas.has(u.id))
    .sort((a, b) => a.numero - b.numero);
}

export function vistaReserva(db, r) {
  const unidad = db.unidades.find((u) => u.id === r.unidadId);
  return { id: r.id, material: unidad.tipo, unidad: unidad.numero, inicio: r.inicio, fin: r.fin, estado: r.estado };
}

/** API-002-01: unidades libres de `material` en todo el rango; no escribe reservas (un rango invertido no tiene libres). */
export function consultarDisponibilidad(ctx, { material, inicio, fin } = {}) {
  return operar(ctx, 'consultarDisponibilidad', (db) => {
    validarFecha(inicio);
    validarFecha(fin);
    validarTipo(material);
    aplicarNoRecogidas(db, ctx.reloj.hoy());
    return { material, inicio, fin, libres: fin < inicio ? 0 : unidadesLibres(db, material, inicio, fin).length };
  });
}

/**
 * API-002-02. Orden: sesión, rol, datos, tipo, fecha pasada, invertida, más de 14 días, multa, replay, unidades.
 * Repetir el envío idéntico devuelve la reserva existente (INV-RES-008, RN-011) antes de buscar unidad.
 */
export function reservarMaterial(ctx, { material, inicio, fin } = {}) {
  return operar(ctx, 'reservarMaterial', (db, cuenta) => {
    validarFecha(inicio);
    validarFecha(fin);
    validarTipo(material);
    const hoy = ctx.reloj.hoy();
    aplicarNoRecogidas(db, hoy);
    if (inicio < hoy) throw new ErrorDominio('E_FECHA_PASADA');
    if (fin < inicio) throw new ErrorDominio('E_FECHAS_INVERTIDAS');
    if (diasEntre(inicio, fin) + 1 > RESERVATION_MAX_DAYS) throw new ErrorDominio('E_RESERVA_MUY_LARGA');
    if (db.multas.some((m) => m.socioId === cuenta.id && m.estado === 'Pendiente')) throw new ErrorDominio('E_MULTA_PENDIENTE');
    const igual = db.reservas.find((r) => r.socioId === cuenta.id && r.estado === 'Reservada' && r.inicio === inicio && r.fin === fin
      && db.unidades.find((u) => u.id === r.unidadId)?.tipo === material);
    if (igual) return vistaReserva(db, igual);
    const [unidad] = unidadesLibres(db, material, inicio, fin);
    if (!unidad) throw new ErrorDominio('E_SIN_UNIDADES');
    const reserva = {
      id: siguienteId(db, 'reservas'), socioId: cuenta.id, unidadId: unidad.id, inicio, fin, estado: 'Reservada',
      entregadaEl: null, devueltaEl: null, canceladaEl: null,
    };
    db.reservas.push(reserva);
    return vistaReserva(db, reserva);
  });
}

/** API-002-03: solo las reservas de la cuenta de la sesión (INV-SEC-001), las más recientes primero; aplica No recogida (RN-004). */
export function listarMisReservas(ctx) {
  return operar(ctx, 'listarMisReservas', (db, cuenta) => {
    aplicarNoRecogidas(db, ctx.reloj.hoy());
    return db.reservas
      .filter((r) => r.socioId === cuenta.id)
      .sort((a, b) => (a.inicio < b.inicio ? 1 : a.inicio > b.inicio ? -1 : b.id - a.id))
      .map((r) => vistaReserva(db, r));
  });
}

/**
 * API-002-04: cancela una reserva propia Reservada con `inicio` > hoy y libera la unidad (INV-RES-006). Repetir la
 * cancelación no cambia nada (INV-RES-007). Una reserva ajena es como una que no existe (INV-SEC-001).
 */
export function cancelarReserva(ctx, { reservaId } = {}) {
  return operar(ctx, 'cancelarReserva', (db, cuenta) => {
    if (!Number.isInteger(reservaId)) throw new ErrorDominio('E_DATOS_INVALIDOS');
    const hoy = ctx.reloj.hoy();
    aplicarNoRecogidas(db, hoy);
    const reserva = db.reservas.find((r) => r.id === reservaId && r.socioId === cuenta.id);
    if (!reserva) throw new ErrorDominio('E_RESERVA_NO_ENCONTRADA');
    if (reserva.estado === 'Cancelada') return vistaReserva(db, reserva);
    if (reserva.estado !== 'Reservada') throw new ErrorDominio('E_ESTADO_INVALIDO');
    if (reserva.inicio <= hoy) throw new ErrorDominio('E_CANCELACION_TARDIA');
    reserva.estado = 'Cancelada';
    reserva.canceladaEl = hoy;
    return vistaReserva(db, reserva);
  });
}
