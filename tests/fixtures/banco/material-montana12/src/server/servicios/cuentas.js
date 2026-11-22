// UC-001 entrar y UC-002 salir (API-001-01, API-001-02). Contraseñas solo con hash scrypt y sal (INV-SOC-003).
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { error, AVISOS, EXITOS, rellenar } from '../mensajes.js';

const N = 16384;
const LONGITUD = 64;

export function hashContrasena(contrasena) {
  const sal = randomBytes(16).toString('hex');
  const hash = scryptSync(contrasena, sal, LONGITUD, { N }).toString('hex');
  return `scrypt$${N}$${sal}$${hash}`;
}

export function verificarContrasena(contrasena, guardado) {
  const [, n, sal, hash] = String(guardado).split('$');
  if (!n || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'hex');
  const calculado = scryptSync(String(contrasena), sal, esperado.length, { N: Number(n) });
  return timingSafeEqual(calculado, esperado);
}

// Para que un correo desconocido o una cuenta de baja tarden lo mismo que una contraseña errónea (INV-SOC-008)
const HASH_FALSO = hashContrasena(randomBytes(8).toString('hex'));

export const PAGINA_CAMBIAR = '/cambiar-contrasena';
export const DESTINO = { socio: '/mis-reservas', encargado: '/panel', junta: '/historial' };

/**
 * API-001-01. Devuelve { sesionId, nombre, rol, destino } o lanza E_CREDENCIALES / E_CUENTA_BLOQUEADA.
 * Los fallos se guardan aunque la operación termine en error, por eso el resultado sale de la transacción y se lanza después.
 */
export async function login(ctx, { correo, contrasena }) {
  const email = String(correo ?? '').trim().toLowerCase();
  const { LOGIN_MAX_FAILURES, LOGIN_LOCK_MINUTES } = ctx.config;
  const ahora = ctx.reloj.ahora();

  const resultado = await ctx.store.transaccion((d) => {
    const cuenta = d.cuentas.find((c) => c.email === email);
    if (!cuenta || !cuenta.active) {
      verificarContrasena(contrasena, HASH_FALSO);
      return { codigo: 'E_CREDENCIALES' };
    }
    if (cuenta.lockedUntil && new Date(cuenta.lockedUntil) > ahora) return { codigo: 'E_CUENTA_BLOQUEADA' };
    if (!verificarContrasena(contrasena, cuenta.passwordHash)) {
      cuenta.failedLogins += 1;
      if (cuenta.failedLogins >= LOGIN_MAX_FAILURES) {
        cuenta.lockedUntil = new Date(ahora.getTime() + LOGIN_LOCK_MINUTES * 60000).toISOString();
        cuenta.failedLogins = 0;
      }
      return { codigo: 'E_CREDENCIALES' };
    }
    cuenta.failedLogins = 0;
    cuenta.lockedUntil = null;
    return { cuenta: { id: cuenta.id, name: cuenta.name, role: cuenta.role, debeCambiar: cuenta.mustChangePassword === true } };
  });
  if (resultado.codigo) throw error(resultado.codigo);

  const { id, name, role, debeCambiar } = resultado.cuenta;
  const sesionId = ctx.sesiones.abrir({ cuentaId: id, rol: role, nombre: name, debeCambiar });
  return { sesionId, nombre: name, rol: role, destino: debeCambiar ? PAGINA_CAMBIAR : DESTINO[role] };
}

/** API-001-02. Cerrar una sesión que ya no existe no es un error: avisa (ADR-005). */
export async function logout(ctx, sesionId) {
  if (sesionId && ctx.sesiones.cerrar(sesionId)) return {};
  return { aviso: { codigo: 'E_YA_SALIDO', mensaje: AVISOS.E_YA_SALIDO } };
}

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const largo = (t) => [...String(t ?? '')].length;
const estadoCuenta = (c) => (c.active ? 'Activo' : 'Baja');

/** API-003 de la página Socios: los socios con su estado, por nombre. Solo lee. */
export async function listMembers(ctx) {
  const d = await ctx.store.leer();
  const socios = d.cuentas.filter((c) => c.role === 'socio')
    .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id))
    .map((c) => ({ id: c.id, nombre: c.name, correo: c.email, estado: estadoCuenta(c) }));
  return { socios };
}

/**
 * API-001-04 (UC-003). Orden: datos válidos (RN-024), contraseña mínima (INV-SOC-002), correo no repetido ni entre bajas (INV-SOC-001).
 * Solo se guardan nombre, correo, hash con sal, rol e indicadores (INV-SOC-009); la respuesta nunca lleva el hash.
 */
