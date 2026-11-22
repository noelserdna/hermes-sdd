import { describe, it, expect, beforeEach } from 'vitest';
import { iniciarSesion } from '../../src/domain/cuentas.js';
import { listarInventario, darDeBajaUnidad } from '../../src/domain/inventario.js';
import { entregarReserva } from '../../src/domain/prestamos.js';
import { textoRecuento } from '../../src/ui/textos.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';
import { sembrarUnidades, sembrarReserva } from '../helpers/material.js';

let e; let sidMarta;
beforeEach(() => {
  e = crearEntorno();   // hoy: 2026-12-05
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Junta', correo: 'junta@club.test', contrasena: 'Cumbre2026', rol: 'junta' });
  sidMarta = iniciarSesion(e.ctx(), { correo: 'marta@club.test', contrasena: 'Cumbre2026' }).sid;
});
const ctx = () => e.ctx(sidMarta);
const recuento = (tipo) => listarInventario(ctx()).tipos.find((t) => t.tipo === tipo);
const unidad = (tipo, numero) => e.store.leer().unidades.find((u) => u.tipo === tipo && u.numero === numero);
const reservas = () => e.store.leer().reservas;
// «{tipo}: {n} unidad(es)»: la forma que enseña la pantalla, «1 unidad» o «3 unidades»
const forma = (tipo, n) => `${tipo}: ${n} ${n === 1 ? 'unidad(es)'.replace('(es)', '') : 'unidad(es)'.replace('(es)', 'es')}`;

