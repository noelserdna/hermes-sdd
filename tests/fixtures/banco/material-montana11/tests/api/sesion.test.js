import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../src/server/plugin.js';
import { crearEntorno } from '../helpers/entorno.js';

let e; let servidor; let base;
beforeAll(async () => {
  e = crearEntorno();
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  const manejador = crearManejador({ store: e.store, reloj: e.reloj, log: () => {} });
  servidor = http.createServer((req, res) => manejador(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
afterAll(() => new Promise((r) => servidor.close(r)));

async function entrar() {
  const r = await fetch(`${base}/api/iniciarSesion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'lucia@club.test', contrasena: 'Cumbre2026' }) });
  return r.headers.get('set-cookie').split(';')[0];
}
const get = (ruta, cookie) => fetch(base + ruta, { headers: cookie ? { cookie } : {} });
const salir = (cookie) => fetch(`${base}/api/cerrarSesion`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: '{}' });

describe('API de sesión', () => {
  it('comprobarSesion con la cookie devuelve la cuenta y el rol; sin cookie, 401 E_NO_AUTENTICADO', async () => {
    const cookie = await entrar();
    const ok = await get('/api/comprobarSesion', cookie);
    expect(await ok.json()).toEqual({ ok: true, datos: { nombre: 'Lucía Gil', correo: 'lucia@club.test', rol: 'socio' } });
    const sin = await get('/api/comprobarSesion');
    expect(sin.status).toBe(401);
    expect(await sin.json()).toEqual({ ok: false, codigo: 'E_NO_AUTENTICADO', mensaje: 'Entrar' });
  });

  it('cerrarSesion borra la cookie y la siguiente comprobación ya no vale', async () => {
    const cookie = await entrar();
    const r = await salir(cookie);
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await get('/api/comprobarSesion', cookie)).status).toBe(401);
    expect((await salir(cookie)).status).toBe(401);
  });

  it('a los 30 minutos sin actividad responde 401 E_SESION_CADUCADA con el literal', async () => {
    const cookie = await entrar();
    e.avanzar(31);
    const r = await get('/api/comprobarSesion', cookie);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ ok: false, codigo: 'E_SESION_CADUCADA', mensaje: 'Sesión caducada, vuelve a entrar' });
  });
});
