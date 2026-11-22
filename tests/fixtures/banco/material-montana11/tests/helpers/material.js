// Ayudas de test de FASE-1: preparan el GIVEN (unidades, multas, reservas) directamente en el almacén
// (TEST-PLAN R-5: datos sembrados en el almacén, no por la interfaz).
import { siguienteId } from '../../src/server/store.js';
import { iniciarSesion } from '../../src/domain/cuentas.js';

/** Hoy de los escenarios de reservas: 2026-11-21 (el helper del entorno parte de 2026-12-05). */
export const HOY_FASE_1 = '2026-11-21T10:00:00Z';

export function sembrarUnidades(e, tipo, n) {
  e.store.transaccion((db) => {
    const ya = db.unidades.filter((u) => u.tipo === tipo).length;
    for (let i = 1; i <= n; i++) db.unidades.push({ id: siguienteId(db, 'unidades'), tipo, numero: ya + i, estado: 'Alta' });
  });
}

export function sembrarMulta(e, correo, { importeEur = 4, estado = 'Pendiente' } = {}) {
  e.store.transaccion((db) => {
    const socio = db.cuentas.find((c) => c.correo === correo);
    db.multas.push({ id: siguienteId(db, 'multas'), socioId: socio.id, reservaId: 0, diasRetraso: 2, importeEur, estado, creadaEl: '2026-11-10', pagadaEl: null });
  });
}

/** Reserva directa en el almacén (sin pasar por reservarMaterial): `unidad` es el número dentro del tipo. */
export function sembrarReserva(e, { correo, tipo, unidad = 1, inicio, fin, estado = 'Reservada' }) {
  return e.store.transaccion((db) => {
    const socio = db.cuentas.find((c) => c.correo === correo);
    const u = db.unidades.find((x) => x.tipo === tipo && x.numero === unidad);
    const reserva = { id: siguienteId(db, 'reservas'), socioId: socio.id, unidadId: u.id, inicio, fin, estado, entregadaEl: null, devueltaEl: null, canceladaEl: null };
    db.reservas.push(reserva);
    return reserva.id;
  });
}

export const sesionDe = (e, correo, contrasena = 'Cumbre2026') => iniciarSesion(e.ctx(), { correo, contrasena }).sid;
