import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { migrar, MIGRACIONES, deshacer } from '../../src/server/store/migraciones.js';
import { crearAlmacenJson } from '../../src/server/store/almacen-json.js';

let carpeta;
let ruta;
beforeEach(() => { carpeta = mkdtempSync(path.join(tmpdir(), 'mm-mig-')); ruta = path.join(carpeta, 'datos.json'); });
afterEach(() => rmSync(carpeta, { recursive: true, force: true }));

const cuenta = (id, extra = {}) => ({ id, name: `Socio ${id}`, email: `${id}@club.test`, passwordHash: 'scrypt$1$a$b', role: 'socio', mustChangePassword: false, active: true, failedLogins: 0, lockedUntil: null, ...extra });
const v1 = () => ({ version: 1, cuentas: [cuenta('a'), cuenta('b', { active: false })], material: [{ id: 'm1', name: 'Casco', totalUnits: 3 }], reservas: [], multas: [] });

describe('INV-SOC-009 migración 002_baja_en (ADR-003, D-PA-003)', () => {
  it('abrir un fichero de la versión 1 añade bajaEn: null a cada cuenta sin tocar el resto de los datos', async () => {
    writeFileSync(ruta, JSON.stringify(v1()));
    const datos = await crearAlmacenJson(ruta).leer();
    expect(datos.cuentas.map((c) => c.bajaEn)).toEqual([null, null]);
    expect(datos.cuentas.map(({ bajaEn: _b, ...resto }) => resto)).toEqual(v1().cuentas);
    expect(datos.material).toEqual(v1().material);
    expect(datos.migraciones).toEqual(['002_baja_en']);
  });

  it('ejecutarla dos veces no cambia nada: respeta un bajaEn ya guardado', () => {
    const una = migrar({ ...v1(), cuentas: [cuenta('a', { active: false, bajaEn: '2026-11-22' })] });
    const dos = migrar(structuredClone(una));
    expect(dos).toEqual(una);
    expect(dos.cuentas[0].bajaEn).toBe('2026-11-22');
  });

  it('el paso de bajada quita el campo y deja los datos como estaban', () => {
    const subida = migrar(v1());
    const baja = deshacer(subida, '002_baja_en');
    expect(baja.cuentas.every((c) => !('bajaEn' in c))).toBe(true);
    expect(baja.migraciones).toEqual([]);
    expect(baja.cuentas).toEqual(v1().cuentas);
    expect(MIGRACIONES.map((m) => m.id)).toEqual(['002_baja_en']);
  });

  it('lo migrado se guarda en la siguiente transacción', async () => {
    writeFileSync(ruta, JSON.stringify(v1()));
    await crearAlmacenJson(ruta).transaccion(() => {});
    expect(JSON.parse(readFileSync(ruta, 'utf8')).cuentas[0].bajaEn).toBeNull();
  });
});
