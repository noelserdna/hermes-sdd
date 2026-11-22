import { describe, it, expect, afterEach } from 'vitest';
import { crearReloj } from '../../src/domain/reloj.js';

const entorno = process.env.NODE_ENV;
afterEach(() => { process.env.NODE_ENV = entorno; });

describe('reloj', () => {
  it("D-T-001 reloj fijo: crearReloj({fijo:'2026-12-05'}).hoy() devuelve '2026-12-05'", () => {
    expect(crearReloj({ fijo: '2026-12-05' }).hoy()).toBe('2026-12-05');
  });

  it('D-T-001 un instante fijo con hora fija ahora() y hoy()', () => {
    const r = crearReloj({ fijo: '2026-12-05T10:10:00Z' });
    expect(r.ahora()).toBe(Date.parse('2026-12-05T10:10:00Z'));
    expect(r.hoy()).toBe('2026-12-05');
  });

  it('D-T-001 CLOCK_FIXED se ignora con NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    const r = crearReloj({ fijo: '2026-12-05', ahora: () => Date.parse('2030-01-02T12:00:00Z') });
    expect(r.hoy()).toBe('2030-01-02');
  });

  it('hoy() cuenta el día en Europe/Madrid', () => {
    const r = crearReloj({ ahora: () => Date.parse('2026-12-05T23:30:00Z') });
    expect(r.hoy()).toBe('2026-12-06');
  });
});
