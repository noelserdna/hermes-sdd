import { describe, it, expect, beforeEach } from 'vitest';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { reservarMaterial, listarMisReservas } from '../../../src/domain/reservas.js';

let almacen;
const reloj = { ahora: () => new Date('2026-12-01T11:00:00Z'), hoy: () => '2026-12-01' };
const lucia = { id: 1, nombre: 'Lucía', rol: 'socio' };
const pablo = { id: 2, nombre: 'Pablo', rol: 'socio' };
const encargado = { id: 3, nombre: 'Encargado', rol: 'encargado' };
const ctx = () => ({ almacen, reloj });
const codigoDe = (promesa) => promesa.then(() => null, (e) => e.codigo);
const reservar = (actor, tipo, desde, hasta) => reservarMaterial(ctx(), actor, { tipo, desde, hasta });
const sembrarUnidades = (tipo, cantidad) => almacen.transaction((db) => {
  for (let i = 1; i <= cantidad; i += 1) db.unidades.push({ id: db.unidades.length + 1, tipo, numero: i, estado: 'Activa' });
});
const sembrarReserva = (socioId, tipo, desde, hasta, estado = 'Reservada') => almacen.transaction((db) => {
  db.reservas.push({ id: db.reservas.length + 1, socioId, tipo, desde, hasta, estado, unidadId: null, devueltaEl: null, creadaEl: '2026-11-20T10:00:00.000Z' });
});
const sembrarMulta = (socioId, importeEur, estado = 'Pendiente') => almacen.transaction((db) => {
  db.multas.push({ id: db.multas.length + 1, socioId, reservaId: 1, dias: importeEur / 2, importeEur, estado, pagadaEl: null });
});

beforeEach(async () => { almacen = crearAlmacenMemoria(); });

