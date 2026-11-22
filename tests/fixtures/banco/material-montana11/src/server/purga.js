// Purga por retención (SPEC-LIM-003, RN-010, D-PA-010): al arrancar, una sola escritura (INV-SEC-003) borra las cuentas de
// socio y los préstamos y multas cuya última actividad es anterior a RETENTION_YEARS años. Un socio en Baja conserva su
// historial mientras haya actividad dentro del plazo.
import { RETENTION_YEARS } from '../domain/constantes.js';

/** Fecha límite: `hoy` menos RETENTION_YEARS años. Lo anterior a ella supera la retención; lo de ese día, no. */
function limite(hoy) {
  const d = new Date(`${hoy}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - RETENTION_YEARS);
  return d.toISOString().slice(0, 10);
}

const masReciente = (fechas) => fechas.filter(Boolean).map((f) => String(f).slice(0, 10)).sort().at(-1);
const actividadReserva = (r) => masReciente([r.fin, r.entregadaEl, r.devueltaEl, r.canceladaEl]);
const actividadMulta = (m) => masReciente([m.creadaEl, m.pagadaEl]);

/**
 * Devuelve cuántas cuentas, reservas y multas borró. Una cuenta de socio sin ninguna actividad fechada se conserva
 * (no hay de qué fecharla); las del encargado y la junta nunca se purgan.
 */
export function purgar(store, hoy) {
  const corte = limite(hoy);
  return store.transaccion((db) => {
    const actividad = new Map();   // cuentaId → fecha de su última actividad
    const anotar = (cuentaId, fecha) => { if (fecha && (!actividad.has(cuentaId) || fecha > actividad.get(cuentaId))) actividad.set(cuentaId, fecha); };
    for (const r of db.reservas) anotar(r.socioId, actividadReserva(r));
    for (const m of db.multas) anotar(m.socioId, actividadMulta(m));
    for (const s of db.sesiones) anotar(s.cuentaId, masReciente([s.ultimaActividad]));

    const caducas = new Set(db.cuentas.filter((c) => c.rol === 'socio' && actividad.has(c.id) && actividad.get(c.id) < corte).map((c) => c.id));
    const resumen = { cuentas: caducas.size, reservas: 0, multas: 0 };
    const reservas = db.reservas.filter((r) => !caducas.has(r.socioId) && (actividadReserva(r) ?? corte) >= corte);
    const multas = db.multas.filter((m) => !caducas.has(m.socioId) && (actividadMulta(m) ?? corte) >= corte);
    resumen.reservas = db.reservas.length - reservas.length;
    resumen.multas = db.multas.length - multas.length;
    db.reservas = reservas;
    db.multas = multas;
    db.sesiones = db.sesiones.filter((s) => !caducas.has(s.cuentaId));
    db.cuentas = db.cuentas.filter((c) => !caducas.has(c.id));
    return resumen;
  });
}
