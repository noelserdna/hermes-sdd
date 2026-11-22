import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearApp } from '../../src/server/app.js';
import { crearAlmacenMemoria } from '../../src/server/store/almacen-memoria.js';
import { crearAlmacenJson } from '../../src/server/store/almacen-json.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';
import { crearManejador } from '../../src/server/http/rutas.js';
import { datosSemilla } from '../../demo/sembrar.mjs';

let app, http;
const sesiones = {};
const idCookie = (r) => `mm_sesion=${/mm_sesion=([^;]+)/.exec(r.cabeceras['Set-Cookie'])[1]}`;

async function montar(datos) {
  app = crearApp({ store: crearAlmacenMemoria(datos ?? await datosSemilla({ hoy: '2026-11-22' })), reloj: crearRelojManual('2026-11-22T10:00:00Z') });
  http = crearManejador(app);
  const entrar = async (correo, contrasena) => idCookie(await http({ metodo: 'POST', ruta: '/api/entrar', cuerpo: { correo, contrasena } }));
  sesiones.pablo = await entrar('pablo@club.test', 'Piolet2026!');
  sesiones.lucia = await entrar('lucia@club.test', 'Cumbre2026!');
  sesiones.elena = await entrar('elena@club.test', 'Junta2026!');
}
const listar = async (cookie = sesiones.pablo) => (await http({ metodo: 'GET', ruta: '/api/material', cookie })).cuerpo.material;
const anadir = (nombre, cantidad, cookie = sesiones.pablo) => http({ metodo: 'POST', ruta: '/api/material', cuerpo: { nombre, cantidad }, cookie });
const retirar = (id, cantidad, cookie = sesiones.pablo) => http({ metodo: 'POST', ruta: `/api/material/${id}/retirar`, cuerpo: { cantidad }, cookie });
const total = async (nombre) => (await listar()).find((m) => m.nombre === nombre)?.total;

beforeEach(() => montar());