describe('reservarMaterial: crear (INV-RES-004, INV-RES-008)', () => {
  it('INV-RES-004 con unidades libres todos los días se crea la reserva Reservada del socio', async () => {
    await sembrarUnidades('Piolet', 3);
    const { reserva, creada } = await reservar(lucia, 'Piolet', '2026-12-05', '2026-12-07');
    expect(creada).toBe(true);
    expect(reserva).toMatchObject({ socioId: 1, tipo: 'Piolet', desde: '2026-12-05', hasta: '2026-12-07', estado: 'Reservada', unidadId: null });
    expect((await almacen.load()).reservas).toHaveLength(1);
  });

  it('INV-RES-008 repetir la misma reserva devuelve la existente y no duplica', async () => {
    await sembrarUnidades('Piolet', 3);
    const primera = await reservar(lucia, 'Piolet', '2026-12-05', '2026-12-07');
    const segunda = await reservar(lucia, 'Piolet', '2026-12-05', '2026-12-07');
    expect(segunda.creada).toBe(false);
    expect(segunda.reserva.id).toBe(primera.reserva.id);
    expect((await almacen.load()).reservas).toHaveLength(1);
  });

  it('INV-RES-004 un día sin unidades libres rechaza con E_SIN_UNIDADES_LIBRES y no crea nada', async () => {
    await sembrarUnidades('Tienda', 2);
    await sembrarReserva(1, 'Tienda', '2026-12-05', '2026-12-07');
    await sembrarReserva(3, 'Tienda', '2026-12-05', '2026-12-07');
    const error = await reservar(pablo, 'Tienda', '2026-12-06', '2026-12-06').catch((e) => e);
    expect(error.codigo).toBe('E_SIN_UNIDADES_LIBRES');
    expect(error.mensaje).toBe('No quedan unidades libres de Tienda esas fechas');
    expect((await almacen.load()).reservas).toHaveLength(2);
  });

  it('INV-RES-004 las unidades ocupadas que no coinciden en los mismos días no impiden reservar', async () => {
    await sembrarUnidades('Tienda', 2);
    await sembrarReserva(1, 'Tienda', '2026-12-05', '2026-12-06');
    const { reserva } = await reservar(pablo, 'Tienda', '2026-12-07', '2026-12-08');
    expect(reserva).toMatchObject({ tipo: 'Tienda', desde: '2026-12-07', hasta: '2026-12-08' });
    // un rango que roza un día ocupado por todas las unidades sí se rechaza
    await sembrarReserva(3, 'Tienda', '2026-12-08', '2026-12-09');
    expect(await codigoDe(reservar(lucia, 'Tienda', '2026-12-08', '2026-12-10'))).toBe('E_SIN_UNIDADES_LIBRES');
  });

  it('INV-RES-004 RN-018 dos reservas a la vez por la última unidad: gana una sola', async () => {
    await sembrarUnidades('Crampones', 1);
    const resultados = await Promise.allSettled([reservar(lucia, 'Crampones', '2026-12-05', '2026-12-07'), reservar(pablo, 'Crampones', '2026-12-05', '2026-12-07')]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rechazada = resultados.find((r) => r.status === 'rejected');
    expect(rechazada.reason.codigo).toBe('E_SIN_UNIDADES_LIBRES');
    expect(rechazada.reason.mensaje).toBe('No quedan unidades libres de Crampones esas fechas');
    expect((await almacen.load()).reservas).toHaveLength(1);
  });

  it('INV-STK-001 las unidades DeBaja no cuentan como libres', async () => {
    await sembrarUnidades('Casco', 2);
    await almacen.transaction((db) => { db.unidades[1].estado = 'DeBaja'; });
    await reservar(lucia, 'Casco', '2026-12-05', '2026-12-05');
    expect(await codigoDe(reservar(pablo, 'Casco', '2026-12-05', '2026-12-05'))).toBe('E_SIN_UNIDADES_LIBRES');
  });

  it('INV-RES-007 una Reservada con hoy posterior a hasta es No recogida y no ocupa unidades; una Prestada sí', async () => {
    await sembrarUnidades('Cuerda', 1);
    await sembrarReserva(2, 'Cuerda', '2026-11-20', '2026-11-25');
    await sembrarReserva(2, 'Cuerda', '2026-12-10', '2026-12-12', 'Devuelta');
    await sembrarReserva(2, 'Cuerda', '2026-12-10', '2026-12-12', 'Cancelada');
    expect((await reservar(lucia, 'Cuerda', '2026-12-10', '2026-12-12')).creada).toBe(true);
    await sembrarReserva(2, 'Cuerda', '2026-12-20', '2026-12-21', 'Prestada');
    expect(await codigoDe(reservar(lucia, 'Cuerda', '2026-12-21', '2026-12-22'))).toBe('E_SIN_UNIDADES_LIBRES');
  });
});

describe('reservarMaterial: validaciones en el orden de RN-017', () => {
  beforeEach(async () => { await sembrarUnidades('Casco', 2); await sembrarUnidades('Cuerda', 2); });

  it('INV-RES-002 desde anterior a hoy: E_FECHA_PASADA; hoy mismo vale', async () => {
    const error = await reservar(lucia, 'Casco', '2026-11-30', '2026-12-02').catch((e) => e);
    expect(error.codigo).toBe('E_FECHA_PASADA');
    expect(error.mensaje).toBe('Las fechas no pueden estar en el pasado');
    expect((await reservar(lucia, 'Casco', '2026-12-01', '2026-12-02')).creada).toBe(true);
  });

  it('INV-RES-003 hasta anterior a desde: E_FECHAS_INVERTIDAS', async () => {
    const error = await reservar(lucia, 'Cuerda', '2026-12-10', '2026-12-09').catch((e) => e);
    expect(error.codigo).toBe('E_FECHAS_INVERTIDAS');
    expect(error.mensaje).toBe('La fecha final no puede ser anterior a la inicial');
  });

  it('INV-RES-001 más de 14 días: E_RESERVA_MUY_LARGA; exactamente 14 vale', async () => {
    const error = await reservar(lucia, 'Cuerda', '2026-12-10', '2026-12-25').catch((e) => e);
    expect(error.codigo).toBe('E_RESERVA_MUY_LARGA');
    expect(error.mensaje).toBe('Máximo 14 días por reserva');
    expect(await codigoDe(reservar(lucia, 'Cuerda', '2026-12-10', '2026-12-24'))).toBe('E_RESERVA_MUY_LARGA');
    expect((await reservar(lucia, 'Cuerda', '2026-12-10', '2026-12-23')).creada).toBe(true);
  });

  it('RN-017 el orden: pasado antes que invertidas, invertidas antes que duración, y las fechas antes que la multa', async () => {
    expect(await codigoDe(reservar(lucia, 'Casco', '2026-11-20', '2026-11-10'))).toBe('E_FECHA_PASADA');
    await sembrarMulta(1, 4);
    expect(await codigoDe(reservar(lucia, 'Casco', '2026-12-10', '2026-12-09'))).toBe('E_FECHAS_INVERTIDAS');
    expect(await codigoDe(reservar(lucia, 'Casco', '2026-12-05', '2026-12-06'))).toBe('E_MULTA_PENDIENTE');
  });

  it('INV-RES-002 una fecha que no es AAAA-MM-DD no se acepta como reserva y no cambia nada', async () => {
    for (const desde of ['', 'mañana', '2026-13-40', undefined, 20261205]) {
      expect(await codigoDe(reservar(lucia, 'Casco', desde, '2026-12-06'))).toBe('E_FECHA_PASADA');
    }
    expect((await almacen.load()).reservas).toEqual([]);
  });

  it('INV-RES-005 con una multa Pendiente de 4 € no se reserva', async () => {
    await sembrarMulta(1, 4);
    const error = await reservar(lucia, 'Casco', '2026-12-05', '2026-12-06').catch((e) => e);
    expect(error.codigo).toBe('E_MULTA_PENDIENTE');
    expect(error.mensaje).toBe('Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar');
    expect((await almacen.load()).reservas).toEqual([]);
  });

  it('INV-RES-005 la multa de 2 € de Pablo da su importe; con la multa Pagada vuelve a poder reservar', async () => {
    await sembrarMulta(2, 2);
    const error = await reservar(pablo, 'Casco', '2026-12-05', '2026-12-06').catch((e) => e);
    expect(error.mensaje).toBe('Tienes una multa pendiente de 2 €. Págala al encargado para poder reservar');
    await almacen.transaction((db) => { db.multas[0].estado = 'Pagada'; });
    expect((await reservar(pablo, 'Casco', '2026-12-05', '2026-12-06')).creada).toBe(true);
  });

  it('INV-RES-005 una multa Pendiente de otro socio no impide reservar', async () => {
    await sembrarMulta(2, 2);
    expect((await reservar(lucia, 'Casco', '2026-12-05', '2026-12-06')).creada).toBe(true);
  });

  it('AC-003-11 un rol sin permiso (encargado o junta) recibe E_SIN_PERMISO', async () => {
    expect(await codigoDe(reservar(encargado, 'Casco', '2026-12-05', '2026-12-06'))).toBe('E_SIN_PERMISO');
    expect(await codigoDe(reservar({ id: 4, nombre: 'Junta', rol: 'junta' }, 'Casco', '2026-12-05', '2026-12-06'))).toBe('E_SIN_PERMISO');
    expect((await almacen.load()).reservas).toEqual([]);
  });

  it('AC-003-12 un tipo inválido recibe E_TIPO_INVALIDO, antes que las fechas', async () => {
    expect(await codigoDe(reservar(lucia, 'Mochila', '2026-12-05', '2026-12-06'))).toBe('E_TIPO_INVALIDO');
    expect(await codigoDe(reservar(lucia, 'Mochila', '2026-11-01', '2026-10-01'))).toBe('E_TIPO_INVALIDO');
  });
});

describe('listarMisReservas (API-002-02 mínima)', () => {
  it('INV-ACC-009 listarMisReservas devuelve solo las reservas del socio, con { reservas, multas: [] }', async () => {
    await sembrarReserva(1, 'Casco', '2026-12-01', '2026-12-03');
    await sembrarReserva(2, 'Piolet', '2026-12-04', '2026-12-05');
    await sembrarReserva(1, 'Cuerda', '2026-12-10', '2026-12-11');
    const { reservas, multas } = await listarMisReservas(ctx(), lucia);
    expect(multas).toEqual([]);
    expect(reservas.map((r) => r.tipo)).toEqual(['Cuerda', 'Casco']);
    expect(reservas.every((r) => r.socioId === 1)).toBe(true);
    expect((await listarMisReservas(ctx(), pablo)).reservas.map((r) => r.tipo)).toEqual(['Piolet']);
  });

  it('INV-ACC-008 solo el socio la usa: el encargado recibe E_SIN_PERMISO', async () => {
    expect(await codigoDe(listarMisReservas(ctx(), encargado))).toBe('E_SIN_PERMISO');
  });
});
