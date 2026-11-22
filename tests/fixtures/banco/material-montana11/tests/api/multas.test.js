import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../src/server/plugin.js';
import { crearEntorno } from '../helpers/entorno.js';
import { sembrarMulta } from '../helpers/material.js';

let e; let servidor; let base;
beforeEach(async () => {
  e = crearEntorno({ inicio: '2026-12-11T10:00:00Z' });
  e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
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
const get = (operacion, cookie) => fetch(`${base}/api/${operacion}`, { headers: cookie ? { cookie } : {} });

describe('API-003-06 GET /api/listarMisMultas', () => {
  it('el socio recibe 200 con sus multas, el importe sin formatear', async () => {
    const r = await get('listarMisMultas', await entrar('pablo@club.test', 'Nieve2026'));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, datos: [{ importeEur: 6, estado: 'Pendiente' }] });
  });

  // AC-011-03: "GIVEN the store is unavailable WHEN "pablo" opens Mis multas THEN the user sees the error and no fine"
  it('AC-011-03 fallo del almacén: 503 E_ALMACEN_NO_DISPONIBLE y ninguna multa', async () => {
    const cookie = await entrar('pablo@club.test', 'Nieve2026');
    e.caer();
    const r = await get('listarMisMultas', cookie);
    expect(r.status).toBe(503);
    const cuerpo = await r.json();
    expect(cuerpo).toMatchObject({ ok: false, codigo: 'E_ALMACEN_NO_DISPONIBLE' });
    expect(cuerpo.datos).toBeUndefined();
  });

  it('el encargado recibe 403 E_ACCESO_NO_PERMITIDO y sin sesión 401', async () => {
    const r = await get('listarMisMultas', await entrar('marta@club.test', 'Cumbre2026'));
    expect(r.status).toBe(403);
    expect((await r.json()).codigo).toBe('E_ACCESO_NO_PERMITIDO');
    expect((await get('listarMisMultas')).status).toBe(401);
  });
});

const post = (operacion, cuerpo, cookie) => fetch(`${base}/api/${operacion}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(cuerpo) });

describe('API-003-07 GET /api/listarMultas y API-003-08 POST /api/marcarMultaPagada', () => {
  it('el encargado lista las multas con el socio y marca la de 6 € Pagada; repetirlo la deja igual', async () => {
    const cookie = await entrar('marta@club.test', 'Cumbre2026');
    expect(await (await get('listarMultas', cookie)).json()).toMatchObject({ ok: true, datos: [{ socio: 'Pablo Ruiz', importeEur: 6, estado: 'Pendiente' }] });
    const pago = await post('marcarMultaPagada', { multaId: 1 }, cookie);
    expect(pago.status).toBe(200);
    expect(await pago.json()).toMatchObject({ ok: true, datos: { estado: 'Pagada', pagadaEl: '2026-12-11' } });
    expect(await (await post('marcarMultaPagada', { multaId: 1 }, cookie)).json()).toMatchObject({ ok: true, datos: { estado: 'Pagada', pagadaEl: '2026-12-11' } });
  });

  it('un socio recibe 403 en las dos operaciones, una multa inexistente 404 y el almacén caído 503', async () => {
    const socio = await entrar('pablo@club.test', 'Nieve2026');
    expect((await get('listarMultas', socio)).status).toBe(403);
    expect((await post('marcarMultaPagada', { multaId: 1 }, socio)).status).toBe(403);
    const cookie = await entrar('marta@club.test', 'Cumbre2026');
    const noExiste = await post('marcarMultaPagada', { multaId: 99 }, cookie);
    expect(noExiste.status).toBe(404);
    expect((await noExiste.json()).codigo).toBe('E_MULTA_NO_ENCONTRADA');
    e.caer();
    expect((await post('marcarMultaPagada', { multaId: 1 }, cookie)).status).toBe(503);
  });
});
