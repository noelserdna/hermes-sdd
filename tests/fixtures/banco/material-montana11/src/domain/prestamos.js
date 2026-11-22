// Préstamos (API-003-xx): entrega, lista y la parte interna que usan las lecturas y escrituras de reservas.
import { ErrorDominio } from './errores.js';
import { operar } from './cuentas.js';
import { aplicarMultaPorRetraso } from './multas.js';
import { validarFecha, diasEntre } from './validacion.js';

/**
 * API-003-03, interna (sin ruta ni fila de rol: solo la dispara el sistema, D-PA-003): toda reserva Reservada con
 * `inicio` anterior a `hoy` pasa a No recogida; al dejar de estar Reservada ya no ocupa su unidad (INV-LOA-002, RN-004).
 * Idempotente. Devuelve cuántas cambió. Se llama dentro de la transacción de quien lee o escribe reservas.
 */
export function aplicarNoRecogidas(tx, hoy) {
  let cambiadas = 0;
  for (const r of tx.reservas) {
    if (r.estado === 'Reservada' && r.inicio < hoy) { r.estado = 'No recogida'; cambiadas += 1; }
  }
  return cambiadas;
}

/** Vista de una reserva para el encargado: lo que muestra Préstamos (SCR-007). */
export function vistaPrestamo(db, r) {
  const unidad = db.unidades.find((u) => u.id === r.unidadId);
  const socio = db.cuentas.find((c) => c.id === r.socioId);
  const multa = db.multas.find((m) => m.reservaId === r.id);
  return {
    id: r.id, material: unidad.tipo, unidad: unidad.numero, socio: socio?.nombre ?? '', inicio: r.inicio, fin: r.fin,
    estado: r.estado, entregadaEl: r.entregadaEl, devueltaEl: r.devueltaEl,
    multa: multa ? { importeEur: multa.importeEur, estado: multa.estado } : null,
  };
}

function reservaDe(db, reservaId) {
  if (!Number.isInteger(reservaId)) throw new ErrorDominio('E_DATOS_INVALIDOS');
  const reserva = db.reservas.find((r) => r.id === reservaId);
  if (!reserva) throw new ErrorDominio('E_RESERVA_NO_ENCONTRADA');
  return reserva;
}

/** API-003-04: todas las reservas con su estado, tras aplicar No recogida (API-003-03). Solo el encargado. */
export function listarPrestamosYReservas(ctx) {
  return operar(ctx, 'listarPrestamosYReservas', (db) => {
    aplicarNoRecogidas(db, ctx.reloj.hoy());
    return [...db.reservas]
      .sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : a.id - b.id))
      .map((r) => vistaPrestamo(db, r));
  });
}

/**
 * API-003-01: Reservada → Entregado con `entregadaEl` = hoy, solo el día de `inicio` (INV-LOA-001, RN-003).
 * Una reserva que ya no está Reservada (entregada antes por otro encargado, No recogida, Cancelada) da
 * E_ESTADO_INVALIDO y conserva lo del primero.
 */
export function entregarReserva(ctx, { reservaId } = {}) {
  return operar(ctx, 'entregarReserva', (db) => {
    const hoy = ctx.reloj.hoy();
    aplicarNoRecogidas(db, hoy);
    const reserva = reservaDe(db, reservaId);
    if (reserva.estado !== 'Reservada') throw new ErrorDominio('E_ESTADO_INVALIDO');
    if (hoy < reserva.inicio) throw new ErrorDominio('E_ENTREGA_ANTICIPADA');
    reserva.estado = 'Entregado';
    reserva.entregadaEl = hoy;
    return vistaPrestamo(db, reserva);
  });
}

/**
 * API-003-02: Entregado → Devuelto con `devueltaEl` = hoy (INV-LOA-003). Repetirla sobre una ya Devuelta no cambia
 * nada y conserva la primera fecha. Cualquier otro estado da E_ESTADO_INVALIDO. Todo en una sola escritura (ADR-005).
 */
