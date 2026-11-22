import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../src/server/plugin.js';
import { crearEntorno } from '../helpers/entorno.js';
import { sembrarUnidades, sembrarReserva } from '../helpers/material.js';

let e; let servidor; let base;
beforeEach(async () => {
  e = crearEntorno({ inicio: '2026-12-09T10:00:00Z' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  sembrarUnidades(e, 'Piolet', 1);
  sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07', estado: 'Entregado' });
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

describe('API-003-09 GET /api/consultarPrestado?dia=', () => {
  it('el encargado recibe 200 con lo prestado y lo que vuelve el día pedido', async () => {
    const r = await get('consultarPrestado?dia=2026-12-07', await entrar('marta@club.test', 'Cumbre2026'));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, datos: [{ material: 'Piolet', unidad: 1, socio: 'Lucía Gil', fin: '2026-12-07', vuelveHoy: true, retrasoDias: 2 }] });
  });

  it('con "?dia=" vacío usa hoy; un día mal formado da 422; un socio, 403; sin sesión, 401; POST, 405', async () => {
    const marta = await entrar('marta@club.test', 'Cumbre2026');
    expect((await (await get('consultarPrestado?dia=', marta)).json()).datos[0].vuelveHoy).toBe(false);
    expect((await get('consultarPrestado?dia=31-31-2026', marta)).status).toBe(422);
    expect((await get('consultarPrestado', await entrar('lucia@club.test', 'Cumbre2026'))).status).toBe(403);
    expect((await get('consultarPrestado')).status).toBe(401);
    expect((await fetch(`${base}/api/consultarPrestado`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(405);
  });
});
