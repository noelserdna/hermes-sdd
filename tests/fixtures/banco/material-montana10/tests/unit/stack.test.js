import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const paquete = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const configVitest = readFileSync(new URL('../../vitest.config.js', import.meta.url), 'utf8');

describe('stack', () => {
  // REQ-C-002: el proyecto es JavaScript ESM con Vite y Vitest
  it('REQ-C-002 el proyecto es JavaScript ESM con Vite y Vitest', () => {
    expect(paquete.type).toBe('module');
    const dependencias = { ...paquete.dependencies, ...paquete.devDependencies };
    expect(dependencias).toHaveProperty('vite');
    expect(dependencias).toHaveProperty('vitest');
    expect(configVitest).toMatch(/maxWorkers:\s*2/);
  });

  it('package.json define los scripts dev, build, start, test, lint y cuentas', () => {
    for (const script of ['dev', 'build', 'start', 'test', 'lint', 'cuentas']) expect(paquete.scripts).toHaveProperty(script);
    expect(paquete.scripts.test).toBe('vitest run --maxWorkers=2');
    expect(paquete.scripts.cuentas).toBe('node src/server/preparar-cuentas.js');
  });

  it('start sirve lo construido y lee PORT y HOST sin fijar 127.0.0.1', () => {
    expect(paquete.scripts.start).toContain('vite preview');
    expect(paquete.scripts.start).toContain('${PORT');
    expect(paquete.scripts.start).toContain('${HOST:-0.0.0.0}');
    expect(paquete.scripts.start).not.toContain('127.0.0.1');
  });
});
