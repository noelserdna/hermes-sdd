// UC-019 depurar historial antiguo; API-002-07. Tarea interna, sin usuario: borra los registros cerrados anteriores a hoy − RETENTION_YEARS
// (INV-RES-011, RN-021) y nunca los vivos ni las deudas (RN-033). `hoy` llega por parámetro (D-PA-013) para probar cualquier fecha.
import { restarAnios } from '../dominio/fechas.js';

const CERRADAS = ['Devuelta', 'Cancelada'];
// «No recogida» no se guarda (INV-RES-008): es una Reservada cuyo fin ya pasó, y todo lo anterior al límite ya ha pasado
const cerrada = (r) => CERRADAS.includes(r.status) || r.status === 'Reservada';

/** Lo que borraría hoy: reservas y préstamos cerrados con `endDate` anterior al límite, y multas Pagadas con creación anterior (anterior estricto, AC-019-02). */
function sobrantes(d, limite) {
  return {
    reservas: d.reservas.filter((r) => cerrada(r) && r.endDate < limite),
    multas: d.multas.filter((m) => m.status === 'Pagada' && m.createdOn < limite),
  };
}

/**
 * API-002-07. Una sola transacción (o se borra todo o nada) e idempotente. Antes de borrar guarda `datos.json.bak`; sin nada que borrar no
 * escribe el almacén ni toca la copia anterior. Devuelve los recuentos de lo borrado.
 */
export async function purgeOldRecords(ctx, { hoy }) {
  const limite = restarAnios(hoy, ctx.config.RETENTION_YEARS);
  const previo = sobrantes(await ctx.store.leer(), limite);
  if (!previo.reservas.length && !previo.multas.length) return { deletedReservations: 0, deletedFines: 0 };
  return ctx.store.transaccion(async (d) => {
    const { reservas, multas } = sobrantes(d, limite);
    if (!reservas.length && !multas.length) return { deletedReservations: 0, deletedFines: 0 };
    await ctx.store.respaldar?.();
    d.reservas = d.reservas.filter((r) => !reservas.includes(r));
    d.multas = d.multas.filter((m) => !multas.includes(m));
    return { deletedReservations: reservas.length, deletedFines: multas.length };
  });
}

// D-PA-003: lo que queda de una cuenta borrada es un marcador por id, sin ningún dato personal; el correo original queda libre (ADR-003).
const marcador = (c) => ({ name: `Socio ${c.id}`, email: `${c.id}@borrado.invalid` });
const porBorrar = (d, limite) => d.cuentas.filter((c) => c.active === false && c.bajaEn && c.bajaEn <= limite
  && (c.name !== marcador(c).name || c.email !== marcador(c).email));

/**
 * D-PA-003, INV-SOC-009: a los 3 años de la baja (`bajaEn` ≤ hoy − RETENTION_YEARS) se vacían el nombre y el correo de la cuenta. Idempotente:
 * una cuenta ya borrada no cuenta otra vez. El historial del socio no se toca aquí: sigue su propia retención (`purgeOldRecords`).
 */
export async function eraseRemovedMembers(ctx, { hoy }) {
  const limite = restarAnios(hoy, ctx.config.RETENTION_YEARS);
  if (!porBorrar(await ctx.store.leer(), limite).length) return { erasedAccounts: 0 };
  return ctx.store.transaccion(async (d) => {
    const cuentas = porBorrar(d, limite);
    if (!cuentas.length) return { erasedAccounts: 0 };
    await ctx.store.respaldar?.();
    for (const c of cuentas) Object.assign(c, marcador(c));
    return { erasedAccounts: cuentas.length };
  });
}

/** Lo que el plugin lanza al arrancar y cada 24 h: los registros antiguos y los datos personales de las bajas, con el mismo día. */
export async function runPurge(ctx, { hoy }) {
  return { ...(await purgeOldRecords(ctx, { hoy })), ...(await eraseRemovedMembers(ctx, { hoy })) };
}
