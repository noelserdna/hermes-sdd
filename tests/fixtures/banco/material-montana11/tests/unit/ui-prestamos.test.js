// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pantallaPrestamos } from '../../src/ui/pantallas/prestamos.js';
import { ErrorApi } from '../../src/ui/api.js';

let contenedor;
beforeEach(() => { document.body.replaceChildren(); contenedor = document.createElement('main'); document.body.append(contenedor); });
const usuario = { nombre: 'Marta', rol: 'encargado' };
const piolet = { id: 1, material: 'Piolet', unidad: 1, socio: 'Lucía Gil', inicio: '2026-12-05', fin: '2026-12-07', estado: 'Reservada', entregadaEl: null, devueltaEl: null };
const filas = () => [...contenedor.querySelectorAll('table[aria-label="Préstamos"] tbody tr')].map((tr) => [...tr.children].slice(0, 5).map((td) => td.textContent));
const vaciar = () => new Promise((r) => setTimeout(r, 0));
const clic = async (boton) => { boton.click(); await vaciar(); await vaciar(); };

describe('pantalla Préstamos (UC-008, SCR-007)', () => {
  // REQ-F-005 AC1: "GIVEN today is 2026-12-05 and "lucia" has a "Piolet" reservation starting 2026-12-05 WHEN the encargado marks "Entregar" THEN the user sees the reservation "Piolet" with state "Entregado""
  it('AC-008-01 REQ-F-005 AC1 una fila por reserva con su estado; pulsar "Entregar" en el Piolet de Lucía muestra "Entregado"', async () => {
    const api = {
      listarPrestamosYReservas: vi.fn().mockResolvedValueOnce([piolet]).mockResolvedValueOnce([{ ...piolet, estado: 'Entregado', entregadaEl: '2026-12-05' }]),
      entregarReserva: vi.fn().mockResolvedValue({}),
    };
    await pantallaPrestamos({ contenedor, usuario, api });
    expect(contenedor.querySelector('h1').textContent).toBe('Préstamos');
    expect(filas()).toEqual([['Piolet 1', 'Lucía Gil', '2026-12-05', '2026-12-07', 'Reservada']]);
    await clic(contenedor.querySelector('tbody button'));
    expect(api.entregarReserva).toHaveBeenCalledWith(1);
    expect(filas()).toEqual([['Piolet 1', 'Lucía Gil', '2026-12-05', '2026-12-07', 'Entregado']]);
  });

  // REQ-F-005 AC6: "GIVEN a socio session WHEN the socio opens the address of "Préstamos" THEN the user sees "Acceso no permitido""
  it('AC-008-04 REQ-F-005 AC6 un socio que abre #/prestamos ve "Acceso no permitido" y ninguna lista', async () => {
    const api = { listarPrestamosYReservas: vi.fn().mockRejectedValue(new ErrorApi('E_ACCESO_NO_PERMITIDO')) };
    await pantallaPrestamos({ contenedor, usuario: { nombre: 'Lucía Gil', rol: 'socio' }, api });
    expect(contenedor.querySelector('h1').textContent).toBe('Acceso no permitido');
    expect(contenedor.querySelector('table')).toBeNull();
    expect(contenedor.textContent).not.toContain('Piolet');
  });

  // REQ-F-005 AC3: "GIVEN a reservation starting 2026-12-05 WHEN the encargado tries to deliver it on 2026-12-04 THEN the user sees "No se puede entregar antes de la fecha de inicio""
  it('AC-008-03 la pantalla muestra "No se puede entregar antes de la fecha de inicio" y la fila sigue "Reservada"', async () => {
    const api = { listarPrestamosYReservas: vi.fn().mockResolvedValue([piolet]), entregarReserva: vi.fn().mockRejectedValue(new ErrorApi('E_ENTREGA_ANTICIPADA')) };
    await pantallaPrestamos({ contenedor, usuario, api });
    await clic(contenedor.querySelector('tbody button'));
    expect(contenedor.querySelector('[role="alert"]').textContent).toBe('No se puede entregar antes de la fecha de inicio');
    expect(filas()[0][4]).toBe('Reservada');
  });

  it('cada fila ofrece solo la acción válida de su estado: Reservada "Entregar"; "No recogida" y "Cancelada" ninguna', async () => {
    const api = { listarPrestamosYReservas: vi.fn().mockResolvedValue([
      piolet, { ...piolet, id: 2, estado: 'No recogida' }, { ...piolet, id: 3, estado: 'Cancelada' }]) };
    await pantallaPrestamos({ contenedor, usuario, api });
    const botones = [...contenedor.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('button')].map((b) => b.textContent));
    expect(botones).toEqual([['Entregar'], [], []]);
    expect(contenedor.querySelector('tbody button').getAttribute('aria-label')).toBe('Entregar Piolet 1');
  });

  it('con el almacén caído avisa "No se pudo guardar. Inténtalo de nuevo" (catálogo) y no lista nada', async () => {
    const api = { listarPrestamosYReservas: vi.fn().mockRejectedValue(new ErrorApi('E_ALMACEN_NO_DISPONIBLE')) };
    await pantallaPrestamos({ contenedor, usuario, api });
    expect(contenedor.querySelector('[role="alert"]').textContent).toBe('No se pudo guardar. Inténtalo de nuevo');
    expect(contenedor.querySelector('table')).toBeNull();
  });

  // REQ-F-005 AC2: "GIVEN a delivered "Piolet" due 2026-12-07 WHEN the encargado marks "Devolver" on 2026-12-07 THEN the user sees state "Devuelto" and the unit is free again"
  it('AC-009-01 REQ-F-005 AC2 la fila Entregada ofrece "Registrar devolución" y tras pulsarla se ve "Devuelto" sin más acción', async () => {
    const entregado = { ...piolet, estado: 'Entregado', entregadaEl: '2026-12-05' };
    const api = {
      listarPrestamosYReservas: vi.fn().mockResolvedValueOnce([entregado]).mockResolvedValueOnce([{ ...entregado, estado: 'Devuelto', devueltaEl: '2026-12-07' }]),
      registrarDevolucion: vi.fn().mockResolvedValue({}),
    };
    await pantallaPrestamos({ contenedor, usuario, api });
    expect(contenedor.querySelector('tbody button').textContent).toBe('Registrar devolución');
    expect(contenedor.querySelector('tbody button').getAttribute('aria-label')).toBe('Registrar devolución de Piolet 1');
    await clic(contenedor.querySelector('tbody button'));
    expect(api.registrarDevolucion).toHaveBeenCalledWith(1);
    expect(filas()).toEqual([['Piolet 1', 'Lucía Gil', '2026-12-05', '2026-12-07', 'Devuelto']]);
    expect(contenedor.querySelector('tbody button')).toBeNull();
  });
});

