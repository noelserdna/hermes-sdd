import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearReloj, crearRelojManual, diaEnMadrid, sumarDias, diasEntre } from '../../src/server/dominio/fechas.js';

describe('RN-022 reloj', () => {
  it('hoy sale del reloj inyectado, en hora de Madrid', () => {
    // 23:30 UTC del 21 de noviembre ya es 22 de noviembre en Madrid (UTC+1)
    const r = crearRelojManual('2026-11-21T23:30:00Z');
    expect(r.hoy()).toBe('2026-11-22');
    r.avanzar(60);
    expect(r.ahora().toISOString()).toBe('2026-11-22T00:30:00.000Z');
  });

  it('MM_HOY fija el día fuera de producción', () => {
    const r = crearReloj({ env: { MM_HOY: '2026-12-01' }, ahora: () => new Date('2026-11-22T10:00:00Z') });
    expect(r.hoy()).toBe('2026-12-01');
  });

  it('MM_HOY se ignora cuando NODE_ENV=production', () => {
    const r = crearReloj({ env: { NODE_ENV: 'production', MM_HOY: '2026-12-01' }, ahora: () => new Date('2026-11-22T10:00:00Z') });
    expect(r.hoy()).toBe('2026-11-22');
  });

  describe('MM_RELOJ (solo desarrollo y e2e)', () => {
    let carpeta;
    afterEach(() => carpeta && rmSync(carpeta, { recursive: true, force: true }));

    it('un fichero con una fecha y hora adelanta el reloj; en producción se ignora', () => {
      carpeta = mkdtempSync(path.join(tmpdir(), 'mm-reloj-'));
      const f = path.join(carpeta, 'reloj.txt');
      writeFileSync(f, '2026-11-22T11:00:00Z');
      const dev = crearReloj({ env: { MM_RELOJ: f }, ahora: () => new Date('2026-11-22T10:00:00Z') });
      expect(dev.ahora().toISOString()).toBe('2026-11-22T11:00:00.000Z');
      const prod = crearReloj({ env: { NODE_ENV: 'production', MM_RELOJ: f }, ahora: () => new Date('2026-11-22T10:00:00Z') });
      expect(prod.ahora().toISOString()).toBe('2026-11-22T10:00:00.000Z');
    });

    it('sin el fichero usa el reloj real', () => {
      const r = crearReloj({ env: { MM_RELOJ: '/no/existe' }, ahora: () => new Date('2026-11-22T10:00:00Z') });
      expect(r.ahora().toISOString()).toBe('2026-11-22T10:00:00.000Z');
    });
  });
});

describe('fechas ISO', () => {
  it('diaEnMadrid, sumarDias y diasEntre trabajan con AAAA-MM-DD', () => {
    expect(diaEnMadrid(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01');
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(diasEntre('2026-12-05', '2026-12-07')).toEqual(['2026-12-05', '2026-12-06', '2026-12-07']);
    expect(diasEntre('2026-12-07', '2026-12-05')).toEqual([]);
  });
});
