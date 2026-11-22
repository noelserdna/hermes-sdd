// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { montar } from '../../../src/ui/pantallas/inventario.js';
import { ErrorApi } from '../../../src/ui/api.js';

let raiz;
let api;
const esperar = (condicion) => vi.waitFor(condicion, { timeout: 1000 });
const piolet = (n) => ({ tipo: 'Piolet', activas: n, unidades: Array.from({ length: n }, (_, i) => ({ id: i + 1, nombre: `Piolet ${i + 1}`, estado: 'Activa', prestada: false })) });
const enviarFormulario = (tipo, cantidad) => {
  raiz.querySelector('select[name="tipo"]').value = tipo;
  raiz.querySelector('input[name="cantidad"]').value = cantidad;
  raiz.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

beforeEach(() => {
  raiz = document.createElement('div');
  document.body.replaceChildren(raiz);
  api = { listarInventario: vi.fn().mockResolvedValue([]), anadirUnidades: vi.fn(), darDeBajaUnidad: vi.fn() };
});

describe('pantalla Inventario (SCR-007)', () => {
  it('añadir 2 piolets: el recuento sale en el elemento de «Piolet» y el aviso dice la cantidad añadida', async () => {
    montar({ raiz, api, sesion: { nombre: 'Encargado', rol: 'encargado' } });
    await esperar(() => expect(raiz.querySelector('form')).not.toBeNull());
    api.anadirUnidades.mockResolvedValue({ tipo: 'Piolet', anadidas: 2 });
    api.listarInventario.mockResolvedValue([piolet(2)]);
    enviarFormulario('Piolet', '2');
    await esperar(() => expect(raiz.querySelector('[data-tipo="Piolet"] h2').textContent).toBe('Piolet · 2 unidades'));
    expect(api.anadirUnidades).toHaveBeenCalledWith('Piolet', 2);
    expect(raiz.querySelector('[role="status"]').textContent).toBe('Añadidas 2 unidades de Piolet');
    expect(raiz.querySelector('h1').textContent).toBe('Inventario');
  });

  it('el botón de baja se ofrece en una unidad Activa, prestada o no, y no en una De baja; una baja pide confirmación antes de llamar a la API', async () => {
    api.listarInventario.mockResolvedValue([{ tipo: 'Casco', activas: 2, unidades: [
      { id: 1, nombre: 'Casco 1', estado: 'Activa', prestada: true },
      { id: 2, nombre: 'Casco 2', estado: 'Activa', prestada: false },
      { id: 3, nombre: 'Casco 3', estado: 'DeBaja', prestada: false },
    ] }]);
    montar({ raiz, api, sesion: { nombre: 'Encargado', rol: 'encargado' } });
    await esperar(() => expect(raiz.querySelectorAll('li').length).toBe(3));
    const filas = [...raiz.querySelectorAll('li')];
    expect(filas[0].textContent).toContain('Casco 1 · Prestada');
    // REQ-F-008 AC4: "GIVEN \"Casco 1\" is lent to Pablo WHEN the encargado marks it as broken" — la unidad prestada ofrece el botón
    expect(filas[0].querySelector('button').textContent).toBe('Marcar como rota');
    expect(filas[2].textContent).toBe('Casco 3 · De baja');
    expect(filas[2].querySelector('button')).toBeNull();

    filas[1].querySelector('button').click();
    expect(api.darDeBajaUnidad).not.toHaveBeenCalled();
    api.darDeBajaUnidad.mockResolvedValue({ id: 2, nombre: 'Casco 2', estado: 'DeBaja' });
    raiz.querySelector('li [data-accion="confirmar"]').click();
    await esperar(() => expect(api.darDeBajaUnidad).toHaveBeenCalledWith(2));
  });

  it('los errores de la API se muestran con su mensaje', async () => {
    api.listarInventario.mockResolvedValue([{ tipo: 'Casco', activas: 1, unidades: [{ id: 1, nombre: 'Casco 1', estado: 'Activa', prestada: false }] }]);
    montar({ raiz, api, sesion: { nombre: 'Encargado', rol: 'encargado' } });
    await esperar(() => expect(raiz.querySelector('li button')).not.toBeNull());
    api.darDeBajaUnidad.mockRejectedValue(new ErrorApi('E_BAJA_UNIDAD_PRESTADA', 'No se puede dar de baja: está prestada', 409));
    raiz.querySelector('li button').click();
    raiz.querySelector('li [data-accion="confirmar"]').click();
    await esperar(() => expect(raiz.querySelector('[role="alert"]').textContent).toBe('No se puede dar de baja: está prestada'));
    expect(raiz.querySelector('li').textContent).toContain('Casco 1 · Activa');
  });
});
