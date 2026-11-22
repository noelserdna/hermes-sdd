// UC-018 consultar historial de un socio; API-001-07. Solo lee (INV-SEC-002): la junta busca por nombre o correo y ve los préstamos y las
// multas del socio. La respuesta lleva nombre, correo y su historial y nada más: nunca el hash (INV-SOC-009).
import { EXITOS, error } from '../mensajes.js';

/** Minúsculas y sin tildes: «lucia» encuentra a «Lucía» (RN-019). */
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

function historialDe(d, cuenta) {
  const nombre = (id) => d.material.find((m) => m.id === id)?.name ?? '';
  // un préstamo es una reserva que se entregó: Prestada, o Devuelta con su fecha
  const prestamos = d.reservas
    .filter((r) => r.accountId === cuenta.id && (r.status === 'Prestada' || r.status === 'Devuelta'))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))
    .map((r) => ({ cantidad: r.quantity, material: nombre(r.itemId), inicio: r.startDate, fin: r.endDate, devueltoEl: r.returnedOn ?? null }));
  const multas = d.multas
    .filter((m) => m.accountId === cuenta.id)
    .sort((a, b) => a.createdOn.localeCompare(b.createdOn) || a.id.localeCompare(b.id))
    .map((m) => ({ importe: m.amountEur, estado: m.status }));
  return {
    socio: { id: cuenta.id, nombre: cuenta.name, correo: cuenta.email },
    prestamos,
    multas,
    ...(prestamos.length || multas.length ? {} : { mensaje: EXITOS.sinHistorial }),
  };
}

/**
 * API-001-07. Con `id` devuelve el historial de ese socio; con `q` busca por nombre o correo (parcial, sin mayúsculas ni tildes): un solo
 * resultado trae ya su historial y varios traen solo la lista para elegir (AC-018-05). Nada que mostrar → E_BUSQUEDA_VACIA.
 */
export async function getMemberHistory(ctx, { q, id } = {}) {
  const d = await ctx.store.leer();
  const socios = d.cuentas.filter((c) => c.role === 'socio');
  const lista = (cuentas) => cuentas.map((c) => ({ id: c.id, nombre: c.name }));

  if (id !== undefined) {
    const cuenta = socios.find((c) => c.id === id);
    if (!cuenta) throw error('E_BUSQUEDA_VACIA');
    return { socios: lista([cuenta]), historial: historialDe(d, cuenta) };
  }
  const consulta = normalizar(q);
  if (!consulta) throw error('E_BUSQUEDA_VACIA');
  const hallados = socios
    .filter((c) => normalizar(c.name).includes(consulta) || normalizar(c.email).includes(consulta))
    .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
  if (!hallados.length) throw error('E_BUSQUEDA_VACIA');
  return hallados.length === 1 ? { socios: lista(hallados), historial: historialDe(d, hallados[0]) } : { socios: lista(hallados) };
}
