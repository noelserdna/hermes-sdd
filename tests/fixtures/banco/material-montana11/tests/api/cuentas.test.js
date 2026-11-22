import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../src/server/plugin.js';
import { crearEntorno } from '../helpers/entorno.js';

let e; let servidor; let base; const lineasLog = [];

beforeAll(async () => {
  e = crearEntorno();
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  const manejador = crearManejador({ store: e.store, reloj: e.reloj, log: (l) => lineasLog.push(l) });
  servidor = http.createServer((req, res) => manejador(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
afterAll(() => new Promise((r) => servidor.close(r)));

async function cookieDe(correo) {
  const r = await fetch(`${base}/api/iniciarSesion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo, contrasena: 'Cumbre2026' }) });
  return r.headers.get('set-cookie').split(';')[0];
}
const post = (ruta, cuerpo, cookie) => fetch(base + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(cuerpo) });

describe('API-001-06 POST /api/restablecerContrasena', () => {
  it('SPEC-SEC-006 responde éxito sin la contraseña, los errores llevan su estado y el log no escribe la contraseña', async () => {
    const cookie = await cookieDe('marta@club.test');
    const cookieSocio = await cookieDe('lucia@club.test');
    const socioId = e.store.leer().cuentas.find((c) => c.correo === 'lucia@club.test').id;
    const ok = await post('/api/restablecerContrasena', { socioId, contrasena: 'Hielo2026x' }, cookie);
    expect(ok.status).toBe(200);
    const cuerpo = await ok.json();
    expect(cuerpo).toEqual({ ok: true, datos: {} });
    const corta = await post('/api/restablecerContrasena', { socioId, contrasena: 'corta1' }, cookie);
    expect(corta.status).toBe(422);
    expect((await corta.json()).codigo).toBe('E_CONTRASENA_CORTA');
    const noExiste = await post('/api/restablecerContrasena', { socioId: 999, contrasena: 'Hielo2026x' }, cookie);
    expect(noExiste.status).toBe(404);
    const socio = await post('/api/restablecerContrasena', { socioId, contrasena: 'Hielo2026x' }, cookieSocio);
    expect(socio.status).toBe(401);   // restablecer cerró la sesión de Lucía (INV-ACC-008)
    const get = await fetch(`${base}/api/restablecerContrasena`, { headers: { cookie } });
    expect(get.status).toBe(405);
    expect(lineasLog.join('\n')).not.toContain('Hielo2026x');
    expect(lineasLog.join('\n')).not.toContain('corta1');
  });
});

describe('API-001-07 POST /api/darDeBajaSocio', () => {
  it('responde la cuenta en Baja y los errores con su estado de OPERATION-MAPPING', async () => {
    const cookie = await cookieDe('marta@club.test');
    const noExiste = await post('/api/darDeBajaSocio', { socioId: 999 }, cookie);
    expect(noExiste.status).toBe(404);
    const socioId = e.store.leer().cuentas.find((c) => c.correo === 'lucia@club.test').id;
    const ok = await post('/api/darDeBajaSocio', { socioId }, cookie);
    expect(ok.status).toBe(200);
    expect((await ok.json()).datos).toEqual({ id: socioId, nombre: 'Lucía Gil', correo: 'lucia@club.test', estado: 'Baja' });
  });
});