describe('API-003-01 addUnits · INV-MAT-001..004', () => {
  it('añadir a un tipo existente suma a su total y un tipo nuevo se crea con esa cantidad', async () => {
    const r = await anadir('Casco', 2);
    expect(r.estado).toBe(200);
    expect(await total('Casco')).toBe(5);
    await anadir('Piolet', 2);
    expect((await listar()).map((m) => [m.nombre, m.total])).toEqual([['Casco', 5], ['Cuerda', 0], ['Piolet', 2]]);
  });

  it('INV-MAT-004 el nombre es único sin distinguir mayúsculas ni espacios alrededor', async () => {
    await anadir('  cAsCo ', 1);
    const filas = await listar();
    expect(filas.filter((m) => m.nombre.toLowerCase() === 'casco')).toHaveLength(1);
    expect(await total('Casco')).toBe(4);
  });

  it('PROP-023 nombres con capitalización aleatoria no crean un segundo tipo', async () => {
    const variantes = ['PIOLET', 'piolet', 'PiOlEt', 'pIoLeT'];
    for (const v of variantes) await anadir(v, 1);
    const piolets = (await listar()).filter((m) => m.nombre.toLowerCase() === 'piolet');
    expect(piolets).toHaveLength(1);
    expect(piolets[0].total).toBe(4);
  });

  it('AC-015-03 cantidad 0, negativa, decimal o vacía: E_CANTIDAD_INVALIDA y nada cambia', async () => {
    const antes = await listar();
    for (const cantidad of [0, -1, 1.5, null, 'dos']) {
      const r = await anadir('Cuerda', cantidad);
      expect(r.estado).toBe(400);
      expect(r.cuerpo.error).toEqual({ codigo: 'E_CANTIDAD_INVALIDA', mensaje: 'La cantidad debe ser un número entero de 1 o más' });
    }
    expect(await listar()).toEqual(antes);
  });

  it('AC-015-04 nombre vacío: E_NOMBRE_VACIO y nada cambia', async () => {
    const antes = await listar();
    for (const nombre of ['', '   ', undefined]) {
      const r = await anadir(nombre, 3);
      expect(r.cuerpo.error.codigo).toBe('E_NOMBRE_VACIO');
    }
    expect(await listar()).toEqual(antes);
  });

  // AC-015-06 (RN-035): "GIVEN "Cuerda" tiene 4 unidades y el encargado acaba de añadir 2 (6 unidades) WHEN se envía otra vez el mismo alta de 2 unidades THEN … "Cuerda: 8 unidades""
  it('AC-015-06 reenviar el mismo alta suma otra vez: segunda alta por diseño (RN-035)', async () => {
    await anadir('Cuerda', 4);
    await anadir('Cuerda', 2);
    expect(await total('Cuerda')).toBe(6);
    await anadir('Cuerda', 2);
    expect(await total('Cuerda')).toBe(8);
  });

  it('AC-015-05 solo el encargado añade: el socio y la junta reciben E_ACCESO_DENEGADO y nada cambia', async () => {
    const antes = await listar();
    for (const cookie of [sesiones.lucia, sesiones.elena]) {
      const r = await anadir('Cuerda', 2, cookie);
      expect(r.estado).toBe(403);
      expect(r.cuerpo.error.codigo).toBe('E_ACCESO_DENEGADO');
    }
    expect(await listar()).toEqual(antes);
  });

  it('sin sesión pide Entrar y no cambia nada', async () => {
    const r = await http({ metodo: 'POST', ruta: '/api/material', cuerpo: { nombre: 'Cuerda', cantidad: 2 } });
    expect(r.estado).toBe(401);
    expect(r.cuerpo).toEqual({ entrar: true });
  });

  it('ADR-DRAFT-002 el material sobrevive al reabrir el almacén JSON', async () => {
    const carpeta = mkdtempSync(path.join(tmpdir(), 'mm-mat-'));
    try {
      const ruta = path.join(carpeta, 'datos.json');
      await crearAlmacenJson(ruta).transaccion((d) => { Object.assign(d, datosSemillaVacia()); });
      const primera = crearApp({ store: crearAlmacenJson(ruta), reloj: crearRelojManual('2026-11-22T10:00:00Z') });
      const { addUnits } = await import('../../src/server/servicios/material.js');
      await addUnits({ ...primera, sesion: { rol: 'encargado' } }, { nombre: 'Piolet', cantidad: 2 });
      const segunda = crearApp({ store: crearAlmacenJson(ruta), reloj: crearRelojManual('2026-11-22T10:00:00Z') });
      const { listMaterial } = await import('../../src/server/servicios/material.js');
      expect((await listMaterial({ ...segunda, sesion: { rol: 'encargado' } })).material.map((m) => [m.nombre, m.total])).toEqual([['Piolet', 2]]);
    } finally { rmSync(carpeta, { recursive: true, force: true }); }
  });
});
const datosSemillaVacia = () => ({ version: 1, cuentas: [], material: [], reservas: [], multas: [] });

