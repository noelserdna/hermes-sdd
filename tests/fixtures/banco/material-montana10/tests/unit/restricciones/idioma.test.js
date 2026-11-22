import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import * as textos from '../../../src/ui/textos.js';

const raiz = path.resolve(import.meta.dirname, '../../..');
const ficheros = (dir) => (existsSync(dir)
  ? readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? ficheros(path.join(dir, f)) : [path.join(dir, f)]))
  : []);
const literales = (codigo) => [...codigo.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]);
const valores = (objeto) => Object.values(objeto).flatMap((v) => (typeof v === 'string' ? [v] : typeof v === 'object' && v ? valores(v) : []));

describe('restricción de idioma', () => {
  // REQ-C-001 AC1: "All texts of the interface SHALL be in Spanish"
  it('REQ-C-001 AC1 los textos de la interfaz están en español: sin Error, Loading, Submit, Cancel, Login, Logout, Save ni Delete', () => {
    const ingles = /\b(Error|Loading|Submit|Cancel|Login|Logout|Save|Delete)\b/;
    const deTextos = valores(textos.T);
    const dePantallas = ficheros(path.join(raiz, 'src/ui/pantallas')).flatMap((f) => literales(readFileSync(f, 'utf8')));
    expect(deTextos.length).toBeGreaterThan(5);
    for (const texto of [...deTextos, ...dePantallas]) expect(texto).not.toMatch(ingles);
  });
});
