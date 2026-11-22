import { error } from './errores.js';
import { puede } from './permisos.js';
import { nuevaCuenta, normalizarCorreo, hashContrasena, verificarContrasena } from './acceso.js';
import { PASSWORD_MIN_LENGTH } from './config.js';

// UC-002 Gestionar socios (API-001-03..06). Solo el encargado y solo sobre cuentas con rol socio: ninguna operación crea ni
// cambia cuentas de encargado o junta (D-PA-003, las prepara quien instala la web).
const exigirRol = (actor, operacion) => { if (!puede(actor?.rol, operacion)) throw error('E_SIN_PERMISO'); };
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fila = (c) => ({ id: c.id, nombre: c.nombre, correo: c.correo, estado: c.estado });

// API-001-06 listarSocios. Sin `detalle` es el selector de Historial (RN-023): id, nombre y estado, para el encargado y la
// junta. Con `detalle` es la lista de Socios (SCR-006), solo del encargado: añade el correo. Nunca devuelve el hash.
export async function listarSocios({ almacen }, actor, { detalle = false } = {}) {
  exigirRol(actor, detalle ? 'crearSocio' : 'listarSocios');
  const db = await almacen.load();
  return db.cuentas.filter((c) => c.rol === 'socio').map((c) => (detalle ? fila(c) : { id: c.id, nombre: c.nombre, estado: c.estado }));
}

// API-001-03 crearSocio. Orden: rol > datos (RN-021) > contraseña (INV-ACC-002) > correo único (INV-ACC-001, RN-014). Comprobar el
// correo y crear la cuenta es una sola transacción: de dos altas simultáneas con el mismo correo gana una (AC-002-09).
export async function crearSocio({ almacen }, actor, { nombre, correo, contrasena } = {}) {
  exigirRol(actor, 'crearSocio');
  const limpio = typeof nombre === 'string' ? nombre.trim() : '';
  const normalizado = typeof correo === 'string' ? normalizarCorreo(correo) : '';
  if (!limpio || !CORREO.test(normalizado)) throw error('E_DATOS_SOCIO_INVALIDOS');
  if (typeof contrasena !== 'string' || contrasena.length < PASSWORD_MIN_LENGTH) throw error('E_CONTRASENA_CORTA');
  return almacen.transaction((db) => {
    if (db.cuentas.some((c) => c.correo === normalizado)) throw error('E_CORREO_DUPLICADO');
    return fila(nuevaCuenta(db, { nombre: limpio, correo: normalizado, contrasena, rol: 'socio' }));
  });
}

// D-PA-004: quien deja de ser Activo pierde sus sesiones en la misma transacción; no hace falta esperar a su siguiente petición.
export function revocarDeCuenta(db, cuentaId) {
  db.sesiones = db.sesiones.filter((s) => s.cuentaId !== cuentaId);
}

const socioPorId = (db, cuentaId) => {
  const cuenta = db.cuentas.find((c) => c.id === cuentaId && c.rol === 'socio'); // D-PA-003: nunca encargado ni junta
  if (!cuenta) throw error('E_SOCIO_NO_ENCONTRADO');
  return cuenta;
};

// API-001-04 darDeBajaSocio. Orden: rol > el socio existe > bloqueo (INV-ACC-007, RN-010: préstamo Prestado o multa Pendiente).
// Repetirla sobre una cuenta ya en Baja no cambia nada. La baja y el corte de sesión son una sola transacción (INV-ACC-006).
export async function darDeBajaSocio({ almacen }, actor, { cuentaId } = {}) {
  exigirRol(actor, 'darDeBajaSocio');
  return almacen.transaction((db) => {
    const cuenta = socioPorId(db, cuentaId);
    if (cuenta.estado === 'Baja') return fila(cuenta);
    const bloqueada = db.reservas.some((r) => r.socioId === cuenta.id && r.estado === 'Prestada')
      || db.multas.some((m) => m.socioId === cuenta.id && m.estado === 'Pendiente');
    if (bloqueada) throw error('E_BAJA_SOCIO_BLOQUEADA');
    cuenta.estado = 'Baja';
    revocarDeCuenta(db, cuenta.id);
    return fila(cuenta);
  });
}

// API-001-05 restablecerContrasena. Orden: rol > contraseña (INV-ACC-002, igual que el alta) > el socio existe. Sustituye el hash
// y la anterior deja de valer (INV-ACC-103); si la contraseña ya es la vigente no se toca nada. Nunca la devuelve ni la registra.
export async function restablecerContrasena({ almacen }, actor, { cuentaId, contrasena } = {}) {
  exigirRol(actor, 'restablecerContrasena');
  if (typeof contrasena !== 'string' || contrasena.length < PASSWORD_MIN_LENGTH) throw error('E_CONTRASENA_CORTA');
  return almacen.transaction(async (db) => {
    const cuenta = socioPorId(db, cuentaId);
    if (cuenta.estado === 'Baja') throw error('E_SOCIO_NO_ENCONTRADO'); // Q-spec-auditor-001: no se restablece una cuenta en Baja
    if (!(await verificarContrasena(contrasena, cuenta.hashContrasena))) cuenta.hashContrasena = hashContrasena(contrasena);
    // REQ-F-002 AC6: quien la olvidó suele tener la cuenta bloqueada por errores; la nueva contraseña la desbloquea en el acto.
    cuenta.fallosSeguidos = 0;
    cuenta.bloqueadaHasta = null;
    return fila(cuenta);
  });
}
