import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearAlmacenJson } from '../../src/server/store/almacen-json.js';
import { crearAlmacenMemoria } from '../../src/server/store/almacen-memoria.js';
import { MENSAJES, ErrorDominio, mensajeDe } from '../../src/server/mensajes.js';
import * as nodeFs from 'node:fs/promises';

let carpeta;
let ruta;
beforeEach(() => { carpeta = mkdtempSync(path.join(tmpdir(), 'mm-')); ruta = path.join(carpeta, 'datos.json'); });
afterEach(() => rmSync(carpeta, { recursive: true, force: true }));

describe('ADR-DRAFT-002 almacén JSON', () => {
  it('una transacción escribe en .tmp y renombra; al reabrir el fichero devuelve los mismos datos', async () => {
    const a = crearAlmacenJson(ruta);
    await a.transaccion((d) => { d.material.push({ id: 'm1', name: 'Casco', totalUnits: 3 }); });
    expect(readdirSync(carpeta)).toEqual(['datos.json']);
    const b = crearAlmacenJson(ruta);
    const datos = await b.leer();
    expect(datos.material).toEqual([{ id: 'm1', name: 'Casco', totalUnits: 3 }]);
    expect(datos.version).toBe(1);
    expect(Array.isArray(datos.cuentas) && Array.isArray(datos.reservas) && Array.isArray(datos.multas)).toBe(true);
  });

  it('dos transacciones simultáneas se serializan: no se pierde ninguna', async () => {
    const a = crearAlmacenJson(ruta);
    await Promise.all(Array.from({ length: 10 }, (_, i) => a.transaccion(async (d) => {
      const n = d.material.length;
      await new Promise((r) => setTimeout(r, 5 - (i % 5)));
      d.material.push({ id: `m${n}`, name: `T${n}`, totalUnits: 1 });
    })));
    const datos = await a.leer();
    expect(datos.material.map((m) => m.id)).toEqual(Array.from({ length: 10 }, (_, i) => `m${i}`));
  });

  it('un fallo de escritura lanza E_ALMACEN_NO_DISPONIBLE y deja el fichero sin cambios', async () => {
    const a = crearAlmacenJson(ruta);
    await a.transaccion((d) => { d.material.push({ id: 'm1', name: 'Casco', totalUnits: 3 }); });
    const antes = readFileSync(ruta, 'utf8');
    const roto = crearAlmacenJson(ruta, { fs: { ...nodeFs, rename: async () => { throw new Error('disco lleno'); } } });
    await expect(roto.transaccion((d) => { d.material[0].totalUnits = 99; })).rejects.toMatchObject({ codigo: 'E_ALMACEN_NO_DISPONIBLE' });
    expect(readFileSync(ruta, 'utf8')).toBe(antes);
    expect(readdirSync(carpeta)).toEqual(['datos.json']);
  });

  it('una transacción que lanza un error de dominio no escribe nada', async () => {
    const a = crearAlmacenJson(ruta);
    await a.transaccion((d) => { d.material.push({ id: 'm1', name: 'Casco', totalUnits: 3 }); });
    const antes = readFileSync(ruta, 'utf8');
    await expect(a.transaccion((d) => { d.material[0].totalUnits = 0; throw new ErrorDominio('E_CANTIDAD_INVALIDA'); })).rejects.toMatchObject({ codigo: 'E_CANTIDAD_INVALIDA' });
    expect(readFileSync(ruta, 'utf8')).toBe(antes);
  });

  it('lee de disco cada vez: un fichero sembrado por fuera se ve sin reiniciar', async () => {
    const a = crearAlmacenJson(ruta);
    await a.leer();
    expect(existsSync(ruta)).toBe(false);
    writeFileSync(ruta, JSON.stringify({ version: 1, cuentas: [], material: [{ id: 'x', name: 'Cuerda', totalUnits: 4 }], reservas: [], multas: [] }));
    expect((await a.leer()).material[0].name).toBe('Cuerda');
  });

  it('el almacén en memoria cumple el mismo contrato y puede simular el fallo', async () => {
    const m = crearAlmacenMemoria();
    await m.transaccion((d) => { d.material.push({ id: 'm1', name: 'Casco', totalUnits: 3 }); });
    expect((await m.leer()).material).toHaveLength(1);
    m.fallarEscritura = true;
    await expect(m.transaccion((d) => { d.material.length = 0; })).rejects.toMatchObject({ codigo: 'E_ALMACEN_NO_DISPONIBLE' });
    expect((await m.leer()).material).toHaveLength(1);
  });
});

describe('VO-010 catálogo de mensajes', () => {
  it('expone los mensajes literales en español', () => {
    expect(MENSAJES.E_CREDENCIALES).toBe('Correo o contraseña incorrectos');
    expect(MENSAJES.E_CUENTA_BLOQUEADA).toBe('Cuenta bloqueada. Vuelve a intentarlo en 15 minutos');
    expect(MENSAJES.E_PAGINA_PROHIBIDA).toBe('No tienes permiso para ver esta página');
    expect(MENSAJES.E_ACCESO_DENEGADO).toBe('Acceso denegado');
    expect(MENSAJES.E_ALMACEN_NO_DISPONIBLE).toBe('No se pudo guardar. Inténtalo de nuevo');
  });

  it('rellena los huecos {n}, {material} y {día}', () => {
    expect(mensajeDe('E_BAJA_UNIDADES_NECESARIAS', { n: 2, material: 'Tienda', día: '2026-12-06' }))
      .toBe('No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06');
  });
});
