import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../src/server/plugin.js';
import { crearStore } from '../../src/server/store.js';
import { crearEntorno } from '../helpers/entorno.js';
import { HOY_FASE_1, sembrarUnidades } from '../helpers/material.js';

let e; let servidor; let base;
beforeEach(async () => {
  e = crearEntorno({ inicio: HOY_FASE_1 });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
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

describe('REQ-C-003 Datos compartidos entre dispositivos', () => {
  // REQ-C-003 AC1: "a second session with another account reads data written by the first"
  it('REQ-C-003 AC1 la sesión de pablo ve 2 libres del Piolet tras la reserva de lucia y el almacén en disco la guarda', async () => {
    sembrarUnidades(e, 'Piolet', 3);
    const lucia = await entrar('lucia@club.test', 'Cumbre2026');
    const pablo = await entrar('pablo@club.test', 'Nieve2026');
    expect(lucia).not.toBe(pablo);
    const rango = { inicio: '2026-12-05', fin: '2026-12-07' };
    const consulta = '/api/consultarDisponibilidad?material=Piolet&inicio=2026-12-05&fin=2026-12-07';
    expect((await (await fetch(base + consulta, { headers: { cookie: pablo } })).json()).datos.libres).toBe(3);
    const r = await fetch(`${base}/api/reservarMaterial`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: lucia }, body: JSON.stringify({ material: 'Piolet', ...rango }) });
    expect(r.status).toBe(200);
    expect((await (await fetch(base + consulta, { headers: { cookie: pablo } })).json()).datos.libres).toBe(2);
    // otro almacén abierto sobre el mismo fichero (otro dispositivo) lee la reserva de la primera sesión
    const otro = crearStore({ archivo: e.archivo });
    expect(otro.leer().reservas).toHaveLength(1);
  });
});
