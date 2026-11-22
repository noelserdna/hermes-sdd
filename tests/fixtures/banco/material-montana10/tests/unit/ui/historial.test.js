// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { montar } from '../../../src/ui/pantallas/historial.js';
import { resolver } from '../../../src/ui/router.js';

let raiz;
const esperar = (condicion) => vi.waitFor(condicion, { timeout: 1000 });
const junta = { nombre: 'Ana', rol: 'junta' };
const socios = [{ id: 1, nombre: 'Lucía', estado: 'Activa' }, { id: 2, nombre: 'Pablo', estado: 'Activa' }];
const textos = (selector) => [...raiz.querySelectorAll(selector)].map((n) => n.textContent);
const elegir = (id) => { raiz.querySelector('select').value = String(id); raiz.querySelector('button').click(); };
const apiCon = (historial) => ({ listarSocios: vi.fn().mockResolvedValue(socios), consultarHistorial: vi.fn().mockResolvedValue(historial) });

beforeEach(() => {
  raiz = document.createElement('div');
  document.body.replaceChildren(raiz);
});

describe('pantalla Historial (SCR-008, UC-010)', () => {
  it('la ruta #/historial existe para la junta y el encargado, no para el socio', () => {
    expect(resolver('#/historial')).toMatchObject({ nombre: 'historial', roles: expect.arrayContaining(['junta', 'encargado']) });
    expect(resolver('#/historial').roles).not.toContain('socio');
  });

  it('el selector «Socio» se llena con los socios; al elegir uno pide su historial por id y lista «{unidad} · {desde} a {hasta} · {estado}» y «Multa de {importe} € · {estado}»', async () => {
    const api = apiCon({
      prestamos: [{ unidad: 'Piolet 2', desde: '2026-12-05', hasta: '2026-12-07', estado: 'Devuelta' }, { unidad: null, desde: '2026-12-20', hasta: '2026-12-21', estado: 'Reservada' }],
      multas: [{ importe: 2, estado: 'Pagada' }],
    });
    montar({ raiz, api, sesion: junta });
    await esperar(() => expect(raiz.querySelectorAll('option')).toHaveLength(2));
    expect(textos('option')).toEqual(['Lucía', 'Pablo']);
    expect(raiz.querySelector('label').textContent).toContain('Socio');
    elegir(1);
    await esperar(() => expect(textos('[data-seccion="prestamos"] li')).toHaveLength(2));
    expect(api.consultarHistorial).toHaveBeenCalledWith(1);
    expect(textos('[data-seccion="prestamos"] li')).toEqual(['Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta', 'Sin unidad · 2026-12-20 a 2026-12-21 · Reservada']);
    expect(textos('[data-seccion="multas"] li')).toEqual(['Multa de 2 € · Pagada']);
  });

  it('es de solo lectura: tras elegir un socio no hay más botón que «Ver historial», ni enlaces ni campos para editar', async () => {
    montar({ raiz, api: apiCon({ prestamos: [{ unidad: 'Piolet 2', desde: '2026-12-05', hasta: '2026-12-07', estado: 'Devuelta' }], multas: [{ importe: 4, estado: 'Pendiente' }] }), sesion: junta });
    await esperar(() => expect(raiz.querySelectorAll('option')).toHaveLength(2));
    elegir(1);
    await esperar(() => expect(raiz.querySelectorAll('li').length).toBeGreaterThan(0));
    expect(textos('button, input, a, textarea')).toEqual(['Ver historial']);
  });

  it('un socio sin préstamos ni multas muestra «Sin préstamos ni multas» y ninguna lista', async () => {
    montar({ raiz, api: apiCon({ prestamos: [], multas: [] }), sesion: junta });
    await esperar(() => expect(raiz.querySelectorAll('option')).toHaveLength(2));
    elegir(2);
    await esperar(() => expect(raiz.textContent).toContain('Sin préstamos ni multas'));
    expect(raiz.querySelectorAll('li')).toHaveLength(0);
  });

  it('un rechazo de la API (socio inexistente) sale como alerta con su mensaje, sin historial, y se puede elegir otro', async () => {
    const api = apiCon({ prestamos: [], multas: [] });
    api.consultarHistorial.mockRejectedValueOnce({ codigo: 'E_SOCIO_NO_ENCONTRADO', mensaje: 'El socio elegido no existe' });
    montar({ raiz, api, sesion: junta });
    await esperar(() => expect(raiz.querySelectorAll('option')).toHaveLength(2));
    elegir(1);
    await esperar(() => expect(raiz.querySelector('[role="alert"]').textContent).toBe('El socio elegido no existe'));
    expect(raiz.querySelectorAll('li')).toHaveLength(0);
    expect(raiz.textContent).not.toContain('Sin préstamos ni multas');
    elegir(2);
    await esperar(() => expect(raiz.textContent).toContain('Sin préstamos ni multas'));
    expect(raiz.querySelector('[role="alert"]')).toBeNull();
  });

  it('un fallo al cargar la lista de socios sale como alerta con el mensaje de la API', async () => {
    const api = { listarSocios: vi.fn().mockRejectedValue({ codigo: 'E_SIN_PERMISO', mensaje: 'No tienes permiso para ver esta pantalla' }) };
    montar({ raiz, api, sesion: junta });
    await esperar(() => expect(raiz.querySelector('[role="alert"]').textContent).toBe('No tienes permiso para ver esta pantalla'));
  });
});
