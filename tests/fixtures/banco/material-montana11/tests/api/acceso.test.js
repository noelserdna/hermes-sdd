import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../src/server/plugin.js';
import { crearEntorno } from '../helpers/entorno.js';

let e; let servidor; let base; const lineasLog = [];

beforeAll(async () => {
  e = crearEntorno();
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  const manejador = crearManejador({ store: e.store, reloj: e.reloj, log: (l) => lineasLog.push(l) });
  servidor = http.createServer((req, res) => manejador(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
afterAll(() => new Promise((r) => servidor.close(r)));

const post = (ruta, cuerpo, cabeceras = { 'Content-Type': 'application/json' }) =>
  fetch(base + ruta, { method: 'POST', headers: cabeceras, body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) });

describe('API de acceso', () => {
  it('SEC-T-004 POST /api/iniciarSesion fija sid HttpOnly SameSite=Strict y Cache-Control: no-store', async () => {
    const r = await post('/api/iniciarSesion', { correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
    const cuerpo = await r.json();
    expect(r.status).toBe(200);
    expect(cuerpo).toEqual({ ok: true, datos: { nombre: 'Lucía Gil', rol: 'socio' } });
    const cookie = r.headers.get('set-cookie');
    expect(cookie).toMatch(/^sid=[0-9a-f]{64}/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(JSON.stringify(cuerpo)).not.toContain('Cumbre2026');
  });

  it('SEC-T-004 rechaza un cuerpo de más de 16 KB y un POST sin Content-Type', async () => {
    const grande = await post('/api/iniciarSesion', JSON.stringify({ correo: 'a@b.c', contrasena: 'x'.repeat(17 * 1024) }));
    expect(grande.status).toBe(413);
    const sinTipo = await post('/api/iniciarSesion', '{"correo":"lucia@club.test","contrasena":"Cumbre2026"}', {});
    expect(sinTipo.status).toBe(415);
    expect((await sinTipo.json()).ok).toBe(false);
  });

  it('un error de dominio responde con su código y su literal, con el estado de OPERATION-MAPPING', async () => {
    const mala = await post('/api/iniciarSesion', { correo: 'lucia@club.test', contrasena: 'x' });
    expect(mala.status).toBe(401);
    expect(await mala.json()).toEqual({ ok: false, codigo: 'E_CREDENCIALES_INVALIDAS', mensaje: 'Correo o contraseña incorrectos' });
    const vacia = await post('/api/iniciarSesion', { correo: '', contrasena: '' });
    expect(vacia.status).toBe(422);
  });

  it('INV-ACC-003 el registro es una línea JSON por petición y nunca contiene la contraseña', async () => {
    await post('/api/iniciarSesion', { correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
    expect(lineasLog.length).toBeGreaterThan(0);
    for (const linea of lineasLog) {
      expect(() => JSON.parse(linea)).not.toThrow();
      expect(linea).not.toContain('Cumbre2026');
    }
  });

  it('una operación desconocida responde 404 y un GET sobre una escritura no se admite', async () => {
    expect((await fetch(`${base}/api/noExiste`)).status).toBe(404);
    expect((await fetch(`${base}/api/iniciarSesion`)).status).toBe(405);
  });
});
