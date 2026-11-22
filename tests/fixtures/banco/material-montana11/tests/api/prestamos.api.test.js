import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../src/server/plugin.js';
import { crearEntorno } from '../helpers/entorno.js';
import { sembrarUnidades, sembrarReserva } from '../helpers/material.js';

let e; let servidor; let base; let reservaId;
beforeEach(async () => {
  e = crearEntorno({ inicio: '2026-12-05T10:00:00Z' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  sembrarUnidades(e, 'Piolet', 1);
  reservaId = sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' });
  const manejador = crearManejador({ store: e.store, reloj: e.reloj, log: () => {} });
  servidor = http.createServer((req, res) => manejador(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
afterEach(() => new Promise((r) => servidor.close(r)));

async function entrar(correo, contrasena = 'Cumbre2026') {
  const r = await fetch(`${base}/api/iniciarSesion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo, contrasena }) });
  return r.headers.get('set-cookie').split(';')[0];
}
const post = (operacion, cuerpo, cookie) => fetch(`${base}/api/${operacion}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(cuerpo) });
const get = (operacion, cookie) => fetch(`${base}/api/${operacion}`, { headers: cookie ? { cookie } : {} });

describe('API-003 préstamos por HTTP', () => {
  it('UC-008 POST /api/entregarReserva y GET /api/listarPrestamosYReservas: el encargado entrega y ve "Entregado"', async () => {
    const cookie = await entrar('marta@club.test');
    const entrega = await post('entregarReserva', { reservaId }, cookie);
    expect(entrega.status).toBe(200);
    expect(await entrega.json()).toMatchObject({ ok: true, datos: { id: reservaId, estado: 'Entregado', entregadaEl: '2026-12-05' } });
    const lista = await (await get('listarPrestamosYReservas', cookie)).json();
    expect(lista).toMatchObject({ ok: true, datos: [{ material: 'Piolet', socio: 'Lucía Gil', estado: 'Entregado' }] });
  });

  it('un socio recibe 403 E_ACCESO_NO_PERMITIDO en las dos operaciones y sin sesión 401', async () => {
    const socio = await entrar('lucia@club.test');
    expect((await post('entregarReserva', { reservaId }, socio)).status).toBe(403);
    const lista = await get('listarPrestamosYReservas', socio);
    expect([lista.status, (await lista.json()).codigo]).toEqual([403, 'E_ACCESO_NO_PERMITIDO']);
    expect((await post('entregarReserva', { reservaId })).status).toBe(401);
  });

  // REQ-F-005 AC3: "GIVEN a reservation starting 2026-12-05 WHEN the encargado tries to deliver it on 2026-12-04 THEN the user sees "No se puede entregar antes de la fecha de inicio""
  it('AC-008-03 REQ-F-005 AC3 la entrega anticipada es 409 E_ENTREGA_ANTICIPADA con su texto, y una reserva inexistente 404', async () => {
    e.avanzar(-24 * 60);
    const cookie = await entrar('marta@club.test');
    const anticipada = await post('entregarReserva', { reservaId }, cookie);
    expect(anticipada.status).toBe(409);
    expect(await anticipada.json()).toMatchObject({ codigo: 'E_ENTREGA_ANTICIPADA', mensaje: 'No se puede entregar antes de la fecha de inicio' });
    expect((await post('entregarReserva', { reservaId: 99 }, cookie)).status).toBe(404);
  });

  it('el método equivocado da 405 y la lista no se pide con POST', async () => {
    const cookie = await entrar('marta@club.test');
    expect((await get('entregarReserva', cookie)).status).toBe(405);
    expect((await post('listarPrestamosYReservas', {}, cookie)).status).toBe(405);
  });

  it('UC-009 POST /api/registrarDevolucion: el encargado devuelve el Piolet entregado y ve "Devuelto"; un socio recibe 403', async () => {
    const cookie = await entrar('marta@club.test');
    await post('entregarReserva', { reservaId }, cookie);
    expect((await post('registrarDevolucion', { reservaId }, await entrar('lucia@club.test'))).status).toBe(403);
    const devolucion = await post('registrarDevolucion', { reservaId }, cookie);
    expect(devolucion.status).toBe(200);
    expect(await devolucion.json()).toMatchObject({ ok: true, datos: { id: reservaId, estado: 'Devuelto', devueltaEl: '2026-12-05' } });
    const otra = await post('registrarDevolucion', { reservaId: 99 }, cookie);
    expect([otra.status, (await otra.json()).codigo]).toEqual([404, 'E_RESERVA_NO_ENCONTRADA']);
  });
});
