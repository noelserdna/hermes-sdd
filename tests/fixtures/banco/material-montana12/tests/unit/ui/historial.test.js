// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginaHistorial } from '../../../src/ui/paginas/historial.js';
import { crearApi } from '../../../src/ui/api.js';
import { T } from '../../../src/ui/textos.js';

// SCR-010. Lo que ve la junta en cada criterio con pantalla (AC-018-01..04, REQ-F-009 AC1..AC4) lo prueba el recorrido e2e con su captura
// (tests/e2e/fase-5.spec.js); aquí va cómo se arma la página: la búsqueda, la lista para elegir, el vacío y que no haya acciones.
beforeEach(() => document.body.replaceChildren());
const esperar = () => new Promise((r) => setTimeout(r, 0));
const LUCIA = { id: 'c-lucia', nombre: 'Lucía Gil', correo: 'lucia@club.test' };
const historial = (extra = {}) => ({ socio: LUCIA, prestamos: [{ cantidad: 2, material: 'Casco', inicio: '2026-12-05', fin: '2026-12-07', devueltoEl: '2026-12-09' }], multas: [{ importe: 4, estado: 'Pagada' }], ...extra });

async function abrir(respuestas) {
  const api = { historial: vi.fn(async () => (respuestas.shift ? respuestas.shift() : respuestas)) };
  const main = await paginaHistorial({ api, T });
  document.body.append(main);
  const buscar = async (q) => {
    main.querySelector('input').value = q;
    main.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await esperar();
  };
  return { main, api, buscar };
}
const textos = (nodo, selector) => [...nodo.querySelectorAll(selector)].map((n) => n.textContent);

describe('SCR-010 Historial del socio', () => {
  it('título, nota de solo lectura y un buscador con su etiqueta, en un formulario de búsqueda', async () => {
    const { main } = await abrir([]);
    expect(main.querySelector('h1').textContent).toBe('Historial del socio');
    expect(main.querySelector('form').getAttribute('role')).toBe('search');
    expect(main.querySelector('label').textContent).toBe('Buscar por nombre o correo');
    expect(main.querySelector('label').getAttribute('for')).toBe(main.querySelector('input').id);
    expect(main.querySelector('.solo-lectura').textContent).toBe('Solo lectura: aquí no se puede Entregar, Devolver, Marcar pagada ni Cancelar');
  });

  it('un resultado único muestra su nombre, su correo, sus préstamos y sus multas con el texto del contrato', async () => {
    const { main, api, buscar } = await abrir({ estado: 200, cuerpo: { socios: [{ id: 'c-lucia', nombre: 'Lucía Gil' }], historial: historial() } });
    await buscar('lucia');
    expect(api.historial).toHaveBeenCalledWith({ q: 'lucia' });
    expect(main.querySelector('.historial h2').textContent).toBe('Lucía Gil (lucia@club.test)');
    expect(textos(main, '.prestamos li')).toEqual(['2 × Casco del 2026-12-05 al 2026-12-07 — devuelto el 2026-12-09']);
    expect(textos(main, '.multas-historial li')).toEqual(['Multa de 4 € — Pagada']);
  });

  it('un préstamo sin devolver lo dice', async () => {
    const { main, buscar } = await abrir({ estado: 200, cuerpo: { socios: [], historial: historial({ prestamos: [{ cantidad: 1, material: 'Casco', inicio: '2026-11-20', fin: '2026-11-24', devueltoEl: null }], multas: [] }) } });
    await buscar('lucia');
    expect(textos(main, '.prestamos li')).toEqual(['1 × Casco del 2026-11-20 al 2026-11-24 — sin devolver']);
    expect(main.querySelector('.multas-historial')).toBeNull();
  });

  it('un socio sin nada muestra el mensaje vacío de textos.js y ninguna lista', async () => {
    const { main, buscar } = await abrir({ estado: 200, cuerpo: { socios: [], historial: historial({ prestamos: [], multas: [], mensaje: 'Sin préstamos ni multas' }) } });
    await buscar('marta');
    expect(main.querySelector('.historial .vacio').textContent).toBe('Sin préstamos ni multas');
    expect(main.querySelector('.historial ul')).toBeNull();
  });

  it('sin coincidencias sale «Ningún socio coincide» como alerta y no queda ningún historial de la búsqueda anterior', async () => {
    const { main, buscar } = await abrir([
      { estado: 200, cuerpo: { socios: [], historial: historial() } },
      { estado: 404, cuerpo: { error: { codigo: 'E_BUSQUEDA_VACIA', mensaje: 'Ningún socio coincide' } } },
    ]);
    await buscar('lucia');
    await buscar('zzz');
    expect(main.querySelector('[role=alert]').textContent).toBe('Ningún socio coincide');
    expect(main.querySelector('.historial')).toBeNull();
  });

  it('varios resultados: una lista de enlaces con el nombre y el historial solo al elegir uno', async () => {
    const { main, api, buscar } = await abrir([
      { estado: 200, cuerpo: { socios: [{ id: 'c-lucas', nombre: 'Lucas Gil' }, { id: 'c-lucia', nombre: 'Lucía Gil' }] } },
      { estado: 200, cuerpo: { socios: [{ id: 'c-lucia', nombre: 'Lucía Gil' }], historial: historial() } },
    ]);
    await buscar('gil');
    expect(textos(main, '.resultados a')).toEqual(['Lucas Gil', 'Lucía Gil']);
    expect(main.querySelector('[role=status]').textContent).toBe('2 socios encontrados');
    expect(main.querySelector('.historial')).toBeNull();
    main.querySelectorAll('.resultados a')[1].click();
    await esperar();
    expect(api.historial).toHaveBeenLastCalledWith({ id: 'c-lucia' });
    expect(main.querySelector('.historial h2').textContent).toBe('Lucía Gil (lucia@club.test)');
  });

  it('es de solo lectura: en toda la página no hay más botón que «Buscar» y las filas no llevan acciones', async () => {
    const { main, buscar } = await abrir({ estado: 200, cuerpo: { socios: [], historial: historial() } });
    await buscar('lucia');
    expect(textos(main, 'button')).toEqual(['Buscar']);
    expect(main.querySelector('li button, li input, li select')).toBeNull();
  });

  it('un fallo de red o del almacén sale como alerta', async () => {
    const { main, buscar } = await abrir({ estado: 503, cuerpo: { error: { codigo: 'E_ALMACEN_NO_DISPONIBLE', mensaje: 'No se pudo guardar. Inténtalo de nuevo' } } });
    await buscar('lucia');
    expect(main.querySelector('[role=alert]').textContent).toBe('No se pudo guardar. Inténtalo de nuevo');
  });
});

describe('api.historial', () => {
  it('pide /api/historial con la búsqueda o con el id elegido, codificados', async () => {
    const fetchFn = vi.fn(async () => ({ status: 200, json: async () => ({}) }));
    const api = crearApi(fetchFn);
    await api.historial({ q: 'lucía gil' });
    await api.historial({ id: 'c-1' });
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual(['/api/historial?q=luc%C3%ADa%20gil', '/api/historial?id=c-1']);
  });
});
