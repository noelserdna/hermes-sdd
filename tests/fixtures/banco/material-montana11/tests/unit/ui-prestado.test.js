// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pantallaPrestado } from '../../src/ui/pantallas/prestado.js';
import { pantallaInicio } from '../../src/ui/pantallas/inicio.js';
import { ErrorApi } from '../../src/ui/api.js';

let contenedor;
beforeEach(() => { document.body.replaceChildren(); contenedor = document.createElement('main'); document.body.append(contenedor); });
const usuario = { nombre: 'Marta', rol: 'encargado' };
const piolet = { reservaId: 1, material: 'Piolet', unidad: 1, socio: 'Lucía Gil', inicio: '2026-12-05', fin: '2026-12-07', retrasoDias: 0, vuelveHoy: true };
const casco = { reservaId: 2, material: 'Casco', unidad: 2, socio: 'Pablo Ruiz', inicio: '2026-12-05', fin: '2026-12-08', retrasoDias: 1, vuelveHoy: false };
const vaciar = () => new Promise((r) => setTimeout(r, 0));
const seccion = (titulo) => [...contenedor.querySelectorAll('section')].find((s) => s.querySelector('h2').textContent === titulo);
const lineas = (titulo) => [...seccion(titulo).querySelectorAll('li')].map((li) => li.textContent);
const ver = async (dia) => {
  contenedor.querySelector('input[type="date"]').value = dia;
  contenedor.querySelector('button').click();
  await vaciar(); await vaciar();
};