describe('Préstamos: la multa de una devolución tardía (UC-010)', () => {
  // REQ-F-006 AC1: "GIVEN "pablo" has a "Casco" loan ending 2026-12-07 WHEN the encargado marks it returned on 2026-12-10 THEN the user sees the fine "6,00 €" for "Pablo Ruiz" with state "Pendiente""
  it('AC-010-01 REQ-F-006 AC1 tras devolver tarde la fila del Casco de Pablo Ruiz muestra "6,00 €" y "Pendiente" (coma decimal, VO-008)', async () => {
    const casco = { id: 2, material: 'Casco', unidad: 1, socio: 'Pablo Ruiz', inicio: '2026-12-05', fin: '2026-12-07', estado: 'Entregado', entregadaEl: '2026-12-05', devueltaEl: null, multa: null };
    const api = {
      listarPrestamosYReservas: vi.fn().mockResolvedValueOnce([casco])
        .mockResolvedValueOnce([{ ...casco, estado: 'Devuelto', devueltaEl: '2026-12-10', multa: { importeEur: 6, estado: 'Pendiente' } }]),
      registrarDevolucion: vi.fn().mockResolvedValue({ ...casco, estado: 'Devuelto', multa: { importeEur: 6, estado: 'Pendiente' } }),
    };
    await pantallaPrestamos({ contenedor, usuario, api });
    await clic(contenedor.querySelector('tbody button'));
    const celdas = [...contenedor.querySelector('tbody tr').children].map((td) => td.textContent);
    expect(celdas).toEqual(['Casco 1', 'Pablo Ruiz', '2026-12-05', '2026-12-07', 'Devuelto', '2026-12-10', '6,00 € Pendiente', '']);
    expect(contenedor.querySelector('[role="status"]').textContent).toBe('Multa creada: 6,00 €');
  });

  it('la fila Devuelta muestra la fecha de devolución 2026-12-07, sin multa ni aviso', async () => {
    const casco = { id: 2, material: 'Casco', unidad: 1, socio: 'Pablo Ruiz', inicio: '2026-12-05', fin: '2026-12-07', estado: 'Devuelto', entregadaEl: '2026-12-05', devueltaEl: '2026-12-07', multa: null };
    await pantallaPrestamos({ contenedor, usuario, api: { listarPrestamosYReservas: vi.fn().mockResolvedValue([casco]) } });
    expect([...contenedor.querySelector('tbody tr').children].map((td) => td.textContent).slice(4)).toEqual(['Devuelto', '2026-12-07', '', '']);
    expect(contenedor.querySelector('[role="status"]')).toBeNull();
  });
});
