// Reloj inyectable y fechas ISO (RN-022). «Hoy» es el día de Madrid del reloj, nunca del ordenador del usuario.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ZONA = 'Europe/Madrid';
const formato = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });

export const diaEnMadrid = (fecha) => formato.format(fecha);

export function sumarDias(dia, n) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** `dia` menos `n` años; un 29 de febrero cae en el 28 de febrero si ese año no es bisiesto (RN-022). */
export function restarAnios(dia, n) {
  const [a, m, d] = dia.split('-').map(Number);
  const anio = a - n;
  const ultimo = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  return `${String(anio).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

/** Todos los días de inicio a fin, ambos incluidos; vacío si fin < inicio. */
export function diasEntre(inicio, fin) {
  const dias = [];
  for (let d = inicio; d <= fin; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

/**
 * Reloj de producción o de desarrollo. MM_HOY (fija el día) y MM_RELOJ (fichero con una fecha y hora, para los e2e)
 * se ignoran con NODE_ENV=production. MM_HOY_FICHERO (solo desarrollo) apunta a un fichero con un día AAAA-MM-DD que fija «hoy»
 * mientras exista, para que un e2e viva el día de su GIVEN sin reiniciar el servidor; manda sobre MM_HOY.
 */
export function crearReloj({ env = process.env, ahora = () => new Date() } = {}) {
  const produccion = env.NODE_ENV === 'production';
  const diaDeFichero = () => {
    const ruta = env.MM_HOY_FICHERO || (env.MM_RELOJ && path.join(path.dirname(env.MM_RELOJ), 'hoy.txt'));
    if (!ruta) return null;
    try { const dia = readFileSync(ruta, 'utf8').trim(); return esDia(dia) ? dia : null; } catch { return null; }
  };
  const leerAhora = () => {
    if (!produccion && env.MM_RELOJ) {
      try { return new Date(readFileSync(env.MM_RELOJ, 'utf8').trim()); } catch { /* sin fichero: reloj real */ }
    }
    return ahora();
  };
  return {
    ahora: leerAhora,
    hoy: () => (!produccion && (diaDeFichero() ?? env.MM_HOY)) || diaEnMadrid(leerAhora()),
  };
}

/** Reloj de tests: empieza en un instante y avanza a mano. */
export function crearRelojManual(inicio) {
  let t = new Date(inicio).getTime();
  return {
    ahora: () => new Date(t),
    hoy: () => diaEnMadrid(new Date(t)),
    avanzar: (minutos) => { t += minutos * 60000; },
    avanzarSegundos: (s) => { t += s * 1000; },
  };
}

/** ¿Es un día ISO real (YYYY-MM-DD, calendario válido)? */
export function esDia(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}
