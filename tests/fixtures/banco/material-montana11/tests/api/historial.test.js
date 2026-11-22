import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../src/server/plugin.js';
import { crearEntorno } from '../helpers/entorno.js';
import { sembrarMulta } from '../helpers/material.js';

let e; let servidor; let base; let pablo;
beforeEach(async () => {
  e = crearEntorno({ inicio: '2026-12-11T10:00:00Z' });
  e.cuenta({ nombre: 'Junta', correo: 'junta@club.test', contrasena: 'Cumbre2026', rol: 'junta' });
  e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
  sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
  pablo = e.store.leer().cuentas.find((c) => c.correo === 'pablo@club.test').id;
  const manejador = crearManejador({ store: e.store, reloj: e.reloj, log: () => {} });
  servidor = http.createServer((req, res) => manejador(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
afterEach(() => new Promise((r) => servidor.close(r)));

async function entrar(correo, contrasena) {
  const r = await fetch(`${base}/api/iniciarSesion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo, contrasena }) });
  return r.headers.get('set-cookie').split(';')[0];
}
const get = (ruta, cookie) => fetch(`${base}/api/${ruta}`, { headers: cookie ? { cookie } : {} });

describe('API-003-10 GET /api/consultarHistorialSocio?socioId=', () => {
  it('la junta recibe 200 con la multa de Pablo Ruiz; el selector llega por listarSociosHistorial', async () => {
    const cookie = await entrar('junta@club.test', 'Cumbre2026');
    const r = await get(`consultarHistorialSocio?socioId=${pablo}`, cookie);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, datos: { socio: { nombre: 'Pablo Ruiz' }, multas: [{ importeEur: 6, estado: 'Pendiente' }], prestamos: [] } });
    expect((await (await get('listarSociosHistorial', cookie)).json()).datos).toEqual([{ id: pablo, nombre: 'Pablo Ruiz', estado: 'Activa' }]);
  });

  it('un socio recibe 403; sin sesión 401; un socio inexistente 404; un id mal formado 422; sin almacén 503', async () => {
    expect((await get(`consultarHistorialSocio?socioId=${pablo}`, await entrar('pablo@club.test', 'Nieve2026'))).status).toBe(403);
    expect((await get(`consultarHistorialSocio?socioId=${pablo}`)).status).toBe(401);
    const cookie = await entrar('junta@club.test', 'Cumbre2026');
    expect((await get('consultarHistorialSocio?socioId=999', cookie)).status).toBe(404);
    expect((await get('consultarHistorialSocio?socioId=abc', cookie)).status).toBe(422);
    e.caer();
    expect((await get(`consultarHistorialSocio?socioId=${pablo}`, cookie)).status).toBe(503);
  });
});
