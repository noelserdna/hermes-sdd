// Fábrica de la aplicación (D-PA-008): el plugin de Vite y los tests construyen los servicios con la misma función.
import path from 'node:path';
import { crearAlmacenJson } from './store/almacen-json.js';
import { crearReloj } from './dominio/fechas.js';
import { crearSesiones } from './servicios/sesiones.js';

// Límites de spec/VALUE-REGISTRY.md
export const CONFIG = { LOGIN_MAX_FAILURES: 5, LOGIN_LOCK_MINUTES: 15, SESSION_IDLE_MINUTES: 30, PASSWORD_MIN_LENGTH: 8, RETENTION_YEARS: 3 };

export function crearApp({ store, reloj, env = process.env, config = CONFIG } = {}) {
  const relojApp = reloj ?? crearReloj({ env });
  const almacen = store ?? crearAlmacenJson(path.resolve(env.MM_DATOS ?? 'data/datos.json'));
  return {
    store: almacen,
    reloj: relojApp,
    config,
    sesiones: crearSesiones({ reloj: relojApp, idleMinutes: config.SESSION_IDLE_MINUTES }),
    cookieSegura: env.MM_COOKIE_SECURE === '1',
  };
}
