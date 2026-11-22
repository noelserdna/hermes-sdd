import { describe, it, expect, beforeEach } from 'vitest';
import { consultarDisponibilidad, reservarMaterial, listarMisReservas, cancelarReserva } from '../../src/domain/reservas.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';
import { HOY_FASE_1, sembrarUnidades, sembrarMulta, sembrarReserva, sesionDe } from '../helpers/material.js';

let e; let lucia; let pablo; let marta;
beforeEach(() => {
  e = crearEntorno({ inicio: HOY_FASE_1 });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  lucia = e.ctx(sesionDe(e, 'lucia@club.test'));
  pablo = e.ctx(sesionDe(e, 'pablo@club.test'));
  marta = e.ctx(sesionDe(e, 'marta@club.test'));
});
const reservas = () => e.store.leer().reservas;
const libres = (ctx, material, inicio, fin) => consultarDisponibilidad(ctx, { material, inicio, fin }).libres;

describe('UC-005 reservarMaterial', () => {
  it('UC-005 lucia reserva Piolet del 2026-12-05 al 2026-12-07 con 3 libres: queda Reservada y Piolet muestra 2 libres', () => {
    sembrarUnidades(e, 'Piolet', 3);
    expect(libres(lucia, 'Piolet', '2026-12-05', '2026-12-07')).toBe(3);
    const r = reservarMaterial(lucia, { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' });
    expect(r).toMatchObject({ material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07', estado: 'Reservada' });
    expect(libres(lucia, 'Piolet', '2026-12-05', '2026-12-07')).toBe(2);
    expect(reservas()).toHaveLength(1);
  });

  it('INV-RES-009 se asigna la unidad libre de menor número en todo el rango', () => {
    sembrarUnidades(e, 'Piolet', 3);
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Piolet', unidad: 1, inicio: '2026-12-06', fin: '2026-12-06' });
    const u = (reserva) => e.store.leer().unidades.find((x) => x.id === reserva.unidadId).numero;
    // la unidad 1 está ocupada el 12-06: el rango 12-05..12-07 se queda con la 2; el 12-10..12-11 vuelve a la 1
    reservarMaterial(lucia, { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' });
    reservarMaterial(lucia, { material: 'Piolet', inicio: '2026-12-10', fin: '2026-12-11' });
    expect(reservas().map(u)).toEqual([1, 2, 1]);
  });

  it('RN-001 días contiguos: Tienda reservada hasta 2026-12-08: pablo reserva del 2026-12-09 al 2026-12-10 y se crea', () => {
    sembrarUnidades(e, 'Tienda', 1);
    reservarMaterial(lucia, { material: 'Tienda', inicio: '2026-12-06', fin: '2026-12-08' });
    const r = reservarMaterial(pablo, { material: 'Tienda', inicio: '2026-12-09', fin: '2026-12-10' });
    expect(r).toMatchObject({ material: 'Tienda', inicio: '2026-12-09', fin: '2026-12-10', estado: 'Reservada' });
    expect(reservas()).toHaveLength(2);
  });

  it('INV-RES-005 lucia sin multas reserva Casco del 2026-12-05 al 2026-12-06 y se crea (una multa Pagada no bloquea)', () => {
    sembrarUnidades(e, 'Casco', 1);
    sembrarMulta(e, 'lucia@club.test', { estado: 'Pagada' });
    expect(reservarMaterial(lucia, { material: 'Casco', inicio: '2026-12-05', fin: '2026-12-06' }).estado).toBe('Reservada');
  });

  // REQ-F-003 AC2: "GIVEN "Tienda" has 1 unit already reserved 2026-12-06 to 2026-12-08 WHEN "pablo" reserves "Tienda" from 2026-12-07 to 2026-12-09 THEN the user sees "No hay unidades libres esas fechas" and no reservation is created"
  it('AC-005-04 REQ-F-003 AC2 Tienda reservada del 2026-12-06 al 2026-12-08: pablo del 2026-12-07 al 2026-12-09 recibe E_SIN_UNIDADES y no se crea nada', async () => {
    sembrarUnidades(e, 'Tienda', 1);
    reservarMaterial(lucia, { material: 'Tienda', inicio: '2026-12-06', fin: '2026-12-08' });
    const error = await fallo(() => reservarMaterial(pablo, { material: 'Tienda', inicio: '2026-12-07', fin: '2026-12-09' }));
    expect(error.codigo).toBe('E_SIN_UNIDADES');
    expect(error.message).toBe('No hay unidades libres esas fechas');
    expect(reservas()).toHaveLength(1);
    // un solo día de solape en cualquiera de los dos extremos también basta
    expect((await fallo(() => reservarMaterial(pablo, { material: 'Tienda', inicio: '2026-12-08', fin: '2026-12-12' }))).codigo).toBe('E_SIN_UNIDADES');
    expect((await fallo(() => reservarMaterial(pablo, { material: 'Tienda', inicio: '2026-12-01', fin: '2026-12-06' }))).codigo).toBe('E_SIN_UNIDADES');
  });

  // REQ-F-003 AC4: "GIVEN today is 2026-11-21 WHEN "lucia" reserves "Casco" from 2026-11-20 to 2026-11-22 THEN the user sees "No se puede reservar en fechas pasadas""
  it('AC-005-05 REQ-F-003 AC4 hoy 2026-11-21: Casco del 2026-11-20 al 2026-11-22 da E_FECHA_PASADA; empezar hoy sí se puede', async () => {
    sembrarUnidades(e, 'Casco', 1);
    const error = await fallo(() => reservarMaterial(lucia, { material: 'Casco', inicio: '2026-11-20', fin: '2026-11-22' }));
    expect(error.codigo).toBe('E_FECHA_PASADA');
    expect(error.message).toBe('No se puede reservar en fechas pasadas');
    expect(reservas()).toHaveLength(0);
    expect((await reservarMaterial(lucia, { material: 'Casco', inicio: '2026-11-21', fin: '2026-11-22' })).estado).toBe('Reservada');
  });

  // REQ-F-003 AC5: "GIVEN an end date before the start date, 2026-12-10 and 2026-12-08, WHEN "lucia" submits THEN the user sees "La fecha de fin no puede ser anterior a la de inicio""
  it('AC-005-06 REQ-F-003 AC5 inicio 2026-12-10 y fin 2026-12-08: E_FECHAS_INVERTIDAS', async () => {
    sembrarUnidades(e, 'Casco', 1);
    const error = await fallo(() => reservarMaterial(lucia, { material: 'Casco', inicio: '2026-12-10', fin: '2026-12-08' }));
    expect(error.codigo).toBe('E_FECHAS_INVERTIDAS');
    expect(error.message).toBe('La fecha de fin no puede ser anterior a la de inicio');
    expect(reservas()).toHaveLength(0);
  });

  // REQ-F-003 AC6: "GIVEN a range of 15 days WHEN "lucia" reserves "Cuerda" from 2026-12-01 to 2026-12-15 THEN the user sees "La reserva no puede superar 14 días""
  it('AC-005-07 REQ-F-003 AC6 Cuerda del 2026-12-01 al 2026-12-15 (15 días): E_RESERVA_MUY_LARGA; del 01 al 14 (14 días) sí', async () => {
    sembrarUnidades(e, 'Cuerda', 1);
    const error = await fallo(() => reservarMaterial(lucia, { material: 'Cuerda', inicio: '2026-12-01', fin: '2026-12-15' }));
    expect(error.codigo).toBe('E_RESERVA_MUY_LARGA');
    expect(error.message).toBe('La reserva no puede superar 14 días');
    expect(reservas()).toHaveLength(0);
    expect((await reservarMaterial(lucia, { material: 'Cuerda', inicio: '2026-12-01', fin: '2026-12-14' })).estado).toBe('Reservada');
  });

  // REQ-F-003 AC7: "GIVEN "pablo" has an unpaid fine of 4 € WHEN he reserves "Casco" for 2026-12-05 to 2026-12-06 THEN the user sees "Tienes una multa pendiente: no puedes reservar hasta pagarla" and no reservation is created"
  it('AC-005-08 REQ-F-003 AC7 pablo con multa Pendiente de 4 € reserva Casco del 2026-12-05 al 2026-12-06: E_MULTA_PENDIENTE y no se crea nada', async () => {
    sembrarUnidades(e, 'Casco', 1);
    sembrarMulta(e, 'pablo@club.test', { importeEur: 4 });
    const error = await fallo(() => reservarMaterial(pablo, { material: 'Casco', inicio: '2026-12-05', fin: '2026-12-06' }));
    expect(error.codigo).toBe('E_MULTA_PENDIENTE');
    expect(error.message).toBe('Tienes una multa pendiente: no puedes reservar hasta pagarla');
    expect(reservas()).toHaveLength(0);
  });

  it('AC-005-09 tipo inválido (Bastón): E_MATERIAL_INVALIDO y sin cambios', async () => {
    expect((await fallo(() => reservarMaterial(lucia, { material: 'Bastón', inicio: '2026-12-05', fin: '2026-12-06' }))).codigo).toBe('E_MATERIAL_INVALIDO');
    expect(reservas()).toHaveLength(0);
  });

  it('AC-005-10 datos vacíos o fechas mal formadas: E_DATOS_INVALIDOS y sin cambios', async () => {
    sembrarUnidades(e, 'Casco', 1);
    for (const datos of [{ material: 'Casco' }, { inicio: '2026-12-05', fin: '2026-12-06' }, { material: 'Casco', inicio: '', fin: '' },
      { material: 'Casco', inicio: '2026-13-40', fin: '2026-12-06' }, { material: 'Casco', inicio: '5/12/2026', fin: '2026-12-06' }, {}]) {
      expect((await fallo(() => reservarMaterial(lucia, datos))).codigo, JSON.stringify(datos)).toBe('E_DATOS_INVALIDOS');
    }
    expect(reservas()).toHaveLength(0);
  });

  it('AC-005-11 el encargado intenta reservar: E_ACCESO_NO_PERMITIDO y sin cambios; sin sesión, E_NO_AUTENTICADO', async () => {
    sembrarUnidades(e, 'Casco', 1);
    const datos = { material: 'Casco', inicio: '2026-12-05', fin: '2026-12-06' };
    const error = await fallo(() => reservarMaterial(marta, datos));
    expect(error.codigo).toBe('E_ACCESO_NO_PERMITIDO');
    expect(error.message).toBe('Acceso no permitido');
    expect((await fallo(() => reservarMaterial(e.ctx(undefined), datos))).codigo).toBe('E_NO_AUTENTICADO');
    expect(reservas()).toHaveLength(0);
  });

  it('AC-005-13 con el almacén caído: E_ALMACEN_NO_DISPONIBLE y sin cambios', async () => {
    sembrarUnidades(e, 'Casco', 1);
    e.caer();
    const error = await fallo(() => reservarMaterial(lucia, { material: 'Casco', inicio: '2026-12-05', fin: '2026-12-06' }));
    expect(error.codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    expect(error.message).toBe('No se pudo guardar. Inténtalo de nuevo');
    e.caer(false);
    expect(reservas()).toHaveLength(0);
  });

  it('INV-RES-008 RN-011 lucia envía dos veces Piolet del 2026-12-05 al 2026-12-07: una sola reserva; otro socio sin unidad libre recibe E_SIN_UNIDADES', async () => {
    sembrarUnidades(e, 'Piolet', 1);
    const datos = { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' };
    const primera = reservarMaterial(lucia, datos);
    const segunda = reservarMaterial(lucia, datos);
    expect(segunda.id).toBe(primera.id);
    expect(reservas()).toHaveLength(1);
    expect((await fallo(() => reservarMaterial(pablo, datos))).codigo).toBe('E_SIN_UNIDADES');
    expect(reservas()).toHaveLength(1);
  });

  it('INV-RES-008 el replay solo cuenta con la reserva Reservada idéntica: tras cancelarla, el mismo envío crea otra', () => {
    sembrarUnidades(e, 'Piolet', 1);
    const datos = { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' };
    const primera = reservarMaterial(lucia, datos);
    e.store.transaccion((db) => { db.reservas[0].estado = 'Cancelada'; });
    expect(reservarMaterial(lucia, datos).id).not.toBe(primera.id);
    expect(reservas()).toHaveLength(2);
  });

  it('INV-LOA-002 una Reservada vencida pasa a No recogida y su unidad queda libre para reservar', () => {
    sembrarUnidades(e, 'Tienda', 1);
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Tienda', inicio: '2026-11-01', fin: '2026-12-30' });
    expect(reservarMaterial(lucia, { material: 'Tienda', inicio: '2026-12-05', fin: '2026-12-06' }).estado).toBe('Reservada');
    expect(reservas().map((r) => r.estado)).toEqual(['No recogida', 'Reservada']);
  });
});

describe('API-002-01 consultarDisponibilidad', () => {
  it('cuenta las unidades libres de todo el rango, sin escribir reservas; un rango invertido no tiene unidades libres', () => {
    sembrarUnidades(e, 'Piolet', 3);
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Piolet', unidad: 1, inicio: '2026-12-07', fin: '2026-12-09' });
    expect(consultarDisponibilidad(lucia, { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-06' })).toEqual({ material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-06', libres: 3 });
    expect(libres(lucia, 'Piolet', '2026-12-06', '2026-12-07')).toBe(2);
    expect(libres(lucia, 'Piolet', '2026-12-10', '2026-12-05')).toBe(0);
    expect(libres(lucia, 'Cuerda', '2026-12-05', '2026-12-06')).toBe(0);
    expect(reservas()).toHaveLength(1);
  });

  it('exige sesión de socio y datos válidos', async () => {
    expect((await fallo(() => consultarDisponibilidad(e.ctx(undefined), { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-06' }))).codigo).toBe('E_NO_AUTENTICADO');
    expect((await fallo(() => consultarDisponibilidad(marta, { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-06' }))).codigo).toBe('E_ACCESO_NO_PERMITIDO');
    expect((await fallo(() => consultarDisponibilidad(lucia, { material: 'Bastón', inicio: '2026-12-05', fin: '2026-12-06' }))).codigo).toBe('E_MATERIAL_INVALIDO');
    expect((await fallo(() => consultarDisponibilidad(lucia, { material: 'Piolet', inicio: 'ayer', fin: '2026-12-06' }))).codigo).toBe('E_DATOS_INVALIDOS');
  });
});

describe('UC-006 listarMisReservas', () => {
  // REQ-F-004 AC1: "GIVEN "lucia" has "Piolet" 2026-12-05 to 2026-12-07 and "pablo" has "Casco" 2026-12-06 to 2026-12-07 WHEN "lucia" opens "Mis reservas" THEN the user sees "Piolet" and does not see "Casco""
  it('AC-006-01 REQ-F-004 AC1 lucia con Piolet y pablo con Casco: lucia lista solo su Piolet del 2026-12-05 al 2026-12-07', () => {
    sembrarUnidades(e, 'Piolet', 1);
    sembrarUnidades(e, 'Casco', 1);
    sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' });
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', inicio: '2026-12-06', fin: '2026-12-07' });
    const lista = listarMisReservas(lucia);
    expect(lista).toEqual([{ id: 1, material: 'Piolet', unidad: 1, inicio: '2026-12-05', fin: '2026-12-07', estado: 'Reservada' }]);
    expect(JSON.stringify(lista)).not.toContain('Casco');
    expect(listarMisReservas(pablo).map((r) => r.material)).toEqual(['Casco']);
  });

  it('las más recientes primero (por inicio) y sin datos de otros socios', () => {
    sembrarUnidades(e, 'Piolet', 2);
    sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', unidad: 1, inicio: '2026-12-05', fin: '2026-12-06' });
    sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', unidad: 2, inicio: '2026-12-20', fin: '2026-12-21' });
    expect(listarMisReservas(lucia).map((r) => r.inicio)).toEqual(['2026-12-20', '2026-12-05']);
    expect(Object.keys(listarMisReservas(lucia)[0]).sort()).toEqual(['estado', 'fin', 'id', 'inicio', 'material', 'unidad']);
  });

  it('UC-006 lucia sin reservas: la lista llega vacía', () => {
    sembrarUnidades(e, 'Casco', 1);
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', inicio: '2026-12-06', fin: '2026-12-07' });
    expect(listarMisReservas(lucia)).toEqual([]);
  });

  it('AC-006-03 sin sesión E_NO_AUTENTICADO y no se lista nada; el encargado recibe E_ACCESO_NO_PERMITIDO', async () => {
    expect((await fallo(() => listarMisReservas(e.ctx(undefined)))).codigo).toBe('E_NO_AUTENTICADO');
    expect((await fallo(() => listarMisReservas(marta))).codigo).toBe('E_ACCESO_NO_PERMITIDO');
  });

  it('AC-006-04 con el almacén caído: E_ALMACEN_NO_DISPONIBLE', async () => {
    sembrarUnidades(e, 'Casco', 1);
    e.caer();
    expect((await fallo(() => listarMisReservas(lucia))).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
  });

  // INV-LOA-002: "Una reserva Reservada con `inicio` < hoy pasa a No recogida y libera la unidad"
  it('INV-LOA-002 al leer: una Reservada con inicio < hoy se lista "No recogida" y queda guardada así', () => {
    sembrarUnidades(e, 'Piolet', 1);
    sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-11-20', fin: '2026-11-22' });
    expect(listarMisReservas(lucia).map((r) => r.estado)).toEqual(['No recogida']);
    expect(reservas().map((r) => r.estado)).toEqual(['No recogida']);
  });
});

describe('UC-007 cancelarReserva', () => {
  let lu; let pa; let en;
  const sembrar = (inicio = '2026-12-05') => { sembrarUnidades(e, 'Piolet', 1); return sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio, fin: '2026-12-07' }); };
  const estadoDe = (id) => reservas().find((r) => r.id === id).estado;
  beforeEach(() => {
    e = crearEntorno({ inicio: '2026-12-04T10:00:00Z' });
    e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
    e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Cumbre2026' });
    e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
    [lu, pa, en] = ['lucia', 'pablo', 'marta'].map((n) => e.ctx(sesionDe(e, `${n}@club.test`)));
  });

  it('INV-RES-006 hoy 2026-12-04 y Piolet desde 2026-12-05: lucia cancela, queda "Cancelada" y la unidad vuelve a estar libre', () => {
    const id = sembrar();
    expect(libres(lu, 'Piolet', '2026-12-05', '2026-12-07')).toBe(0);
    expect(cancelarReserva(lu, { reservaId: id })).toMatchObject({ id, material: 'Piolet', estado: 'Cancelada' });
    expect(listarMisReservas(lu).map((r) => r.estado)).toEqual(['Cancelada']);
    expect(libres(lu, 'Piolet', '2026-12-05', '2026-12-07')).toBe(1);
    expect(reservas().find((r) => r.id === id).canceladaEl).toBe('2026-12-04');
  });

  // REQ-F-004 AC3: "GIVEN today is 2026-12-05 and "lucia" has "Piolet" starting 2026-12-05 WHEN she tries to cancel it THEN the user sees "Solo se puede cancelar hasta el día antes" and the reservation stays"
  it('AC-007-02 REQ-F-004 AC3 hoy 2026-12-05 y Piolet desde 2026-12-05: E_CANCELACION_TARDIA y la reserva sigue Reservada', async () => {
    const id = sembrar();
    const antes = estadoDe(id);
    e.avanzar(24 * 60);
    const ctxHoy = e.ctx(sesionDe(e, 'lucia@club.test'));
    const error = await fallo(() => cancelarReserva(ctxHoy, { reservaId: id }));
    expect(error.codigo).toBe('E_CANCELACION_TARDIA');
    expect(error.message).toBe('Solo se puede cancelar hasta el día antes');
    // REQ-F-004 AC3 cláusula: "the reservation stays"
    expect(estadoDe(id)).toBe(antes);
  });

  // REQ-F-004 AC5: "GIVEN "lucia" already cancelled a reservation WHEN the same cancel is sent again THEN the reservation stays "Cancelada" and nothing else changes"
  it('AC-007-03 REQ-F-004 AC5 repetir la cancelación deja la reserva "Cancelada" y no cambia nada más (ni siquiera el día de inicio)', () => {
    const id = sembrar();
    cancelarReserva(lu, { reservaId: id });
    const antes = JSON.stringify([e.store.leer().reservas, e.store.leer().unidades]);
    e.avanzar(2 * 24 * 60);
    const ctxTarde = e.ctx(sesionDe(e, 'lucia@club.test'));
    // REQ-F-004 AC5 cláusula: "the reservation stays"
    expect(cancelarReserva(ctxTarde, { reservaId: id }).estado).toBe('Cancelada');
    // REQ-F-004 AC5 cláusula: "nothing else changes"
    expect(JSON.stringify([e.store.leer().reservas, e.store.leer().unidades])).toBe(antes);
  });

  it('AC-007-04 una reserva ajena o inexistente da el mismo E_RESERVA_NO_ENCONTRADA y no cambia nada', async () => {
    const id = sembrar();
    const ajena = await fallo(() => cancelarReserva(pa, { reservaId: id }));
    const inexistente = await fallo(() => cancelarReserva(pa, { reservaId: 999 }));
    expect(ajena.codigo).toBe('E_RESERVA_NO_ENCONTRADA');
    expect(ajena.message).toBe(inexistente.message);
    expect(estadoDe(id)).toBe('Reservada');
    expect((await fallo(() => cancelarReserva(lu, { reservaId: 'uno' }))).codigo).toBe('E_DATOS_INVALIDOS');
  });

  it('AC-007-05 una reserva Entregado o No recogida no se cancela: E_ESTADO_INVALIDO y sin cambios', async () => {
    sembrarUnidades(e, 'Piolet', 2);
    const entregada = sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', unidad: 1, inicio: '2026-12-10', fin: '2026-12-11', estado: 'Entregado' });
    const vencida = sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', unidad: 2, inicio: '2026-12-01', fin: '2026-12-02' });
    expect((await fallo(() => cancelarReserva(lu, { reservaId: entregada }))).codigo).toBe('E_ESTADO_INVALIDO');
    expect((await fallo(() => cancelarReserva(lu, { reservaId: vencida }))).codigo).toBe('E_ESTADO_INVALIDO');
    expect(estadoDe(entregada)).toBe('Entregado');
  });

  it('AC-007-06 con el almacén caído: E_ALMACEN_NO_DISPONIBLE y la reserva sigue Reservada; sin sesión E_NO_AUTENTICADO; el encargado E_ACCESO_NO_PERMITIDO', async () => {
    const id = sembrar();
    expect((await fallo(() => cancelarReserva(e.ctx(undefined), { reservaId: id }))).codigo).toBe('E_NO_AUTENTICADO');
    expect((await fallo(() => cancelarReserva(en, { reservaId: id }))).codigo).toBe('E_ACCESO_NO_PERMITIDO');
    e.caer();
    expect((await fallo(() => cancelarReserva(lu, { reservaId: id }))).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    e.caer(false);
    expect(estadoDe(id)).toBe('Reservada');
  });
});
