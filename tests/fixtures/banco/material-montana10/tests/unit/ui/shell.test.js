import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import * as textos from '../../../src/ui/textos.js';
import { resolver, PANTALLAS } from '../../../src/ui/router.js';

const raiz = path.resolve(import.meta.dirname, '../../..');
const ficheros = (dir) => (existsSync(dir)
  ? readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? ficheros(path.join(dir, f)) : [path.join(dir, f)]))
  : []);
const literales = (codigo) => [...codigo.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]);
const valores = (objeto) => Object.values(objeto).flatMap((v) => (typeof v === 'string' ? [v] : typeof v === 'object' && v ? valores(v) : []));

describe('shell de la SPA', () => {
  // REQ-C-001: los textos de la interfaz están en español, sin cadenas inglesas de la lista de control
  it('REQ-C-001 los textos de la interfaz no contienen cadenas inglesas de la lista de control', () => {
    const ingles = /\b(Error|Loading|Submit|Cancel|Login|Logout|Save|Delete)\b/;
    const deTextos = valores(textos.T);
    const dePantallas = ficheros(path.join(raiz, 'src/ui/pantallas')).flatMap((f) => literales(readFileSync(f, 'utf8')));
    expect(deTextos.length).toBeGreaterThan(5);
    for (const texto of [...deTextos, ...dePantallas]) expect(texto).not.toMatch(ingles);
  });

  // REQ-C-003: ningún dato de negocio en el navegador, todo en el almacén del servidor
  it('REQ-C-003 ningún dato de negocio en localStorage ni sessionStorage', () => {
    const codigo = ficheros(path.join(raiz, 'src')).filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(codigo.length).toBeGreaterThan(100);
    expect(codigo).not.toContain('localStorage');
    expect(codigo).not.toContain('sessionStorage');
  });

  it('el router resuelve #/entrar, #/mis-reservas, #/reservar e #/inventario a su pantalla', () => {
    expect(resolver('#/entrar').nombre).toBe('entrar');
    expect(resolver('#/mis-reservas').nombre).toBe('mis-reservas');
    expect(resolver('#/reservar').nombre).toBe('reservar');
    expect(resolver('#/inventario').nombre).toBe('inventario');
    expect(resolver('#/no-existe')).toBeNull();
    expect(resolver('')).toBeNull();
    expect(Object.keys(PANTALLAS)).toEqual(expect.arrayContaining(['#/entrar', '#/mis-reservas', '#/reservar', '#/inventario']));
  });
});
