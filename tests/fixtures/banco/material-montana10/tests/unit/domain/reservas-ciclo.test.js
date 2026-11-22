import { describe, it, expect, beforeEach } from 'vitest';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { derivarNoRecogidas, listarMisReservas, cancelarReserva, reservarMaterial } from '../../../src/domain/reservas.js';

let almacen;
const relojDe = (dia) => ({ ahora: () => new Date(`${dia}T11:00:00Z`), hoy: () => dia });
const lucia = { id: 1, nombre: 'Lucía', rol: 'socio' };
const sembrarReserva = (socioId, tipo, desde, hasta, estado = 'Reservada') => almacen.transaction((db) => {
  db.reservas.push({ id: db.reservas.length + 1, socioId, tipo, desde, hasta, estado, unidadId: null, devueltaEl: null, creadaEl: '2026-11-20T10:00:00.000Z' });
});

beforeEach(() => { almacen = crearAlmacenMemoria(); });

describe('derivación «No recogida» (RN-008, INV-RES-007, API-003-07 al leer)', () => {
  it('INV-RES-007 una Reservada con hoy posterior a hasta se lee como «No recogida» sin tocar el original', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    const db = await almacen.load();
    const derivadas = derivarNoRecogidas(db, '2026-12-08');
    expect(derivadas[0].estado).toBe('No recogida');
    expect(db.reservas[0].estado).toBe('Reservada');
  });

  it('INV-RES-007 el día hasta todavía es Reservada; Prestada, Cancelada y Devuelta no cambian aunque hasta haya pasado', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    await sembrarReserva(1, 'Casco', '2026-12-01', '2026-12-03', 'Prestada');
    await sembrarReserva(1, 'Cuerda', '2026-12-01', '2026-12-03', 'Cancelada');
    await sembrarReserva(1, 'Tienda', '2026-12-01', '2026-12-03', 'Devuelta');
    const db = await almacen.load();
    expect(derivarNoRecogidas(db, '2026-12-07').map((r) => r.estado)).toEqual(['Reservada', 'Prestada', 'Cancelada', 'Devuelta']);
    expect(derivarNoRecogidas(db, '2026-12-08').map((r) => r.estado)).toEqual(['No recogida', 'Prestada', 'Cancelada', 'Devuelta']);
  });

  it('INV-RES-007 listarMisReservas muestra «No recogida» y no marca la reserva como cancelable', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    const { reservas } = await listarMisReservas({ almacen, reloj: relojDe('2026-12-08') }, lucia);
    expect(reservas[0]).toMatchObject({ tipo: 'Piolet', estado: 'No recogida', cancelable: false });
    expect((await almacen.load()).reservas[0].estado).toBe('Reservada');
  });
});

// ───────────── UC-004 cancelarReserva (API-002-03) y listarMisReservas (API-002-02) ─────────────

const pablo = { id: 2, nombre: 'Pablo', rol: 'socio' };
const encargado = { id: 3, nombre: 'Encargado', rol: 'encargado' };
const ctx = (dia) => ({ almacen, reloj: relojDe(dia) });
const sembrarUnidades = (tipo, cantidad) => almacen.transaction((db) => {
  for (let i = 1; i <= cantidad; i += 1) db.unidades.push({ id: db.unidades.length + 1, tipo, numero: i, estado: 'Activa' });
});
const sembrarMulta = (socioId, importeEur, estado = 'Pendiente') => almacen.transaction((db) => {
  db.multas.push({ id: db.multas.length + 1, socioId, reservaId: 1, dias: importeEur / 2, importeEur, estado, pagadaEl: null });
});

