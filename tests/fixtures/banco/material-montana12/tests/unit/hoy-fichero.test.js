import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearReloj } from '../../src/server/dominio/fechas.js';

let carpeta;
afterEach(() => rmSync(carpeta, { recursive: true, force: true }));
const ahora = () => new Date('2026-11-22T10:00:00Z');
const fichero = (texto) => { carpeta = mkdtempSync(path.join(tmpdir(), 'mm-hoy-')); const f = path.join(carpeta, 'hoy.txt'); if (texto !== null) writeFileSync(f, texto); return f; };

describe('MM_HOY_FICHERO: el «hoy» de un e2e (solo desarrollo)', () => {
  it('mientras el fichero tenga un día, ese es hoy y manda sobre MM_HOY; sin fichero o con basura vale MM_HOY', () => {
    const f = fichero('2026-12-04\n');
    expect(crearReloj({ env: { MM_HOY_FICHERO: f, MM_HOY: '2026-11-22' }, ahora }).hoy()).toBe('2026-12-04');
    writeFileSync(f, 'mañana');
    expect(crearReloj({ env: { MM_HOY_FICHERO: f, MM_HOY: '2026-11-22' }, ahora }).hoy()).toBe('2026-11-22');
    rmSync(f);
    expect(crearReloj({ env: { MM_HOY_FICHERO: f, MM_HOY: '2026-11-22' }, ahora }).hoy()).toBe('2026-11-22');
    expect(crearReloj({ env: { MM_HOY_FICHERO: f }, ahora }).hoy()).toBe('2026-11-22');
  });

  it('sin MM_HOY_FICHERO, el día se lee de hoy.txt junto al fichero de MM_RELOJ (la configuración de los e2e no cambia)', () => {
    const f = fichero('2026-12-04');
    const reloj = path.join(path.dirname(f), 'reloj.txt');
    expect(crearReloj({ env: { MM_RELOJ: reloj, MM_HOY: '2026-11-22' }, ahora }).hoy()).toBe('2026-12-04');
  });

  it('en producción se ignora', () => {
    const f = fichero('2026-12-04');
    expect(crearReloj({ env: { NODE_ENV: 'production', MM_HOY_FICHERO: f }, ahora }).hoy()).toBe('2026-11-22');
  });
});
