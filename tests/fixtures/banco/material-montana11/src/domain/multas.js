// Multas por retraso (API-003-05, UC-010). Interna: la dispara registrarDevolucion en su misma escritura (ADR-005),
// sin ruta HTTP ni fila de rol (D-PA-003, Q-spec-auditor-001).
import { FINE_PER_DAY_EUR } from './constantes.js';
import { diasEntre } from './validacion.js';
import { siguienteId } from '../server/store.js';
import { operar } from './cuentas.js';
import { ErrorDominio } from './errores.js';

/**
 * Si `devueltaEl` > `fin` crea la multa Pendiente de `FINE_PER_DAY_EUR` × días naturales de retraso (INV-FIN-001, RN-009).
 * Una reserva tiene como mucho una multa: si ya la tiene se conserva y se devuelve (INV-FIN-002). Devuelve la multa o null.
 */
export function aplicarMultaPorRetraso(db, reservaId) {
  const reserva = db.reservas.find((r) => r.id === reservaId);
  const existente = db.multas.find((m) => m.reservaId === reservaId);
  if (existente) return existente;
  if (!reserva?.devueltaEl) return null;
  const dias = diasEntre(reserva.fin, reserva.devueltaEl);
  if (dias <= 0) return null;
  const multa = {
    id: siguienteId(db, 'multas'), socioId: reserva.socioId, reservaId, diasRetraso: dias,
    importeEur: FINE_PER_DAY_EUR * dias, estado: 'Pendiente', creadaEl: reserva.devueltaEl, pagadaEl: null,
  };
  db.multas.push(multa);
  return multa;
}

/**
 * API-003-06 (UC-011): solo las multas de la cuenta de la sesión (INV-SEC-001, RN-015), con el importe sin formatear.
 * `material` y `devueltaEl` salen de la reserva que la originó (vacíos si la multa no tiene reserva).
 */
export function listarMisMultas(ctx) {
  return operar(ctx, 'listarMisMultas', (db, cuenta) => db.multas
    .filter((m) => m.socioId === cuenta.id)
    .sort((a, b) => a.id - b.id)
    .map((m) => {
      const reserva = db.reservas.find((r) => r.id === m.reservaId);
      const unidad = reserva && db.unidades.find((u) => u.id === reserva.unidadId);
      return { id: m.id, material: unidad?.tipo ?? '', devueltaEl: reserva?.devueltaEl ?? null, importeEur: m.importeEur, estado: m.estado, pagadaEl: m.pagadaEl };
    }));
}

const vistaMulta = (db, m) => ({
  id: m.id, socio: db.cuentas.find((c) => c.id === m.socioId)?.nombre ?? '', importeEur: m.importeEur, estado: m.estado, pagadaEl: m.pagadaEl,
});

/** API-003-07 (UC-012): todas las multas con el nombre del socio; las Pendiente primero, y por número. Solo el encargado. */
export function listarMultas(ctx) {
  return operar(ctx, 'listarMultas', (db) => [...db.multas]
    .sort((a, b) => (a.estado === b.estado ? a.id - b.id : a.estado === 'Pendiente' ? -1 : 1))
    .map((m) => vistaMulta(db, m)));
}

/**
 * API-003-08 (UC-012): Pendiente → Pagada con `pagadaEl` = hoy (INV-FIN-003), en una sola escritura (ADR-005).
 * Repetirla sobre una Pagada no cambia nada y conserva la primera fecha. El bloqueo no se guarda en la cuenta:
 * reservarMaterial lo calcula con las multas Pendiente (INV-FIN-004, INV-RES-005).
 */
export function marcarMultaPagada(ctx, { multaId } = {}) {
  return operar(ctx, 'marcarMultaPagada', (db) => {
    if (!Number.isInteger(multaId)) throw new ErrorDominio('E_DATOS_INVALIDOS');
    const multa = db.multas.find((m) => m.id === multaId);
    if (!multa) throw new ErrorDominio('E_MULTA_NO_ENCONTRADA');
    if (multa.estado === 'Pendiente') {
      multa.estado = 'Pagada';
      multa.pagadaEl = ctx.reloj.hoy();
    }
    return vistaMulta(db, multa);
  });
}
