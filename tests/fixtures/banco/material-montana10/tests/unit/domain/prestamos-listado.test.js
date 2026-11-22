import { describe, it, expect, beforeEach } from 'vitest';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { consultarEntregasYDevoluciones } from '../../../src/domain/prestamos.js';

let almacen;
const relojDe = (dia) => ({ ahora: () => new Date(`${dia}T11:00:00Z`), hoy: () => dia });
const encargado = { id: 9, nombre: 'Encargado', rol: 'encargado' };
const junta = { id: 8, nombre: 'Junta', rol: 'junta' };
const consultar = (dia, actor = encargado) => consultarEntregasYDevoluciones({ almacen, reloj: relojDe(dia) }, actor);
const sembrarBase = () => almacen.transaction((db) => {
  db.cuentas.push({ id: 1, nombre: 'Lucía', rol: 'socio' }, { id: 2, nombre: 'Pablo', rol: 'socio' }, { id: 3, nombre: 'Marta', rol: 'socio' });
  for (const [tipo, n] of [['Piolet', 3], ['Casco', 2], ['Cuerda', 2]]) for (let i = 1; i <= n; i += 1) db.unidades.push({ id: db.unidades.length + 1, tipo, numero: i, estado: 'Activa' });
});
const unidadDe = (db, nombre) => db.unidades.find((u) => `${u.tipo} ${u.numero}` === nombre)?.id ?? null;
const sembrarReserva = (socioId, tipo, desde, hasta, estado = 'Reservada', unidad = null) => almacen.transaction((db) => {
  db.reservas.push({ id: db.reservas.length + 1, socioId, tipo, desde, hasta, estado, unidadId: unidad && unidadDe(db, unidad), devueltaEl: null, creadaEl: '2026-11-20T10:00:00.000Z' });
});

beforeEach(async () => { almacen = crearAlmacenMemoria(); await sembrarBase(); });

describe('consultarEntregasYDevoluciones (API-003-05, RN-009, RN-022, INV-LOA-401)', () => {
  it('RN-022 hoy 2026-12-07: vuelve hoy lo Prestado hasta hoy y prestado lo que vence hoy o después', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-04', '2026-12-07', 'Prestada', 'Piolet 2');
    await sembrarReserva(2, 'Casco', '2026-12-05', '2026-12-09', 'Prestada', 'Casco 1');
    const lista = await consultar('2026-12-07');
    expect(lista.vuelveHoy.map(({ unidad, socio }) => [unidad, socio])).toEqual([['Piolet 2', 'Lucía']]);
    expect(lista.prestado.map(({ unidad, socio, hasta }) => [unidad, socio, hasta])).toEqual([['Piolet 2', 'Lucía', '2026-12-07'], ['Casco 1', 'Pablo', '2026-12-09']]);
    expect(lista.conRetraso).toEqual([]);
  });

  it('RN-009 lo Prestado con hasta anterior a hoy va con retraso en días naturales (2026-12-05 → hoy 2026-12-07 = 2 días) y no como prestado', async () => {
    await sembrarReserva(3, 'Cuerda', '2026-12-01', '2026-12-05', 'Prestada', 'Cuerda 1');
    const lista = await consultar('2026-12-07');
    expect(lista.conRetraso.map(({ unidad, socio, dias }) => [unidad, socio, dias])).toEqual([['Cuerda 1', 'Marta', 2]]);
    expect(lista.prestado).toEqual([]);
    expect(lista.vuelveHoy).toEqual([]);
  });

  it('RN-022 «Entregar hoy»: Reservada con desde igual o anterior a hoy y hasta igual o posterior; con las unidades libres del tipo para elegir', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-07', '2026-12-09');
    await sembrarReserva(2, 'Casco', '2026-12-05', '2026-12-07');
    await sembrarReserva(2, 'Cuerda', '2026-12-08', '2026-12-09');
    await sembrarReserva(3, 'Piolet', '2026-12-01', '2026-12-03', 'Cancelada');
    await sembrarReserva(3, 'Piolet', '2026-12-01', '2026-12-09', 'Prestada', 'Piolet 1');
    const lista = await consultar('2026-12-07');
    expect(lista.entregarHoy.map(({ material, socio }) => [material, socio])).toEqual([['Casco', 'Pablo'], ['Piolet', 'Lucía']]);
    expect(lista.entregarHoy[0].unidadesLibres.map((u) => u.nombre)).toEqual(['Casco 1', 'Casco 2']);
    expect(lista.entregarHoy[1].unidadesLibres.map((u) => u.nombre)).toEqual(['Piolet 2', 'Piolet 3']);
  });

  it('AC-009-07 una Reservada con hasta 2026-12-06 no figura en «Entregar hoy» ni como prestada el 2026-12-07 y sigue sin cambios en el almacén', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-04', '2026-12-06');
    const antes = JSON.stringify(await almacen.load());
    const lista = await consultar('2026-12-07');
    expect(lista.entregarHoy).toEqual([]);
    expect(lista.prestado).toEqual([]);
    expect(lista.conRetraso).toEqual([]);
    expect(JSON.stringify(await almacen.load())).toBe(antes);
  });

  it('RN-008 las No recogidas recientes se listan aparte con «material · socio» (la persistida y la derivada); las de hace más de una semana no', async () => {
    await sembrarReserva(1, 'Piolet', '2026-12-05', '2026-12-07');
    await sembrarReserva(2, 'Casco', '2026-12-01', '2026-12-03', 'No recogida');
    await sembrarReserva(3, 'Cuerda', '2026-11-01', '2026-11-03', 'No recogida');
    const lista = await consultar('2026-12-08');
    expect(lista.noRecogidas.map(({ material, socio }) => [material, socio])).toEqual([['Casco', 'Pablo'], ['Piolet', 'Lucía']]);
  });

  it('INV-LOA-401 nada prestado: todas las listas vacías', async () => {
    expect(await consultar('2026-12-07')).toEqual({ entregarHoy: [], vuelveHoy: [], conRetraso: [], prestado: [], noRecogidas: [] });
  });

  it('INV-LOA-401 la junta consulta lo mismo en solo lectura, sin las unidades para elegir', async () => {
    await sembrarReserva(2, 'Casco', '2026-12-05', '2026-12-09', 'Prestada', 'Casco 1');
    await sembrarReserva(1, 'Piolet', '2026-12-07', '2026-12-09');
    const antes = JSON.stringify(await almacen.load());
    const lista = await consultar('2026-12-07', junta);
    expect(lista.prestado.map(({ unidad, socio, hasta }) => [unidad, socio, hasta])).toEqual([['Casco 1', 'Pablo', '2026-12-09']]);
    expect(lista.entregarHoy[0].unidadesLibres).toBeUndefined();
    expect(JSON.stringify(await almacen.load())).toBe(antes);
  });

  it('AC-009-06 un socio recibe E_SIN_PERMISO («No tienes permiso para ver esta pantalla»)', async () => {
    const fallo = await consultar('2026-12-07', { id: 1, nombre: 'Lucía', rol: 'socio' }).catch((e) => e);
    expect(fallo.codigo).toBe('E_SIN_PERMISO');
    expect(fallo.mensaje).toBe('No tienes permiso para ver esta pantalla');
  });
});