describe('API-003-02 withdrawUnits · INV-MAT-001, INV-MAT-002', () => {
  const idDe = async (nombre) => (await listar()).find((m) => m.nombre === nombre).id;

  it('con 2 de 3 Casco reservadas, retirar 3 falla con las unidades necesarias y el primer día; retirar 1 deja 2', async () => {
    const { startDate } = (await app.store.leer()).reservas[0];
    const fallo = await retirar(await idDe('Casco'), 3);
    expect(fallo.estado).toBe(409);
    expect(fallo.cuerpo.error).toEqual({ codigo: 'E_BAJA_UNIDADES_NECESARIAS', mensaje: `No se puede dar de baja: hay 2 unidades de Casco necesarias el ${startDate}` });
    expect(await total('Casco')).toBe(3);
    expect((await retirar(await idDe('Casco'), 1)).estado).toBe(200);
    expect(await total('Casco')).toBe(2);
  });

  it('retirar justo hasta la cobertura de las reservas se acepta y una más ya no', async () => {
    await retirar(await idDe('Casco'), 1);
    const r = await retirar(await idDe('Casco'), 1);
    expect(r.cuerpo.error.codigo).toBe('E_BAJA_UNIDADES_NECESARIAS');
    expect(await total('Casco')).toBe(2);
  });

  it('INV-MAT-001 más unidades de las que hay: E_BAJA_UNIDADES_INSUFICIENTES y el total no cambia (también al repetir una baja)', async () => {
    await anadir('Cuerda', 1);
    const id = await idDe('Cuerda');
    expect((await retirar(id, 1)).estado).toBe(200);
    const otra = await retirar(id, 1);
    expect(otra.cuerpo.error).toEqual({ codigo: 'E_BAJA_UNIDADES_INSUFICIENTES', mensaje: 'No hay tantas unidades para dar de baja' });
    expect(await total('Cuerda')).toBe(0);
  });

  it('AC-016-04 cantidad inválida: E_CANTIDAD_INVALIDA y nada cambia', async () => {
    const id = await idDe('Casco');
    for (const cantidad of [0, -2, 0.5, null]) expect((await retirar(id, cantidad)).cuerpo.error.codigo).toBe('E_CANTIDAD_INVALIDA');
    expect(await total('Casco')).toBe(3);
  });

  it('un tipo que no existe da E_MATERIAL_NO_ENCONTRADO', async () => {
    const r = await retirar('m-no-existe', 1);
    expect(r.estado).toBe(404);
    expect(r.cuerpo.error.codigo).toBe('E_MATERIAL_NO_ENCONTRADO');
  });

  it('AC-016-05 solo el encargado retira: el socio y la junta reciben E_ACCESO_DENEGADO y nada cambia', async () => {
    const id = await idDe('Casco');
    for (const cookie of [sesiones.lucia, sesiones.elena]) {
      const r = await retirar(id, 1, cookie);
      expect(r.estado).toBe(403);
      expect(r.cuerpo.error.codigo).toBe('E_ACCESO_DENEGADO');
    }
    expect(await total('Casco')).toBe(3);
  });

  it('PROP-021 altas y bajas aleatorias: el total nunca es negativo', async () => {
    let semilla = 11;
    const azar = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };
    await montar(await datosSemilla({ hoy: '2026-11-22', reservas: [] }));
    for (let i = 0; i < 60; i++) {
      const n = 1 + Math.floor(azar() * 4);
      if (azar() < 0.5) await anadir('Casco', n); else await retirar(await idDe('Casco'), n);
      expect(await total('Casco')).toBeGreaterThanOrEqual(0);
    }
  });

  it('INV-RES-004 las unidades ocupadas se calculan al leer: cancelar la reserva libera la baja', async () => {
    const id = await idDe('Casco');
    expect((await retirar(id, 3)).estado).toBe(409);
    await app.store.transaccion((d) => { d.reservas[0].status = 'Cancelada'; });
    expect((await retirar(id, 3)).estado).toBe(200);
    expect(await total('Casco')).toBe(0);
    expect((await app.store.leer()).material.every((m) => !('ocupadas' in m))).toBe(true);
  });
});

describe('API-003-03 listMaterial · INV-MAT-003', () => {
  it('marca como reservable solo el tipo con unidades: Casco sí, Cuerda (0 unidades) no, y lo ve igual el socio que el encargado', async () => {
    const esperado = [['Casco', 3, true], ['Cuerda', 0, false]];
    expect((await listar(sesiones.pablo)).map((m) => [m.nombre, m.total, m.reservable])).toEqual(esperado);
    expect((await listar(sesiones.lucia)).map((m) => [m.nombre, m.total, m.reservable])).toEqual(esperado);
  });

  it('la junta no puede listar material (E_ACCESO_DENEGADO)', async () => {
    const r = await http({ metodo: 'GET', ruta: '/api/material', cookie: sesiones.elena });
    expect(r.cuerpo.error.codigo).toBe('E_ACCESO_DENEGADO');
  });
});