describe('UC-014 darDeBajaUnidad (API-004-03)', () => {
  // REQ-F-008 AC2: "GIVEN "Casco" has 4 units and "Casco 3" is broken WHEN the encargado removes "Casco 3" THEN the user sees "Casco: 3 unidades" and "Casco 3" as "De baja""
  it('AC-014-01 REQ-F-008 AC2 "Casco" con 4 unidades: tras dar de baja "Casco 3" el inventario devuelve 3 unidades de "Casco" y "Casco 3" en "De baja"', () => {
    sembrarUnidades(e, 'Casco', 4);
    const r = darDeBajaUnidad(ctx(), { unidadId: unidad('Casco', 3).id });
    expect(r.inventario.tipos.find((t) => t.tipo === 'Casco').total).toBe(3);
    expect(recuento('Casco').total).toBe(3);
    expect(textoRecuento('Casco', recuento('Casco').total)).toBe(forma('Casco', 3));
    expect(recuento('Casco').unidades.map((u) => [u.numero, u.estado])).toEqual([[1, 'Alta'], [2, 'Alta'], [3, 'De baja'], [4, 'Alta']]);
    expect(r.reservasCanceladas).toBe(0);
    expect(r.mensaje).toBeUndefined();
  });

  // REQ-F-008 AC4: "GIVEN "Tienda" has 1 unit with a future reservation from 2026-12-20 WHEN the encargado removes it THEN that reservation is cancelled and the user sees "1 reserva cancelada por la baja""
  it('AC-014-02 REQ-F-008 AC4 "Tienda" con 1 unidad y una reserva futura desde 2026-12-20: la reserva queda Cancelada y la respuesta trae "1 reserva cancelada por la baja"', () => {
    sembrarUnidades(e, 'Tienda', 1);
    const id = sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Tienda', inicio: '2026-12-20', fin: '2026-12-22' });
    const r = darDeBajaUnidad(ctx(), { unidadId: unidad('Tienda', 1).id });
    expect(reservas().find((x) => x.id === id)).toMatchObject({ estado: 'Cancelada', canceladaEl: '2026-12-05' });
    expect(r.reservasCanceladas).toBe(1);
    expect(r.mensaje).toBe('1 reserva cancelada por la baja');
    expect(recuento('Tienda').total).toBe(0);
  });

  // REQ-F-008 AC3: "GIVEN "Casco 2" is lent now WHEN the encargado tries to remove it THEN the user sees "No se puede dar de baja: está prestada" and the unit stays"
  it('AC-014-03 REQ-F-008 AC3 "Casco 2" con un Entregado da E_UNIDAD_PRESTADA y sigue en Alta, con sus reservas intactas', async () => {
    sembrarUnidades(e, 'Casco', 2);
    sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Casco', unidad: 2, inicio: '2026-12-05', fin: '2026-12-07', estado: 'Entregado' });
    sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Casco', unidad: 2, inicio: '2026-12-20', fin: '2026-12-21' });
    const antes = JSON.stringify(reservas());
    const error = await fallo(() => darDeBajaUnidad(ctx(), { unidadId: unidad('Casco', 2).id }));
    expect(error.codigo).toBe('E_UNIDAD_PRESTADA');
    expect(error.message).toBe('No se puede dar de baja: está prestada');
    // REQ-F-008 AC3 cláusula: "the unit stays"
    expect(unidad('Casco', 2).estado).toBe('Alta');
    expect(JSON.stringify(reservas())).toBe(antes);
  });

  // REQ-F-008 AC5: "GIVEN a unit already "De baja" WHEN the same removal is sent again THEN the count stays the same"
  it('AC-014-07 REQ-F-008 AC5 con "Casco 3" ya "De baja", repetir la baja deja "Casco: 3 unidades"', () => {
    sembrarUnidades(e, 'Casco', 4);
    const unidadId = unidad('Casco', 3).id;
    darDeBajaUnidad(ctx(), { unidadId });
    const repetida = darDeBajaUnidad(ctx(), { unidadId });
    expect(repetida.inventario.tipos.find((t) => t.tipo === 'Casco').total).toBe(3);
    expect(repetida.reservasCanceladas).toBe(0);
    // REQ-F-008 AC5 cláusula: "the count stays the same"
    expect(recuento('Casco').total).toBe(3);
    expect(textoRecuento('Casco', recuento('Casco').total)).toBe(forma('Casco', 3));
    expect(unidad('Casco', 3).estado).toBe('De baja');
  });

  // D-T-009: "gana la primera confirmada: la baja da E_UNIDAD_PRESTADA o la entrega da E_ESTADO_INVALIDO"
  it('AC-014-06 entrega y baja a la vez (D-T-009): gana la primera confirmada y nunca tienen éxito las dos', async () => {
    for (const primero of ['entrega', 'baja']) {
      const entorno = crearEntorno();   // hoy: 2026-12-05
      entorno.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
      entorno.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
      sembrarUnidades(entorno, 'Casco', 2);
      const reservaId = sembrarReserva(entorno, { correo: 'lucia@club.test', tipo: 'Casco', unidad: 2, inicio: '2026-12-05', fin: '2026-12-07' });
      const c = entorno.ctx(iniciarSesion(entorno.ctx(), { correo: 'marta@club.test', contrasena: 'Cumbre2026' }).sid);
      const unidadId = entorno.store.leer().unidades.find((u) => u.numero === 2).id;
      const entrega = () => entregarReserva(c, { reservaId });
      const baja = () => darDeBajaUnidad(c, { unidadId });
      const [a, b] = primero === 'entrega' ? [entrega, baja] : [baja, entrega];
      expect(await fallo(a)).toBeNull();
      const error = await fallo(b);
      expect(error.codigo).toBe(primero === 'entrega' ? 'E_UNIDAD_PRESTADA' : 'E_ESTADO_INVALIDO');
    }
  });

  it('PROP-008 dar de baja una unidad n veces equivale a una vez; nunca con reserva Entregado; ninguna Reservada queda sobre una De baja (INV-STK-005)', async () => {
    let semilla = 11;
    const azar = (n) => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla % n; };
    for (let ronda = 0; ronda < 30; ronda++) {
      const entorno = crearEntorno();
      entorno.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
      entorno.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
      sembrarUnidades(entorno, 'Casco', 3);
      const estados = ['Reservada', 'Entregado', 'Devuelto', 'Cancelada'];
      for (let numero = 1; numero <= 3; numero++) {
        if (azar(2)) sembrarReserva(entorno, { correo: 'lucia@club.test', tipo: 'Casco', unidad: numero, inicio: '2026-12-05', fin: '2026-12-07', estado: estados[azar(4)] });
      }
      const c = entorno.ctx(iniciarSesion(entorno.ctx(), { correo: 'marta@club.test', contrasena: 'Cumbre2026' }).sid);
      const unidadId = entorno.store.leer().unidades[azar(3)].id;
      const prestada = entorno.store.leer().reservas.some((r) => r.unidadId === unidadId && r.estado === 'Entregado');
      const veces = 1 + azar(4);
      let uno;
      for (let i = 0; i < veces; i++) {
        const error = await fallo(() => darDeBajaUnidad(c, { unidadId }));
        if (prestada) expect(error.codigo).toBe('E_UNIDAD_PRESTADA');
        else { expect(error).toBeNull(); uno ??= JSON.stringify(entorno.store.leer()); expect(JSON.stringify(entorno.store.leer())).toBe(uno); }
      }
      const db = entorno.store.leer();
      expect(db.unidades.find((u) => u.id === unidadId).estado).toBe(prestada ? 'Alta' : 'De baja');
      for (const u of db.unidades.filter((x) => x.estado === 'De baja')) {
        expect(db.reservas.filter((r) => r.unidadId === u.id && (r.estado === 'Reservada' || r.estado === 'Entregado'))).toEqual([]);
      }
    }
  });

  it('AC-014-04 "Casco 99" da E_UNIDAD_NO_ENCONTRADA y nada cambia', async () => {
    sembrarUnidades(e, 'Casco', 4);
    const antes = JSON.stringify(e.store.leer());
    const error = await fallo(() => darDeBajaUnidad(ctx(), { unidadId: 99 }));
    expect(error.codigo).toBe('E_UNIDAD_NO_ENCONTRADA');
    expect(error.message).toBe('La unidad no existe');
    expect(e.store.leer()).toEqual(JSON.parse(antes));
  });

  it('AC-014-05 socio o junta: E_ACCESO_NO_PERMITIDO y "Casco 3" sigue en Alta', async () => {
    sembrarUnidades(e, 'Casco', 4);
    for (const correo of ['lucia@club.test', 'junta@club.test']) {
      const sid = iniciarSesion(e.ctx(), { correo, contrasena: 'Cumbre2026' }).sid;
      expect((await fallo(() => darDeBajaUnidad(e.ctx(sid), { unidadId: unidad('Casco', 3).id }))).codigo).toBe('E_ACCESO_NO_PERMITIDO');
    }
    expect(unidad('Casco', 3).estado).toBe('Alta');
  });

  it('AC-014-08 almacén caído: E_ALMACEN_NO_DISPONIBLE y la unidad y sus reservas no cambian', async () => {
    sembrarUnidades(e, 'Casco', 4);
    sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Casco', unidad: 3, inicio: '2026-12-20', fin: '2026-12-21' });
    e.caer();
    expect((await fallo(() => darDeBajaUnidad(ctx(), { unidadId: unidad('Casco', 3).id }))).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    e.caer(false);
    expect(unidad('Casco', 3).estado).toBe('Alta');
    expect(reservas().map((r) => r.estado)).toEqual(['Reservada']);
  });
});
