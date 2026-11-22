// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginaMultas } from '../../../src/ui/paginas/multas.js';
import { crearAvisos } from '../../../src/ui/componentes.js';
import { T } from '../../../src/ui/textos.js';

// SCR-009. Lo que ve el encargado en cada criterio (AC-013-01..03, AC-014-01) lo prueba el recorrido e2e con su captura
// (tests/e2e/fase-4-ciclo-prestamo.spec.js); aquí va cómo se arma la página: botones por fila, avisos y errores.
beforeEach(() => document.body.replaceChildren());
const esperar = () => new Promise((r) => setTimeout(r, 0));
const pendiente = { id: 'f-1', socio: 'Pablo Sanz', importe: 6, estado: 'Pendiente' };
const pagada = { id: 'f-2', socio: 'Lucía Gil', importe: 2, estado: 'Pagada' };
const ok = (multas) => ({ estado: 200, cuerpo: { multas } });

async function pagina(respuestas, extra = {}) {
  const cola = [...respuestas];
  const api = { listarMultas: vi.fn(async () => (cola.length > 1 ? cola.shift() : cola[0])), pagarMulta: vi.fn(), ...extra };
  const avisos = crearAvisos(T);
  const main = await paginaMultas({ api, T, avisos });
  document.body.append(main);
  return { main, api, avisos };
}
const textos = (nodo, selector) => [...nodo.querySelectorAll(selector)].map((n) => n.textContent);

describe('SCR-009 Multas', () => {
  it('título «Multas» y una fila por multa; «Marcar pagada» solo en las Pendientes', async () => {
    const { main } = await pagina([ok([pendiente, pagada])]);
    expect(main.querySelector('h1').textContent).toBe('Multas');
    expect(textos(main, 'li .texto')).toEqual(['Pablo Sanz — Multa de 6 € — Pendiente', 'Lucía Gil — Multa de 2 € — Pagada']);
    const filas = main.querySelectorAll('li');
    expect(textos(filas[0], 'button')).toEqual(['Marcar pagada']);
    expect(filas[1].querySelector('button')).toBeNull();
  });

  it('sin multas muestra «No hay multas» (RN-031)', async () => {
    const { main } = await pagina([{ estado: 200, cuerpo: { multas: [], mensaje: 'No hay multas' } }]);
    expect(main.querySelector('.vacio').textContent).toBe('No hay multas');
    expect(main.querySelector('li')).toBeNull();
  });

  it('«Marcar pagada» paga esa multa, pone «Multa pagada» en los avisos y recarga la lista', async () => {
    const pagarMulta = vi.fn(async () => ({ estado: 200, cuerpo: { mensaje: 'Multa pagada', estado: 'Pagada', paidOn: '2026-11-22', bloqueado: false } }));
    const { main, api, avisos } = await pagina([ok([pendiente]), ok([{ ...pendiente, estado: 'Pagada' }])], { pagarMulta });
    main.querySelector('li button').click();
    await esperar(); await esperar();
    expect(pagarMulta).toHaveBeenCalledWith('f-1');
    expect(api.listarMultas).toHaveBeenCalledTimes(2);
    expect(avisos.textos()).toEqual(['Multa pagada']);
    expect(textos(main, 'li .texto')).toEqual(['Pablo Sanz — Multa de 6 € — Pagada']);
    expect(main.querySelector('li button')).toBeNull();
  });

  it('ADR-005 el aviso de repetición va a los avisos, no es un error, y la lista se recarga', async () => {
    const pagarMulta = vi.fn(async () => ({ estado: 200, cuerpo: { aviso: { codigo: 'E_MULTA_YA_PAGADA', mensaje: 'La multa ya estaba pagada' } } }));
    const { main, avisos } = await pagina([ok([pendiente]), ok([{ ...pendiente, estado: 'Pagada' }])], { pagarMulta });
    main.querySelector('li button').click();
    await esperar(); await esperar();
    expect(avisos.textos()).toEqual(['La multa ya estaba pagada']);
    expect(main.querySelector('[role=alert]')).toBeNull();
  });

  it('un error al pagar sale como alerta junto a la lista y no toca los avisos', async () => {
    const pagarMulta = vi.fn(async () => ({ estado: 404, cuerpo: { error: { codigo: 'E_MULTA_NO_ENCONTRADA', mensaje: 'La multa no existe' } } }));
    const { main, avisos } = await pagina([ok([pendiente])], { pagarMulta });
    main.querySelector('li button').click();
    await esperar(); await esperar();
    expect(main.querySelector('[role=alert]').textContent).toBe('La multa no existe');
    expect(avisos.textos()).toEqual([]);
  });
});
