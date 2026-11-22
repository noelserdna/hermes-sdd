import { describe, it, expect } from 'vitest';
import { diasRetraso, importeMulta, FINE_PER_DAY_EUR } from '../../src/server/dominio/multas.js';

// REQ-F-005 · INV-MUL-004: retraso = día de la devolución (o hoy) − fin, en días naturales. Lo que se ve de estos importes
// (AC-011-02, AC-011-03) lo prueba el recorrido e2e de FASE-2; aquí va solo el cálculo.
describe('INV-MUL-004 diasRetraso e importeMulta (ADR-004)', () => {
  it('un préstamo que acabó hace 3 días lleva 3 días de retraso y uno que acabó ayer, 1', () => {
    expect(diasRetraso('2026-12-07', '2026-12-10')).toBe(3);
    expect(diasRetraso('2026-12-07', '2026-12-08')).toBe(1);
  });

  it('devuelto el último día o antes no hay retraso', () => {
    expect(diasRetraso('2026-12-07', '2026-12-07')).toBe(0);
    expect(diasRetraso('2026-12-07', '2026-12-05')).toBe(0);
  });

  it('cuenta días naturales también al cruzar mes y año', () => {
    expect(diasRetraso('2026-12-30', '2027-01-02')).toBe(3);
  });

  it('el importe es FINE_PER_DAY_EUR por día y sin retraso no hay multa', () => {
    expect(importeMulta(3)).toBe(FINE_PER_DAY_EUR * 3);
    expect(importeMulta(1)).toBe(FINE_PER_DAY_EUR * 1);
    expect(importeMulta(0)).toBe(0);
  });
});
