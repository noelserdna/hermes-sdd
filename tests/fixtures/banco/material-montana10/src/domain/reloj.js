import { ZONA_HORARIA } from './config.js';

// ADR-001: «hoy» es el día natural de ZONA_HORARIA y el reloj se inyecta; nadie más lee la hora del sistema.
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' });

export const diaDe = (instante) => formatoDia.format(instante);

function instanteFijo(valor) {
  // «2026-12-01» fija el día (a mediodía en Madrid, sin riesgo de cambio de día); con hora fija el instante.
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return new Date(`${valor}T11:00:00Z`);
  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) throw new Error(`CLOCK_FIXED no es una fecha válida: ${valor}`);
  return instante;
}

export function crearReloj({ env = process.env, ahora = () => new Date() } = {}) {
  const fijo = env.CLOCK_FIXED ? instanteFijo(env.CLOCK_FIXED) : null;
  const instante = () => (fijo ? new Date(fijo.getTime()) : ahora());
  return { ahora: instante, hoy: () => diaDe(instante()) };
}
