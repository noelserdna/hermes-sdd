import { describe, it, expect, beforeEach } from 'vitest';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { devolverPrestamo } from '../../../src/domain/prestamos.js';
import { listarMisReservas } from '../../../src/domain/reservas.js';
import { FINE_PER_DAY_EUR } from '../../../src/domain/config.js';

let almacen;
const relojDe = (dia) => ({ ahora: () => new Date(`${dia}T11:00:00Z`), hoy: () => dia });
const ctx = (dia) => ({ almacen, reloj: relojDe(dia) });
const encargado = { id: 9, nombre: 'Encargado', rol: 'encargado' };
const lucia = { id: 1, nombre: 'Lucía', rol: 'socio' };
const prestar = (socioId, tipo, numero, hasta, estado = 'Prestada') => almacen.transaction((db) => {
  const unidad = { id: db.unidades.length + 1, tipo, numero, estado: 'Activa' };
  db.unidades.push(unidad);
  db.reservas.push({ id: db.reservas.length + 1, socioId, tipo, desde: '2026-12-05', hasta, estado, unidadId: estado === 'Prestada' ? unidad.id : null, devueltaEl: null, creadaEl: '2026-11-20T10:00:00.000Z' });
});
const datos = async () => almacen.load();

beforeEach(async () => {
  almacen = crearAlmacenMemoria();
  await almacen.transaction((db) => { db.cuentas.push({ id: 1, nombre: 'Lucía', rol: 'socio' }, { id: 2, nombre: 'Pablo', rol: 'socio' }); });
});

describe('devolverPrestamo (API-003-02, INV-LOA-003, INV-LOA-004, RN-009)', () => {
  it('INV-LOA-004 devuelta el día hasta (2026-12-07) pasa a Devuelta con devueltaEl y sin multa', async () => {
    await prestar(1, 'Piolet', 2, '2026-12-07');
    const salida = await devolverPrestamo(ctx('2026-12-07'), encargado, { reservaId: 1 });
    expect(salida).toEqual({ unidad: 'Piolet 2', socio: 'Lucía', estado: 'Devuelta', multa: null });
    const db = await datos();
    expect(db.reservas[0]).toMatchObject({ estado: 'Devuelta', devueltaEl: '2026-12-07' });
    expect(db.multas).toEqual([]);
  });

  it('INV-LOA-004 con 3 días de retraso (hasta 2026-12-07, devuelta 2026-12-10) crea una multa Pendiente de 6 € (FINE_PER_DAY_EUR × 3)', async () => {
    await prestar(2, 'Casco', 1, '2026-12-07');
    const salida = await devolverPrestamo(ctx('2026-12-10'), encargado, { reservaId: 1 });
    expect(FINE_PER_DAY_EUR).toBe(2);
    expect(salida).toEqual({ unidad: 'Casco 1', socio: 'Pablo', estado: 'Devuelta', multa: { importeEur: 6, dias: 3 } });
    expect((await datos()).multas).toEqual([{ id: 1, socioId: 2, reservaId: 1, dias: 3, importeEur: 6, estado: 'Pendiente', pagadaEl: null }]);
  });

  it('INV-LOA-004 con 1 día de retraso (hasta 2026-12-07, devuelta 2026-12-08) la multa es de 2 € y el socio la ve en sus reservas', async () => {
    await prestar(1, 'Cuerda', 1, '2026-12-07');
    const salida = await devolverPrestamo(ctx('2026-12-08'), encargado, { reservaId: 1 });
    expect(salida.multa).toEqual({ importeEur: 2, dias: 1 });
    expect((await listarMisReservas(ctx('2026-12-08'), lucia)).multas).toMatchObject([{ importeEur: 2, estado: 'Pendiente' }]);
  });

  it('INV-LOA-003 repetir la devolución de una Devuelta no cambia nada ni duplica la multa de 6 €', async () => {
    await prestar(2, 'Casco', 1, '2026-12-07');
    const primera = await devolverPrestamo(ctx('2026-12-10'), encargado, { reservaId: 1 });
    const antes = JSON.stringify(await datos());
    const repetida = await devolverPrestamo(ctx('2026-12-11'), encargado, { reservaId: 1 });
    expect(repetida).toEqual(primera);
    expect(JSON.stringify(await datos())).toBe(antes);
    expect((await datos()).multas).toHaveLength(1);
  });

  it('INV-LOA-003 una reserva Reservada, Cancelada o No recogida da E_RESERVA_NO_PRESTADA «Esa reserva no está prestada» y no crea multa', async () => {
    for (const estado of ['Reservada', 'Cancelada', 'No recogida']) {
      almacen = crearAlmacenMemoria();
      await prestar(1, 'Piolet', 1, '2026-12-07', estado);
      const antes = JSON.stringify(await datos());
      const fallo = await devolverPrestamo(ctx('2026-12-10'), encargado, { reservaId: 1 }).catch((e) => e);
      expect([estado, fallo.codigo, fallo.mensaje]).toEqual([estado, 'E_RESERVA_NO_PRESTADA', 'Esa reserva no está prestada']);
      expect(JSON.stringify(await datos())).toBe(antes);
    }
  });

  it('AC-006-06 una reserva que no existe da E_RESERVA_NO_ENCONTRADA y no cambia nada', async () => {
    await prestar(1, 'Piolet', 1, '2026-12-07');
    const antes = JSON.stringify(await datos());
    const fallo = await devolverPrestamo(ctx('2026-12-10'), encargado, { reservaId: 99 }).catch((e) => e);
    expect(fallo.codigo).toBe('E_RESERVA_NO_ENCONTRADA');
    expect(JSON.stringify(await datos())).toBe(antes);
  });

  it('INV-ACC-008 un socio no puede devolver: E_SIN_PERMISO y nada cambia', async () => {
    await prestar(1, 'Piolet', 1, '2026-12-07');
    const antes = JSON.stringify(await datos());
    const fallo = await devolverPrestamo(ctx('2026-12-10'), lucia, { reservaId: 1 }).catch((e) => e);
    expect(fallo.codigo).toBe('E_SIN_PERMISO');
    expect(JSON.stringify(await datos())).toBe(antes);
  });

  it('INV-LOA-004 devolución y multa son una sola transacción: si el almacén falla al escribir no queda devolución sin multa', async () => {
    await prestar(2, 'Casco', 1, '2026-12-07');
    const original = almacen.transaction;
    const roto = { ...almacen, transaction: (fn) => original((db) => { fn(db); throw new Error('fallo a mitad'); }) };
    await expect(devolverPrestamo({ almacen: roto, reloj: relojDe('2026-12-10') }, encargado, { reservaId: 1 })).rejects.toThrow('fallo a mitad');
    const db = await datos();
    expect([db.reservas[0].estado, db.multas.length]).toEqual(['Prestada', 0]);
  });
});
