import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../../src/server/http.js';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { nuevaCuenta } from '../../../src/domain/acceso.js';

const servidores = [];
let almacen;
let base;
afterEach(async () => { while (servidores.length) await new Promise((r) => servidores.pop().close(r)); });

beforeEach(async () => {
  almacen = crearAlmacenMemoria();
  await almacen.transaction((db) => {
    nuevaCuenta(db, { nombre: 'Encargado', correo: 'encargado@club.es', contrasena: 'Glaciar2026', rol: 'encargado' });
    nuevaCuenta(db, { nombre: 'Pablo', correo: 'pablo@club.es', contrasena: 'Arista2026', rol: 'socio' });
  });
  const reloj = { ahora: () => new Date('2026-11-21T11:00:00Z'), hoy: () => '2026-11-21' };
  const manejador = crearManejador({ almacen, reloj, env: {}, registrar: () => {} });
  const servidor = http.createServer((req, res) => manejador(req, res, () => { res.statusCode = 404; res.end(); }));
  servidores.push(servidor);
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

const entrar = async (correo, contrasena) => {
  const r = await fetch(`${base}/api/iniciar-sesion`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ correo, contrasena }) });
  return r.headers.get('set-cookie').split(';')[0];
};
const llamar = (cookie, metodo, ruta, cuerpo) => fetch(`${base}${ruta}`, {
  method: metodo, headers: { cookie, 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined,
});

describe('baja de un socio con la sesión abierta (INV-ACC-006, D-PA-004, decisión Q-spec-auditor-001)', () => {
  it('REQ-F-002 tras dar de baja a Pablo, su cookie da E_NO_AUTENTICADO en la siguiente petición y sus sesiones se borraron en la misma transacción', async () => {
    const cookiePablo = await entrar('pablo@club.es', 'Arista2026');
    const cookieEncargado = await entrar('encargado@club.es', 'Glaciar2026');
    expect((await llamar(cookiePablo, 'GET', '/api/mis-reservas')).status).toBe(200);
    const pablo = (await almacen.load()).cuentas.find((c) => c.correo === 'pablo@club.es');

    const baja = await llamar(cookieEncargado, 'POST', '/api/socios/baja', { cuentaId: pablo.id });
    expect(baja.status).toBe(200);
    expect(await baja.json()).toMatchObject({ nombre: 'Pablo', estado: 'Baja' });
    // revocarDeCuenta: ya no queda ninguna sesión de Pablo en el almacén (no hace falta esperar a su siguiente petición)
    expect((await almacen.load()).sesiones.filter((s) => s.cuentaId === pablo.id)).toEqual([]);

    const siguiente = await llamar(cookiePablo, 'GET', '/api/mis-reservas');
    expect(siguiente.status).toBe(401);
    expect((await siguiente.json()).error).toBe('E_NO_AUTENTICADO');
    // la sesión del encargado sigue viva
    expect((await llamar(cookieEncargado, 'GET', '/api/socios?detalle=1')).status).toBe(200);
  });

  it('API-001-03 y API-001-06 por HTTP: el alta da 201 con el socio sin hash y la lista con detalle lleva el correo; un socio recibe 403', async () => {
    const cookieEncargado = await entrar('encargado@club.es', 'Glaciar2026');
    const alta = await llamar(cookieEncargado, 'POST', '/api/socios', { nombre: 'Marta Ruiz', correo: 'marta@club.es', contrasena: 'Glaciar2026' });
    expect(alta.status).toBe(201);
    expect(await alta.json()).toMatchObject({ nombre: 'Marta Ruiz', correo: 'marta@club.es', estado: 'Activa' });
    const lista = await (await llamar(cookieEncargado, 'GET', '/api/socios?detalle=1')).json();
    expect(lista.map((s) => s.nombre)).toEqual(['Pablo', 'Marta Ruiz']);
    expect(JSON.stringify(lista)).not.toMatch(/scrypt|hash/);
    const cookiePablo = await entrar('pablo@club.es', 'Arista2026');
    expect((await llamar(cookiePablo, 'GET', '/api/socios?detalle=1')).status).toBe(403);
  });
});
