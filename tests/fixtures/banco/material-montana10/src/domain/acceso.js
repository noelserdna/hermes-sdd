import { randomBytes, scrypt, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { error } from './errores.js';
import { LOGIN_MAX_FAILURES, LOGIN_LOCK_MINUTES, SESSION_IDLE_HOURS } from './config.js';

// UC-001 Entrar y salir (API-001-01, API-001-02). Casos de uso con almacén y reloj inyectados (ADR-001, ADR-002).
const LARGO_CLAVE = 64;
const HORA_MS = 3_600_000;

export const normalizarCorreo = (correo) => String(correo ?? '').trim().toLowerCase();

// INV-ACC-003: solo hash scrypt con sal por cuenta: «scrypt$<sal>$<hash>».
export function hashContrasena(contrasena) {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString('hex')}$${scryptSync(String(contrasena), sal, LARGO_CLAVE).toString('hex')}`;
}

export function verificarContrasena(contrasena, almacenado) {
  const [esquema, sal, hash] = String(almacenado).split('$');
  if (esquema !== 'scrypt' || !sal || !hash) return Promise.resolve(false);
  return new Promise((resolver) => {
    scrypt(String(contrasena), Buffer.from(sal, 'hex'), LARGO_CLAVE, (fallo, derivada) => {
      const esperado = Buffer.from(hash, 'hex');
      resolver(!fallo && derivada.length === esperado.length && timingSafeEqual(derivada, esperado));
    });
  });
}

// El identificador de sesión (cookie) no se guarda: el almacén solo tiene su huella.
export const idDeSesion = (sid) => createHash('sha256').update(String(sid)).digest('hex');

const siguienteId = (coleccion) => coleccion.reduce((max, x) => Math.max(max, x.id), 0) + 1;

// Alta de una cuenta en el almacén abierto (la usan `npm run cuentas`, la semilla de pruebas y, en FASE-3, los socios).
export function nuevaCuenta(db, { nombre, correo, contrasena, rol, estado = 'Activa' }) {
  const cuenta = {
    id: siguienteId(db.cuentas), nombre, correo: normalizarCorreo(correo), hashContrasena: hashContrasena(contrasena), rol,
    estado, fallosSeguidos: 0, bloqueadaHasta: null,
  };
  db.cuentas.push(cuenta);
  return cuenta;
}

let hashFalso;

// INV-ACC-101: el mismo envío (misma cuenta y misma contraseña) que llega dos veces a la vez se atiende una sola vez y las dos
// respuestas llevan el mismo identificador; así la cookie que quede en el navegador, llegue la respuesta que llegue la última, abre la sesión única.
const enCurso = new WeakMap();

export function iniciarSesion(contexto, datos = {}) {
  const { correo, contrasena } = datos ?? {};
  if (typeof correo !== 'string' || typeof contrasena !== 'string') return iniciarSesionUnica(contexto, datos);
  const pendientes = enCurso.get(contexto.almacen) ?? enCurso.set(contexto.almacen, new Map()).get(contexto.almacen);
  const clave = JSON.stringify([normalizarCorreo(correo), contrasena]);
  if (!pendientes.has(clave)) {
    const trabajo = iniciarSesionUnica(contexto, datos).finally(() => pendientes.delete(clave));
    pendientes.set(clave, trabajo);
  }
  return pendientes.get(clave);
}

async function iniciarSesionUnica({ almacen, reloj }, { correo, contrasena } = {}) {
  const texto = typeof contrasena === 'string' ? contrasena : '';
  const buscado = typeof correo === 'string' ? normalizarCorreo(correo) : '';
  // Se comprueba la contraseña también con cuentas inexistentes para no delatar por el tiempo (INV-ACC-006).
  const candidato = (await almacen.load()).cuentas.find((c) => c.correo === buscado && c.estado === 'Activa');
  hashFalso ??= hashContrasena('sin-cuenta');
  const acierta = await verificarContrasena(texto, candidato?.hashContrasena ?? hashFalso);

  const resultado = await almacen.transaction((db) => {
    const ahora = reloj.ahora();
    const cuenta = db.cuentas.find((c) => c.id === candidato?.id && c.estado === 'Activa');
    if (!cuenta) return { codigo: 'E_CREDENCIALES_INVALIDAS' };
    if (cuenta.bloqueadaHasta && Date.parse(cuenta.bloqueadaHasta) > ahora.getTime()) return { codigo: 'E_CUENTA_BLOQUEADA' };
    // CH-006: la contraseña se comprobó contra el hash leído antes; si un restablecimiento lo cambió entretanto, ese acierto ya no vale.
    if (!acierta || cuenta.hashContrasena !== candidato.hashContrasena) {
      cuenta.fallosSeguidos += 1;
      if (cuenta.fallosSeguidos >= LOGIN_MAX_FAILURES) cuenta.bloqueadaHasta = new Date(ahora.getTime() + LOGIN_LOCK_MINUTES * 60_000).toISOString();
      return { codigo: 'E_CREDENCIALES_INVALIDAS' };
    }
    cuenta.fallosSeguidos = 0;
    cuenta.bloqueadaHasta = null;
    // INV-ACC-101: una sola sesión viva por cuenta; de paso se retiran las caducadas.
    db.sesiones = db.sesiones.filter((s) => s.cuentaId !== cuenta.id && ahora.getTime() - Date.parse(s.ultimaActividad) < SESSION_IDLE_HOURS * HORA_MS);
    const sid = randomBytes(32).toString('hex');
    db.sesiones.push({ id: idDeSesion(sid), cuentaId: cuenta.id, ultimaActividad: ahora.toISOString() });
    return { sid, nombre: cuenta.nombre, rol: cuenta.rol };
  });
  if (resultado.codigo) throw error(resultado.codigo);
  return resultado;
}

// Devuelve el actor de la sesión (INV-ACC-008, INV-ACC-005); la cuenta se vuelve a leer en cada petición (D-PA-004).
export async function validarSesion({ almacen, reloj }, sid) {
  if (typeof sid !== 'string' || !sid) throw error('E_NO_AUTENTICADO');
  const resultado = await almacen.transaction((db) => {
    const id = idDeSesion(sid);
    const sesion = db.sesiones.find((s) => s.id === id);
    if (!sesion) return { codigo: 'E_NO_AUTENTICADO' };
    const ahora = reloj.ahora();
    const cuenta = db.cuentas.find((c) => c.id === sesion.cuentaId);
    if (!cuenta || cuenta.estado !== 'Activa') {
      db.sesiones = db.sesiones.filter((s) => s.cuentaId !== sesion.cuentaId);
      return { codigo: 'E_NO_AUTENTICADO' };
    }
    if (ahora.getTime() - Date.parse(sesion.ultimaActividad) >= SESSION_IDLE_HOURS * HORA_MS) {
      db.sesiones = db.sesiones.filter((s) => s.id !== id);
      return { codigo: 'E_SESION_CADUCADA' };
    }
    sesion.ultimaActividad = ahora.toISOString();
    return { actor: { id: cuenta.id, nombre: cuenta.nombre, rol: cuenta.rol } };
  });
  if (resultado.codigo) throw error(resultado.codigo);
  return resultado.actor;
}

// INV-ACC-102: Salir invalida la sesión en el servidor.
export async function cerrarSesion({ almacen }, sid) {
  const cerrada = typeof sid === 'string' && sid
    ? await almacen.transaction((db) => {
      const id = idDeSesion(sid);
      const habia = db.sesiones.some((s) => s.id === id);
      db.sesiones = db.sesiones.filter((s) => s.id !== id);
      return habia;
    })
    : false;
  if (!cerrada) throw error('E_NO_AUTENTICADO');
}
