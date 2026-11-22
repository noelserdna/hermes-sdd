import { describe, it, expect, beforeEach } from 'vitest';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { entregarReserva } from '../../../src/domain/prestamos.js';

let almacen;
const relojDe = (dia) => ({ ahora: () => new Date(`${dia}T11:00:00Z`), hoy: () => dia });
const ctx = (dia) => ({ almacen, reloj: relojDe(dia) });
const encargado = { id: 9, nombre: 'Encargado', rol: 'encargado' };
const sembrarCuentas = () => almacen.transaction((db) => {
  db.cuentas.push({ id: 1, nombre: 'Lucía', rol: 'socio' }, { id: 2, nombre: 'Pablo', rol: 'socio' });
});
const sembrarUnidades = (tipo, cantidad, bajas = []) => almacen.transaction((db) => {
  for (let i = 1; i <= cantidad; i += 1) db.unidades.push({ id: db.unidades.length + 1, tipo, numero: i, estado: bajas.includes(i) ? 'DeBaja' : 'Activa' });
});
const sembrarReserva = (socioId, tipo, desde, hasta, estado = 'Reservada', unidadId = null) => almacen.transaction((db) => {
  db.reservas.push({ id: db.reservas.length + 1, socioId, tipo, desde, hasta, estado, unidadId, devueltaEl: null, creadaEl: '2026-11-20T10:00:00.000Z' });
});
const estados = async () => (await almacen.load()).reservas.map((r) => [r.estado, r.unidadId]);

beforeEach(async () => { almacen = crearAlmacenMemoria(); await sembrarCuentas(); });

