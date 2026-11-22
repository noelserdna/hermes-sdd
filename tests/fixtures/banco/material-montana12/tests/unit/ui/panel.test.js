// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginaPanelConLista } from '../../../src/ui/paginas/panel.js';
import { crearAvisos } from '../../../src/ui/componentes.js';
import { T } from '../../../src/ui/textos.js';

// SCR-006. Lo que ve el encargado en cada criterio (AC-010-0x, AC-011-0x, AC-017-0x) lo prueba el recorrido e2e con su captura
// (tests/e2e/fase-2.spec.js); aquí va cómo se arma la página: grupos, botones por fila, avisos y errores.
beforeEach(() => document.body.replaceChildren());
const esperar = () => new Promise((r) => setTimeout(r, 0));
const fila = (extra) => ({ id: 'r1', cantidad: 2, material: 'Casco', socio: 'Lucía Gil', inicio: '2026-12-05', fin: '2026-12-07', retraso: 0, ...extra });
const vacio = { hoy: '2026-12-05', fecha: '2026-12-05', porEntregar: [], noRecogidas: [], vuelven: [], prestados: [], multas: [] };
const ok = (cuerpo) => ({ estado: 200, cuerpo: { ...vacio, ...cuerpo } });
const textos = (nodo, selector) => [...nodo.querySelectorAll(selector)].map((n) => n.textContent);

async function pagina(respuestas, extra = {}) {
  const cola = [...respuestas];
  const api = { panel: vi.fn(async () => (cola.length > 1 ? cola.shift() : cola[0])), entregar: vi.fn(), devolver: vi.fn(), ...extra };
  const avisos = crearAvisos(T);
  const main = await paginaPanelConLista({ api, T, avisos });
  document.body.append(main);
  return { main, api, avisos };
}

