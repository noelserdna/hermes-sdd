// UC-017 · API-002-06: el panel del encargado. Solo lee (ADR-004: abrirlo no crea ninguna multa).
import { EXITOS, error } from '../mensajes.js';
import { esDia, sumarDias } from '../dominio/fechas.js';
import { diasRetraso } from '../dominio/multas.js';

/**
 * RN-018: «Por entregar» = Reservada con inicio ≤ hoy ≤ fin; «vuelven» = Prestada con fin = la fecha elegida (hoy por defecto);
 * «prestados» = el resto de las Prestadas. Cada préstamo sale en una sola lista. El retraso es de hoy (INV-MUL-004).
 * RN-029: «noRecogidas» = Reservada con fin anterior a hoy y no más de NOT_COLLECTED_VISIBLE_DAYS días atrás (sin «Entregar», sin multa).
 * RN-032: una fecha vacía o no válida es E_FECHA_INVALIDA.
 */
/** VALUE-REGISTRY: días tras su fin durante los que el Panel sigue listando una reserva «No recogida» (RN-029). */
export const NOT_COLLECTED_VISIBLE_DAYS = 7;

export async function getPanel(ctx, { fecha } = {}) {
  const hoy = ctx.reloj.hoy();
  if (fecha !== undefined && !esDia(fecha)) throw error('E_FECHA_INVALIDA');
  const dia = fecha ?? hoy;
  const d = await ctx.store.leer();
  const fila = (r) => ({
    id: r.id, cantidad: r.quantity, material: d.material.find((m) => m.id === r.itemId)?.name ?? '',
    socio: d.cuentas.find((c) => c.id === r.accountId)?.name ?? '', inicio: r.startDate, fin: r.endDate,
    retraso: r.status === 'Prestada' ? diasRetraso(r.endDate, hoy) : 0,
  });
  const orden = (a, b) => a.fin.localeCompare(b.fin) || a.id.localeCompare(b.id);
  const porEntregar = d.reservas.filter((r) => r.status === 'Reservada' && r.startDate <= hoy && hoy <= r.endDate).map(fila).sort(orden);
  const desde = sumarDias(hoy, -NOT_COLLECTED_VISIBLE_DAYS);
  const noRecogidas = d.reservas.filter((r) => r.status === 'Reservada' && r.endDate < hoy && r.endDate >= desde).map(fila).sort(orden);
  const prestadas = d.reservas.filter((r) => r.status === 'Prestada').map(fila).sort(orden);
  const vuelven = prestadas.filter((f) => f.fin === dia);
  const prestados = prestadas.filter((f) => f.fin !== dia);
  const multas = d.multas.filter((m) => m.status === 'Pendiente').map((m) => ({
    socio: d.cuentas.find((c) => c.id === m.accountId)?.name ?? '', importe: m.amountEur, estado: m.status,
  }));
  return { hoy, fecha: dia, porEntregar, noRecogidas, vuelven, prestados, multas, ...(prestadas.length ? {} : { mensaje: EXITOS.sinPrestamos }) };
}
