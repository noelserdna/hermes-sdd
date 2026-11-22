import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { T } from '../../src/ui/textos.js';

describe('REQ-C-001 textos en español (MNT-T-001)', () => {
  it('textos.js exporta las entradas que usan las páginas, con el texto literal en español', () => {
    expect(T.entrar).toBe('Entrar');
    expect(T.correo).toBe('Correo');
    expect(T.contrasena).toBe('Contraseña');
    expect(T.salir).toBe('Salir');
    expect(T.sinPermiso).toBe('Sin permiso');
    expect(T.volver).toBe('Volver a mi página');
    expect(T.hola('Lucía')).toBe('Hola, Lucía');
    expect(T.fila('Cuerda', 6)).toBe('Cuerda: 6 unidades');
  });

  it('todo texto exportado es una cadena (o una función que la devuelve) no vacía y sin palabras en inglés', () => {
    const ingles = /\b(login|logout|sign in|submit|password|email|loading|error|welcome|save|cancel|delete)\b/i;
    for (const [clave, valor] of Object.entries(T)) {
      const texto = typeof valor === 'function' ? valor('x', 1) : valor;
      expect(typeof texto, clave).toBe('string');
      expect(texto.length, clave).toBeGreaterThan(0);
      expect(texto, clave).not.toMatch(ingles);
    }
  });

  it('ninguna página lleva texto escrito a mano: solo lo toma de textos.js', () => {
    const carpeta = new URL('../../src/ui/paginas/', import.meta.url);
    for (const f of readdirSync(carpeta)) {
      const fuente = readFileSync(new URL(f, carpeta), 'utf8').replace(/\/\/.*$/gm, '');
      const literales = [...fuente.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
      const texto = literales.filter((s) => /[A-Za-zÁ-ú]{3,}\s+[A-Za-zÁ-ú]{2,}/.test(s) && !s.startsWith('.') && !s.startsWith('/') && !s.includes('./'));
      expect(texto, f).toEqual([]);
    }
  });
});
