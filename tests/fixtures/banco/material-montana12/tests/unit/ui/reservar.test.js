// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginaReservar } from '../../../src/ui/paginas/reservar.js';
import { T } from '../../../src/ui/textos.js';

beforeEach(() => document.body.replaceChildren());
const con = async (material) => paginaReservar({ api: { listarMaterial: vi.fn(async () => ({ estado: 200, cuerpo: { material } })) }, T });

describe('SCR-004 Reservar, versión mínima (solo lectura)', () => {
  it('ofrece en la lista solo los tipos reservables y nombra aparte los que no tienen unidades', async () => {
    const main = await con([{ id: 'm1', nombre: 'Casco', total: 6, reservable: true }, { id: 'm2', nombre: 'Cuerda', total: 0, reservable: false }]);
    expect(main.querySelector('h1').textContent).toBe('Reservar');
    expect([...main.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Casco']);
    expect(main.querySelector('.sin-unidades').textContent).toBe('Sin unidades por ahora: Cuerda');
  });

  it('no tiene formulario ni botón «Reservar»: eso llega en FASE-1', async () => {
    const main = await con([{ id: 'm1', nombre: 'Casco', total: 6, reservable: true }]);
    expect(main.querySelector('form')).toBeNull();
    expect(main.querySelector('button')).toBeNull();
  });

  it('sin ningún tipo reservable lo dice', async () => {
    const main = await con([{ id: 'm2', nombre: 'Cuerda', total: 0, reservable: false }]);
    expect(main.querySelector('li')).toBeNull();
    expect(main.textContent).toContain('No hay material para reservar');
  });
});
