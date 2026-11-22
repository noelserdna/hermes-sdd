import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../../src/server/http.js';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { nuevaCuenta } from '../../../src/domain/acceso.js';

const servidores = [];
let ahora;
let almacen;
let base;
let registro;
afterEach(async () => { while (servidores.length) await new Promise((r) => servidores.pop().close(r)); });

beforeEach(async () => {
  ahora = Date.parse('2026-12-01T11:00:00Z');
  registro = [];
  almacen = crearAlmacenMemoria();
  await almacen.transaction((db) => {
    nuevaCuenta(db, { nombre: 'Lucía', correo: 'lucia@club.es', contrasena: 'Cumbre2026', rol: 'socio' });
  });
  const reloj = { ahora: () => new Date(ahora), hoy: () => '2026-12-01' };
  const manejador = crearManejador({ almacen, reloj, env: {}, registrar: (l) => registro.push(l) });
  const servidor = http.createServer((req, res) => manejador(req, res, () => { res.statusCode = 404; res.end(); }));
  servidores.push(servidor);
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

const entrar = (contrasena = 'Cumbre2026') => fetch(`${base}/api/iniciar-sesion`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ correo: 'lucia@club.es', contrasena }),
});
const cookieDe = (respuesta) => respuesta.headers.get('set-cookie').split(';')[0];

describe('sesiones por HTTP', () => {
  it('SEC-002 la cookie es HttpOnly y SameSite=Strict y ninguna salida lleva la contraseña ni el hash', async () => {
    const respuesta = await entrar();
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('set-cookie')).toMatch(/HttpOnly/);
    expect(respuesta.headers.get('set-cookie')).toMatch(/SameSite=Strict/);
    const texto = await respuesta.text();
    expect(JSON.parse(texto)).toEqual({ nombre: 'Lucía', rol: 'socio' });
    for (const secreto of ['Cumbre2026', 'scrypt']) expect(texto).not.toContain(secreto);
    const fallo = await entrar('mala');
    expect(fallo.status).toBe(401);
    expect(await fallo.json()).toEqual({ error: 'E_CREDENCIALES_INVALIDAS', mensaje: 'Correo o contraseña incorrectos' });
    for (const linea of registro) for (const secreto of ['Cumbre2026', 'mala', 'sid=']) expect(linea).not.toContain(secreto);
  });

  it('E_CUENTA_BLOQUEADA sale como 423 con su mensaje', async () => {
    for (let i = 0; i < 5; i += 1) await entrar('mala');
    const bloqueada = await entrar();
    expect(bloqueada.status).toBe(423);
    expect((await bloqueada.json()).mensaje).toBe('Cuenta bloqueada. Inténtalo de nuevo en 15 minutos');
    expect(bloqueada.headers.get('set-cookie')).toBeNull();
  });

  it('INV-ACC-008 AC-001-13 sin sesión, una operación protegida da E_NO_AUTENTICADO (401) y salir también', async () => {
    const protegida = await fetch(`${base}/api/sesion`);
    expect(protegida.status).toBe(401);
    expect((await protegida.json()).error).toBe('E_NO_AUTENTICADO');
    const salir = await fetch(`${base}/api/cerrar-sesion`, { method: 'POST' });
    expect(salir.status).toBe(401);
  });

  it('INV-ACC-102 Salir invalida la sesión en el servidor, no solo borra la cookie', async () => {
    const cookie = cookieDe(await entrar());
    expect((await (await fetch(`${base}/api/sesion`, { headers: { cookie } })).json())).toEqual({ nombre: 'Lucía', rol: 'socio' });
    const salir = await fetch(`${base}/api/cerrar-sesion`, { method: 'POST', headers: { cookie } });
    expect(salir.status).toBe(204);
    expect(salir.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    expect((await fetch(`${base}/api/sesion`, { headers: { cookie } })).status).toBe(401);
  });

  it('INV-ACC-005 con 8 horas sin actividad la operación da E_SESION_CADUCADA (401)', async () => {
    const cookie = cookieDe(await entrar());
    ahora += 8 * 3_600_000;
    const caducada = await fetch(`${base}/api/sesion`, { headers: { cookie } });
    expect(caducada.status).toBe(401);
    expect(await caducada.json()).toEqual({ error: 'E_SESION_CADUCADA', mensaje: 'Tu sesión ha caducado' });
  });

  it('D-PA-004 la cuenta dada de baja deja de poder usar la web en la siguiente petición', async () => {
    const cookie = cookieDe(await entrar());
    await almacen.transaction((db) => { db.cuentas[0].estado = 'Baja'; });
    expect((await fetch(`${base}/api/sesion`, { headers: { cookie } })).status).toBe(401);
  });
});
