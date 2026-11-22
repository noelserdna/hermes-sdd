import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../src/server/plugin.js';
import { crearEntorno } from '../helpers/entorno.js';
import { sembrarUnidades } from '../helpers/material.js';

let e; let servidor; let base;

beforeAll(async () => {
  e = crearEntorno();
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  sembrarUnidades(e, 'Casco', 4);
  const manejador = crearManejador({ store: e.store, reloj: e.reloj, log: () => {} });
  servidor = http.createServer((req, res) => manejador(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
afterAll(() => new Promise((r) => servidor.close(r)));

describe('API-004-03 POST /api/darDeBajaUnidad', () => {
  it('responde el inventario nuevo y los errores con su estado de OPERATION-MAPPING', async () => {
    const entrada = await fetch(`${base}/api/iniciarSesion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'marta@club.test', contrasena: 'Cumbre2026' }) });
    const cookie = entrada.headers.get('set-cookie').split(';')[0];
    const post = (cuerpo) => fetch(`${base}/api/darDeBajaUnidad`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(cuerpo) });
    expect((await post({ unidadId: 99 })).status).toBe(404);
    const ok = await post({ unidadId: 3 });
    expect(ok.status).toBe(200);
    const { datos } = await ok.json();
    expect(datos.inventario.tipos.find((t) => t.tipo === 'Casco').total).toBe(3);
    expect(datos.reservasCanceladas).toBe(0);
    expect((await fetch(`${base}/api/darDeBajaUnidad`, { headers: { cookie } })).status).toBe(405);
  });
});
