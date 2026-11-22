// Operaciones de cuentas y sesión (API-001-01..05). Cada operación es una transacción del almacén (INV-SEC-003).
import { ErrorDominio } from './errores.js';
import { LOGIN_MAX_FAILURES, LOCK_MINUTES } from './constantes.js';
import { exigirTexto, normalizarCorreo, validarNombre, validarCorreo, validarContrasena } from './validacion.js';
import { verificarContrasena, hashContrasena, HASH_FICTICIO } from '../server/hash.js';
import { siguienteId } from '../server/store.js';
import { nuevaSesion } from '../server/sesiones.js';
import { autorizar } from './permisos.js';

const MINUTO = 60 * 1000;

/**
 * API-001-01. Un fallo se guarda aunque la operación acabe en error, así que la transacción devuelve el código
 * y el error se lanza después de volcar.
 */
export function iniciarSesion(ctx, { correo, contrasena } = {}) {
  exigirTexto(correo);
  exigirTexto(contrasena);
  const resultado = ctx.store.transaccion((db) => {
    const ahora = ctx.reloj.ahora();
    const cuenta = db.cuentas.find((c) => c.correo === normalizarCorreo(correo));
    if (!cuenta) {
      verificarContrasena(contrasena, HASH_FICTICIO);
      return { error: 'E_CREDENCIALES_INVALIDAS' };
    }
    if (cuenta.bloqueadaHasta) {
      if (ahora < Date.parse(cuenta.bloqueadaHasta)) return { error: 'E_CUENTA_BLOQUEADA' };
      cuenta.bloqueadaHasta = null;
      cuenta.fallosSeguidos = 0;
    }
    const valida = verificarContrasena(contrasena, cuenta.hashContrasena);
    if (!valida || cuenta.estado !== 'Activa') {
      if (cuenta.estado !== 'Activa') return { error: 'E_CREDENCIALES_INVALIDAS' };
      cuenta.fallosSeguidos += 1;
      if (cuenta.fallosSeguidos >= LOGIN_MAX_FAILURES) {
        cuenta.bloqueadaHasta = new Date(ahora + LOCK_MINUTES * MINUTO).toISOString();
        return { error: 'E_CUENTA_BLOQUEADA' };
      }
      return { error: 'E_CREDENCIALES_INVALIDAS' };
    }
    cuenta.fallosSeguidos = 0;
    cuenta.bloqueadaHasta = null;
    const sesion = nuevaSesion(db, cuenta.id, ahora);
    return { datos: { nombre: cuenta.nombre, rol: cuenta.rol, sid: sesion.id } };
  });
  if (resultado.error) throw new ErrorDominio(resultado.error);
  return resultado.datos;
}

function restaurar(db, instantanea) {
  for (const clave of Object.keys(db)) delete db[clave];
  Object.assign(db, instantanea);
}

/**
 * Ejecuta una operación con sesión en una transacción: sesión → rol (autorizar) → resto (D-T-006). Una sesión
 * válida renueva su actividad aunque la operación acabe en error de dominio; los demás cambios se deshacen.
 * `fn(db, cuenta, sesion)` valida y escribe.
 */
export function operar(ctx, operacion, fn) {
  const resultado = ctx.store.transaccion((db) => {
    let acceso;
    try {
      acceso = autorizar(ctx, db, operacion);
    } catch (e) {
      if (e.conservarCambios) return { error: e.codigo };
      throw e;
    }
    const instantanea = structuredClone(db);
    try {
      return { datos: fn(db, acceso?.cuenta, acceso?.sesion) };
    } catch (e) {
      if (!(e instanceof ErrorDominio)) throw e;
      restaurar(db, instantanea);
      return { error: e.codigo };
    }
  });
  if (resultado.error) throw new ErrorDominio(resultado.error);
  return resultado.datos;
}

/** API-001-02: invalida la sesión (todos los roles). */
export function cerrarSesion(ctx) {
  return operar(ctx, 'cerrarSesion', (db, _cuenta, sesion) => {
    db.sesiones = db.sesiones.filter((s) => s.id !== sesion.id);
    return {};
  });
}

