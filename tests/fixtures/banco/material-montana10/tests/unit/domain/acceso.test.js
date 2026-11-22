import { describe, it, expect, beforeEach } from 'vitest';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { iniciarSesion, cerrarSesion, validarSesion, nuevaCuenta, hashContrasena, verificarContrasena } from '../../../src/domain/acceso.js';
import { LOGIN_MAX_FAILURES, LOGIN_LOCK_MINUTES, SESSION_IDLE_HOURS } from '../../../src/domain/config.js';

let almacen;
let ahora;
const reloj = { ahora: () => new Date(ahora), hoy: () => new Date(ahora).toISOString().slice(0, 10) };
const ctx = () => ({ almacen, reloj });
const avanzar = (minutos) => { ahora += minutos * 60_000; };
const codigoDe = (promesa) => promesa.then(() => null, (e) => e.codigo);
const lucia = (db) => db.cuentas.find((c) => c.correo === 'lucia@club.es');

beforeEach(async () => {
  almacen = crearAlmacenMemoria();
  ahora = Date.parse('2026-12-01T11:00:00Z');
  await almacen.transaction((db) => {
    nuevaCuenta(db, { nombre: 'Lucía', correo: 'lucia@club.es', contrasena: 'Cumbre2026', rol: 'socio' });
    nuevaCuenta(db, { nombre: 'Pablo', correo: 'pablo@club.es', contrasena: 'Arista2026', rol: 'socio' });
    nuevaCuenta(db, { nombre: 'Encargado', correo: 'encargado@club.es', contrasena: 'Glaciar2026', rol: 'encargado' });
    nuevaCuenta(db, { nombre: 'Junta', correo: 'junta@club.es', contrasena: 'Serac2026', rol: 'junta' });
    nuevaCuenta(db, { nombre: 'Marta', correo: 'marta@club.es', contrasena: 'Hielo2026', rol: 'socio', estado: 'Baja' });
  });
});

describe('contraseñas (INV-ACC-003, SEC-001)', () => {
  it('SEC-001 se guardan solo como hash scrypt con sal por cuenta, nunca en claro', async () => {
    const datos = JSON.stringify(await almacen.load());
    for (const clave of ['Cumbre2026', 'Arista2026', 'Glaciar2026', 'Serac2026']) expect(datos).not.toContain(clave);
    const { cuentas } = await almacen.load();
    expect(cuentas[0].hashContrasena).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(cuentas[0].hashContrasena).not.toBe(cuentas[1].hashContrasena);
    expect(await verificarContrasena('Cumbre2026', cuentas[0].hashContrasena)).toBe(true);
    expect(await verificarContrasena('otra', cuentas[0].hashContrasena)).toBe(false);
    expect(await verificarContrasena('x', 'basura')).toBe(false);
    expect(hashContrasena('x')).not.toBe(hashContrasena('x'));
  });
});

