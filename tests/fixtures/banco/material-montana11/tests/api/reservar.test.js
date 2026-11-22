import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../src/server/plugin.js';
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
const post = (operacion, cuerpo, cookie) => fetch(`${base}/api/${operacion}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(cuerpo) });
const get = (ruta, cookie) => fetch(base + ruta, { headers: cookie ? { cookie } : {} });
const rango = { inicio: '2026-12-05', fin: '2026-12-07' };

describe('API-002-02 reservarMaterial por HTTP', () => {
  // D-PA-008, INV-RES-001: "Una unidad no tiene dos reservas Reservada o Entregado con días en común"
  it('AC-005-12 última unidad pedida a la vez por lucia y pablo: una se crea (200) y la otra recibe E_SIN_UNIDADES (409)', async () => {
    sembrarUnidades(e, 'Tienda', 1);
    const [cl, cp] = [await entrar('lucia@club.test', 'Cumbre2026'), await entrar('pablo@club.test', 'Nieve2026')];
    const [a, b] = await Promise.all([post('reservarMaterial', { material: 'Tienda', ...rango }, cl), post('reservarMaterial', { material: 'Tienda', ...rango }, cp)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const perdedora = await (a.status === 409 ? a : b).json();
    expect(perdedora).toMatchObject({ ok: false, codigo: 'E_SIN_UNIDADES', mensaje: 'No hay unidades libres esas fechas' });
    expect(e.store.leer().reservas).toHaveLength(1);
  });

  it('los errores de validación devuelven 422, la multa y la falta de unidades 409 y sin sesión 401', async () => {
    sembrarUnidades(e, 'Casco', 1);
    const cookie = await entrar('lucia@club.test', 'Cumbre2026');
    expect((await post('reservarMaterial', { material: 'Casco', inicio: '2026-11-20', fin: '2026-11-22' }, cookie)).status).toBe(422);
    expect((await post('reservarMaterial', { material: 'Casco', inicio: '2026-12-10', fin: '2026-12-08' }, cookie)).status).toBe(422);
    expect((await post('reservarMaterial', { material: 'Bastón', ...rango }, cookie)).status).toBe(422);
    expect((await post('reservarMaterial', { material: 'Casco', ...rango })).status).toBe(401);
    expect((await post('reservarMaterial', { material: 'Casco', ...rango }, cookie)).status).toBe(200);
    const otra = await entrar('pablo@club.test', 'Nieve2026');
    expect((await post('reservarMaterial', { material: 'Casco', ...rango }, otra)).status).toBe(409);
  });

  // REQ-C-003: "mismos datos en cada dispositivo"
  it('REQ-C-003 otra sesión con otra cuenta ve las unidades libres que dejó la primera reserva', async () => {
    sembrarUnidades(e, 'Piolet', 3);
    const lucia = await entrar('lucia@club.test', 'Cumbre2026');
    const pablo = await entrar('pablo@club.test', 'Nieve2026');
    const consulta = '/api/consultarDisponibilidad?material=Piolet&inicio=2026-12-05&fin=2026-12-07';
    expect((await (await get(consulta, pablo)).json()).datos.libres).toBe(3);
    await post('reservarMaterial', { material: 'Piolet', ...rango }, lucia);
    expect(await (await get(consulta, pablo)).json()).toEqual({ ok: true, datos: { material: 'Piolet', ...rango, libres: 2 } });
  });

  it('consultarDisponibilidad es GET con los datos en la consulta y no existe por POST', async () => {
    const cookie = await entrar('lucia@club.test', 'Cumbre2026');
    expect((await post('consultarDisponibilidad', { material: 'Piolet', ...rango }, cookie)).status).toBe(405);
    expect((await get('/api/consultarDisponibilidad?material=Piolet', cookie)).status).toBe(422);
  });
});
