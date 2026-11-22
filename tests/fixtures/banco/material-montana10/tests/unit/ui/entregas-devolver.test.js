// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { montar } from '../../../src/ui/pantallas/entregas.js';

let raiz;
const esperar = (condicion) => vi.waitFor(condicion, { timeout: 1000 });
const encargado = { nombre: 'Encargado', rol: 'encargado' };
const junta = { nombre: 'Junta', rol: 'junta' };
const lista = (extra = {}) => ({ entregarHoy: [], vuelveHoy: [], conRetraso: [], prestado: [], noRecogidas: [], ...extra });
const textos = (selector) => [...raiz.querySelectorAll(selector)].map((n) => n.textContent);
const conPrestamos = () => lista({
  vuelveHoy: [{ reservaId: 1, unidad: 'Piolet 2', socio: 'Lucía', hasta: '2026-12-07' }],
  conRetraso: [{ reservaId: 2, unidad: 'Casco 1', socio: 'Pablo', hasta: '2026-12-07', dias: 3 }],
  prestado: [{ reservaId: 3, unidad: 'Cuerda 1', socio: 'Inés', hasta: '2026-12-12' }],
});

beforeEach(() => {
  raiz = document.createElement('div');
  document.body.replaceChildren(raiz);
});

describe('acción Devolver en Entregas y devoluciones (SCR-004, UC-006)', () => {
  it('el encargado tiene un botón Devolver en cada préstamo (vuelve hoy, con retraso, prestado) y la junta ninguno', async () => {
    const api = { consultarEntregasYDevoluciones: vi.fn().mockResolvedValue(conPrestamos()) };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(raiz.querySelectorAll('li').length).toBe(3));
    for (const seccion of ['vuelve-hoy', 'con-retraso', 'prestado']) expect(raiz.querySelectorAll(`[data-seccion="${seccion}"] input[type="button"]`)).toHaveLength(1);
    raiz.replaceChildren();
    montar({ raiz, api, sesion: junta });
    await esperar(() => expect(raiz.querySelectorAll('li').length).toBe(3));
    expect(raiz.querySelectorAll('button, input[type="button"]')).toHaveLength(0);
  });

  it('Devolver llama a la API con la reserva, avisa «{unidad} · {socio} · Devuelta» y, con retraso, «Multa de {importe} € a {socio} ({n} días de retraso)», y vuelve a pedir la lista', async () => {
    const api = {
      consultarEntregasYDevoluciones: vi.fn().mockResolvedValueOnce(conPrestamos()).mockResolvedValue(lista()),
      devolverPrestamo: vi.fn().mockResolvedValue({ unidad: 'Casco 1', socio: 'Pablo', estado: 'Devuelta', multa: { importeEur: 6, dias: 3 } }),
    };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(raiz.querySelector('[data-seccion="con-retraso"] input[type="button"]')).not.toBeNull());
    raiz.querySelector('[data-seccion="con-retraso"] input[type="button"]').click();
    await esperar(() => expect(textos('#mensajes [role="status"]')).toEqual(['Casco 1 · Pablo · Devuelta', 'Multa de 6 € a Pablo (3 días de retraso)']));
    expect(api.devolverPrestamo).toHaveBeenCalledWith(2);
    await esperar(() => expect(raiz.querySelectorAll('li')).toHaveLength(0));
  });

  it('sin multa solo avisa «{unidad} · {socio} · Devuelta»', async () => {
    const api = {
      consultarEntregasYDevoluciones: vi.fn().mockResolvedValueOnce(conPrestamos()).mockResolvedValue(lista()),
      devolverPrestamo: vi.fn().mockResolvedValue({ unidad: 'Piolet 2', socio: 'Lucía', estado: 'Devuelta', multa: null }),
    };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(raiz.querySelector('[data-seccion="vuelve-hoy"] input[type="button"]')).not.toBeNull());
    raiz.querySelector('[data-seccion="vuelve-hoy"] input[type="button"]').click();
    await esperar(() => expect(textos('#mensajes [role="status"]')).toEqual(['Piolet 2 · Lucía · Devuelta']));
  });

  it('un rechazo de la API se muestra con su mensaje en la fila y el préstamo sigue en la lista', async () => {
    const api = {
      consultarEntregasYDevoluciones: vi.fn().mockResolvedValue(conPrestamos()),
      devolverPrestamo: vi.fn().mockRejectedValue({ codigo: 'E_RESERVA_NO_PRESTADA', mensaje: 'Esa reserva no está prestada' }),
    };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(raiz.querySelector('[data-seccion="prestado"] input[type="button"]')).not.toBeNull());
    raiz.querySelector('[data-seccion="prestado"] input[type="button"]').click();
    await esperar(() => expect(raiz.querySelector('[data-seccion="prestado"] [role="alert"]').textContent).toBe('Esa reserva no está prestada'));
    expect(raiz.querySelectorAll('[data-seccion="prestado"] li')).toHaveLength(1);
  });
});
