// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pantallaMultas } from '../../src/ui/pantallas/multas.js';
import { ErrorApi } from '../../src/ui/api.js';

let contenedor;
beforeEach(() => { document.body.replaceChildren(); contenedor = document.createElement('main'); document.body.append(contenedor); });
const usuario = { nombre: 'Marta', rol: 'encargado' };
const pendiente = { id: 1, socio: 'Pablo Ruiz', importeEur: 6, estado: 'Pendiente', pagadaEl: null };
const pagada = { ...pendiente, estado: 'Pagada', pagadaEl: '2026-12-11' };
const filas = () => [...contenedor.querySelectorAll('table[aria-label="Multas"] tbody tr')].map((tr) => [...tr.children].slice(0, 4).map((td) => td.textContent));
const vaciar = () => new Promise((r) => setTimeout(r, 0));
const clic = async (boton) => { boton.click(); await vaciar(); await vaciar(); };

describe('pantalla Multas (UC-012, SCR-008)', () => {
  it('UC-012 "Marcar pagada" pide confirmación en línea y, al confirmar, la fila de Pablo Ruiz 6,00 € pasa a "Pagada" sin botón', async () => {
    const api = {
      listarMultas: vi.fn().mockResolvedValueOnce([pendiente]).mockResolvedValueOnce([pagada]),
      marcarMultaPagada: vi.fn().mockResolvedValue(pagada),
    };
    await pantallaMultas({ contenedor, usuario, api });
    expect(contenedor.querySelector('h1').textContent).toBe('Multas');
    expect(filas()).toEqual([['Pablo Ruiz', '6,00 €', 'Pendiente', '']]);
    const boton = contenedor.querySelector('tbody button');
    expect(boton.textContent).toBe('Marcar pagada');
    expect(boton.getAttribute('aria-label')).toBe('Marcar pagada: Pablo Ruiz 6,00 €');
    await clic(boton);
    expect(api.marcarMultaPagada).not.toHaveBeenCalled();   // primero la confirmación
    expect(contenedor.querySelector('[role="group"]').getAttribute('aria-label')).toBe('¿Marcar pagada la multa de Pablo Ruiz?');
    await clic([...contenedor.querySelectorAll('[role="group"] button')].find((b) => b.textContent === 'Sí, marcar pagada'));
    expect(api.marcarMultaPagada).toHaveBeenCalledWith(1);
    expect(filas()).toEqual([['Pablo Ruiz', '6,00 €', 'Pagada', '2026-12-11']]);
    expect(contenedor.querySelector('tbody button')).toBeNull();
  });

  it('"No" en la confirmación vuelve al botón sin llamar a la API', async () => {
    const api = { listarMultas: vi.fn().mockResolvedValue([pendiente]), marcarMultaPagada: vi.fn() };
    await pantallaMultas({ contenedor, usuario, api });
    await clic(contenedor.querySelector('tbody button'));
    await clic([...contenedor.querySelectorAll('[role="group"] button')].find((b) => b.textContent === 'No'));
    expect(api.marcarMultaPagada).not.toHaveBeenCalled();
    expect(contenedor.querySelector('tbody button').textContent).toBe('Marcar pagada');
  });

  // REQ-F-007 AC3: "GIVEN a socio session WHEN the socio opens the address of "Multas" of the encargado THEN the user sees "Acceso no permitido""
  it('AC-012-04 REQ-F-007 AC3 si la operación devuelve E_ACCESO_NO_PERMITIDO la pantalla muestra "Acceso no permitido" y ninguna multa', async () => {
    const api = { listarMultas: vi.fn().mockRejectedValue(new ErrorApi('E_ACCESO_NO_PERMITIDO')) };
    await pantallaMultas({ contenedor, usuario: { nombre: 'Pablo Ruiz', rol: 'socio' }, api });
    expect(contenedor.querySelector('h1').textContent).toBe('Acceso no permitido');
    expect(contenedor.querySelector('table')).toBeNull();
    expect(contenedor.textContent).not.toContain('Pablo Ruiz');
  });

  it('la tabla muestra socio, importe "6,00 €" y estado; sin multas muestra "Sin multas"', async () => {
    await pantallaMultas({ contenedor, usuario, api: { listarMultas: vi.fn().mockResolvedValue([pendiente, { ...pagada, id: 2, socio: 'Ana Mir', importeEur: 2 }]) } });
    expect(filas()).toEqual([['Pablo Ruiz', '6,00 €', 'Pendiente', ''], ['Ana Mir', '2,00 €', 'Pagada', '2026-12-11']]);
    await pantallaMultas({ contenedor, usuario, api: { listarMultas: vi.fn().mockResolvedValue([]) } });
    expect(contenedor.textContent).toContain('Sin multas');
    expect(contenedor.querySelector('table')).toBeNull();
  });

  it('un fallo al marcar muestra el mensaje y la multa sigue Pendiente', async () => {
    const api = { listarMultas: vi.fn().mockResolvedValue([pendiente]), marcarMultaPagada: vi.fn().mockRejectedValue(new ErrorApi('E_ALMACEN_NO_DISPONIBLE')) };
    await pantallaMultas({ contenedor, usuario, api });
    await clic(contenedor.querySelector('tbody button'));
    await clic([...contenedor.querySelectorAll('[role="group"] button')].find((b) => b.textContent === 'Sí, marcar pagada'));
    expect(contenedor.querySelector('[role="alert"]').textContent).toBe('No se pudo guardar. Inténtalo de nuevo');
    expect(filas()[0][2]).toBe('Pendiente');
  });
});
