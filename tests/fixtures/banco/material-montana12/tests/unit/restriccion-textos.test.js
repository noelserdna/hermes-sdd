import { describe, it, expect } from 'vitest';
import { T } from '../../src/ui/textos.js';

describe('REQ-C-001 textos en español', () => {
  it('REQ-C-001 AC1 los textos de la interfaz no contienen frases en inglés de la lista de control', () => {
    // «Every text of the interface SHALL be in Spanish» — verificación: los textos no contienen frases en inglés de una lista de control
    const lista = ['Login', 'Logout', 'Sign in', 'Submit', 'Password', 'Loading', 'Welcome', 'Save', 'Cancel', 'Delete'];
    const textos = Object.values(T).map((v) => (typeof v === 'function' ? v('x', 1) : v));
    for (const frase of lista) {
      const re = new RegExp(`\\b${frase}\\b`, 'i');
      for (const texto of textos) expect(texto).not.toMatch(re);
    }
    expect(T.entrar).toBe('Entrar');
    expect(T.contrasena).toBe('Contraseña');
    expect(T.salir).toBe('Salir');
  });
});
