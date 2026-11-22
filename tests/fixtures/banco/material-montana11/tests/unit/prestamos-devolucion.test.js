import { describe, it, expect, beforeEach } from 'vitest';
import { entregarReserva, registrarDevolucion } from '../../src/domain/prestamos.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';
import { sembrarUnidades, sembrarReserva, sesionDe } from '../helpers/material.js';

// Devolución (UC-009). Piolet de Lucía 2026-12-05 a 2026-12-07, entregado el 05 por Marta; el reloj se mueve con `avanzar`.
let e; let marta; let reservaId;
const DIA = 24 * 60;
const entrarMarta = () => { marta = sesionDe(e, 'marta@club.test'); return marta; };
beforeEach(() => {
  e = crearEntorno({ inicio: '2026-12-05T10:00:00Z' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  sembrarUnidades(e, 'Piolet', 1);
  reservaId = sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' });
  entregarReserva(e.ctx(entrarMarta()), { reservaId });
});
const reserva = () => e.store.leer().reservas.find((r) => r.id === reservaId);
const diaSiguiente = (n) => { e.avanzar(n * DIA); return entrarMarta(); };   // la sesión de ayer caducó: se entra de nuevo

describe('API-003-02 registrarDevolucion (UC-009)', () => {
  // REQ-F-005 AC2: "GIVEN a delivered "Piolet" due 2026-12-07 WHEN the encargado marks "Devolver" on 2026-12-07 THEN the user sees state "Devuelto" and the unit is free again"
  it('AC-009-01 REQ-F-005 AC2 un Piolet Entregado con fin 2026-12-07 devuelto el 2026-12-07 queda "Devuelto" y su unidad libre', () => {
    const sid = diaSiguiente(2);
    const vista = registrarDevolucion(e.ctx(sid), { reservaId });
    expect(vista).toMatchObject({ id: reservaId, material: 'Piolet', estado: 'Devuelto', devueltaEl: '2026-12-07' });
    expect(reserva()).toMatchObject({ estado: 'Devuelto', devueltaEl: '2026-12-07' });
    // INV-LOA-003: la unidad queda libre (ninguna reserva Reservada/Entregado la ocupa)
    expect(e.store.leer().reservas.filter((r) => ['Reservada', 'Entregado'].includes(r.estado) && r.unidadId === 1)).toEqual([]);
  });

  // REQ-F-005 AC5: "GIVEN a delivered unit already marked "Devuelto" WHEN "Devolver" is sent again THEN the state stays "Devuelto" with the first return date and no second fine is created"
  it('AC-009-03 REQ-F-005 AC5 devolver otra vez el 2026-12-11 deja "Devuelto" con devueltaEl 2026-12-10 y la única multa de 6 €', () => {
    // GIVEN: una unidad Entregada (fin 2026-12-07) ya devuelta con retraso el 2026-12-10, que creó su multa
    registrarDevolucion(e.ctx(diaSiguiente(5)), { reservaId });
    const primera = e.store.leer().multas;
    expect(primera).toHaveLength(1);
    // WHEN: "Devolver" se envía otra vez el 2026-12-11
    const vista = registrarDevolucion(e.ctx(diaSiguiente(1)), { reservaId });
    // REQ-F-005 AC5: "GIVEN a delivered unit already marked "Devuelto" WHEN "Devolver" is sent again THEN the state stays "Devuelto" with the first return date and no second fine is created"
    // REQ-F-005 AC5 cláusula: "the state stays "Devuelto" with the first return date"
    expect(vista).toMatchObject({ estado: 'Devuelto', devueltaEl: '2026-12-10' });
    expect(reserva()).toMatchObject({ estado: 'Devuelto', devueltaEl: '2026-12-10' });
    // REQ-F-005 AC5 cláusula: "no second fine is created"
    const multas = e.store.leer().multas;
    expect(multas).toHaveLength(1);
    expect(multas).toEqual(primera);
    expect(multas[0]).toMatchObject({ reservaId, importeEur: 6, estado: 'Pendiente' });
  });

  it('AC-009-04 un socio recibe E_ACCESO_NO_PERMITIDO y la reserva sigue "Entregado"', async () => {
    const lucia = sesionDe(e, 'lucia@club.test');
    const error = await fallo(() => registrarDevolucion(e.ctx(lucia), { reservaId }));
    expect([error.codigo, error.message]).toEqual(['E_ACCESO_NO_PERMITIDO', 'Acceso no permitido']);
    expect(reserva().estado).toBe('Entregado');
  });

  it('AC-009-05 una reserva que no existe da E_RESERVA_NO_ENCONTRADA y no cambia nada', async () => {
    const antes = JSON.stringify(e.store.leer());
    expect((await fallo(() => registrarDevolucion(e.ctx(marta), { reservaId: 99 }))).codigo).toBe('E_RESERVA_NO_ENCONTRADA');
    expect(JSON.stringify(e.store.leer())).toBe(antes);
  });

  it('AC-009-06 una reserva Reservada (no entregada) da E_ESTADO_INVALIDO y no cambia nada', async () => {
    const otra = sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', unidad: 1, inicio: '2026-12-20', fin: '2026-12-21' });
    const antes = JSON.stringify(e.store.leer().reservas);
    expect((await fallo(() => registrarDevolucion(e.ctx(marta), { reservaId: otra }))).codigo).toBe('E_ESTADO_INVALIDO');
    expect(JSON.stringify(e.store.leer().reservas)).toBe(antes);
  });

  it('AC-009-07 con el almacén caído da E_ALMACEN_NO_DISPONIBLE, la reserva sigue "Entregado" y no hay multa', async () => {
    const sid = diaSiguiente(5);
    e.caer();
    expect((await fallo(() => registrarDevolucion(e.ctx(sid), { reservaId }))).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    e.caer(false);
    expect(reserva()).toMatchObject({ estado: 'Entregado', devueltaEl: null });
    expect(e.store.leer().multas).toEqual([]);
  });

  it('un identificador que no es un entero da E_DATOS_INVALIDOS', async () => {
    expect((await fallo(() => registrarDevolucion(e.ctx(marta), { reservaId: 'uno' }))).codigo).toBe('E_DATOS_INVALIDOS');
  });
});
