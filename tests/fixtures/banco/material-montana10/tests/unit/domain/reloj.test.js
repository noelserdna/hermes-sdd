import { describe, it, expect } from 'vitest';
import { crearReloj } from '../../../src/domain/reloj.js';

describe('reloj', () => {
  // ADR-001: «Hoy» es el día natural de Europe/Madrid y el reloj se inyecta
  it('ADR-001 reloj.hoy() devuelve la fecha natural Europe/Madrid', () => {
    expect(crearReloj({ env: { CLOCK_FIXED: '2026-12-01' } }).hoy()).toBe('2026-12-01');
    // 23:30 UTC del 30-nov ya es 1-dic en Madrid
    const sinFijar = crearReloj({ env: {}, ahora: () => new Date('2026-11-30T23:30:00Z') });
    expect(sinFijar.hoy()).toBe('2026-12-01');
    // en verano el desfase es de 2 horas
    expect(crearReloj({ env: {}, ahora: () => new Date('2026-07-14T22:30:00Z') }).hoy()).toBe('2026-07-15');
  });

  it('ADR-001 con CLOCK_FIXED el instante no avanza y se puede fijar con hora', () => {
    const fijo = crearReloj({ env: { CLOCK_FIXED: '2026-12-01' } });
    expect(fijo.ahora().getTime()).toBe(fijo.ahora().getTime());
    const concreto = crearReloj({ env: { CLOCK_FIXED: '2026-12-01T09:00:00Z' } });
    expect(concreto.ahora().toISOString()).toBe('2026-12-01T09:00:00.000Z');
    expect(concreto.hoy()).toBe('2026-12-01');
  });
});
