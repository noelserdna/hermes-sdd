import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { crearManejador } from '../../src/server/plugin.js';
import { REGISTRO } from '../../src/domain/permisos.js';
import { crearEntorno } from '../helpers/entorno.js';
import { sembrarMulta, sembrarUnidades, sembrarReserva } from '../helpers/material.js';

let e; let servidor; let base; let pablo; const lineasLog = [];
beforeAll(async () => {
  e = crearEntorno({ inicio: '2026-12-11T10:00:00Z' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  sembrarUnidades(e, 'Casco', 1);
  sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', inicio: '2026-12-05', fin: '2026-12-07', estado: 'Devuelto' });
  sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
  pablo = e.store.leer().cuentas.find((c) => c.correo === 'pablo@club.test').id;
  const manejador = crearManejador({ store: e.store, reloj: e.reloj, log: (l) => lineasLog.push(l) });
  servidor = http.createServer((req, res) => manejador(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
afterAll(() => new Promise((r) => servidor.close(r)));

async function entrar(correo, contrasena = 'Cumbre2026') {
  const r = await fetch(`${base}/api/iniciarSesion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo, contrasena }) });
  return r.headers.get('set-cookie').split(';')[0];
}
const get = (ruta, cookie) => fetch(`${base}/api/${ruta}`, { headers: cookie ? { cookie } : {} });
const post = (ruta, cuerpo, cookie) => fetch(`${base}/api/${ruta}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(cuerpo) });
/** Pide la operación por la ruta y el verbo que acepte (GET lecturas, POST escrituras). */
async function pedir(operacion, cookie) {
  const r = await get(operacion, cookie);
  return r.status === 405 ? post(operacion, {}, cookie) : r;
}

describe('REQ-NF-001 seguridad por rol sobre la API', () => {
  // REQ-NF-001 AC1: "GIVEN session of "lucia" WHEN she requests the reservations, fines or profile of "pablo" by address THEN the response is refused (no data of "pablo")"
  it('REQ-NF-001 AC1 SEC-T-001 la sesión de "lucia" que pide las multas o el historial de "pablo" recibe rechazo y ningún dato de Pablo', async () => {
    const lucia = await entrar('lucia@club.test');
    const historial = await get(`consultarHistorialSocio?socioId=${pablo}`, lucia);
    expect(historial.status).toBe(403);
    const todas = await get('listarMultas', lucia);
    expect(todas.status).toBe(403);
    const perfil = await get(`listarSocios?socioId=${pablo}`, lucia);
    expect(perfil.status).toBe(403);
    for (const r of [historial, todas, perfil]) {
      const texto = JSON.stringify(await r.json());
      expect(texto).toContain('E_ACCESO_NO_PERMITIDO');
      expect(texto).not.toMatch(/Pablo|pablo@/);
    }
    // las lecturas propias ignoran el socio pedido: Lucía solo recibe lo suyo, que es nada
    for (const ruta of [`listarMisMultas?socioId=${pablo}`, `listarMisReservas?socioId=${pablo}`]) {
      const cuerpo = await (await get(ruta, lucia)).json();
      expect(cuerpo).toEqual({ ok: true, datos: [] });
    }
  });

  // REQ-NF-001 AC2: "GIVEN no session WHEN any data address is requested THEN the response is refused"
  it('REQ-NF-001 AC2 SEC-T-002 sin sesión cada operación de la API se rechaza con 401 E_NO_AUTENTICADO', async () => {
    const conRuta = [];
    for (const [operacion, definicion] of Object.entries(REGISTRO)) {
      if (definicion.publica || definicion.roles?.includes('sistema')) continue;
      const r = await pedir(operacion);
      expect(r.status, operacion).toBe(401);
      expect((await r.json()).codigo, operacion).toBe('E_NO_AUTENTICADO');
      conRuta.push(operacion);
    }
    expect(conRuta).toEqual(expect.arrayContaining(['listarMisMultas', 'consultarHistorialSocio', 'consultarPrestado', 'listarSocios']));
    // las operaciones del sistema no tienen ruta (D-PA-003)
    for (const operacion of ['aplicarNoRecogidas', 'aplicarMultaPorRetraso']) expect((await get(operacion, await entrar('marta@club.test'))).status).toBe(404);
  });

  // REQ-NF-001 AC3: "GIVEN the stored data after creating "pablo" with password "Nieve2026" THEN the text "Nieve2026" appears nowhere and the stored value is a hash"
  it('REQ-NF-001 AC3 SEC-T-003 tras crear a "pablo" con la contraseña "Nieve2026" el almacén no contiene "Nieve2026" y sí un hash', async () => {
    const r = await post('crearSocio', { nombre: 'Pablo Nuevo', correo: 'nuevo@club.test', contrasena: 'Nieve2026' }, await entrar('marta@club.test'));
    expect(r.status).toBe(200);
    expect(JSON.stringify(await r.json())).not.toContain('Nieve2026');
    const almacen = readFileSync(e.archivo, 'utf8');
    expect(almacen).not.toContain('Nieve2026');
    const creada = JSON.parse(almacen).cuentas.find((c) => c.correo === 'nuevo@club.test');
    expect(creada.hashContrasena).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  // REQ-NF-001 AC4: "GIVEN a socio session WHEN the socio opens the list of all socios THEN the user sees "Acceso no permitido""
  it('REQ-NF-001 AC4 un socio recibe E_ACCESO_NO_PERMITIDO ("Acceso no permitido") en listarSocios', async () => {
    const r = await get('listarSocios', await entrar('lucia@club.test'));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ ok: false, codigo: 'E_ACCESO_NO_PERMITIDO', mensaje: 'Acceso no permitido' });
  });

  it('SEC-T-006 ningún secreto ni contraseña aparece en los logs: ni contraseñas, ni hashes, ni sid, ni correos', async () => {
    const cookie = await entrar('lucia@club.test');
    await entrar('marta@club.test');
    await post('iniciarSesion', { correo: 'lucia@club.test', contrasena: 'ContrasenaMala1' });
    await get('listarMisMultas', cookie);
    const registro = lineasLog.join('\n');
    expect(lineasLog.length).toBeGreaterThan(3);
    expect(registro).not.toMatch(/Cumbre2026|Nieve2026|ContrasenaMala1|scrypt|lucia@club|marta@club|Pablo|Lucía/);
    expect(registro).not.toContain(cookie.split('=')[1]);
  });
});

describe('REQ-NF-001 AC2 direcciones del fichero de datos con el servidor de Vite real', () => {
  let vite; let http2; let urlBase; let archivoDatos; let dirAnterior;
  beforeAll(async () => {
    const { createServer } = await import('vite');
    const { materialMontana } = await import('../../src/server/plugin.js');
    const ent = crearEntorno({ inicio: '2026-12-11T10:00:00Z' });
    ent.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
    archivoDatos = ent.archivo;
    // el fichero de datos vive dentro de la raíz del proyecto, como `data/almacen.json` en producción
    const { mkdirSync, copyFileSync } = await import('node:fs');
    const path = await import('node:path');
    mkdirSync(path.resolve('data'), { recursive: true });
    const dentro = path.resolve('data', `almacen-test-${process.pid}.json`);
    copyFileSync(ent.archivo, dentro);
    archivoDatos = dentro;
    dirAnterior = process.env.DATA_FILE; process.env.DATA_FILE = dentro;
    vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'silent', plugins: [materialMontana()], server: { middlewareMode: true }, appType: 'custom' });
    http2 = http.createServer((req, res) => vite.middlewares(req, res, () => { res.statusCode = 404; res.end(); }));
    await new Promise((r) => http2.listen(0, '127.0.0.1', r));
    urlBase = `http://127.0.0.1:${http2.address().port}`;
  });
  afterAll(async () => {
    await new Promise((r) => http2.close(r));
    await vite.close();
    if (dirAnterior === undefined) delete process.env.DATA_FILE; else process.env.DATA_FILE = dirAnterior;
    const { rmSync } = await import('node:fs');
    rmSync(archivoDatos, { force: true });
  });

  // REQ-NF-001 AC2: "GIVEN no session WHEN any data address is requested THEN the response is refused"
  it('REQ-NF-001 AC2 SEC-T-002 sin sesión la dirección del fichero de datos, por cualquier ruta, se rechaza con 401 E_NO_AUTENTICADO y no devuelve datos', async () => {
    const nombre = archivoDatos.split('/').pop();
    const rutas = [`/data/${nombre}`, `/data/${nombre}.tmp`, `/data/${nombre}?raw`, `/data/%2e%2e/data/${nombre}`, `/%64ata/${nombre}`, `/@fs${archivoDatos}`, `/data/`, `/data`];
    for (const ruta of rutas) {
      const r = await fetch(`${urlBase}${ruta}`);
      const texto = await r.text();
      expect(r.status, ruta).toBe(401);
      expect(JSON.parse(texto).codigo, ruta).toBe('E_NO_AUTENTICADO');
      expect(texto, ruta).not.toMatch(/lucia@club|hashContrasena|cuentas/);
    }
  });

  // REQ-NF-001 AC2: "GIVEN no session WHEN any data address is requested THEN the response is refused" (CH-006: también con ?import, /@id/ o //)
  it('REQ-NF-001 AC2 SEC-T-002 sin sesión ninguna forma de pedir el fichero de datos (?import, /@id/, //, dirección absoluta) se rechaza con 401 y sin su contenido', async () => {
    const nombre = archivoDatos.split('/').pop();
    const formas = [`/@id/data/${nombre}?import`, `/@id${archivoDatos}?import`, `/@id/__x00__data/${nombre}?import`, `//data/${nombre}`, `//data/${nombre}?import`, `///data/${nombre}?raw`, `/data//${nombre}?import`, `/data/${nombre}?import`, `/data/${nombre}?import&raw&url&inline`, `/@fs${archivoDatos}?import`, `http://x/data/${nombre}?import`, `http://x//data/${nombre}`];
    for (const forma of formas) {
      const { estado, texto } = await new Promise((resolve, reject) => {
        const q = http.request({ host: '127.0.0.1', port: http2.address().port, path: forma, method: 'GET' }, (r) => { let t = ''; r.on('data', (d) => { t += d; }); r.on('end', () => resolve({ estado: r.statusCode, texto: t })); });
        q.on('error', reject); q.end();
      });
      expect(estado, forma).toBe(401);
      expect(JSON.parse(texto).codigo, forma).toBe('E_NO_AUTENTICADO');
      expect(texto, forma).not.toMatch(/lucia@club|hashContrasena|cuentas|export /);
    }
  });

  it('REQ-NF-001 AC2 SEC-T-002 con sesión el fichero de datos tampoco se sirve: 403 E_ACCESO_NO_PERMITIDO', async () => {
    const entrada = await fetch(`${urlBase}/api/iniciarSesion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'lucia@club.test', contrasena: 'Cumbre2026' }) });
    const cookie = entrada.headers.get('set-cookie').split(';')[0];
    const r = await fetch(`${urlBase}/data/${archivoDatos.split('/').pop()}`, { headers: { cookie } });
    expect(r.status).toBe(403);
    expect((await r.json()).codigo).toBe('E_ACCESO_NO_PERMITIDO');
  });
});
