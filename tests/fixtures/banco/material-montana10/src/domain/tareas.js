import { RETENTION_YEARS } from './config.js';
// Tareas del sistema (API-003-07). La derivación al leer vive en reservas.js; esta tarea solo la persiste.
// Una Reservada con hoy posterior a `hasta` pasa a «No recogida», sin multa (INV-RES-007, RN-008); idempotente (D-PA-008).
export async function resolverNoRecogidas({ almacen, reloj }) {
  const hoy = reloj.hoy();
  return almacen.transaction((db) => {
    let noRecogidas = 0;
    for (const reserva of db.reservas) {
      if (reserva.estado === 'Reservada' && reserva.hasta < hoy) { reserva.estado = 'No recogida'; noRecogidas += 1; }
    }
    return { noRecogidas };
  });
}

// API-003-08 purgarRegistrosAntiguos (REQ-NF-001, INV-LOA-006, RN-013, D-PA-005): la lanza la tarea diaria tras resolverNoRecogidas.
// Cierre de un préstamo (reserva): su devolución, o `hasta` si Cancelada o No recogida; de una multa: su fecha de pago. Se borra
// lo cerrado hace más de RETENTION_YEARS años; nunca una multa Pendiente ni un préstamo sin cerrar. Después, la cuenta de un socio
// en Baja que ya no tiene reservas ni multas conservadas se borra entera (nombre, correo y hash). Idempotente.
const cierreDeReserva = (r) => (r.estado === 'Devuelta' ? (r.devueltaEl ?? r.hasta) : ['Cancelada', 'No recogida'].includes(r.estado) ? r.hasta : null);

export async function purgarRegistrosAntiguos({ almacen, reloj }) {
  const hoy = reloj.hoy();
  const limite = `${Number(hoy.slice(0, 4)) - RETENTION_YEARS}${hoy.slice(4)}`; // AAAA-MM-DD, los años de retención antes de hoy
  const caducado = (cierre) => cierre !== null && cierre !== undefined && cierre < limite;
  return almacen.transaction((db) => {
    const reservas = db.reservas.length;
    const multas = db.multas.length;
    const cuentas = db.cuentas.length;
    db.reservas = db.reservas.filter((r) => !caducado(cierreDeReserva(r)));
    db.multas = db.multas.filter((m) => !(m.estado === 'Pagada' && caducado(m.pagadaEl)));
    db.cuentas = db.cuentas.filter((c) => !(c.rol === 'socio' && c.estado === 'Baja'
      && !db.reservas.some((r) => r.socioId === c.id) && !db.multas.some((m) => m.socioId === c.id)));
    return { reservas: reservas - db.reservas.length, multas: multas - db.multas.length, cuentas: cuentas - db.cuentas.length };
  });
}