describe('iniciarSesion', () => {
  it('INV-ACC-008 entra con correo normalizado (RN-014) y devuelve nombre y rol, sin hash', async () => {
    const r = await iniciarSesion(ctx(), { correo: '  Lucia@Club.ES ', contrasena: 'Cumbre2026' });
    expect(r.nombre).toBe('Lucía');
    expect(r.rol).toBe('socio');
    expect(typeof r.sid).toBe('string');
    expect(JSON.stringify(r)).not.toContain('scrypt');
    expect((await almacen.load()).sesiones).toHaveLength(1);
  });

  it('AC-001-12 el encargado y la junta entran con su rol', async () => {
    expect((await iniciarSesion(ctx(), { correo: 'encargado@club.es', contrasena: 'Glaciar2026' })).rol).toBe('encargado');
    expect((await iniciarSesion(ctx(), { correo: 'junta@club.es', contrasena: 'Serac2026' })).rol).toBe('junta');
  });

  it('INV-ACC-006 AC-001-10 correo desconocido o cuenta en Baja: el mismo error y el contador no cambia', async () => {
    const antes = JSON.stringify(await almacen.load());
    expect(await codigoDe(iniciarSesion(ctx(), { correo: 'nadie@club.es', contrasena: 'Cumbre2026' }))).toBe('E_CREDENCIALES_INVALIDAS');
    expect(await codigoDe(iniciarSesion(ctx(), { correo: 'marta@club.es', contrasena: 'Hielo2026' }))).toBe('E_CREDENCIALES_INVALIDAS');
    expect(await codigoDe(iniciarSesion(ctx(), { correo: 5, contrasena: {} }))).toBe('E_CREDENCIALES_INVALIDAS');
    expect(JSON.stringify(await almacen.load())).toBe(antes);
  });

  it('INV-ACC-004 un fallo suma un seguido; un acierto reinicia el contador', async () => {
    await codigoDe(iniciarSesion(ctx(), { correo: 'lucia@club.es', contrasena: 'mala' }));
    await codigoDe(iniciarSesion(ctx(), { correo: 'lucia@club.es', contrasena: 'mala' }));
    expect(lucia(await almacen.load()).fallosSeguidos).toBe(2);
    await iniciarSesion(ctx(), { correo: 'lucia@club.es', contrasena: 'Cumbre2026' });
    expect(lucia(await almacen.load()).fallosSeguidos).toBe(0);
  });

  it('INV-ACC-004 AC-001-11 el 5.º fallo seguido bloquea la cuenta 15 minutos', async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i += 1) {
      expect(await codigoDe(iniciarSesion(ctx(), { correo: 'lucia@club.es', contrasena: 'mala' }))).toBe('E_CREDENCIALES_INVALIDAS');
    }
    expect(lucia(await almacen.load()).bloqueadaHasta).toBeNull();
    expect(await codigoDe(iniciarSesion(ctx(), { correo: 'lucia@club.es', contrasena: 'mala' }))).toBe('E_CREDENCIALES_INVALIDAS');
    expect(lucia(await almacen.load()).bloqueadaHasta).toBe(new Date(ahora + LOGIN_LOCK_MINUTES * 60_000).toISOString());
  });

  it('INV-ACC-004 bloqueada, la contraseña correcta da E_CUENTA_BLOQUEADA y no hay sesión', async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) await codigoDe(iniciarSesion(ctx(), { correo: 'lucia@club.es', contrasena: 'mala' }));
    avanzar(LOGIN_LOCK_MINUTES - 1);
    expect(await codigoDe(iniciarSesion(ctx(), { correo: 'lucia@club.es', contrasena: 'Cumbre2026' }))).toBe('E_CUENTA_BLOQUEADA');
    expect((await almacen.load()).sesiones).toHaveLength(0);
  });

  it('INV-ACC-004 pasado el bloqueo se entra con normalidad y el contador vuelve a 0', async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) await codigoDe(iniciarSesion(ctx(), { correo: 'lucia@club.es', contrasena: 'mala' }));
    avanzar(LOGIN_LOCK_MINUTES);
    expect((await iniciarSesion(ctx(), { correo: 'lucia@club.es', contrasena: 'Cumbre2026' })).nombre).toBe('Lucía');
    const cuenta = lucia(await almacen.load());
    expect(cuenta.fallosSeguidos).toBe(0);
    expect(cuenta.bloqueadaHasta).toBeNull();
  });

  it('INV-ACC-101 un envío correcto repetido o simultáneo deja una sola sesión que vale con el identificador de cualquiera de las dos respuestas', async () => {
    // REQ-F-001 AC9: "GIVEN \"lucia@club.es\" sends the same correct form twice (double click) WHEN both arrive THEN there is one single session and the user sees \"Hola, Lucía\""
    const [a, b] = await Promise.all([
      iniciarSesion(ctx(), { correo: 'lucia@club.es', contrasena: 'Cumbre2026' }),
      iniciarSesion(ctx(), { correo: 'lucia@club.es', contrasena: 'Cumbre2026' }),
    ]);
    expect(a.nombre).toBe('Lucía');
    expect(b.nombre).toBe('Lucía');
    // there is one single session
    expect((await almacen.load()).sesiones).toHaveLength(1);
    // la cookie que quede en el navegador (la de la última respuesta en llegar, sea cual sea) abre esa sesión y se ve «Hola, Lucía»
    expect((await validarSesion(ctx(), a.sid)).nombre).toBe('Lucía');
    expect((await validarSesion(ctx(), b.sid)).nombre).toBe('Lucía');
  });

  it('SEC-001 la sesión se guarda con el hash del identificador, no con el valor de la cookie', async () => {
    const { sid } = await iniciarSesion(ctx(), { correo: 'lucia@club.es', contrasena: 'Cumbre2026' });
    expect(JSON.stringify(await almacen.load())).not.toContain(sid);
  });
});

describe('validarSesion y cerrarSesion', () => {
  const entrar = () => iniciarSesion(ctx(), { correo: 'lucia@club.es', contrasena: 'Cumbre2026' });

  it('INV-ACC-005 con SESSION_IDLE_HOURS sin actividad da E_SESION_CADUCADA; antes, renueva la actividad', async () => {
    const { sid } = await entrar();
    avanzar(SESSION_IDLE_HOURS * 60 - 1);
    expect((await validarSesion(ctx(), sid)).nombre).toBe('Lucía');
    avanzar(SESSION_IDLE_HOURS * 60 - 1); // la actividad se renovó: sigue vigente
    expect((await validarSesion(ctx(), sid)).rol).toBe('socio');
    avanzar(SESSION_IDLE_HOURS * 60);
    expect(await codigoDe(validarSesion(ctx(), sid))).toBe('E_SESION_CADUCADA');
    expect(await codigoDe(validarSesion(ctx(), sid))).toBe('E_NO_AUTENTICADO');
  });

  it('INV-ACC-102 una sesión cerrada con Salir no vuelve a valer', async () => {
    const { sid } = await entrar();
    await cerrarSesion(ctx(), sid);
    expect(await codigoDe(validarSesion(ctx(), sid))).toBe('E_NO_AUTENTICADO');
    expect((await almacen.load()).sesiones).toHaveLength(0);
  });

  it('AC-001-13 salir sin sesión, o sin ninguna cookie, da E_NO_AUTENTICADO', async () => {
    expect(await codigoDe(cerrarSesion(ctx(), undefined))).toBe('E_NO_AUTENTICADO');
    expect(await codigoDe(cerrarSesion(ctx(), 'inventada'))).toBe('E_NO_AUTENTICADO');
    expect(await codigoDe(validarSesion(ctx(), undefined))).toBe('E_NO_AUTENTICADO');
  });

  it('D-PA-004 una cuenta que pasa a Baja deja de poder usar la web al instante', async () => {
    const { sid } = await entrar();
    await almacen.transaction((db) => { lucia(db).estado = 'Baja'; });
    expect(await codigoDe(validarSesion(ctx(), sid))).toBe('E_NO_AUTENTICADO');
    expect((await almacen.load()).sesiones).toHaveLength(0);
  });
});
