// ADR-001: la disponibilidad de un día se calcula desde las reservas; nunca se guarda un contador (INV-RES-004, INV-RES-005).
import { diasEntre } from './fechas.js';

/** Unidades de un tipo ocupadas un día: Reservada y Prestada; la Prestada vencida ocupa hasta hoy (INV-RES-005). */
export function ocupadasEn(reservas, itemId, dia, hoy) {
  let ocupadas = 0;
  for (const r of reservas) {
    if (r.itemId !== itemId) continue;
    if (r.status !== 'Reservada' && r.status !== 'Prestada') continue;
    const fin = r.status === 'Prestada' && r.endDate < hoy ? hoy : r.endDate;
    if (dia >= r.startDate && dia <= fin) ocupadas += r.quantity;
  }
  return ocupadas;
}

export const libresEn = (reservas, tipo, dia, hoy) => tipo.totalUnits - ocupadasEn(reservas, tipo.id, dia, hoy);

/**
 * INV-MAT-002: retirar n unidades solo si cada día desde hoy `total − n ≥ ocupadas`.
 * Devuelve el primer día que no queda cubierto, con las unidades que ese día hacen falta, o null si la baja cabe.
 */
export function primerDiaSinCobertura(reservas, tipo, n, hoy) {
  const ultimo = reservas.filter((r) => r.itemId === tipo.id).reduce((max, r) => (r.endDate > max ? r.endDate : max), hoy);
  for (const dia of diasEntre(hoy, ultimo)) {
    const necesarias = ocupadasEn(reservas, tipo.id, dia, hoy);
    if (tipo.totalUnits - n < necesarias) return { dia, necesarias };
  }
  return null;
}
