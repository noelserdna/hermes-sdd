// Sesiones en memoria del servidor (ADR-DRAFT-003): id opaco, caducidad por inactividad (INV-SOC-005, D-PA-001).
import { randomBytes } from 'node:crypto';

export function crearSesiones({ reloj, idleMinutes = 30 }) {
  const abiertas = new Map();
  const limite = idleMinutes * 60000;

  const caducada = (s) => reloj.ahora().getTime() - s.ultimaActividad > limite;   // con exactamente el límite sigue viva

  return {
    abrir({ cuentaId, rol, nombre, debeCambiar = false }) {
      const id = randomBytes(32).toString('base64url');
      abiertas.set(id, { id, cuentaId, rol, nombre, debeCambiar, ultimaActividad: reloj.ahora().getTime() });
      return id;
    },
    /** La sesión viva o null. No renueva la actividad: eso lo hace `renovar`, solo cuando authorize autoriza. */
    obtener(id) {
      const s = id ? abiertas.get(id) : null;
      if (!s) return null;
      if (caducada(s)) { abiertas.delete(id); return null; }
      return { id: s.id, cuentaId: s.cuentaId, rol: s.rol, nombre: s.nombre, debeCambiar: s.debeCambiar, renovar: () => { s.ultimaActividad = reloj.ahora().getTime(); } };
    },
    cerrar: (id) => abiertas.delete(id),
    /** INV-SOC-006: marca (o desmarca) las sesiones vivas de la cuenta como «debe cambiar la contraseña». */
    marcarDeCuenta(cuentaId, debeCambiar) {
      for (const s of abiertas.values()) if (s.cuentaId === cuentaId) s.debeCambiar = debeCambiar;
    },
    cerrarDeCuenta(cuentaId) {
      for (const [id, s] of abiertas) if (s.cuentaId === cuentaId) abiertas.delete(id);
    },
  };
}