export function registrarDevolucion(ctx, { reservaId } = {}) {
  return operar(ctx, 'registrarDevolucion', (db) => {
    const hoy = ctx.reloj.hoy();
    aplicarNoRecogidas(db, hoy);
    const reserva = reservaDe(db, reservaId);
    if (reserva.estado === 'Devuelto') return vistaPrestamo(db, reserva);
    if (reserva.estado !== 'Entregado') throw new ErrorDominio('E_ESTADO_INVALIDO');
    reserva.estado = 'Devuelto';
    reserva.devueltaEl = hoy;
    aplicarMultaPorRetraso(db, reserva.id);   // INV-FIN-001: en la misma escritura; si falla, no queda nada a medias
    return vistaPrestamo(db, reserva);
  });
}

/**
 * API-003-09 (UC-015): el material prestado ahora (reservas Entregado sin devolver) con su retraso en días contra `hoy`
 * del reloj (RN-009) y `vuelveHoy` si su `fin` es `dia` (por defecto hoy). Los retrasados van primero. Solo lectura.
 */
export function consultarPrestado(ctx, { dia } = {}) {
  return operar(ctx, 'consultarPrestado', (db) => {
    const hoy = ctx.reloj.hoy();
    const elegido = dia === undefined || dia === '' ? hoy : validarFecha(dia);
    return db.reservas
      .filter((r) => r.estado === 'Entregado')
      .map((r) => {
        const unidad = db.unidades.find((u) => u.id === r.unidadId);
        return {
          reservaId: r.id, material: unidad.tipo, unidad: unidad.numero, socio: db.cuentas.find((c) => c.id === r.socioId)?.nombre ?? '',
          inicio: r.inicio, fin: r.fin, retrasoDias: Math.max(0, diasEntre(r.fin, hoy)), vuelveHoy: r.fin === elegido,
        };
      })
      .sort((a, b) => (b.retrasoDias > 0) - (a.retrasoDias > 0) || (a.fin < b.fin ? -1 : a.fin > b.fin ? 1 : a.reservaId - b.reservaId));
  });
}

const vistaSocioHistorial = (c) => ({ id: c.id, nombre: c.nombre, estado: c.estado });

/**
 * Selector del Historial (SCR-011): id, nombre y estado de cada socio, solo para la junta (INV-SEC-002, solo lectura).
 * Lectura propia porque tests/unit/permisos.test.js, aceptado, no deja a la junta usar `listarSocios` (Q-task-implementer-005).
 */
export function listarSociosHistorial(ctx) {
  return operar(ctx, 'listarSociosHistorial', (db) => db.cuentas.filter((c) => c.rol === 'socio').map(vistaSocioHistorial));
}

/**
 * API-003-10 (UC-016): los préstamos (reservas Entregado o Devuelto) y las multas del socio pedido, y nada de otros
 * socios (INV-SEC-001). Un socio en Baja conserva su historial (RN-007). Solo la junta; sin escritura (INV-SEC-002).
 */
export function consultarHistorialSocio(ctx, { socioId } = {}) {
  return operar(ctx, 'consultarHistorialSocio', (db) => {
    if (!Number.isInteger(socioId)) throw new ErrorDominio('E_DATOS_INVALIDOS');
    const socio = db.cuentas.find((c) => c.id === socioId && c.rol === 'socio');
    if (!socio) throw new ErrorDominio('E_SOCIO_NO_ENCONTRADO');
    const prestamos = db.reservas
      .filter((r) => r.socioId === socio.id && ['Entregado', 'Devuelto'].includes(r.estado))
      .sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : a.id - b.id))
      .map((r) => {
        const unidad = db.unidades.find((u) => u.id === r.unidadId);
        return { reservaId: r.id, material: unidad?.tipo ?? '', unidad: unidad?.numero ?? 0, inicio: r.inicio, fin: r.fin, estado: r.estado, devueltaEl: r.devueltaEl };
      });
    const multas = db.multas
      .filter((m) => m.socioId === socio.id)
      .sort((a, b) => a.id - b.id)
      .map((m) => ({ id: m.id, importeEur: m.importeEur, estado: m.estado, pagadaEl: m.pagadaEl }));
    return { socio: vistaSocioHistorial(socio), prestamos, multas };
  });
}
