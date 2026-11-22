// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { montar } from '../../../src/ui/pantallas/mis-reservas.js';

let raiz;
const esperar = (condicion) => vi.waitFor(condicion, { timeout: 1000 });
const avisos = (texto = null) => ({ poner: vi.fn(), tomar: () => texto });
const reserva = (id, tipo, desde, hasta, estado = 'Reservada') => ({ id, socioId: 1, tipo, desde, hasta, estado });

beforeEach(() => {
  raiz = document.createElement('div');
  document.body.replaceChildren(raiz);
});

describe('pantalla Mis reservas (SCR-002 mínima)', () => {
  it('muestra «Hola, {nombre}» en el elemento de saludo con el nombre de la sesión', async () => {
    for (const nombre of ['Lucía', 'Pablo']) {
      const api = { listarMisReservas: vi.fn().mockResolvedValue({ reservas: [], multas: [] }) };
      montar({ raiz, api, sesion: { nombre, rol: 'socio' }, avisos: avisos() });
      await esperar(() => expect(raiz.querySelector('#saludo').textContent).toBe(`Hola, ${nombre}`));
      expect(raiz.querySelector('h1').textContent).toBe('Mis reservas');
    }
  });

  it('lista las reservas propias en filas, con el aviso de reserva creada y sin Cancelar ni multas', async () => {
    const api = { listarMisReservas: vi.fn().mockResolvedValue({ reservas: [reserva(2, 'Piolet', '2026-12-03', '2026-12-05'), reserva(1, 'Casco', '2026-11-10', '2026-11-12', 'Devuelta')], multas: [] }) };
    montar({ raiz, api, sesion: { nombre: 'Lucía', rol: 'socio' }, avisos: avisos('Reserva creada: Piolet del 2026-12-03 al 2026-12-05') });
    await esperar(() => expect(raiz.querySelectorAll('tbody tr')).toHaveLength(2));
    expect(raiz.querySelector('[role="status"]').textContent).toBe('Reserva creada: Piolet del 2026-12-03 al 2026-12-05');
    expect([...raiz.querySelectorAll('tbody tr:first-child td')].map((td) => td.textContent)).toEqual(['Piolet', '2026-12-03', '2026-12-05', 'Reservada']);
    expect(raiz.querySelector('button')).toBeNull();
    expect(raiz.textContent).not.toMatch(/multa/i);
  });

  it('sin reservas dice «No tienes reservas»', async () => {
    const api = { listarMisReservas: vi.fn().mockResolvedValue({ reservas: [], multas: [] }) };
    montar({ raiz, api, sesion: { nombre: 'Lucía', rol: 'socio' }, avisos: avisos() });
    await esperar(() => expect(raiz.textContent).toContain('No tienes reservas'));
    expect(raiz.querySelector('table')).toBeNull();
  });
});