describe('entregarReserva (API-003-01, INV-LOA-001, INV-LOA-002, INV-LOA-301, RN-020)', () => {
  it('INV-LOA-002 el encargado entrega con la unidad «Piolet 2» (Lucía, hoy 2026-12-05): la reserva pasa a Prestada con esa unidad', async () => {
    await sembrarUnidades('Piolet', 3);
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    const entrega = await entregarReserva(ctx('2026-12-05'), encargado, { reservaId: 1, unidadId: 2 });
    expect(entrega).toMatchObject({ unidad: 'Piolet 2', socio: 'Lucía', reserva: { id: 1, estado: 'Prestada', unidadId: 2 } });
    expect(await estados()).toEqual([['Prestada', 2]]);
  });

  it('INV-LOA-002 sin unidad indicada se asigna la primera Activa libre del tipo (salta la de baja y la prestada)', async () => {
    await sembrarUnidades('Casco', 4, [1]);
    await sembrarReserva(2, 'Casco', '2026-12-01', '2026-12-09', 'Prestada', 2);
    await sembrarReserva(1, 'Casco', '2026-12-05', '2026-12-07');
    const entrega = await entregarReserva(ctx('2026-12-05'), encargado, { reservaId: 2 });
    expect(entrega.unidad).toBe('Casco 3');
  });

  it('INV-LOA-301 repetir la entrega devuelve la misma Prestada y no asigna otra unidad (ni con otra unidad pedida)', async () => {
    await sembrarUnidades('Piolet', 3);
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    await entregarReserva(ctx('2026-12-05'), encargado, { reservaId: 1, unidadId: 2 });
    const antes = JSON.stringify(await almacen.load());
    const repetida = await entregarReserva(ctx('2026-12-05'), encargado, { reservaId: 1, unidadId: 3 });
    expect(repetida).toMatchObject({ unidad: 'Piolet 2', reserva: { estado: 'Prestada', unidadId: 2 } });
    expect(JSON.stringify(await almacen.load())).toBe(antes);
  });

  it('INV-LOA-001 antes de desde (hoy 2026-12-04, desde 2026-12-05) da E_ENTREGA_ANTICIPADA y sigue Reservada', async () => {
    await sembrarUnidades('Piolet', 3);
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    const fallo = await entregarReserva(ctx('2026-12-04'), encargado, { reservaId: 1, unidadId: 1 }).catch((e) => e);
    expect(fallo.codigo).toBe('E_ENTREGA_ANTICIPADA');
    expect(fallo.mensaje).toBe('Aún no es la fecha de entrega');
    expect(await estados()).toEqual([['Reservada', null]]);
  });

  it('AC-005-05 una reserva que no existe da E_RESERVA_NO_ENCONTRADA y no cambia nada', async () => {
    await sembrarUnidades('Piolet', 3);
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    const antes = JSON.stringify(await almacen.load());
    for (const reservaId of [99, 'x', undefined]) {
      expect((await entregarReserva(ctx('2026-12-05'), encargado, { reservaId, unidadId: 1 }).catch((e) => e)).codigo).toBe('E_RESERVA_NO_ENCONTRADA');
    }
    expect(JSON.stringify(await almacen.load())).toBe(antes);
  });

  it('AC-005-06 una Cancelada, Devuelta o No recogida (también la derivada) da E_RESERVA_NO_ENTREGABLE y sigue como estaba', async () => {
    await sembrarUnidades('Piolet', 3);
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07', 'Cancelada');
    await sembrarReserva(1, 'Piolet', '2026-12-01', '2026-12-03', 'Devuelta', 1);
    await sembrarReserva(1, 'Piolet', '2026-12-01', '2026-12-03', 'No recogida');
    await sembrarReserva(1, 'Piolet', '2026-12-01', '2026-12-04');
    for (const reservaId of [1, 2, 3, 4]) {
      const fallo = await entregarReserva(ctx('2026-12-05'), encargado, { reservaId, unidadId: 2 }).catch((e) => e);
      expect(fallo.codigo).toBe('E_RESERVA_NO_ENTREGABLE');
      expect(fallo.mensaje).toBe('Esa reserva no se puede entregar');
    }
    expect(await estados()).toEqual([['Cancelada', null], ['Devuelta', 1], ['No recogida', null], ['Reservada', null]]);
  });

  it('AC-005-07 una unidad ocupada, de baja, de otro tipo o inexistente da E_UNIDAD_NO_DISPONIBLE y la reserva sigue Reservada', async () => {
    await sembrarUnidades('Piolet', 3, [3]);
    await sembrarUnidades('Casco', 1);
    await sembrarReserva(2, 'Piolet', '2026-12-01', '2026-12-09', 'Prestada', 2);
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    for (const unidadId of [2, 3, 4, 99, 'x']) {
      const fallo = await entregarReserva(ctx('2026-12-05'), encargado, { reservaId: 2, unidadId }).catch((e) => e);
      expect(fallo.codigo).toBe('E_UNIDAD_NO_DISPONIBLE');
      expect(fallo.mensaje).toBe('Esa unidad no sirve para esta reserva');
    }
    expect((await estados())[1]).toEqual(['Reservada', null]);
  });

  it('INV-LOA-002 dos entregas a la vez con la misma unidad: solo una se asigna, la otra da E_UNIDAD_NO_DISPONIBLE', async () => {
    await sembrarUnidades('Piolet', 2);
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    await sembrarReserva(2, 'Piolet', '2026-12-05', '2026-12-07');
    const resultados = await Promise.allSettled([1, 2].map((reservaId) => entregarReserva(ctx('2026-12-05'), encargado, { reservaId, unidadId: 2 })));
    expect(resultados.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(resultados.find((r) => r.status === 'rejected').reason.codigo).toBe('E_UNIDAD_NO_DISPONIBLE');
    expect((await estados()).filter(([estado]) => estado === 'Prestada')).toHaveLength(1);
  });

  it('INV-ACC-008 solo el encargado entrega: un socio o la junta reciben E_SIN_PERMISO', async () => {
    await sembrarUnidades('Piolet', 3);
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    for (const rol of ['socio', 'junta']) {
      expect((await entregarReserva(ctx('2026-12-05'), { id: 5, rol }, { reservaId: 1, unidadId: 1 }).catch((e) => e)).codigo).toBe('E_SIN_PERMISO');
    }
    expect(await estados()).toEqual([['Reservada', null]]);
  });
});
