import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// FASE-0 (observación de Andres Leon, 2026-11-22): la web se veía como HTML sin estilo; ahora aplica el diseño de ux/.
const css = readFileSync(new URL('../../../src/ui/estilos.css', import.meta.url), 'utf8');
const tokens = JSON.parse(readFileSync(new URL('../../../ux/DESIGN-TOKENS.json', import.meta.url), 'utf8'));
const hex = (v) => v.toUpperCase();

describe('ux/ diseño visual (tokens)', () => {
  it('lleva los colores del tema claro y del oscuro de DESIGN-TOKENS.json', () => {
    const c = tokens.color;
    for (const valor of [c.stone['50'], c.stone['0'], c.stone['900'], c.green['700'], c.green['800'], c.red['700'], c.blue['600'], c.forest['100'], c.amber['100'],
      c.night['950'], c.night['900'], c.green['300'], c.blue['300']]) {
      expect(css.toUpperCase(), valor.$value).toContain(hex(valor.$value));
    }
  });

  it('usa la tipografía del sistema, objetivos de 44 px y el anillo de foco de 3 px', () => {
    expect(css).toContain('system-ui');
    expect(css).toContain(`--objetivo: ${tokens.target.touch.$value}`);
    expect(css).toMatch(/:focus-visible\s*{[^}]*outline: 3px solid var\(--foco\)/);
    expect(css).toMatch(/max-width: 72rem/);
  });

  it('da estilo a lo que pintan las páginas: cabecera, formularios, botones, mensajes y filas de reservas', () => {
    for (const selector of ['.cabecera', 'form', 'label', 'input', 'button[type="submit"]', 'button.peligro', '.error', '.aviso', 'ul.reservas li', '.motivo', '.vacio']) {
      expect(css, selector).toContain(selector);
    }
  });

  it('main.js carga la hoja de estilos', () => {
    expect(readFileSync(new URL('../../../src/ui/main.js', import.meta.url), 'utf8')).toContain("import './estilos.css'");
  });
});
