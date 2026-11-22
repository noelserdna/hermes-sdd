// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginaMaterial } from '../../../src/ui/paginas/material.js';
import { T } from '../../../src/ui/textos.js';

beforeEach(() => document.body.replaceChildren());
const esperar = () => new Promise((r) => setTimeout(r, 0));
const fila = (id, nombre, total) => ({ id, nombre, total, reservable: total > 0 });

async function pagina(inicial, api = {}) {
  const apiBase = { listarMaterial: vi.fn(async () => ({ estado: 200, cuerpo: { material: inicial } })), anadirUnidades: vi.fn(), retirarUnidades: vi.fn(), ...api };
  const main = await paginaMaterial({ api: apiBase, T });
  document.body.append(main);
  return { main, api: apiBase };
}
const filaDe = (main, nombre) => [...main.querySelectorAll('li')].find((li) => li.textContent.startsWith(`${nombre}:`));
const escribir = (campo, valor) => { campo.value = valor; };
const enviar = (form) => form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

describe('SCR-008 página Material', () => {
  it('lista cada tipo como «{material}: {total} unidades», también con 0, y cada cantidad se etiqueta con su material', async () => {
    const { main } = await pagina([fila('m1', 'Casco', 6), fila('m2', 'Cuerda', 0)]);
    expect(main.querySelector('h1').textContent).toBe('Material');
    expect(filaDe(main, 'Casco').textContent).toContain('Casco: 6 unidades');
    expect(filaDe(main, 'Cuerda').textContent).toContain('Cuerda: 0 unidades');
    expect(main.querySelector('label[for="cantidad-m1"]').textContent).toBe('Cantidad de Casco');
    expect(filaDe(main, 'Casco').querySelector('button').textContent).toBe('Añadir');
  });

  it('añadir a un tipo envía el nombre y la cantidad, y muestra la línea actualizada en la zona de avisos y en la lista', async () => {
    const api = { anadirUnidades: vi.fn(async () => ({ estado: 200, cuerpo: { material: [fila('m1', 'Cuerda', 6)] } })) };
    const { main } = await pagina([fila('m1', 'Cuerda', 4)], api);
    escribir(main.querySelector('#cantidad-m1'), '2');
    enviar(filaDe(main, 'Cuerda').querySelector('form'));
    await esperar();
    expect(api.anadirUnidades).toHaveBeenCalledWith('Cuerda', 2);
    expect(main.querySelector('[role="status"]').textContent).toBe('Cuerda: 6 unidades');
    expect(filaDe(main, 'Cuerda').textContent).toContain('Cuerda: 6 unidades');
  });

  it('un tipo nuevo se crea con nombre y unidades', async () => {
    const api = { anadirUnidades: vi.fn(async () => ({ estado: 200, cuerpo: { material: [fila('m1', 'Cuerda', 4), fila('m9', 'Mosquetón', 10)] } })) };
    const { main } = await pagina([fila('m1', 'Cuerda', 4)], api);
    escribir(main.querySelector('#nombre-nuevo'), 'Mosquetón');
    escribir(main.querySelector('#unidades-nuevo'), '10');
    enviar(main.querySelector('form.tipo-nuevo'));
    await esperar();
    expect(api.anadirUnidades).toHaveBeenCalledWith('Mosquetón', 10);
    expect(filaDe(main, 'Mosquetón').textContent).toContain('Mosquetón: 10 unidades');
  });

  it('un error del servidor sale en una alerta junto al formulario y deja la lista como estaba', async () => {
    const api = { anadirUnidades: vi.fn(async () => ({ estado: 400, cuerpo: { error: { codigo: 'E_CANTIDAD_INVALIDA', mensaje: 'La cantidad debe ser un número entero de 1 o más' } } })) };
    const { main } = await pagina([fila('m1', 'Cuerda', 4)], api);
    escribir(main.querySelector('#cantidad-m1'), '0');
    enviar(filaDe(main, 'Cuerda').querySelector('form'));
    await esperar();
    expect(main.querySelector('[role="alert"]').textContent).toBe('La cantidad debe ser un número entero de 1 o más');
    expect(filaDe(main, 'Cuerda').textContent).toContain('Cuerda: 4 unidades');
    expect(api.anadirUnidades).toHaveBeenCalledWith('Cuerda', 0);
  });

  it('dar de baja pide confirmación con las unidades y el material, y solo entonces envía', async () => {
    const api = { retirarUnidades: vi.fn(async () => ({ estado: 200, cuerpo: { material: [fila('m1', 'Cuerda', 5)] } })) };
    const { main } = await pagina([fila('m1', 'Cuerda', 6)], api);
    escribir(main.querySelector('#cantidad-m1'), '1');
    [...filaDe(main, 'Cuerda').querySelectorAll('button')].find((b) => b.textContent === 'Dar de baja').click();
    expect(api.retirarUnidades).not.toHaveBeenCalled();
    expect(main.textContent).toContain('¿Dar de baja 1 unidades de Cuerda?');
    [...main.querySelectorAll('button')].find((b) => b.textContent === 'Confirmar').click();
    await esperar();
    expect(api.retirarUnidades).toHaveBeenCalledWith('m1', 1);
    expect(filaDe(main, 'Cuerda').textContent).toContain('Cuerda: 5 unidades');
  });

  it('cancelar la confirmación no envía nada', async () => {
    const { main, api } = await pagina([fila('m1', 'Cuerda', 6)]);
    escribir(main.querySelector('#cantidad-m1'), '1');
    [...filaDe(main, 'Cuerda').querySelectorAll('button')].find((b) => b.textContent === 'Dar de baja').click();
    [...main.querySelectorAll('button')].find((b) => b.textContent === 'Cancelar').click();
    expect(api.retirarUnidades).not.toHaveBeenCalled();
    expect(main.textContent).not.toContain('¿Dar de baja');
  });

  it('el error de baja con unidades necesarias se muestra tal cual y la lista no cambia', async () => {
    const mensaje = 'No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06';
    const api = { retirarUnidades: vi.fn(async () => ({ estado: 409, cuerpo: { error: { codigo: 'E_BAJA_UNIDADES_NECESARIAS', mensaje } } })) };
    const { main } = await pagina([fila('m1', 'Tienda', 2)], api);
    escribir(main.querySelector('#cantidad-m1'), '1');
    [...filaDe(main, 'Tienda').querySelectorAll('button')].find((b) => b.textContent === 'Dar de baja').click();
    [...main.querySelectorAll('button')].find((b) => b.textContent === 'Confirmar').click();
    await esperar();
    expect(main.querySelector('[role="alert"]').textContent).toBe(mensaje);
    expect(filaDe(main, 'Tienda').textContent).toContain('Tienda: 2 unidades');
  });

  it('una cantidad vacía no pide confirmación: el servidor responde con su error', async () => {
    const api = { retirarUnidades: vi.fn(async () => ({ estado: 400, cuerpo: { error: { codigo: 'E_CANTIDAD_INVALIDA', mensaje: 'La cantidad debe ser un número entero de 1 o más' } } })) };
    const { main } = await pagina([fila('m1', 'Cuerda', 6)], api);
    [...filaDe(main, 'Cuerda').querySelectorAll('button')].find((b) => b.textContent === 'Dar de baja').click();
    await esperar();
    expect(api.retirarUnidades).toHaveBeenCalledWith('m1', null);
    expect(main.querySelector('[role="alert"]').textContent).toContain('La cantidad debe ser');
  });
});