export async function registerMember(ctx, { nombre, correo, contrasena }) {
  const name = String(nombre ?? '').trim();
  const email = String(correo ?? '').trim().toLowerCase();
  if (!name || !CORREO_VALIDO.test(email)) throw error('E_SOCIO_DATOS_INVALIDOS');
  if (largo(contrasena) < ctx.config.PASSWORD_MIN_LENGTH) throw error('E_CONTRASENA_CORTA');
  return ctx.store.transaccion((d) => {
    if (d.cuentas.some((c) => c.email === email)) throw error('E_SOCIO_DUPLICADO');
    const cuenta = {
      id: `c-${randomUUID().slice(0, 8)}`, name, email, passwordHash: hashContrasena(contrasena), role: 'socio',
      mustChangePassword: true, active: true, failedLogins: 0, lockedUntil: null, bajaEn: null,
    };
    d.cuentas.push(cuenta);
    return { mensaje: rellenar(EXITOS.socioCreado, { nombre: name }), socio: { id: cuenta.id, nombre: name, correo: email, estado: 'Activo' } };
  });
}

/**
 * API-001-03 (UC-004). La contraseña nueva se guarda solo cifrada y la cuenta pasa de Provisional a Activa (INV-SOC-002, INV-SOC-003);
 * repetirlo deja la última enviada. Devuelve la página del rol.
 */
export async function changePassword(ctx, { nueva }) {
  if (largo(nueva) < ctx.config.PASSWORD_MIN_LENGTH) throw error('E_CONTRASENA_CORTA');
  const rol = await ctx.store.transaccion((d) => {
    const cuenta = d.cuentas.find((c) => c.id === ctx.sesion.cuentaId);
    cuenta.passwordHash = hashContrasena(String(nueva));
    cuenta.mustChangePassword = false;
    return cuenta.role;
  });
  ctx.sesiones.marcarDeCuenta(ctx.sesion.cuentaId, false);
  return { destino: DESTINO[rol] };
}

/**
 * API-001-05 (UC-005). Orden: contraseña mínima (INV-SOC-002), el socio existe y no está de baja (RN-027). La provisional se guarda
 * cifrada, la anterior deja de valer, se levanta el bloqueo por fallos (INV-SOC-004) y las sesiones que el socio tuviera abiertas pasan a pedirle la contraseña nueva (INV-SOC-102).
 */
export async function resetMemberPassword(ctx, { id, contrasena }) {
  if (largo(contrasena) < ctx.config.PASSWORD_MIN_LENGTH) throw error('E_CONTRASENA_CORTA');
  const nombre = await ctx.store.transaccion((d) => {
    const cuenta = d.cuentas.find((c) => c.id === id && c.role === 'socio' && c.active);
    if (!cuenta) throw error('E_SOCIO_NO_ENCONTRADO');
    cuenta.passwordHash = hashContrasena(String(contrasena));
    cuenta.mustChangePassword = true;
    cuenta.failedLogins = 0;   // Q-acceptance-002: restablecer levanta el bloqueo y el socio entra en el acto con la nueva
    cuenta.lockedUntil = null;
    return cuenta.name;
  });
  ctx.sesiones.marcarDeCuenta(id, true);
  return { mensaje: rellenar(EXITOS.provisionalGuardada, { nombre }) };
}

/**
 * API-001-06 (UC-006). Baja lógica (ADR-003): la cuenta pasa a Baja con su fecha y se conserva. Orden: el socio existe (RN-027),
 * ya de baja → aviso sin cambios (ADR-005, D-PA-002), préstamos sin devolver (gana a las multas, RN-006), multas Pendiente (INV-SOC-007).
 * En una sola transacción cancela sus reservas Reservada sin la guarda de fecha de API-002-03 (INV-SOC-101, D-PA-011); después cierra sus
 * sesiones (RN-026). Las unidades quedan libres porque la disponibilidad se calcula desde las reservas (ADR-001).
 */
export async function removeMember(ctx, { id }) {
  const hoy = ctx.reloj.hoy();
  const r = await ctx.store.transaccion((d) => {
    const cuenta = d.cuentas.find((c) => c.id === id && c.role === 'socio');
    if (!cuenta) throw error('E_SOCIO_NO_ENCONTRADO');
    if (!cuenta.active) return { aviso: { codigo: 'E_YA_DE_BAJA', mensaje: rellenar(AVISOS.E_YA_DE_BAJA, { nombre: cuenta.name }) } };
    if (d.reservas.some((x) => x.accountId === id && x.status === 'Prestada')) throw error('E_BAJA_PRESTAMOS');
    if (d.multas.some((m) => m.accountId === id && m.status === 'Pendiente')) throw error('E_BAJA_MULTAS');
    for (const x of d.reservas) if (x.accountId === id && x.status === 'Reservada') x.status = 'Cancelada';
    cuenta.active = false;
    cuenta.bajaEn = hoy;
    return { mensaje: rellenar(EXITOS.socioDeBaja, { nombre: cuenta.name }), cerrar: true };
  });
  if (r.cerrar) ctx.sesiones.cerrarDeCuenta(id);
  return r.cerrar ? { mensaje: r.mensaje } : r;
}
