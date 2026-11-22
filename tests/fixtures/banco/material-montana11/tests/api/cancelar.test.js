import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../src/server/plugin.js';
import { crearEntorno } from '../helpers/entorno.js';
import { sembrarUnidades, sembrarReserva } from '../helpers/material.js';

let e; let servidor; let base;
beforeEach(async () => {
  e = crearEntorno({ inicio: '2026-12-04T10:00:00Z' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  sembrarUnidades(e, 'Piolet', 1);
  sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' });
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
const cancelar = (reservaId, cookie) => fetch(`${base}/api/cancelarReserva`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ reservaId }) });

describe('API-002-04 cancelarReserva por HTTP', () => {
  it('UC-007 HTTP cancelar devuelve 200 con estado Cancelada y repetirlo devuelve 200 con la misma reserva', async () => {
    const cookie = await entrar('lucia@club.test', 'Cumbre2026');
    const primera = await (await cancelar(1, cookie)).json();
    expect(primera).toMatchObject({ ok: true, datos: { id: 1, material: 'Piolet', estado: 'Cancelada' } });
    const segunda = await cancelar(1, cookie);
    expect(segunda.status).toBe(200);
    expect(await segunda.json()).toEqual(primera);
  });

  it('AC-007-04 la reserva ajena y la inexistente dan el mismo 404 E_RESERVA_NO_ENCONTRADA (no se revela que existe)', async () => {
    const cookie = await entrar('pablo@club.test', 'Nieve2026');
    const ajena = await cancelar(1, cookie);
    const inexistente = await cancelar(77, cookie);
    expect(ajena.status).toBe(404);
    expect(await ajena.json()).toEqual(await inexistente.json());
    expect(e.store.leer().reservas[0].estado).toBe('Reservada');
  });

  it('AC-007-06 UC-007 HTTP el día de inicio 409 E_CANCELACION_TARDIA; sin sesión 401; encargado 403; almacén caído 503', async () => {
    const cookie = await entrar('lucia@club.test', 'Cumbre2026');
    expect((await cancelar(1)).status).toBe(401);
    expect((await cancelar(1, await entrar('marta@club.test', 'Cumbre2026'))).status).toBe(403);
    e.caer();
    const caida = await cancelar(1, cookie);
    expect([caida.status, (await caida.json()).codigo]).toEqual([503, 'E_ALMACEN_NO_DISPONIBLE']);
    e.caer(false);
    e.avanzar(24 * 60);
    const tarde = await cancelar(1, await entrar('lucia@club.test', 'Cumbre2026'));
    expect(tarde.status).toBe(409);
    expect((await tarde.json()).codigo).toBe('E_CANCELACION_TARDIA');
  });
});
