import { resolverNoRecogidas, purgarRegistrosAntiguos } from '../domain/tareas.js';
import { ZONA_HORARIA } from '../domain/config.js';

// Envoltorio del temporizador (ADR-001, D-PA-008): lanza las tareas del sistema al arrancar y cada día a las 00:05
// (hora de ZONA_HORARIA). La lógica está en src/domain/tareas.js; este fichero no tiene más que el reloj de pared.
const hora = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA_HORARIA, hour: '2-digit', minute: '2-digit', hour12: false });

export async function ejecutarTareasDiarias({ almacen, reloj }) {
  // La respuesta sigue siendo la de API-003-07 (contadores de no recogidas); la purga (API-003-08) va después, sin cambiarla.
  const resultado = await resolverNoRecogidas({ almacen, reloj });
  await purgarRegistrosAntiguos({ almacen, reloj });
  return resultado;
}

export function programarTareasDiarias({ almacen, reloj, registrar = () => {}, ahora = () => new Date() }) {
  const lanzar = () => ejecutarTareasDiarias({ almacen, reloj }).catch(() => registrar('tareas diarias: no se pudieron ejecutar'));
  lanzar();
  let ultimoMinuto = null;
  const temporizador = setInterval(() => {
    const instante = ahora();
    const minuto = `${instante.toISOString().slice(0, 10)} ${hora.format(instante)}`;
    if (hora.format(instante) === '00:05' && minuto !== ultimoMinuto) { ultimoMinuto = minuto; lanzar(); }
  }, 30_000);
  temporizador.unref?.();
  return () => clearInterval(temporizador);
}
