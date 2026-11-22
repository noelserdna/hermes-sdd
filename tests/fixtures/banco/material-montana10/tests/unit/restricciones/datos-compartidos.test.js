import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '../../..');
const ficheros = (dir) => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? ficheros(path.join(dir, f)) : [path.join(dir, f)]));
const codigo = (dir) => ficheros(path.join(raiz, dir)).filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');

describe('restricción de datos compartidos', () => {
  // REQ-C-003 AC1: "keep reservas, inventory, multas and accounts in one place read by every device, never only in the browser of each user"
  it('REQ-C-003 AC1 reservas, inventario, multas y cuentas se guardan en el almacén del servidor, no en el navegador', () => {
    const todo = codigo('src');
    expect(todo.length).toBeGreaterThan(100);
    expect(todo).not.toContain('localStorage');
    expect(todo).not.toContain('sessionStorage');
    expect(codigo('src/server')).toContain('STORE_FILE');
  });
});