describe('SCR-006 Panel del encargado', () => {
  it('RN-018 pinta un grupo con h2 por lista no vacía y las filas con los literales del contrato', async () => {
    const { main } = await pagina([ok({
      porEntregar: [fila()], vuelven: [fila({ id: 'r2', fin: '2026-12-05' })], prestados: [fila({ id: 'r3', fin: '2026-12-09' })],
    })]);
    expect(main.querySelector('h1').textContent).toBe('Panel del encargado');
    expect(textos(main, 'h2')).toEqual(['Por entregar', 'Vuelven hoy', 'Prestado', 'Multas']);
    expect(textos(main, '.texto')).toEqual([
      'Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05',
      'Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-05',
      'Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-09']);
    expect(textos(main, '.detalle')).toEqual([
      '2 × Casco del 2026-12-05 al 2026-12-07 — Reservada', '2 × Casco del 2026-12-05 al 2026-12-05 — Prestada', '2 × Casco del 2026-12-05 al 2026-12-09 — Prestada']);
  });

  it('RN-029 «No recogida» es un grupo con su fila sin botón', async () => {
    const { main } = await pagina([ok({ noRecogidas: [fila({ fin: '2026-12-04' })] })]);
    expect(textos(main, 'h2')).toEqual(['No recogida', 'Multas']);
    expect(textos(main, '.texto')).toEqual(['No recogida: 2 × Casco — Lucía Gil — hasta el 2026-12-04']);
    expect(main.querySelectorAll('button').length).toBe(1);   // solo «Ver» de la fecha
  });

  it('SCR-006 «Entregar» solo en «Por entregar» y «Devolver» solo en los préstamos', async () => {
    const { main } = await pagina([ok({ porEntregar: [fila()], prestados: [fila({ id: 'r3' })] })]);
    const [entregar, devolver] = [...main.querySelectorAll('li')].map((li) => textos(li, 'button'));
    expect(entregar).toEqual(['Entregar']);
    expect(devolver).toEqual(['Devolver']);
  });

  it('RN-015 el retraso va en la propia fila, en singular o plural', async () => {
    const { main } = await pagina([ok({ prestados: [fila({ id: 'r1', retraso: 3 }), fila({ id: 'r2', retraso: 1 }), fila({ id: 'r3' })] })]);
    const filas = [...main.querySelectorAll('li')];
    expect(textos(filas[0], '.retraso')).toEqual(['Retraso: 3 días']);
    expect(textos(filas[1], '.retraso')).toEqual(['Retraso: 1 día']);
    expect(filas[2].querySelector('.retraso')).toBeNull();
  });

  it('SCR-006 con otra fecha el grupo se titula «Vuelven el {fecha}»', async () => {
    const { main } = await pagina([ok({ fecha: '2026-12-07', vuelven: [fila()] })]);
    expect(textos(main, 'h2')).toContain('Vuelven el 2026-12-07');
    expect(textos(main, 'h2')).not.toContain('Vuelven hoy');
  });

  it('SCR-006 sin préstamos muestra el mensaje del servidor y ninguna lista de préstamos', async () => {
    const { main } = await pagina([ok({ mensaje: 'No hay material prestado' })]);
    expect(main.querySelector('.vacio').textContent).toBe('No hay material prestado');
    expect(textos(main, 'h2')).not.toContain('Prestado');
  });

  it('REQ-F-005 las multas pendientes salen como «{nombre} — Multa de {importe} € — {estado}» y sin ellas «No hay multas»', async () => {
    const con = await pagina([ok({ multas: [{ socio: 'Lucía Gil', importe: 6, estado: 'Pendiente' }] })]);
    expect(textos(con.main, '.multas li')).toEqual(['Lucía Gil — Multa de 6 € — Pendiente']);
    document.body.replaceChildren();
    const sin = await pagina([ok()]);
    expect(sin.main.querySelector('.multas .vacio').textContent).toBe('No hay multas');
  });

  it('UC-010 «Entregar» llama a la operación con el id, pone el texto del servidor en los avisos y recarga la lista', async () => {
    const entregar = vi.fn(async () => ({ estado: 200, cuerpo: { mensaje: 'Entregado: 2 × Casco a Lucía Gil' } }));
    const { main, api, avisos } = await pagina([ok({ porEntregar: [fila()] }), ok({ prestados: [fila()] })], { entregar });
    main.querySelector('li button').click();
    await esperar();
    expect(entregar).toHaveBeenCalledWith('r1');
    expect(avisos.textos()).toEqual(['Entregado: 2 × Casco a Lucía Gil']);
    expect(api.panel).toHaveBeenCalledTimes(2);
    expect(textos(main, '.texto')).toEqual(['Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07']);
  });

  it('ADR-005 un aviso de repetición va a los avisos, no a los errores', async () => {
    const devolver = vi.fn(async () => ({ estado: 200, cuerpo: { aviso: { codigo: 'E_YA_DEVUELTA', mensaje: 'Ya estaba devuelta' } } }));
    const { main, avisos } = await pagina([ok({ prestados: [fila()] })], { devolver });
    main.querySelector('li button').click();
    await esperar();
    expect(devolver).toHaveBeenCalledWith('r1');
    expect(avisos.textos()).toEqual(['Ya estaba devuelta']);
    expect(main.querySelector('[role=alert]')).toBeNull();
  });

  it('SCR-006 un error del servidor sale junto a la lista como alerta y no entra en los avisos', async () => {
    const entregar = vi.fn(async () => ({ estado: 409, cuerpo: { error: { codigo: 'E_ANTES_DE_INICIO', mensaje: 'No se puede entregar antes de la fecha de inicio' } } }));
    const { main, avisos } = await pagina([ok({ porEntregar: [fila()] })], { entregar });
    main.querySelector('li button').click();
    await esperar();
    expect(main.querySelector('[role=alert]').textContent).toBe('No se puede entregar antes de la fecha de inicio');
    expect(avisos.textos()).toEqual([]);
  });

  it('RN-032 «Ver» pide el panel de la fecha elegida y una fecha no válida deja la lista como estaba con el mensaje del servidor', async () => {
    const { main, api } = await pagina([
      ok({ prestados: [fila()] }),
      ok({ fecha: '2026-12-07', vuelven: [fila()] }),
      { estado: 400, cuerpo: { error: { codigo: 'E_FECHA_INVALIDA', mensaje: 'Elige una fecha válida' } } },
    ]);
    const campo = main.querySelector('input');
    expect(main.querySelector('label').textContent).toBe('Fecha');
    campo.value = '2026-12-07';
    main.querySelector('form').requestSubmit();
    await esperar();
    expect(api.panel).toHaveBeenLastCalledWith('2026-12-07');
    expect(textos(main, 'h2')).toContain('Vuelven el 2026-12-07');
    campo.value = '';
    main.querySelector('form').requestSubmit();
    await esperar();
    expect(api.panel).toHaveBeenLastCalledWith('');
    expect(main.querySelector('[role=alert]').textContent).toBe('Elige una fecha válida');
    expect(textos(main, 'h2')).toContain('Vuelven el 2026-12-07');
  });
});
