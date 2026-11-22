import { describe, it, expect, beforeEach } from 'vitest';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { anadirUnidades, darDeBajaUnidad, listarInventario } from '../../../src/domain/inventario.js';

let almacen;
const encargado = { id: 3, nombre: 'Encargado', rol: 'encargado' };
const pablo = { id: 2, nombre: 'Pablo', rol: 'socio' };
const ctx = () => ({ almacen });
const codigoDe = (promesa) => promesa.then(() => null, (e) => e.codigo);
const de = (lista, tipo) => lista.find((t) => t.tipo === tipo);

beforeEach(() => { almacen = crearAlmacenMemoria(); });

describe('anadirUnidades (API-004-01)', () => {
  it('INV-STK-003 añadir n unidades suma n Activas numeradas por tipo; cada envío suma otras', async () => {
    await anadirUnidades(ctx(), encargado, { tipo: 'Piolet', cantidad: 3 });
    expect(await anadirUnidades(ctx(), encargado, { tipo: 'Piolet', cantidad: 2 })).toMatchObject({ tipo: 'Piolet', anadidas: 2 });
    const piolet = de(await listarInventario(ctx(), encargado), 'Piolet');
    expect(piolet.activas).toBe(5);
    expect(piolet.unidades.map((u) => u.nombre)).toEqual(['Piolet 1', 'Piolet 2', 'Piolet 3', 'Piolet 4', 'Piolet 5']);
    await anadirUnidades(ctx(), encargado, { tipo: 'Piolet', cantidad: 2 });
    expect(de(await listarInventario(ctx(), encargado), 'Piolet').activas).toBe(7);
  });

  it('INV-ACC-008 un socio recibe E_SIN_PERMISO y no cambia nada (permiso comprobado en el caso de uso)', async () => {
    expect(await codigoDe(anadirUnidades(ctx(), pablo, { tipo: 'Casco', cantidad: 1 }))).toBe('E_SIN_PERMISO');
    expect(await codigoDe(listarInventario(ctx(), pablo))).toBe('E_SIN_PERMISO');
    expect(await codigoDe(darDeBajaUnidad(ctx(), pablo, { unidadId: 1 }))).toBe('E_SIN_PERMISO');
    expect((await almacen.load()).unidades).toEqual([]);
  });

  it('AC-008-07 tipo inválido: E_TIPO_INVALIDO y sin cambios', async () => {
    expect(await codigoDe(anadirUnidades(ctx(), encargado, { tipo: 'Mochila', cantidad: 1 }))).toBe('E_TIPO_INVALIDO');
    expect((await almacen.load()).unidades).toEqual([]);
  });

  it('AC-008-08 cantidad inválida (0, negativa, decimal, texto o ausente): E_CANTIDAD_INVALIDA y sin cambios', async () => {
    for (const cantidad of [0, -2, 1.5, '2', 'dos', undefined, null]) {
      expect(await codigoDe(anadirUnidades(ctx(), encargado, { tipo: 'Casco', cantidad }))).toBe('E_CANTIDAD_INVALIDA');
    }
    expect((await almacen.load()).unidades).toEqual([]);
  });
});

describe('darDeBajaUnidad (API-004-02)', () => {
  beforeEach(async () => { await anadirUnidades(ctx(), encargado, { tipo: 'Casco', cantidad: 3 }); });

  it('INV-STK-001 una unidad libre pasa a DeBaja y deja de contar; no se reserva', async () => {
    const casco3 = de(await listarInventario(ctx(), encargado), 'Casco').unidades[2];
    expect(casco3.nombre).toBe('Casco 3');
    await darDeBajaUnidad(ctx(), encargado, { unidadId: casco3.id });
    const casco = de(await listarInventario(ctx(), encargado), 'Casco');
    expect(casco.activas).toBe(2);
    expect(casco.unidades[2]).toMatchObject({ nombre: 'Casco 3', estado: 'DeBaja' });
  });

  it('INV-STK-002 una unidad Prestada no se da de baja y sigue Activa', async () => {
    const [casco1] = de(await listarInventario(ctx(), encargado), 'Casco').unidades;
    await almacen.transaction((db) => { db.reservas.push({ id: 1, socioId: 2, tipo: 'Casco', desde: '2026-12-01', hasta: '2026-12-03', estado: 'Prestada', unidadId: casco1.id }); });
    expect(await codigoDe(darDeBajaUnidad(ctx(), encargado, { unidadId: casco1.id }))).toBe('E_BAJA_UNIDAD_PRESTADA');
    const lista = de(await listarInventario(ctx(), encargado), 'Casco');
    expect(lista.unidades[0]).toMatchObject({ estado: 'Activa', prestada: true });
    expect(lista.activas).toBe(3);
  });

  it('INV-STK-001 repetir la baja no cambia nada', async () => {
    const [casco1] = de(await listarInventario(ctx(), encargado), 'Casco').unidades;
    await darDeBajaUnidad(ctx(), encargado, { unidadId: casco1.id });
    const antes = JSON.stringify(await almacen.load());
    await darDeBajaUnidad(ctx(), encargado, { unidadId: casco1.id });
    expect(JSON.stringify(await almacen.load())).toBe(antes);
  });

  it('AC-008-09 una unidad que no existe: E_UNIDAD_NO_ENCONTRADA y sin cambios', async () => {
    const antes = JSON.stringify(await almacen.load());
    expect(await codigoDe(darDeBajaUnidad(ctx(), encargado, { unidadId: 999 }))).toBe('E_UNIDAD_NO_ENCONTRADA');
    expect(await codigoDe(darDeBajaUnidad(ctx(), encargado, { unidadId: 'x' }))).toBe('E_UNIDAD_NO_ENCONTRADA');
    expect(JSON.stringify(await almacen.load())).toBe(antes);
  });
});

describe('listarInventario (API-004-03)', () => {
  it('lista por tipo solo los que tienen unidades, en el orden de los tipos, sin cambiar nada', async () => {
    await anadirUnidades(ctx(), encargado, { tipo: 'Casco', cantidad: 1 });
    await anadirUnidades(ctx(), encargado, { tipo: 'Piolet', cantidad: 2 });
    const antes = JSON.stringify(await almacen.load());
    expect((await listarInventario(ctx(), encargado)).map((t) => t.tipo)).toEqual(['Piolet', 'Casco']);
    expect(JSON.stringify(await almacen.load())).toBe(antes);
  });
});
