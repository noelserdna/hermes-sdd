import { describe, it, expect } from 'vitest';
import { ocupadasEn, primerDiaSinCobertura, libresEn } from '../../src/server/dominio/disponibilidad.js';
import { sumarDias } from '../../src/server/dominio/fechas.js';

const reserva = (extra) => ({ id: 'r', itemId: 'm1', quantity: 1, status: 'Reservada', startDate: '2026-12-05', endDate: '2026-12-07', ...extra });
const HOY = '2026-11-22';

// PRNG determinista para las propiedades (sin dependencias nuevas)
const aleatorio = (semilla) => () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };

describe('ADR-001 INV-RES-005 ocupadas por día, calculadas desde las reservas', () => {
  it('Reservada y Prestada ocupan sus días; Cancelada, Devuelta y No recogida no', () => {
    const rs = [reserva({ quantity: 2 }), reserva({ id: 'p', status: 'Prestada' }),
      reserva({ id: 'c', status: 'Cancelada' }), reserva({ id: 'd', status: 'Devuelta' }), reserva({ id: 'n', status: 'No recogida' })];
    expect(ocupadasEn(rs, 'm1', '2026-12-06', HOY)).toBe(3);
    expect(ocupadasEn(rs, 'm1', '2026-12-04', HOY)).toBe(0);
    expect(ocupadasEn(rs, 'm1', '2026-12-08', HOY)).toBe(0);
  });

  it('solo cuenta las reservas del tipo pedido', () => {
    expect(ocupadasEn([reserva({ itemId: 'otro' })], 'm1', '2026-12-06', HOY)).toBe(0);
  });

  it('una Prestada vencida sigue ocupando hasta hoy', () => {
    const vencida = reserva({ status: 'Prestada', startDate: '2026-11-10', endDate: '2026-11-15' });
    expect(ocupadasEn([vencida], 'm1', '2026-11-22', HOY)).toBe(1);
    expect(ocupadasEn([vencida], 'm1', '2026-11-23', HOY)).toBe(0);
  });

  it('libresEn resta las ocupadas del total', () => {
    expect(libresEn([reserva({ quantity: 2 })], { id: 'm1', totalUnits: 3 }, '2026-12-06', HOY)).toBe(1);
  });
});

describe('INV-MAT-002 retirar solo si cada día ≥ hoy total − n ≥ ocupadas', () => {
  it('con la reserva sembrada (2 de 3) retirar 1 cabe y retirar 2 no, y señala el primer día y las unidades necesarias', () => {
    const rs = [reserva({ quantity: 2 })];
    expect(primerDiaSinCobertura(rs, { id: 'm1', totalUnits: 3 }, 1, HOY)).toBeNull();
    expect(primerDiaSinCobertura(rs, { id: 'm1', totalUnits: 3 }, 2, HOY)).toEqual({ dia: '2026-12-05', necesarias: 2 });
  });

  it('ignora las reservas ya terminadas y las canceladas', () => {
    const rs = [reserva({ startDate: '2026-11-01', endDate: '2026-11-05', quantity: 3 }), reserva({ status: 'Cancelada', quantity: 3 })];
    expect(primerDiaSinCobertura(rs, { id: 'm1', totalUnits: 3 }, 3, HOY)).toBeNull();
  });

  it('PROP-022 con reservas aleatorias la baja se acepta si y solo si total − n ≥ ocupadas cada día', () => {
    const azar = aleatorio(7);
    for (let i = 0; i < 200; i++) {
      const total = 1 + Math.floor(azar() * 6);
      const rs = Array.from({ length: Math.floor(azar() * 4) }, (_, k) => {
        const ini = Math.floor(azar() * 20);
        return reserva({ id: `r${k}`, quantity: 1 + Math.floor(azar() * 3), startDate: sumarDias(HOY, ini), endDate: sumarDias(HOY, ini + 5) });
      });
      const n = 1 + Math.floor(azar() * total);
      const conflicto = primerDiaSinCobertura(rs, { id: 'm1', totalUnits: total }, n, HOY);
      const algunDiaFalla = Array.from({ length: 40 }, (_, d) => sumarDias(HOY, d))
        .some((dia) => total - n < ocupadasEn(rs, 'm1', dia, HOY));
      expect(conflicto !== null).toBe(algunDiaFalla);
    }
  });
});
