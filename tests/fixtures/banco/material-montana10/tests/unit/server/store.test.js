import { describe, it, expect } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import * as fsp from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearAlmacen, crearAlmacenMemoria } from '../../../src/server/store.js';
import { ErrorDominio } from '../../../src/domain/errores.js';
import { LOGIN_MAX_FAILURES, LOGIN_LOCK_MINUTES, SESSION_IDLE_HOURS, RESERVA_MAX_DAYS, FINE_PER_DAY_EUR, RETENTION_YEARS } from '../../../src/domain/config.js';
import { CATALOGO } from '../../../src/domain/errores.js';

const carpeta = () => mkdtempSync(path.join(tmpdir(), 'mm10-store-'));

describe('almacén', () => {
  it('load() crea data/store.json con schemaVersion 1 y sus colecciones, en la ruta de STORE_FILE', async () => {
    const archivo = path.join(carpeta(), 'sub', 'store.json');
    const almacen = crearAlmacen({ archivo });
    const datos = await almacen.load();
    expect(datos).toEqual({ schemaVersion: 1, cuentas: [], unidades: [], reservas: [], multas: [], sesiones: [] });
    expect(existsSync(archivo)).toBe(true);
    expect(JSON.parse(readFileSync(archivo, 'utf8')).schemaVersion).toBe(1);
  });

  it('por defecto la ruta es STORE_FILE y, sin ella, data/store.json', () => {
    expect(crearAlmacen({ env: { STORE_FILE: '/tmp/otro.json' } }).archivo).toBe('/tmp/otro.json');
    expect(crearAlmacen({ env: {} }).archivo).toBe(path.resolve('data/store.json'));
  });

  // ADR-002: dos transaction concurrentes se ejecutan una tras otra
  it('ADR-002 dos transaction concurrentes se ejecutan una tras otra (la segunda ve el resultado de la primera)', async () => {
    const almacen = crearAlmacenMemoria();
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    const primera = almacen.transaction(async (db) => { await espera(20); db.unidades.push({ id: 1 }); return db.unidades.length; });
    const segunda = almacen.transaction(async (db) => { db.unidades.push({ id: 2 }); return db.unidades.length; });
    expect(await Promise.all([primera, segunda])).toEqual([1, 2]);
    expect((await almacen.load()).unidades).toHaveLength(2);
  });

  it('una transaction que lanza no deja cambios', async () => {
    const almacen = crearAlmacenMemoria();
    await expect(almacen.transaction((db) => { db.unidades.push({ id: 9 }); throw new Error('falla'); })).rejects.toThrow('falla');
    expect((await almacen.load()).unidades).toEqual([]);
  });

  it('escritura en fichero temporal + rename; un fallo inyectado devuelve E_ALMACEN_NO_DISPONIBLE y deja el fichero anterior intacto', async () => {
    const dir = carpeta();
    const archivo = path.join(dir, 'store.json');
    const bueno = crearAlmacen({ archivo });
    await bueno.transaction((db) => { db.unidades.push({ id: 1, tipo: 'Piolet' }); });
    const antes = readFileSync(archivo, 'utf8');

    const renombres = [];
    const roto = crearAlmacen({ archivo, fs: { ...fsp, rename: async (de, a) => { renombres.push([de, a]); throw new Error('disco lleno'); } } });
    const fallo = await roto.transaction((db) => { db.unidades.push({ id: 2 }); }).catch((e) => e);
    expect(fallo).toBeInstanceOf(ErrorDominio);
    expect(fallo.codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    expect(renombres[0][1]).toBe(archivo);
    expect(renombres[0][0]).not.toBe(archivo);
    expect(readFileSync(archivo, 'utf8')).toBe(antes);
    expect(readdirSync(dir)).toEqual(['store.json']);
  });

  it('un fichero ilegible se informa como E_ALMACEN_NO_DISPONIBLE sin tocarlo', async () => {
    const archivo = path.join(carpeta(), 'store.json');
    await fsp.writeFile(archivo, '{ no es json');
    const error = await crearAlmacen({ archivo }).load().catch((e) => e);
    expect(error.codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    expect(readFileSync(archivo, 'utf8')).toBe('{ no es json');
  });

  it('vuelve a leer el fichero en cada operación (un cambio externo se ve)', async () => {
    const archivo = path.join(carpeta(), 'store.json');
    const almacen = crearAlmacen({ archivo });
    await almacen.load();
    const otro = crearAlmacen({ archivo });
    await otro.transaction((db) => { db.cuentas.push({ id: 1 }); });
    expect((await almacen.load()).cuentas).toHaveLength(1);
  });
});

describe('config y errores', () => {
  it('config.js exporta cada valor del registro de valores', () => {
    expect([LOGIN_MAX_FAILURES, LOGIN_LOCK_MINUTES, SESSION_IDLE_HOURS, RESERVA_MAX_DAYS, FINE_PER_DAY_EUR, RETENTION_YEARS]).toEqual([5, 15, 8, 14, 2, 2]);
  });

  it('VO-010 el catálogo trae el mensaje literal de cada error', () => {
    expect(CATALOGO.E_CREDENCIALES_INVALIDAS.mensaje).toBe('Correo o contraseña incorrectos');
    expect(CATALOGO.E_CUENTA_BLOQUEADA.mensaje).toBe('Cuenta bloqueada. Inténtalo de nuevo en 15 minutos');
    expect(CATALOGO.E_RESERVA_MUY_LARGA.mensaje).toBe('Máximo 14 días por reserva');
    expect(new ErrorDominio('E_SIN_UNIDADES_LIBRES', { material: 'Tienda' }).mensaje).toBe('No quedan unidades libres de Tienda esas fechas');
    expect(new ErrorDominio('E_MULTA_PENDIENTE', { importe: 4 }).mensaje).toBe('Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar');
    expect(Object.keys(CATALOGO)).toHaveLength(28);
  });
});
