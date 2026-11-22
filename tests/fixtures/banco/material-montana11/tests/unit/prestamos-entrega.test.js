import { describe, it, expect, beforeEach } from 'vitest';
import { entregarReserva, listarPrestamosYReservas } from '../../src/domain/prestamos.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';
import { sembrarUnidades, sembrarReserva, sesionDe } from '../helpers/material.js';

// Entrega y listado de préstamos (UC-008). Las pruebas parten del 2026-12-05 (reloj del entorno) y lo mueven con `avanzar`.
let e; let marta; let lucia; let reservaId;
const DIA = 24 * 60;
beforeEach(() => {
  e = crearEntorno({ inicio: '2026-12-05T10:00:00Z' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  sembrarUnidades(e, 'Piolet', 1);
  reservaId = sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' });
  marta = sesionDe(e, 'marta@club.test');
  lucia = sesionDe(e, 'lucia@club.test');
});
const reserva = () => e.store.leer().reservas.find((r) => r.id === reservaId);

describe('API-003-01 entregarReserva (UC-008)', () => {
  // REQ-F-005 AC1: "GIVEN today is 2026-12-05 and "lucia" has a "Piolet" reservation starting 2026-12-05 WHEN the encargado marks "Entregar" THEN the user sees the reservation "Piolet" with state "Entregado""
  it('AC-008-01 REQ-F-005 AC1 entregar el día de inicio deja el Piolet de lucia "Entregado" con entregadaEl 2026-12-05', () => {
    const vista = entregarReserva(e.ctx(marta), { reservaId });
    expect(vista).toMatchObject({ id: reservaId, material: 'Piolet', socio: 'Lucía Gil', estado: 'Entregado', entregadaEl: '2026-12-05' });
    expect(reserva()).toMatchObject({ estado: 'Entregado', entregadaEl: '2026-12-05' });
  });

  // REQ-F-005 AC3: "GIVEN a reservation starting 2026-12-05 WHEN the encargado tries to deliver it on 2026-12-04 THEN the user sees "No se puede entregar antes de la fecha de inicio""
  it('AC-008-03 REQ-F-005 AC3 entrega anticipada el 2026-12-04: E_ENTREGA_ANTICIPADA con su texto y la reserva sigue "Reservada"', () => {
    e.avanzar(-DIA);
    const error = (() => { try { entregarReserva(e.ctx(marta), { reservaId }); } catch (x) { return x; } return null; })();
    expect(error.codigo).toBe('E_ENTREGA_ANTICIPADA');
    expect(error.message).toBe('No se puede entregar antes de la fecha de inicio');
    expect(reserva()).toMatchObject({ estado: 'Reservada', entregadaEl: null });
  });

  it('AC-008-05 una reserva que no existe da E_RESERVA_NO_ENCONTRADA y no cambia nada', async () => {
    const antes = JSON.stringify(e.store.leer().reservas);
    expect((await fallo(() => entregarReserva(e.ctx(marta), { reservaId: 99 }))).codigo).toBe('E_RESERVA_NO_ENCONTRADA');
    expect(JSON.stringify(e.store.leer().reservas)).toBe(antes);
  });

  it('AC-008-06 entrega doble concurrente (D-T-009): la segunda da E_ESTADO_INVALIDO y se conserva la primera entregadaEl', async () => {
    entregarReserva(e.ctx(marta), { reservaId });
    expect((await fallo(() => entregarReserva(e.ctx(marta), { reservaId }))).codigo).toBe('E_ESTADO_INVALIDO');
    expect(reserva()).toMatchObject({ estado: 'Entregado', entregadaEl: '2026-12-05' });
  });

  it('AC-008-07 con el almacén caído da E_ALMACEN_NO_DISPONIBLE y la reserva sigue "Reservada"', async () => {
    e.caer();
    expect((await fallo(() => entregarReserva(e.ctx(marta), { reservaId }))).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    e.caer(false);
    expect(reserva()).toMatchObject({ estado: 'Reservada', entregadaEl: null });
  });

  it('un socio recibe E_ACCESO_NO_PERMITIDO (solo el encargado entrega) y nada cambia', async () => {
    expect((await fallo(() => entregarReserva(e.ctx(lucia), { reservaId }))).codigo).toBe('E_ACCESO_NO_PERMITIDO');
    expect(reserva().estado).toBe('Reservada');
  });

  it('un identificador que no es un entero da E_DATOS_INVALIDOS', async () => {
    expect((await fallo(() => entregarReserva(e.ctx(marta), { reservaId: 'uno' }))).codigo).toBe('E_DATOS_INVALIDOS');
  });
});

describe('API-003-04 listarPrestamosYReservas (UC-008 paso 2)', () => {
  // REQ-F-005 AC4: "GIVEN a reservation never delivered, start 2026-12-05 WHEN 2026-12-06 arrives THEN the user sees its state "No recogida" and the unit is free for new reservations"
  it('AC-008-02 REQ-F-005 AC4 con hoy 2026-12-06 la reserva sin entregar con inicio 2026-12-05 sale "No recogida" y la unidad queda libre', () => {
    e.avanzar(DIA);
    const lista = listarPrestamosYReservas(e.ctx(sesionDe(e, 'marta@club.test')));   // la sesión de ayer caducó: entra de nuevo
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: reservaId, material: 'Piolet', unidad: 1, socio: 'Lucía Gil', inicio: '2026-12-05', fin: '2026-12-07', estado: 'No recogida' });
    // INV-LOA-002: la unidad queda libre para nuevas reservas
    const ocupan = e.store.leer().reservas.filter((r) => ['Reservada', 'Entregado'].includes(r.estado) && r.unidadId === 1);
    expect(ocupan).toEqual([]);
  });

  it('lista todas las reservas con su estado, socio y unidad, también las Entregadas', () => {
    entregarReserva(e.ctx(marta), { reservaId });
    expect(listarPrestamosYReservas(e.ctx(marta)).map((r) => [r.material, r.unidad, r.socio, r.estado])).toEqual([['Piolet', 1, 'Lucía Gil', 'Entregado']]);
  });

  it('un socio recibe E_ACCESO_NO_PERMITIDO y no ve ninguna lista', async () => {
    expect((await fallo(() => listarPrestamosYReservas(e.ctx(lucia)))).codigo).toBe('E_ACCESO_NO_PERMITIDO');
  });

  it('con el almacén caído da E_ALMACEN_NO_DISPONIBLE', async () => {
    e.caer();
    expect((await fallo(() => listarPrestamosYReservas(e.ctx(marta)))).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
  });
});