/** API-001-03: si la sesión vale renueva la actividad y devuelve la cuenta y el rol. */
export function comprobarSesion(ctx) {
  return operar(ctx, 'comprobarSesion', (_db, cuenta) => ({ nombre: cuenta.nombre, correo: cuenta.correo, rol: cuenta.rol }));
}

const vistaSocio = (c) => ({ id: c.id, nombre: c.nombre, correo: c.correo, estado: c.estado });

/** API-001-04: alta de socio Activa con la contraseña solo como hash (INV-ACC-001..003). */
export function crearSocio(ctx, { nombre, correo, contrasena } = {}) {
  return operar(ctx, 'crearSocio', (db) => {
    const datos = { nombre: validarNombre(nombre), correo: validarCorreo(correo) };
    validarContrasena(contrasena);
    if (db.cuentas.some((c) => c.correo === datos.correo)) throw new ErrorDominio('E_CORREO_DUPLICADO');
    const cuenta = {
      id: siguienteId(db, 'cuentas'), ...datos, rol: 'socio', hashContrasena: hashContrasena(contrasena),
      estado: 'Activa', fallosSeguidos: 0, bloqueadaHasta: null,
    };
    db.cuentas.push(cuenta);
    return vistaSocio(cuenta);
  });
}

/** API-001-05: nombre, correo y estado de cada socio (también los de Baja); nunca el hash (INV-SEC-001). */
export function listarSocios(ctx) {
  return operar(ctx, 'listarSocios', (db) => db.cuentas.filter((c) => c.rol === 'socio').map(vistaSocio));
}

function socioDe(db, socioId) {
  if (!Number.isInteger(socioId)) throw new ErrorDominio('E_DATOS_INVALIDOS');
  const socio = db.cuentas.find((c) => c.id === socioId && c.rol === 'socio');
  if (!socio) throw new ErrorDominio('E_SOCIO_NO_ENCONTRADO');
  return socio;
}

/** INV-ACC-008: las sesiones abiertas de la cuenta dejan de valer (RN-013). */
export const cerrarSesionesDe = (db, cuentaId) => { db.sesiones = db.sesiones.filter((s) => s.cuentaId !== cuentaId); };

/**
 * API-001-06: fija el hash de la contraseña nueva de un socio Activa y cierra sus sesiones (INV-ACC-002, INV-ACC-008).
 * Una cuenta en Baja es como una que no existe (INV-ACC-009). Repetirla es idempotente. No se guarda ninguna marca
 * de "cambiar al entrar" (D-PA-005).
 */
export function restablecerContrasena(ctx, { socioId, contrasena } = {}) {
  return operar(ctx, 'restablecerContrasena', (db) => {
    validarContrasena(contrasena);
    const socio = socioDe(db, socioId);
    if (socio.estado === 'Baja') throw new ErrorDominio('E_SOCIO_NO_ENCONTRADO');
    socio.hashContrasena = hashContrasena(contrasena);
    cerrarSesionesDe(db, socio.id);
    return {};
  });
}

/**
 * API-001-07: pone la cuenta en Baja y cancela sus reservas Reservada en la misma escritura (INV-LOA-004, ADR-005).
 * Con una reserva Entregado sin devolver no cambia nada. Repetirla no cambia nada. Conserva el historial (RN-007).
 * Las reservas se cancelan aquí, sin pasar por reservas.js, que solo cancela las propias del socio.
 */
export function darDeBajaSocio(ctx, { socioId } = {}) {
  return operar(ctx, 'darDeBajaSocio', (db) => {
    const socio = socioDe(db, socioId);
    if (socio.estado === 'Baja') return vistaSocio(socio);
    if (db.reservas.some((r) => r.socioId === socio.id && r.estado === 'Entregado')) throw new ErrorDominio('E_SOCIO_CON_MATERIAL');
    const hoy = ctx.reloj.hoy();
    for (const r of db.reservas) {
      if (r.socioId === socio.id && r.estado === 'Reservada') { r.estado = 'Cancelada'; r.canceladaEl = hoy; }
    }
    socio.estado = 'Baja';
    cerrarSesionesDe(db, socio.id);
    return vistaSocio(socio);
  });
}