describe('pantalla Prestado (UC-015, SCR-010)', () => {
  // REQ-F-009 AC1: "the user sees "Piolet 1 — Lucía Gil — hasta 2026-12-07" and "Casco 2 — Pablo Ruiz — hasta 2026-12-08""
  it('AC-015-01 REQ-F-009 AC1 se pinta "Piolet 1 — Lucía Gil — hasta 2026-12-07" y "Casco 2 — Pablo Ruiz — hasta 2026-12-08"', async () => {
    const api = { consultarPrestado: vi.fn().mockResolvedValue([piolet, casco]) };
    await pantallaPrestado({ contenedor, usuario, api });
    expect(contenedor.querySelector('h1').textContent).toBe('Prestado');
    expect(contenedor.textContent).toContain('Piolet 1 — Lucía Gil — hasta 2026-12-07');
    expect(contenedor.textContent).toContain('Casco 2 — Pablo Ruiz — hasta 2026-12-08');
  });

  // REQ-F-009 AC2: "the user sees "Piolet 1" under "Vuelven hoy" and does not see "Casco 2""
  it('AC-015-02 REQ-F-009 AC2 al elegir el día 2026-12-07 el Piolet 1 aparece bajo "Vuelven hoy" y el Casco 2 no aparece bajo "Vuelven hoy" (sigue prestado, bajo "Prestado ahora")', async () => {
    const api = { consultarPrestado: vi.fn().mockResolvedValueOnce([{ ...piolet, vuelveHoy: false }, casco]).mockResolvedValueOnce([piolet, casco]) };
    await pantallaPrestado({ contenedor, usuario, api });
    expect(lineas('Vuelven hoy')).toEqual([]);
    await ver('2026-12-07');
    expect(api.consultarPrestado).toHaveBeenLastCalledWith('2026-12-07');
    // «sees "Piolet 1" under "Vuelven hoy"»: el texto entero de la sección es su título y esa única línea
    expect(lineas('Vuelven hoy')).toEqual(['Piolet 1 — Lucía Gil — hasta 2026-12-07']);
    expect(seccion('Vuelven hoy').textContent).toBe('Vuelven hoyPiolet 1 — Lucía Gil — hasta 2026-12-07');
    // «does not see "Casco 2"»: se entiende "bajo "Vuelven hoy"" ese día (decisión de la persona). El Casco 2 sigue
    // prestado, hasta 2026-12-08, y por eso sí se ve bajo "Prestado ahora"; bajo "Vuelven hoy" no hay ni una línea ni una palabra suya
    expect(seccion('Vuelven hoy').textContent).not.toContain('Casco 2');
    expect(seccion('Vuelven hoy').textContent).not.toContain('Pablo Ruiz');
    expect(lineas('Prestado ahora')).toEqual(['Casco 2 — Pablo Ruiz — hasta 2026-12-08 Retrasado 1 día']);
  });

  // REQ-F-009 AC3: "the user sees "Casco 2" marked "Retrasado 1 día""
  it('AC-015-03 REQ-F-009 AC3 el Casco 2 con 1 día de retraso muestra "Retrasado 1 día" y con 2, "Retrasado 2 días"', async () => {
    await pantallaPrestado({ contenedor, usuario, api: { consultarPrestado: vi.fn().mockResolvedValue([casco, { ...piolet, vuelveHoy: false, retrasoDias: 2 }]) } });
    expect(lineas('Prestado ahora')).toEqual(['Casco 2 — Pablo Ruiz — hasta 2026-12-08 Retrasado 1 día', 'Piolet 1 — Lucía Gil — hasta 2026-12-07 Retrasado 2 días']);
  });

  // REQ-F-009 AC4: "the user sees "No hay material prestado""
  it('AC-015-04 REQ-F-009 AC4 sin préstamos muestra "No hay material prestado"', async () => {
    await pantallaPrestado({ contenedor, usuario, api: { consultarPrestado: vi.fn().mockResolvedValue([]) } });
    expect(contenedor.textContent).toContain('No hay material prestado');
    expect(contenedor.querySelector('li')).toBeNull();
  });

  it('con E_DATOS_INVALIDOS conserva la lista anterior y muestra el mensaje', async () => {
    const api = { consultarPrestado: vi.fn().mockResolvedValueOnce([casco]).mockRejectedValueOnce(new ErrorApi('E_DATOS_INVALIDOS')) };
    await pantallaPrestado({ contenedor, usuario, api });
    await ver('2026-12-07');
    expect(contenedor.querySelector('[role="alert"]').textContent).toBe('Revisa los datos del formulario');
    expect(contenedor.textContent).toContain('Casco 2 — Pablo Ruiz — hasta 2026-12-08');
  });

  it('con E_ALMACEN_NO_DISPONIBLE no pinta la lista y muestra el mensaje; con E_ACCESO_NO_PERMITIDO, "Acceso no permitido"', async () => {
    await pantallaPrestado({ contenedor, usuario, api: { consultarPrestado: vi.fn().mockRejectedValue(new ErrorApi('E_ALMACEN_NO_DISPONIBLE')) } });
    expect(contenedor.querySelector('[role="alert"]').textContent).toBe('No se pudo guardar. Inténtalo de nuevo');
    expect(contenedor.querySelector('li')).toBeNull();
    await pantallaPrestado({ contenedor, usuario: { nombre: 'Lucía', rol: 'socio' }, api: { consultarPrestado: vi.fn().mockRejectedValue(new ErrorApi('E_ACCESO_NO_PERMITIDO')) } });
    expect(contenedor.querySelector('h1').textContent).toBe('Acceso no permitido');
  });

  it('el selector de día lleva label y el Panel del encargado enlaza a "Prestado"', async () => {
    await pantallaPrestado({ contenedor, usuario, api: { consultarPrestado: vi.fn().mockResolvedValue([]) } });
    const campo = contenedor.querySelector('input[type="date"]');
    expect(contenedor.querySelector(`label[for="${campo.id}"]`).textContent).toBe('Día');
    pantallaInicio({ contenedor, usuario });
    expect(contenedor.querySelector('h1').textContent).toBe('Panel del encargado');
    expect([...contenedor.querySelectorAll('a')].some((a) => a.textContent.includes('Prestado') && a.getAttribute('href') === '#/prestado')).toBe(true);
  });
});
