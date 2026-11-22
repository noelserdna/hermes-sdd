// UC-012 ver mis multas, UC-013 marcar pagada, UC-014 ver todas; API-004-01..03. La multa la crea API-002-05 al devolver (INV-MUL-001):
// aquí solo se lista y se cobra. El bloqueo de reserva no se guarda: se calcula de las multas Pendientes del socio (INV-MUL-002).
import { AVISOS, EXITOS, error } from '../mensajes.js';

/** API-004-01: las multas de la cuenta de la sesión y solo esas (INV-SEC-001). Solo lee. */
export async function listMyFines(ctx) {
  const d = await ctx.store.leer();
  const multas = d.multas
    .filter((m) => m.accountId === ctx.sesion.cuentaId)
    .sort((a, b) => a.createdOn.localeCompare(b.createdOn) || a.id.localeCompare(b.id))
    .map((m) => ({ id: m.id, importe: m.amountEur, dias: m.lateDays, estado: m.status }));
  return multas.length ? { multas } : { multas, mensaje: EXITOS.sinMultasPropias };
}

/**
 * API-004-02 (UC-013). Orden: existe (E_MULTA_NO_ENCONTRADA), ya Pagada → aviso sin cambios (ADR-005, INV-MUL-003). Pasa a Pagada con
 * `paidOn` de hoy. El bloqueo de reserva no se guarda: `bloqueado` dice si al socio le quedan otras Pendientes, que es lo que `reserve` calcula.
 */
export async function payFine(ctx, { id }) {
  const hoy = ctx.reloj.hoy();
  return ctx.store.transaccion((d) => {
    const multa = d.multas.find((m) => m.id === id);
    if (!multa) throw error('E_MULTA_NO_ENCONTRADA');
    if (multa.status === 'Pagada') return { aviso: { codigo: 'E_MULTA_YA_PAGADA', mensaje: AVISOS.E_MULTA_YA_PAGADA } };
    multa.status = 'Pagada';
    multa.paidOn = hoy;
    const bloqueado = d.multas.some((m) => m.accountId === multa.accountId && m.status === 'Pendiente');
    return { mensaje: EXITOS.multaPagada, estado: multa.status, paidOn: hoy, bloqueado };
  });
}

/** API-004-03: todas las multas con el nombre de su socio, de la más antigua a la más reciente (UC-014). Solo lee. */
export async function listFines(ctx) {
  const d = await ctx.store.leer();
  const multas = [...d.multas]
    .sort((a, b) => a.createdOn.localeCompare(b.createdOn) || a.id.localeCompare(b.id))
    .map((m) => ({ id: m.id, socio: d.cuentas.find((c) => c.id === m.accountId)?.name ?? '', importe: m.amountEur, estado: m.status }));
  return multas.length ? { multas } : { multas, mensaje: EXITOS.sinMultas };
}
