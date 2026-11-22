import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const paquete = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));

describe('restricción de stack', () => {
  // REQ-C-002 AC1: "The application SHALL be built with JavaScript (ES modules), Vite and Vitest"
  it('REQ-C-002 AC1 la aplicación es JavaScript (módulos ES) con Vite y Vitest', () => {
    expect(paquete.type).toBe('module');
    const dependencias = { ...paquete.dependencies, ...paquete.devDependencies };
    expect(dependencias).toHaveProperty('vite');
    expect(dependencias).toHaveProperty('vitest');
  });
});
