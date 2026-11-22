// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pantallaMisMultas } from '../../src/ui/pantallas/mis-multas.js';
import { ErrorApi } from '../../src/ui/api.js';

let contenedor;
beforeEach(() => { document.body.replaceChildren(); contenedor = document.createElement('main'); document.body.append(contenedor); });
const usuario = { nombre: 'Pablo Ruiz', rol: 'socio' };
const casco = (importeEur, estado = 'Pendiente') => ({ id: 1, material: 'Casco', devueltaEl: '2026-12-10', importeEur, estado, pagadaEl: null });
const filas = () => [...contenedor.querySelectorAll('table[aria-label="Mis multas"] tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent));

describe('pantalla Mis multas (UC-011, SCR-004)', () => {
  // REQ-F-006 AC6: "GIVEN "pablo" has a pending fine WHEN he opens "Mis multas" THEN the user sees "6,00 €" and "Pendiente""
  it('AC-011-01 REQ-F-006 AC6 la multa de 6 € de Pablo se pinta "6,00 €" y "Pendiente"', async () => {
    const api = { listarMisMultas: vi.fn().mockResolvedValue([casco(6)]) };
    await pantallaMisMultas({ contenedor, usuario, api });
    expect(contenedor.querySelector('h1').textContent).toBe('Mis multas');
    expect(filas()).toEqual([['Casco', '2026-12-10', '6,00 €', 'Pendiente']]);
    expect(contenedor.textContent).toContain('no puedes reservar hasta pagarla');
  });

  it('REQ-F-006 AC1 REQ-F-006 AC2 REQ-F-006 AC3 3 días de retraso se ven "6,00 €", 1 día "2,00 €" y sin retraso "Sin multas"', async () => {
    await pantallaMisMultas({ contenedor, usuario, api: { listarMisMultas: vi.fn().mockResolvedValue([casco(6)]) } });
    // REQ-F-006 AC1: "GIVEN "pablo" has a "Casco" loan ending 2026-12-07 WHEN the encargado marks it returned on 2026-12-10 THEN the user sees the fine "6,00 €" for "Pablo Ruiz" with state "Pendiente""
    expect(filas()[0]).toEqual(['Casco', '2026-12-10', '6,00 €', 'Pendiente']);
    expect(usuario.nombre).toBe('Pablo Ruiz');
    await pantallaMisMultas({ contenedor, usuario, api: { listarMisMultas: vi.fn().mockResolvedValue([casco(2)]) } });
    // REQ-F-006 AC3: "GIVEN a loan ending 2026-12-07 WHEN it is returned on 2026-12-08 THEN the fine is "2,00 €""
    expect(filas()[0][2]).toBe('2,00 €');
    await pantallaMisMultas({ contenedor, usuario, api: { listarMisMultas: vi.fn().mockResolvedValue([]) } });
    // REQ-F-006 AC2: "GIVEN a loan ending 2026-12-07 WHEN it is returned on 2026-12-07 or earlier THEN no fine is created"
    expect(contenedor.textContent).toContain('Sin multas');
    expect(contenedor.querySelector('table')).toBeNull();
  });

  it('una multa Pagada se ve "Pagada" y no avisa de bloqueo', async () => {
    await pantallaMisMultas({ contenedor, usuario, api: { listarMisMultas: vi.fn().mockResolvedValue([casco(6, 'Pagada')]) } });
    expect(filas()).toEqual([['Casco', '2026-12-10', '6,00 €', 'Pagada']]);
    expect(contenedor.textContent).not.toContain('no puedes reservar');
  });

  it('con E_ALMACEN_NO_DISPONIBLE no se pinta ninguna multa y se muestra el mensaje de error', async () => {
    const api = { listarMisMultas: vi.fn().mockRejectedValue(new ErrorApi('E_ALMACEN_NO_DISPONIBLE')) };
    await pantallaMisMultas({ contenedor, usuario, api });
    expect(contenedor.querySelector('[role="alert"]').textContent).toBe('No se pudo guardar. Inténtalo de nuevo');
    expect(contenedor.querySelector('table')).toBeNull();
    expect(contenedor.textContent).not.toContain('Sin multas');
  });

  it('un encargado que abre #/mis-multas ve "Acceso no permitido"', async () => {
    const api = { listarMisMultas: vi.fn().mockRejectedValue(new ErrorApi('E_ACCESO_NO_PERMITIDO')) };
    await pantallaMisMultas({ contenedor, usuario: { nombre: 'Marta', rol: 'encargado' }, api });
    expect(contenedor.querySelector('h1').textContent).toBe('Acceso no permitido');
  });
});
