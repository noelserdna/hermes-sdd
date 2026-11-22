import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearStore, siguienteId } from '../../src/server/store.js';
import { ERRORES } from '../../src/domain/errores.js';

let archivo;
beforeEach(() => { archivo = path.join(mkdtempSync(path.join(tmpdir(), 'mm-')), 'almacen.json'); });

describe('store', () => {
  it('INT-T-001 el almacén conserva los datos al recrear el store', () => {
    const a = crearStore({ archivo });
    a.transaccion((db) => { db.cuentas.push({ id: siguienteId(db, 'cuentas'), correo: 'marta@club.test' }); });
    const b = crearStore({ archivo });
    expect(b.leer().cuentas).toEqual([{ id: 1, correo: 'marta@club.test' }]);
  });

  it('INT-T-001 el almacén nace con version, contadores y las siete colecciones', () => {
    const db = crearStore({ archivo }).leer();
    expect(Object.keys(db).sort()).toEqual(['contadores', 'cuentas', 'multas', 'reservas', 'sesiones', 'unidades', 'version']);
    expect(db.version).toBe(1);
    expect(db.cuentas).toEqual([]);
  });

  it('D-T-003 fallo de escritura: lanza E_ALMACEN_NO_DISPONIBLE y el almacén queda sin cambios', () => {
    const bueno = crearStore({ archivo });
    bueno.transaccion((db) => { db.cuentas.push({ id: 1 }); });
    const antes = readFileSync(archivo, 'utf8');
    const malo = crearStore({ archivo, falloEscritura: true });
    let error;
    try { malo.transaccion((db) => { db.cuentas.push({ id: 2 }); }); } catch (e) { error = e; }
    expect(error.codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    expect(error.message).toBe('No se pudo guardar. Inténtalo de nuevo');
    expect(error.message).toBe(ERRORES.E_ALMACEN_NO_DISPONIBLE);
    expect(readFileSync(archivo, 'utf8')).toBe(antes);
  });

  it('D-T-003 un .tmp residual se ignora', () => {
    writeFileSync(`${archivo}.tmp`, '{ basura');
    const s = crearStore({ archivo });
    s.transaccion((db) => { db.cuentas.push({ id: 1 }); });
    expect(s.leer().cuentas).toHaveLength(1);
    expect(existsSync(`${archivo}.tmp`)).toBe(false);
  });

  it('una excepción dentro de la transacción no deja cambios (copia, valida, vuelca)', () => {
    const s = crearStore({ archivo });
    expect(() => s.transaccion((db) => { db.cuentas.push({ id: 1 }); throw new Error('x'); })).toThrow('x');
    expect(s.leer().cuentas).toEqual([]);
  });

  it('un almacén ilegible lanza E_ALMACEN_NO_DISPONIBLE', () => {
    writeFileSync(archivo, '{ no es json');
    expect(() => crearStore({ archivo }).leer()).toThrowError(expect.objectContaining({ codigo: 'E_ALMACEN_NO_DISPONIBLE' }));
  });
});
