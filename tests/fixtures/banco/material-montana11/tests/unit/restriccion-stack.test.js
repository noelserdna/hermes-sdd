import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('REQ-C-001 Stack', () => {
  // REQ-C-001 AC1: "package.json lists vite and vitest and no other UI framework"
  it('REQ-C-001 AC1 package.json lista vite y vitest y ningún otro framework de interfaz', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(pkg.type).toBe('module');
    expect(deps).toContain('vite');
    expect(deps).toContain('vitest');
    for (const otro of ['react', 'react-dom', 'vue', 'svelte', '@angular/core', 'preact', 'solid-js', 'lit']) {
      expect(deps).not.toContain(otro);
    }
  });
});
