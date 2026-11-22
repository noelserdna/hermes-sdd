// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginaMisReservasConLista } from '../../../src/ui/paginas/mis-reservas.js';
import { crearAvisos } from '../../../src/ui/componentes.js';
import { T } from '../../../src/ui/textos.js';

beforeEach(() => document.body.replaceChildren());
const esperar = () => new Promise((r) => setTimeout(r, 0));
const fila = (extra) => ({ id: 'r1', cantidad: 2, material: 'Casco', inicio: '2026-12-05', fin: '2026-12-07', estado: 'Reservada', cancelable: true, motivo: null, ...extra });

async function pagina(respuestas, cancelarReserva = vi.fn()) {
  const cola = [...respuestas];
  const api = { misReservas: vi.fn(async () => cola.length > 1 ? cola.shift() : cola[0]), cancelarReserva };
  const avisos = crearAvisos(T);
  const main = await paginaMisReservasConLista({ api, T, avisos });
  document.body.append(main);
  return { main, api, avisos };
}
const lista = (reservas) => ({ estado: 200, cuerpo: { reservas } });

describe('SCR-003 Mis reservas con lista', () => {
  it('cada fila dice «{cantidad} × {material} del {inicio} al {fin} — {estado}» y solo la cancelable lleva «Cancelar»', async () => {
    const { main } = await pagina([lista([fila(), fila({ id: 'r2', estado: 'Devuelta', cancelable: false })])]);
    const filas = [...main.querySelectorAll('li')];
    expect(filas.map((li) => li.querySelector('.texto').textContent)).toEqual([
      '2 × Casco del 2026-12-05 al 2026-12-07 — Reservada', '2 × Casco del 2026-12-05 al 2026-12-07 — Devuelta']);
    expect(filas[0].querySelector('button').textContent).toBe('Cancelar');
    expect(filas[0].querySelector('button').getAttribute('aria-describedby')).toBe('reserva-r1');
    expect(filas[1].querySelector('button')).toBeNull();
  });

  it('una fila que no se puede cancelar enseña el motivo en la propia fila y ningún botón', async () => {
    const { main } = await pagina([lista([fila({ cancelable: false, motivo: 'No se puede cancelar: empieza hoy' })])]);
    const li = main.querySelector('li');
    expect(li.querySelector('.motivo').textContent).toBe('No se puede cancelar: empieza hoy');
    expect(li.querySelector('button')).toBeNull();
  });

  it('sin reservas muestra «Aún no tienes reservas» y ninguna lista', async () => {
    const { main } = await pagina([lista([])]);
    expect(main.querySelector('h1').textContent).toBe('Mis reservas');
    expect(main.querySelector('.vacio').textContent).toBe('Aún no tienes reservas');
    expect(main.querySelector('ul')).toBeNull();
  });

  it('«Cancelar» envía el id de la fila, deja «Reserva cancelada» en los avisos y recarga la lista', async () => {
    const cancelar = vi.fn(async () => ({ estado: 200, cuerpo: { mensaje: 'Reserva cancelada' } }));
    const { main, avisos, api } = await pagina([lista([fila()]), lista([fila({ estado: 'Cancelada', cancelable: false })])], cancelar);
    main.querySelector('li button').click();
    await esperar();
    expect(cancelar).toHaveBeenCalledWith('r1');
    expect(avisos.textos()).toEqual(['Reserva cancelada']);
    expect(api.misReservas).toHaveBeenCalledTimes(2);
    expect(main.querySelector('li .texto').textContent).toBe('2 × Casco del 2026-12-05 al 2026-12-07 — Cancelada');
    expect(main.querySelector('li button')).toBeNull();
  });

  it('el aviso de repetición del servidor se muestra tal cual en los avisos, sin error', async () => {
    const cancelar = vi.fn(async () => ({ estado: 200, cuerpo: { aviso: { codigo: 'E_YA_CANCELADA', mensaje: 'La reserva ya estaba cancelada' } } }));
    const { main, avisos } = await pagina([lista([fila()])], cancelar);
    main.querySelector('li button').click();
    await esperar();
    expect(avisos.textos()).toEqual(['La reserva ya estaba cancelada']);
    expect(main.querySelector('[role="alert"]')).toBeNull();
  });

  it('un error al cancelar sale junto a la lista con foco y no deja aviso', async () => {
    const cancelar = vi.fn(async () => ({ estado: 409, cuerpo: { error: { codigo: 'E_EMPIEZA_HOY', mensaje: 'No se puede cancelar: empieza hoy' } } }));
    const { main, avisos } = await pagina([lista([fila()])], cancelar);
    main.querySelector('li button').click();
    await esperar();
    expect(main.querySelector('[role="alert"]').textContent).toBe('No se puede cancelar: empieza hoy');
    expect(avisos.textos()).toEqual([]);
  });
});
