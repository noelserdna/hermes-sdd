import { describe, it, expect, beforeEach } from 'vitest';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { consultarHistorial } from '../../../src/domain/prestamos.js';

let almacen;
const reloj = { ahora: () => new Date('2026-12-10T11:00:00Z'), hoy: () => '2026-12-10' };
const ctx = () => ({ almacen, reloj });
const junta = { id: 8, nombre: 'Ana', rol: 'junta' };
const encargado = { id: 9, nombre: 'Encargado', rol: 'encargado' };
const lucia = { id: 1, nombre: 'Lucía', rol: 'socio' };
const datos = () => almacen.load();

beforeEach(async () => {
  almacen = crearAlmacenMemoria();
  await almacen.transaction((db) => {
    db.cuentas.push(
      { id: 1, nombre: 'Lucía', rol: 'socio', correo: 'lucia@club.es', hashContrasena: 'scrypt$aa$bb' },
      { id: 2, nombre: 'Pablo', rol: 'socio', correo: 'pablo@club.es', hashContrasena: 'scrypt$cc$dd' },
      { id: 8, nombre: 'Ana', rol: 'junta', correo: 'ana@club.es', hashContrasena: 'scrypt$ee$ff' },
    );
    db.unidades.push({ id: 1, tipo: 'Piolet', numero: 2, estado: 'Activa' }, { id: 2, tipo: 'Casco', numero: 1, estado: 'Activa' });
    db.reservas.push(
      { id: 1, socioId: 1, tipo: 'Piolet', desde: '2026-12-05', hasta: '2026-12-07', estado: 'Devuelta', unidadId: 1, devueltaEl: '2026-12-09', creadaEl: '2026-11-20T10:00:00.000Z' },
      { id: 2, socioId: 1, tipo: 'Casco', desde: '2026-12-20', hasta: '2026-12-21', estado: 'Reservada', unidadId: null, devueltaEl: null, creadaEl: '2026-11-21T10:00:00.000Z' },
      { id: 3, socioId: 1, tipo: 'Cuerda', desde: '2026-11-01', hasta: '2026-11-02', estado: 'Reservada', unidadId: null, devueltaEl: null, creadaEl: '2026-10-21T10:00:00.000Z' },
    );
    db.multas.push({ id: 1, socioId: 1, reservaId: 1, dias: 1, importeEur: 2, estado: 'Pagada', pagadaEl: '2026-12-10' });
  });
});

describe('consultarHistorial (API-003-06, INV-LOA-402, RN-012)', () => {
  it('INV-LOA-402 la junta ve los préstamos de Lucía (los más recientes primero, la vencida como «No recogida») y su multa de 2 € Pagada, sin hash ni correo', async () => {
    const historial = await consultarHistorial(ctx(), junta, { socioId: 1 });
    expect(historial).toEqual({
      prestamos: [
        { unidad: null, material: 'Casco', desde: '2026-12-20', hasta: '2026-12-21', estado: 'Reservada' },
        { unidad: 'Piolet 2', material: 'Piolet', desde: '2026-12-05', hasta: '2026-12-07', estado: 'Devuelta' },
        { unidad: null, material: 'Cuerda', desde: '2026-11-01', hasta: '2026-11-02', estado: 'No recogida' },
      ],
      multas: [{ importe: 2, estado: 'Pagada' }],
    });
    expect(JSON.stringify(historial)).not.toMatch(/scrypt|lucia@club\.es/);
  });

  it('AC-010-05 el encargado ve el mismo historial de Lucía y no cambia nada (solo lectura)', async () => {
    const antes = JSON.stringify(await datos());
    const deJunta = await consultarHistorial(ctx(), junta, { socioId: 1 });
    expect(await consultarHistorial(ctx(), encargado, { socioId: 1 })).toEqual(deJunta);
    expect(JSON.stringify(await datos())).toBe(antes);
  });

  it('INV-LOA-402 un socio sin préstamos ni multas (Pablo) devuelve listas vacías', async () => {
    expect(await consultarHistorial(ctx(), junta, { socioId: 2 })).toEqual({ prestamos: [], multas: [] });
  });

  it('INV-ACC-008 un socio no puede consultar ningún historial, ni el suyo: E_SIN_PERMISO', async () => {
    const fallo = await consultarHistorial(ctx(), lucia, { socioId: 1 }).catch((e) => e);
    expect([fallo.codigo, fallo.mensaje]).toEqual(['E_SIN_PERMISO', 'No tienes permiso para ver esta pantalla']);
  });

  it('AC-010-06 un socio que no existe (ni una cuenta que no es socio) da E_SOCIO_NO_ENCONTRADO «El socio elegido no existe»', async () => {
    for (const socioId of [99, 8, undefined, '1']) {
      const fallo = await consultarHistorial(ctx(), junta, { socioId }).catch((e) => e);
      expect([socioId, fallo.codigo, fallo.mensaje]).toEqual([socioId, 'E_SOCIO_NO_ENCONTRADO', 'El socio elegido no existe']);
    }
  });
});
