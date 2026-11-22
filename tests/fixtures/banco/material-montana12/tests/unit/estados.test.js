import { describe, it, expect } from 'vitest';
import { estadoReserva } from '../../src/server/dominio/estados.js';

const reserva = (extra) => ({ id: 'r1', startDate: '2026-12-05', endDate: '2026-12-07', status: 'Reservada', ...extra });

describe('ADR-002 estado derivado de la reserva (INV-RES-008, SM-001)', () => {
  it('una Reservada cuyo fin no ha pasado sigue Reservada, también el último día', () => {
    expect(estadoReserva(reserva(), '2026-12-04')).toBe('Reservada');
    expect(estadoReserva(reserva(), '2026-12-07')).toBe('Reservada');
  });

  it('una Reservada con fin anterior a hoy es «No recogida» sin que nada se guarde', () => {
    const r = reserva();
    expect(estadoReserva(r, '2026-12-08')).toBe('No recogida');
    expect(r.status).toBe('Reservada');
  });

  it('Prestada, Devuelta y Cancelada se devuelven tal cual, pase o no su fin', () => {
    for (const status of ['Prestada', 'Devuelta', 'Cancelada']) {
      expect(estadoReserva(reserva({ status }), '2026-12-06')).toBe(status);
      expect(estadoReserva(reserva({ status }), '2027-01-01')).toBe(status);
    }
  });
});
