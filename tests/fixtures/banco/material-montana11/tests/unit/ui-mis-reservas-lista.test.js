// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pantallaMisReservas } from '../../src/ui/pantallas/mis-reservas.js';
import { ErrorApi } from '../../src/ui/api.js';

let contenedor;
beforeEach(() => { document.body.replaceChildren(); contenedor = document.createElement('main'); document.body.append(contenedor); });
const usuario = { nombre: 'Lucía Gil', rol: 'socio' };
const filas = () => [...contenedor.querySelectorAll('table[aria-label="Reservas"] tbody tr')].map((tr) => [...tr.children].slice(0, 4).map((td) => td.textContent));

describe('pantalla Mis reservas (UC-006)', () => {
  // REQ-F-004 AC1: "GIVEN "lucia" has "Piolet" 2026-12-05 to 2026-12-07 and "pablo" has "Casco" 2026-12-06 to 2026-12-07 WHEN "lucia" opens "Mis reservas" THEN the user sees "Piolet" and does not see "Casco""
  it('AC-006-01 REQ-F-004 AC1 lista el Piolet de lucia con sus fechas y estado, y no muestra el Casco', async () => {
    const api = { listarMisReservas: vi.fn().mockResolvedValue([{ id: 1, material: 'Piolet', unidad: 1, inicio: '2026-12-05', fin: '2026-12-07', estado: 'Reservada' }]) };
    await pantallaMisReservas({ contenedor, usuario, api });
    expect(contenedor.querySelector('h1').textContent).toBe('Mis reservas');
    expect(filas()).toEqual([['Piolet', '2026-12-05', '2026-12-07', 'Reservada']]);
    expect(contenedor.textContent).not.toContain('Casco');
  });

  // REQ-F-004 AC4: "GIVEN "lucia" has no reservations WHEN she opens "Mis reservas" THEN the user sees "No tienes reservas""
  it('AC-006-02 REQ-F-004 AC4 sin reservas muestra "No tienes reservas" y ninguna tabla', async () => {
    await pantallaMisReservas({ contenedor, usuario, api: { listarMisReservas: vi.fn().mockResolvedValue([]) } });
    expect(contenedor.textContent).toContain('No tienes reservas');
    expect(contenedor.querySelector('table')).toBeNull();
  });

  it('INV-LOA-002 una reserva vencida se muestra "No recogida"', async () => {
    const api = { listarMisReservas: vi.fn().mockResolvedValue([{ id: 1, material: 'Piolet', unidad: 1, inicio: '2026-11-20', fin: '2026-11-22', estado: 'No recogida' }]) };
    await pantallaMisReservas({ contenedor, usuario, api });
    expect(filas()).toEqual([['Piolet', '2026-11-20', '2026-11-22', 'No recogida']]);
  });

  it('AC-006-04 con el almacén caído avisa "No se pudo guardar. Inténtalo de nuevo" y no lista nada', async () => {
    await pantallaMisReservas({ contenedor, usuario, api: { listarMisReservas: vi.fn().mockRejectedValue(new ErrorApi('E_ALMACEN_NO_DISPONIBLE')) } });
    expect(contenedor.querySelector('[role="alert"]').textContent).toBe('No se pudo guardar. Inténtalo de nuevo');
    expect(contenedor.querySelector('table')).toBeNull();
  });
});

