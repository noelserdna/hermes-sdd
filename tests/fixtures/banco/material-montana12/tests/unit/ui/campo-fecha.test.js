// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { campoFecha, aIso, aVisible } from '../../../src/ui/campo-fecha.js';
import { T } from '../../../src/ui/textos.js';

beforeEach(() => document.body.replaceChildren());

// REQ-C-001: la web está en español. El navegador pinta el <input type="date"> según su propio idioma (mm/dd/yyyy en inglés),
// así que los campos de fecha son de texto con «dd/mm/aaaa» y el servidor sigue recibiendo AAAA-MM-DD.
describe('REQ-C-001 campos de fecha en día/mes/año', () => {
  it('el campo enseña el formato «dd/mm/aaaa» y la ayuda dice «Formato DD/MM/AAAA»', () => {
    const campo = campoFecha({ id: 'inicio', name: 'inicio' });
    expect(campo.type).toBe('text');
    expect(campo.getAttribute('placeholder')).toBe('dd/mm/aaaa');
    expect(campo.getAttribute('inputmode')).toBe('numeric');
    expect(T.ayudaFecha).toBe('Formato DD/MM/AAAA');
  });

  it('«05/12/2026» se envía como «2026-12-05»; con ceros que faltan, «5/1/2026» como «2026-01-05»', () => {
    expect(aIso('05/12/2026')).toBe('2026-12-05');
    expect(aIso(' 5/1/2026 ')).toBe('2026-01-05');
  });

  it('un valor ya en AAAA-MM-DD se envía igual y al salir del campo se enseña como «05/12/2026»', () => {
    expect(aIso('2026-12-05')).toBe('2026-12-05');
    const campo = campoFecha({ id: 'fecha', name: 'fecha' });
    document.body.append(campo);
    campo.value = '2026-12-05';
    campo.dispatchEvent(new Event('change'));
    expect(campo.value).toBe('05/12/2026');
    expect(aIso(campo.value)).toBe('2026-12-05');
    expect(aVisible('2026-12-05')).toBe('05/12/2026');
  });

  it('lo que no es una fecha se envía tal cual, para que el servidor conteste «Elige una fecha válida»', () => {
    expect(aIso('')).toBe('');
    expect(aIso('mañana')).toBe('mañana');
    expect(aIso('31/02/2026')).toBe('2026-02-31');
    expect(aVisible('mañana')).toBe('mañana');
  });
});
