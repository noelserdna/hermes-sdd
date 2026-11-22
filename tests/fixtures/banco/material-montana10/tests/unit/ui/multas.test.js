// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { montar } from '../../../src/ui/pantallas/multas.js';
import { resolver } from '../../../src/ui/router.js';

let raiz;
const esperar = (condicion) => vi.waitFor(condicion, { timeout: 1000 });
const encargado = { nombre: 'Encargado', rol: 'encargado' };
const textos = (selector) => [...raiz.querySelectorAll(selector)].map((n) => n.textContent);
const pendiente = { id: 1, socio: 'Lucía', importeEur: 4, estado: 'Pendiente', pagadaEl: null };
const pagada = { id: 2, socio: 'Pablo', importeEur: 2, estado: 'Pagada', pagadaEl: '2026-11-19' };

beforeEach(() => {
  raiz = document.createElement('div');
  document.body.replaceChildren(raiz);
});

describe('pantalla Multas (SCR-005, UC-007)', () => {
  it('la ruta #/multas existe solo para el encargado', () => {
    expect(resolver('#/multas')).toMatchObject({ nombre: 'multas', roles: ['encargado'] });
  });

  it('lista cada multa como «Multa de {importe} € · {socio} · {estado}»; la Pagada con su fecha y sin botón, la Pendiente con «Marcar como pagada»', async () => {
    const api = { listarMultas: vi.fn().mockResolvedValue([pendiente, pagada]) };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(raiz.querySelectorAll('li')).toHaveLength(2));
    expect(raiz.querySelector('h1').textContent).toBe('Multas');
    expect(textos('li .linea')).toEqual(['Multa de 4 € · Lucía · Pendiente', 'Multa de 2 € · Pablo · Pagada']);
    expect(raiz.querySelector('[data-multa="2"]').textContent).toContain('pagada el 2026-11-19');
    expect(textos('button')).toEqual(['Marcar como pagada']);
    expect(raiz.querySelector('[data-multa="1"] button')).not.toBeNull();
  });

  it('Marcar como pagada llama a la API con la multa, avisa «Multa de {importe} € · {socio} · Pagada», vuelve a pedir la lista y el botón desaparece', async () => {
    const api = {
      listarMultas: vi.fn().mockResolvedValueOnce([pendiente]).mockResolvedValue([{ ...pendiente, estado: 'Pagada', pagadaEl: '2026-12-10' }]),
      pagarMulta: vi.fn().mockResolvedValue({ id: 1, socio: 'Lucía', importeEur: 4, estado: 'Pagada', pagadaEl: '2026-12-10' }),
    };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(raiz.querySelector('button')).not.toBeNull());
    raiz.querySelector('button').click();
    await esperar(() => expect(textos('#mensajes [role="status"]')).toEqual(['Multa de 4 € · Lucía · Pagada']));
    expect(api.pagarMulta).toHaveBeenCalledWith(1);
    await esperar(() => expect(textos('li .linea')).toEqual(['Multa de 4 € · Lucía · Pagada']));
    expect(raiz.querySelector('[data-multa="1"]').textContent).toContain('pagada el 2026-12-10');
    expect(raiz.querySelector('button')).toBeNull();
  });

  it('sin multas muestra «No hay multas»; un rechazo de la API sale como alerta con su mensaje', async () => {
    montar({ raiz, api: { listarMultas: vi.fn().mockResolvedValue([]) }, sesion: encargado });
    await esperar(() => expect(raiz.textContent).toContain('No hay multas'));
    raiz.replaceChildren();
    const api = { listarMultas: vi.fn().mockResolvedValue([pendiente]), pagarMulta: vi.fn().mockRejectedValue({ codigo: 'E_MULTA_NO_ENCONTRADA', mensaje: 'No se encontró esa multa' }) };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(raiz.querySelector('button')).not.toBeNull());
    raiz.querySelector('button').click();
    await esperar(() => expect(raiz.querySelector('[role="alert"]').textContent).toBe('No se encontró esa multa'));
  });
});