describe('Cancelar reserva con confirmación en línea (UC-007)', () => {
  const reservada = { id: 7, material: 'Piolet', unidad: 1, inicio: '2026-12-05', fin: '2026-12-07', estado: 'Reservada' };
  const botonCancelar = () => contenedor.querySelector('tbody button');
  const textos = () => [...contenedor.querySelectorAll('[role="group"] button')].map((b) => b.textContent);

  it('"Cancelar reserva" solo sale en las Reservadas, con nombre accesible que incluye material y fecha', async () => {
    const api = { listarMisReservas: vi.fn().mockResolvedValue([reservada, { ...reservada, id: 8, estado: 'Cancelada' }]) };
    await pantallaMisReservas({ contenedor, usuario, api });
    expect(contenedor.querySelectorAll('tbody button')).toHaveLength(1);
    expect(botonCancelar().textContent).toBe('Cancelar reserva');
    expect(botonCancelar().getAttribute('aria-label')).toBe('Cancelar reserva de Piolet 2026-12-05');
  });

  it('confirmar-en-linea: pide Sí/No con el foco en el primero; "No" y Esc cierran sin llamar a la API', async () => {
    const api = { listarMisReservas: vi.fn().mockResolvedValue([reservada]), cancelarReserva: vi.fn() };
    await pantallaMisReservas({ contenedor, usuario, api });
    botonCancelar().click();
    expect(contenedor.querySelector('[role="group"]').textContent).toContain('¿Cancelar la reserva de Piolet?');
    expect(textos()).toEqual(['Sí, cancelar', 'No']);
    expect(document.activeElement.textContent).toBe('Sí, cancelar');
    [...contenedor.querySelectorAll('[role="group"] button')][1].click();
    expect(contenedor.querySelector('[role="group"]')).toBeNull();
    expect(document.activeElement).toBe(botonCancelar());
    botonCancelar().click();
    contenedor.querySelector('[role="group"]').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(contenedor.querySelector('[role="group"]')).toBeNull();
    expect(api.cancelarReserva).not.toHaveBeenCalled();
  });

  // REQ-F-004 AC2: "GIVEN today is 2026-12-04 and "lucia" has "Piolet" starting 2026-12-05 WHEN she cancels it THEN the user sees "Reserva cancelada" and the reservation shows state "Cancelada""
  it('AC-007-01 REQ-F-004 AC2 Sí, cancelar avisa "Reserva cancelada", la fila pasa a "Cancelada" sin botón y el foco va al aviso', async () => {
    const api = {
      listarMisReservas: vi.fn().mockResolvedValueOnce([reservada]).mockResolvedValueOnce([{ ...reservada, estado: 'Cancelada' }]),
      cancelarReserva: vi.fn().mockResolvedValue({ ...reservada, estado: 'Cancelada' }),
    };
    await pantallaMisReservas({ contenedor, usuario, api });
    botonCancelar().click();
    [...contenedor.querySelectorAll('[role="group"] button')][0].click();
    await vi.waitFor(() => expect(contenedor.querySelector('[role="status"]')?.textContent).toBe('Reserva cancelada'));
    await vi.waitFor(() => expect(filas()).toEqual([['Piolet', '2026-12-05', '2026-12-07', 'Cancelada']]));
    expect(api.cancelarReserva).toHaveBeenCalledWith(7);
    expect(contenedor.querySelector('tbody button')).toBeNull();
    expect(document.activeElement).toBe(contenedor.querySelector('[role="status"]').parentElement);
  });

  // REQ-F-004 AC3: "GIVEN today is 2026-12-05 and "lucia" has "Piolet" starting 2026-12-05 WHEN she tries to cancel it THEN the user sees "Solo se puede cancelar hasta el día antes" and the reservation stays"
  it('AC-007-02 REQ-F-004 AC3 el día de inicio avisa "Solo se puede cancelar hasta el día antes" y la reserva sigue Reservada', async () => {
    const api = { listarMisReservas: vi.fn().mockResolvedValue([reservada]), cancelarReserva: vi.fn().mockRejectedValue(new ErrorApi('E_CANCELACION_TARDIA')) };
    await pantallaMisReservas({ contenedor, usuario, api });
    const antes = filas();
    botonCancelar().click();
    [...contenedor.querySelectorAll('[role="group"] button')][0].click();
    await vi.waitFor(() => expect(contenedor.querySelector('[role="alert"]')?.textContent).toBe('Solo se puede cancelar hasta el día antes'));
    // REQ-F-004 AC3 cláusula: "the reservation stays"
    await vi.waitFor(() => expect(filas()).toEqual([['Piolet', '2026-12-05', '2026-12-07', 'Reservada']]));
    expect(filas()).toEqual(antes);
  });
});