describe('cancelarReserva (API-002-03, INV-RES-006, RN-019)', () => {
  it('INV-RES-006 una Reservada se cancela hasta el día antes de desde (Lucía, 2026-12-05, hoy 2026-12-04) y devuelve la Cancelada', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    const reserva = await cancelarReserva(ctx('2026-12-04'), lucia, { reservaId: 1 });
    expect(reserva).toMatchObject({ id: 1, tipo: 'Piolet', desde: '2026-12-05', hasta: '2026-12-07', estado: 'Cancelada' });
    expect((await almacen.load()).reservas[0].estado).toBe('Cancelada');
  });

  it('INV-RES-006 cancelar libera sus unidades: con una sola tienda, otro socio puede reservarla esos días', async () => {
    await sembrarUnidades('Tienda', 1);
    await sembrarReserva(1, 'Tienda', '2026-12-05', '2026-12-07');
    await expect(reservarMaterial(ctx('2026-12-04'), pablo, { tipo: 'Tienda', desde: '2026-12-06', hasta: '2026-12-06' })).rejects.toMatchObject({ codigo: 'E_SIN_UNIDADES_LIBRES' });
    await cancelarReserva(ctx('2026-12-04'), lucia, { reservaId: 1 });
    const { creada } = await reservarMaterial(ctx('2026-12-04'), pablo, { tipo: 'Tienda', desde: '2026-12-06', hasta: '2026-12-06' });
    expect(creada).toBe(true);
  });

  it('INV-RES-008 cancelar una reserva ya Cancelada la devuelve igual, una sola vez y sin otro cambio', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    await cancelarReserva(ctx('2026-12-04'), lucia, { reservaId: 1 });
    const antes = JSON.stringify(await almacen.load());
    const repetida = await cancelarReserva(ctx('2026-12-04'), lucia, { reservaId: 1 });
    expect(repetida.estado).toBe('Cancelada');
    expect(JSON.stringify(await almacen.load())).toBe(antes);
    expect((await almacen.load()).reservas).toHaveLength(1);
  });

  it('INV-RES-006 el mismo día de desde (hoy 2026-12-05) o después se rechaza con E_CANCELACION_TARDIA y sigue Reservada', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    for (const dia of ['2026-12-05', '2026-12-06']) {
      const fallo = await cancelarReserva(ctx(dia), lucia, { reservaId: 1 }).catch((e) => e);
      expect(fallo.codigo).toBe('E_CANCELACION_TARDIA');
      expect(fallo.mensaje).toBe('Solo se puede cancelar hasta el día antes');
    }
    expect((await almacen.load()).reservas[0].estado).toBe('Reservada');
  });

  it('INV-RES-006 solo se cancela una Reservada: una Prestada o una No recogida derivada dan E_CANCELACION_TARDIA', async () => {
    await sembrarReserva(1, 'Casco', '2026-12-01', '2026-12-09', 'Prestada');
    await sembrarReserva(1, 'Cuerda', '2026-12-05', '2026-12-07');
    expect((await cancelarReserva(ctx('2026-12-03'), lucia, { reservaId: 1 }).catch((e) => e)).codigo).toBe('E_CANCELACION_TARDIA');
    expect((await cancelarReserva(ctx('2026-12-08'), lucia, { reservaId: 2 }).catch((e) => e)).codigo).toBe('E_CANCELACION_TARDIA');
    expect((await almacen.load()).reservas.map((r) => r.estado)).toEqual(['Prestada', 'Reservada']);
  });

  it('RN-019 con una multa Pendiente de 4 € el socio sigue pudiendo cancelar', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    await sembrarMulta(1, 4);
    expect((await cancelarReserva(ctx('2026-12-04'), lucia, { reservaId: 1 })).estado).toBe('Cancelada');
  });

  it('INV-ACC-009 una reserva de Lucía cancelada por Pablo da E_SIN_PERMISO_CANCELAR y sigue Reservada; la propiedad se comprueba antes que el estado', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    await sembrarReserva(1, 'Casco', '2026-12-05', '2026-12-07', 'Cancelada');
    const ajena = await cancelarReserva(ctx('2026-12-04'), pablo, { reservaId: 1 }).catch((e) => e);
    expect(ajena.codigo).toBe('E_SIN_PERMISO_CANCELAR');
    expect(ajena.mensaje).toBe('No tienes permiso para cancelar esta reserva');
    expect((await cancelarReserva(ctx('2026-12-04'), pablo, { reservaId: 2 }).catch((e) => e)).codigo).toBe('E_SIN_PERMISO_CANCELAR');
    expect((await almacen.load()).reservas[0].estado).toBe('Reservada');
  });

  it('AC-004-08 una reserva que no existe da E_RESERVA_NO_ENCONTRADA y no cambia nada', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    const antes = JSON.stringify(await almacen.load());
    for (const reservaId of [99, 'x', undefined]) {
      const fallo = await cancelarReserva(ctx('2026-12-04'), lucia, { reservaId }).catch((e) => e);
      expect(fallo.codigo).toBe('E_RESERVA_NO_ENCONTRADA');
      expect(fallo.mensaje).toBe('No existe esa reserva');
    }
    expect(JSON.stringify(await almacen.load())).toBe(antes);
  });

  it('INV-ACC-008 el encargado no puede cancelar (E_SIN_PERMISO)', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    expect((await cancelarReserva(ctx('2026-12-04'), encargado, { reservaId: 1 }).catch((e) => e)).codigo).toBe('E_SIN_PERMISO');
  });
});

describe('listarMisReservas completa (API-002-02, INV-ACC-009)', () => {
  it('INV-ACC-009 devuelve solo las reservas y multas propias; cancelable solo en las Reservadas', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    await sembrarReserva(2, 'Casco', '2026-12-10', '2026-12-12');
    await sembrarReserva(1, 'Cuerda', '2026-12-01', '2026-12-02', 'Cancelada');
    await sembrarMulta(1, 4);
    await sembrarMulta(2, 2);
    const mias = await listarMisReservas(ctx('2026-12-03'), lucia);
    expect(mias.reservas.map((r) => [r.tipo, r.estado, r.cancelable])).toEqual([['Piolet', 'Reservada', true], ['Cuerda', 'Cancelada', false]]);
    expect(mias.multas).toHaveLength(1);
    expect(mias.multas[0]).toMatchObject({ socioId: 1, importeEur: 4, estado: 'Pendiente' });
    expect((await listarMisReservas(ctx('2026-12-03'), pablo)).reservas.map((r) => r.tipo)).toEqual(['Casco']);
  });
});
