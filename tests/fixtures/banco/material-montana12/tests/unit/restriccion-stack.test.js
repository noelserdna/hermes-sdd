import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('REQ-C-002 stack del proyecto', () => {
  it('REQ-C-002 AC1 package.json declara vite y vitest y "type": "module"', () => {
    // «The project SHALL be JavaScript (ES modules) with Vite and tests with Vitest» — package.json declara vite y vitest y "type": "module"
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    expect(pkg.type).toBe('module');
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })).toEqual(expect.arrayContaining(['vite', 'vitest']));
  });
});
