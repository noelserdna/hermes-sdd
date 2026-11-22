// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginaReservarConFormulario } from '../../../src/ui/paginas/reservar.js';
import { crearAvisos } from '../../../src/ui/componentes.js';
import { T } from '../../../src/ui/textos.js';

beforeEach(() => document.body.replaceChildren());
const esperar = () => new Promise((r) => setTimeout(r, 0));
const MATERIAL = [{ id: 'm1', nombre: 'Casco', total: 6, reservable: true }, { id: 'm2', nombre: 'Cuerda', total: 0, reservable: false }];
const FILAS = [{ id: 'r1', cantidad: 2, material: 'Linterna', inicio: '2026-12-05', fin: '2026-12-07', estado: 'Reservada', cancelable: true, motivo: null }];

async function pagina({ reservar = vi.fn(), filas = [], material = MATERIAL } = {}) {
  const api = {
    listarMaterial: vi.fn(async () => ({ estado: 200, cuerpo: { material } })),
    misReservas: vi.fn(async () => ({ estado: 200, cuerpo: { reservas: filas } })),
    reservar,
  };
  const navegar = vi.fn();
  const avisos = crearAvisos(T);
  const main = await paginaReservarConFormulario({ api, T, navegar, avisos });
  document.body.append(main);
  return { main, api, navegar, avisos };
}
const rellenar = (main, { material = 'm1', cantidad = '2', inicio = '2026-12-05', fin = '2026-12-07' } = {}) => {
  main.querySelector('#material').value = material;
  main.querySelector('#cantidad').value = cantidad;
  main.querySelector('#inicio').value = inicio;
  main.querySelector('#fin').value = fin;
};
const enviar = (main) => main.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

describe('SCR-004 Reservar con formulario', () => {
  it('SCR-004 ofrece en el desplegable «Casco» y no «Cuerda» y deja los campos con su etiqueta, en el orden del wireframe', async () => {
    const { main } = await pagina();
    expect([...main.querySelectorAll('#material option')].map((o) => o.textContent)).toEqual(['Casco']);
    expect([...main.querySelectorAll('form label')].map((l) => l.textContent)).toEqual(['Material', 'Cantidad', 'Fecha de inicio', 'Fecha de fin']);
    expect(main.querySelector('form button').textContent).toBe('Reservar');
    expect(main.querySelector('li').textContent).toBe('Casco');
  });

  it('envía material, cantidad como número y fechas tal cual; si va bien deja el aviso en la sesión y abre Mis reservas', async () => {
    const reservar = vi.fn(async () => ({ estado: 200, cuerpo: { mensaje: 'Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07' } }));
    const { main, navegar, avisos } = await pagina({ reservar });
    rellenar(main);
    enviar(main);
    await esperar();
    expect(reservar).toHaveBeenCalledWith({ materialId: 'm1', cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' });
    expect(avisos.textos()).toEqual(['Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07']);
    expect(navegar).toHaveBeenCalledWith('/mis-reservas');
  });

  it('un error del servidor sale junto al formulario con foco, los campos se conservan y no se navega', async () => {
    const reservar = vi.fn(async () => ({ estado: 400, cuerpo: { error: { codigo: 'E_FECHA_PASADA', mensaje: 'La fecha de inicio no puede ser pasada' } } }));
    const { main, navegar, avisos } = await pagina({ reservar });
    rellenar(main, { cantidad: '3', inicio: '2026-11-21', fin: '2026-11-23' });
    enviar(main);
    await esperar();
    const alerta = main.querySelector('[role="alert"]');
    expect(alerta.textContent).toBe('La fecha de inicio no puede ser pasada');
    expect(document.activeElement).toBe(alerta);
    expect(main.querySelector('form').compareDocumentPosition(alerta) & window.Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect([main.querySelector('#cantidad').value, main.querySelector('#inicio').value, main.querySelector('#fin').value]).toEqual(['3', '2026-11-21', '2026-11-23']);
    expect(navegar).not.toHaveBeenCalled();
    expect(avisos.textos()).toEqual([]);
  });

  it('mientras se envía no admite un segundo envío del mismo formulario', async () => {
    let terminar;
    const reservar = vi.fn(() => new Promise((r) => { terminar = r; }));
    const { main } = await pagina({ reservar });
    rellenar(main);
    enviar(main);
    enviar(main);
    expect(reservar).toHaveBeenCalledTimes(1);
    expect(main.querySelector('form button').disabled).toBe(true);
    terminar({ estado: 400, cuerpo: { error: { mensaje: 'x' } } });
    await esperar();
    expect(main.querySelector('form button').disabled).toBe(false);
  });

  it('debajo del formulario lista mis reservas sin botón «Cancelar», o «Aún no tienes reservas» si no hay', async () => {
    const con = await pagina({ filas: FILAS });
    expect(con.main.querySelector('ul.reservas').textContent).toBe('2 × Linterna del 2026-12-05 al 2026-12-07 — Reservada');
    expect(con.main.querySelector('ul.reservas button')).toBeNull();
    document.body.replaceChildren();
    const sin = await pagina();
    expect(sin.main.querySelector('.vacio').textContent).toBe('Aún no tienes reservas');
  });

  it('los avisos de la sesión se acumulan, se muestran como estado y «Cerrar avisos» los quita', () => {
    const avisos = crearAvisos(T);
    document.body.append(avisos.region);
    expect(avisos.region.hidden).toBe(true);
    avisos.poner('Reserva cancelada');
    avisos.poner('Reserva creada: 5 × Casco del 2026-12-05 al 2026-12-07');
    expect([...avisos.region.querySelectorAll('[role="status"]')].map((p) => p.textContent)).toEqual(['Reserva cancelada', 'Reserva creada: 5 × Casco del 2026-12-05 al 2026-12-07']);
    avisos.region.querySelector('button').click();
    expect(avisos.region.hidden).toBe(true);
    expect(avisos.textos()).toEqual([]);
  });
});
