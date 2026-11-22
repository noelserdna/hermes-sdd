import { describe, it, expect, beforeEach } from 'vitest';
import { iniciarSesion } from '../../src/domain/cuentas.js';
import { listarInventario, anadirMaterial } from '../../src/domain/inventario.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';

let e; let sidEncargado;
beforeEach(() => {
  e = crearEntorno();
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Junta', correo: 'junta@club.test', contrasena: 'Cumbre2026', rol: 'junta' });
  sidEncargado = iniciarSesion(e.ctx(), { correo: 'marta@club.test', contrasena: 'Cumbre2026' }).sid;
});
const ctx = () => e.ctx(sidEncargado);
const recuento = (tipo) => listarInventario(ctx()).tipos.find((t) => t.tipo === tipo);

describe('UC-013 anadirMaterial / listarInventario', () => {
  // REQ-F-008 AC1: "GIVEN the types are piolets, crampones, cascos, cuerdas and tiendas WHEN the encargado adds 2 units of "Crampones" THEN the user sees "Crampones: 2 unidades" in the inventory"
  it('AC-013-01 añadir 2 Crampones: el inventario cuenta 2 y las unidades son Crampones 1 y Crampones 2', () => {
    anadirMaterial(ctx(), { tipo: 'Crampones', cantidad: 2 });
    const c = recuento('Crampones');
    expect(c.total).toBe(2);
    expect(c.unidades.map((u) => [u.numero, u.estado])).toEqual([[1, 'Alta'], [2, 'Alta']]);
  });

  it('INV-STK-001 la numeración sigue dentro del tipo y no se mezcla con otros tipos', () => {
    anadirMaterial(ctx(), { tipo: 'Casco', cantidad: 2 });
    anadirMaterial(ctx(), { tipo: 'Cuerda', cantidad: 1 });
    anadirMaterial(ctx(), { tipo: 'Casco', cantidad: 1 });
    expect(recuento('Casco').unidades.map((u) => u.numero)).toEqual([1, 2, 3]);
    expect(recuento('Cuerda').unidades.map((u) => u.numero)).toEqual([1]);
  });

  it('AC-013-02 un tipo sin unidades se lista con 0 unidades, y los cinco tipos aparecen', () => {
    const r = listarInventario(ctx());
    expect(r.tipos.map((t) => t.tipo)).toEqual(['Piolet', 'Crampones', 'Casco', 'Cuerda', 'Tienda']);
    expect(recuento('Tienda')).toMatchObject({ total: 0, unidades: [] });
  });

  // REQ-F-008 AC6: "GIVEN an amount of 0 units WHEN the encargado adds material THEN the user sees "La cantidad debe ser al menos 1""
  it('AC-013-03 cantidad 0: E_CANTIDAD_INVALIDA con "La cantidad debe ser al menos 1" y el recuento de Casco no cambia', async () => {
    const error = await fallo(() => anadirMaterial(ctx(), { tipo: 'Casco', cantidad: 0 }));
    expect(error.codigo).toBe('E_CANTIDAD_INVALIDA');
    expect(error.message).toBe('La cantidad debe ser al menos 1');
    expect(recuento('Casco').total).toBe(0);
    expect((await fallo(() => anadirMaterial(ctx(), { tipo: 'Casco', cantidad: 1.5 }))).codigo).toBe('E_CANTIDAD_INVALIDA');
  });

  it('AC-013-04 tipo no válido (Mochila): E_MATERIAL_INVALIDO y no se crea ninguna unidad', async () => {
    const error = await fallo(() => anadirMaterial(ctx(), { tipo: 'Mochila', cantidad: 1 }));
    expect(error.codigo).toBe('E_MATERIAL_INVALIDO');
    expect(e.store.leer().unidades).toHaveLength(0);
  });

  it('AC-013-05 datos ausentes (sin cantidad o sin tipo): E_DATOS_INVALIDOS y el inventario no cambia', async () => {
    expect((await fallo(() => anadirMaterial(ctx(), { tipo: 'Casco' }))).codigo).toBe('E_DATOS_INVALIDOS');
    expect((await fallo(() => anadirMaterial(ctx(), { cantidad: 1 }))).codigo).toBe('E_DATOS_INVALIDOS');
    expect((await fallo(() => anadirMaterial(ctx(), {}))).codigo).toBe('E_DATOS_INVALIDOS');
    expect(e.store.leer().unidades).toHaveLength(0);
  });

  // REQ-F-008 AC7: "GIVEN a socio session WHEN the socio opens the address of "Inventario" THEN the user sees "Acceso no permitido""
  it('AC-013-06 socio y junta: E_ACCESO_NO_PERMITIDO con "Acceso no permitido" al listar y al añadir', async () => {
    for (const correo of ['lucia@club.test', 'junta@club.test']) {
      const sid = iniciarSesion(e.ctx(), { correo, contrasena: 'Cumbre2026' }).sid;
      const lista = await fallo(() => listarInventario(e.ctx(sid)));
      expect(lista.codigo).toBe('E_ACCESO_NO_PERMITIDO');
      expect(lista.message).toBe('Acceso no permitido');
      expect((await fallo(() => anadirMaterial(e.ctx(sid), { tipo: 'Casco', cantidad: 1 }))).codigo).toBe('E_ACCESO_NO_PERMITIDO');
    }
    expect(e.store.leer().unidades).toHaveLength(0);
  });

  it('AC-013-07 almacén caído: E_ALMACEN_NO_DISPONIBLE y el recuento de Cuerda no cambia', async () => {
    e.caer();
    const error = await fallo(() => anadirMaterial(ctx(), { tipo: 'Cuerda', cantidad: 1 }));
    expect(error.codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    e.caer(false);
    expect(recuento('Cuerda').total).toBe(0);
  });

  // RN-016: cada alta es una petición nueva y suma unidades (no se deduplica).
  it('AC-013-08 el mismo alta enviado dos veces suma: 2 + 2 + 2 = "Crampones: 6 unidades"', () => {
    anadirMaterial(ctx(), { tipo: 'Crampones', cantidad: 2 });
    anadirMaterial(ctx(), { tipo: 'Crampones', cantidad: 2 });
    anadirMaterial(ctx(), { tipo: 'Crampones', cantidad: 2 });
    expect(recuento('Crampones').total).toBe(6);
    expect(new Set(recuento('Crampones').unidades.map((u) => u.numero)).size).toBe(6);
  });
});
