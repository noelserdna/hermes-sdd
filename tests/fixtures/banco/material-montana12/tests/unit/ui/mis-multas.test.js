// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginaMisMultas } from '../../../src/ui/paginas/mis-multas.js';
import { crearAvisos } from '../../../src/ui/componentes.js';
import { T } from '../../../src/ui/textos.js';

// SCR-005. Lo que ve la socia en cada criterio (AC-012-01..03) lo prueba el recorrido e2e con su captura
// (tests/e2e/fase-4-ciclo-prestamo.spec.js); aquí va cómo se arma la página: filas, días y errores.
beforeEach(() => document.body.replaceChildren());
const esperar = () => new Promise((r) => setTimeout(r, 0));
const multa = (extra) => ({ id: 'f-1', importe: 6, dias: 3, estado: 'Pendiente', ...extra });

async function pagina(respuesta) {
  const api = { misMultas: vi.fn(async () => respuesta) };
  const main = await paginaMisMultas({ api, T, avisos: crearAvisos(T) });
  document.body.append(main);
  return { main, api };
}
const textos = (nodo, selector) => [...nodo.querySelectorAll(selector)].map((n) => n.textContent);

describe('SCR-005 Mis multas', () => {
  it('título «Mis multas» y una fila por multa con su texto del contrato y, aparte, los días de retraso', async () => {
    const { main, api } = await pagina({ estado: 200, cuerpo: { multas: [multa(), multa({ id: 'f-2', importe: 2, dias: 1, estado: 'Pagada' })] } });
    expect(api.misMultas).toHaveBeenCalledTimes(1);
    expect(main.querySelector('h1').textContent).toBe('Mis multas');
    expect(textos(main, 'li .texto')).toEqual(['Multa de 6 € — Pendiente', 'Multa de 2 € — Pagada']);
    expect(textos(main, 'li .retraso')).toEqual(['Retraso: 3 días', 'Retraso: 1 día']);
    expect(main.querySelector('.vacio')).toBeNull();
  });

  it('una multa sin días guardados (semilla) no inventa el retraso', async () => {
    const { main } = await pagina({ estado: 200, cuerpo: { multas: [multa({ dias: 0 })] } });
    expect(textos(main, 'li .texto')).toEqual(['Multa de 6 € — Pendiente']);
    expect(main.querySelector('.retraso')).toBeNull();
  });

  it('RN-020 sin multas muestra el mensaje vacío de textos.js y ninguna lista', async () => {
    const { main } = await pagina({ estado: 200, cuerpo: { multas: [], mensaje: 'No tienes multas' } });
    expect(main.querySelector('.vacio').textContent).toBe('No tienes multas');
    expect(main.querySelector('ul')).toBeNull();
  });

  it('un error del servidor sale como alerta y no pinta filas', async () => {
    const { main } = await pagina({ estado: 503, cuerpo: { error: { codigo: 'E_ALMACEN_NO_DISPONIBLE', mensaje: 'No se pudo guardar. Inténtalo de nuevo' } } });
    await esperar();
    expect(main.querySelector('[role=alert]').textContent).toBe('No se pudo guardar. Inténtalo de nuevo');
    expect(main.querySelector('li')).toBeNull();
  });
});
