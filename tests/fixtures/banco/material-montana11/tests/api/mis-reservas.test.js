import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../src/server/plugin.js';
import { crearEntorno } from '../helpers/entorno.js';
import { HOY_FASE_1, sembrarUnidades, sembrarReserva } from '../helpers/material.js';

let e; let servidor; let base;
beforeEach(async () => {
  e = crearEntorno({ inicio: HOY_FASE_1 });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
  sembrarUnidades(e, 'Piolet', 1);
  sembrarUnidades(e, 'Casco', 1);
  sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' });
  sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', inicio: '2026-12-06', fin: '2026-12-07' });
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

describe('API-002-03 listarMisReservas por HTTP', () => {
  // SEC-T-001, GAP-003, INV-SEC-001: la lista se filtra por la cuenta de la sesión, nunca por un parámetro.
  it('SEC-T-001 GAP-003 lucia pide sus reservas, también con ?socioId de pablo: solo ve su Piolet y nunca el Casco', async () => {
    const cookie = await entrar('lucia@club.test', 'Cumbre2026');
    for (const ruta of ['/api/listarMisReservas', '/api/listarMisReservas?socioId=2&correo=pablo@club.test']) {
      const r = await fetch(base + ruta, { headers: { cookie } });
      expect(r.status).toBe(200);
      const cuerpo = await r.json();
      expect(cuerpo.datos.map((x) => x.material)).toEqual(['Piolet']);
      expect(JSON.stringify(cuerpo)).not.toContain('Casco');
    }
  });

  it('AC-006-03 sin sesión: 401 E_NO_AUTENTICADO y ningún dato', async () => {
    const r = await fetch(`${base}/api/listarMisReservas`);
    expect(r.status).toBe(401);
    expect(await r.json()).toMatchObject({ ok: false, codigo: 'E_NO_AUTENTICADO' });
  });

  it('AC-006-04 con el almacén caído: 503 E_ALMACEN_NO_DISPONIBLE', async () => {
    const cookie = await entrar('lucia@club.test', 'Cumbre2026');
    e.caer();
    const r = await fetch(`${base}/api/listarMisReservas`, { headers: { cookie } });
    expect(r.status).toBe(503);
    expect((await r.json()).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
  });
});
