// INV-ACC-007: cada operación exige su rol (PERMISSIONS-MATRIX). El orden de los errores es sesión → rol → validación
// (D-T-006). Cada FASE añade las operaciones suyas.
import { ErrorDominio } from './errores.js';
import { SESSION_IDLE_MINUTES } from './constantes.js';

const TODOS = ['socio', 'encargado', 'junta'];

export const OPERACIONES = {
  iniciarSesion: { publica: true },
  // Las operaciones de sesión quedan exentas de INV-SEC-002: la junta puede cerrar y mantener su sesión (D-PA-004).
  cerrarSesion: { roles: TODOS },
  comprobarSesion: { roles: TODOS },
  crearSocio: { roles: ['encargado'] },
  listarSocios: { roles: ['encargado'] },
};

// Operaciones de FASE-1 (reservas e inventario). Van en su propia tabla: tests/unit/permisos.test.js fija el conjunto
// exacto de OPERACIONES de FASE-0 y no se edita sin un registro test-edit (Q-task-implementer-001).
export const OPERACIONES_FASE_1 = {
  listarInventario: { roles: ['encargado'] },
  anadirMaterial: { roles: ['encargado'] },
  consultarDisponibilidad: { roles: ['socio'] },
  reservarMaterial: { roles: ['socio'] },
  listarMisReservas: { roles: ['socio'] },
  cancelarReserva: { roles: ['socio'] },
};

// Operaciones de FASE-2 (préstamos): solo el encargado. aplicarNoRecogidas y aplicarMultaPorRetraso son del sistema:
// no tienen fila de rol ni ruta (D-PA-003, Q-spec-auditor-001).
export const OPERACIONES_FASE_2 = {
  listarPrestamosYReservas: { roles: ['encargado'] },
  entregarReserva: { roles: ['encargado'] },
  registrarDevolucion: { roles: ['encargado'] },
};

// Operaciones de FASE-3 (multas): el socio ve las suyas; el encargado las lista y las marca pagadas.
export const OPERACIONES_FASE_3 = {
  listarMisMultas: { roles: ['socio'] },
  listarMultas: { roles: ['encargado'] },
  marcarMultaPagada: { roles: ['encargado'] },
};

// Operaciones de FASE-4 (bajas): solo el encargado.
export const OPERACIONES_FASE_4 = {
  restablecerContrasena: { roles: ['encargado'] },
  darDeBajaSocio: { roles: ['encargado'] },
  darDeBajaUnidad: { roles: ['encargado'] },
};

// Operaciones de FASE-5 (consultas, solo lectura): lo prestado es del encargado; el historial de un socio, de la junta
// (INV-SEC-002: la junta solo puede API-001-02, API-001-03 y API-003-10 y, para su selector, la lectura de socios).
export const OPERACIONES_FASE_5 = {
  consultarPrestado: { roles: ['encargado'] },
  consultarHistorialSocio: { roles: ['junta'] },
  listarSociosHistorial: { roles: ['junta'] },   // selector del Historial: lectura propia de la junta (Q-task-implementer-005)
};

// Operaciones del sistema (PERMISSIONS-MATRIX, Q-spec-auditor-001): las dispara solo el propio sistema dentro de otras
// escrituras; ninguna sesión de usuario tiene el rol 'sistema' y no hay ruta HTTP para ellas (D-PA-003).
export const OPERACIONES_SISTEMA = {
  aplicarNoRecogidas: { roles: ['sistema'] },
  aplicarMultaPorRetraso: { roles: ['sistema'] },
};

export const REGISTRO = {
  ...OPERACIONES, ...OPERACIONES_FASE_1, ...OPERACIONES_FASE_2, ...OPERACIONES_FASE_3, ...OPERACIONES_FASE_4, ...OPERACIONES_FASE_5, ...OPERACIONES_SISTEMA,
};

/**
 * Autoriza `operacion` para `ctx.sid` dentro de la transacción `db`. Devuelve null si es pública o
 * `{ sesion, cuenta }` y renueva la última actividad (INV-ACC-005). Lanza E_NO_AUTENTICADO sin sesión,
 * E_SESION_CADUCADA pasados SESSION_IDLE_MINUTES (y retira la sesión) y
 * E_ACCESO_NO_PERMITIDO con otro rol; estos dos llevan `conservarCambios` para que la transacción guarde la renovación o la retirada.
 */
export function autorizar(ctx, db, operacion) {
  const definicion = REGISTRO[operacion];
  if (definicion?.publica) return null;
  const sesion = db.sesiones.find((s) => s.id === ctx.sid);
  const cuenta = sesion && db.cuentas.find((c) => c.id === sesion.cuentaId);
  if (!sesion || !cuenta) throw new ErrorDominio('E_NO_AUTENTICADO');
  const ahora = ctx.reloj.ahora();
  if (ahora - Date.parse(sesion.ultimaActividad) > SESSION_IDLE_MINUTES * 60 * 1000) {
    db.sesiones = db.sesiones.filter((s) => s.id !== sesion.id);
    throw Object.assign(new ErrorDominio('E_SESION_CADUCADA'), { conservarCambios: true });
  }
  sesion.ultimaActividad = new Date(ahora).toISOString();
  if (!definicion?.roles?.includes(cuenta.rol)) throw Object.assign(new ErrorDominio('E_ACCESO_NO_PERMITIDO'), { conservarCambios: true });
  return { sesion, cuenta };
}
