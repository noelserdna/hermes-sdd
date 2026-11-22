// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pantallaHistorial } from '../../src/ui/pantallas/historial.js';
import { pantallaInventario } from '../../src/ui/pantallas/inventario.js';
import { pantallaPrestamos } from '../../src/ui/pantallas/prestamos.js';
import { pantallaReservar } from '../../src/ui/pantallas/reservar.js';
import { ErrorApi } from '../../src/ui/api.js';

let contenedor;
beforeEach(() => { document.body.replaceChildren(); contenedor = document.createElement('main'); document.body.append(contenedor); });
const usuario = { nombre: 'Junta', rol: 'junta' };
const socios = [{ id: 2, nombre: 'Lucía Gil', estado: 'Activa' }, { id: 3, nombre: 'Pablo Ruiz', estado: 'Activa' }, { id: 4, nombre: 'Ana Mir', estado: 'Activa' }];
const deLucia = { socio: socios[0], prestamos: [{ reservaId: 1, material: 'Piolet', unidad: 1, inicio: '2026-12-05', fin: '2026-12-07', estado: 'Devuelto' }], multas: [] };
const dePablo = { socio: socios[1], prestamos: [], multas: [{ id: 1, importeEur: 6, estado: 'Pendiente', pagadaEl: null }] };
const deAna = { socio: socios[2], prestamos: [], multas: [] };
const vaciar = () => new Promise((r) => setTimeout(r, 0));
const ver = async (nombre) => {
  const s = contenedor.querySelector('select');
  s.value = [...s.options].find((o) => o.textContent === nombre).value;
  contenedor.querySelector('button').click();
  await vaciar(); await vaciar();
};
const api = (...historiales) => {
  const consultarHistorialSocio = vi.fn();
  for (const h of historiales) consultarHistorialSocio.mockImplementationOnce(async () => (h instanceof Error ? Promise.reject(h) : h));
  return { listarSociosHistorial: vi.fn().mockResolvedValue(socios), consultarHistorialSocio };
};

describe('pantalla Historial (UC-016, SCR-011)', () => {
  // REQ-F-010 AC1: "the user sees "Multa 6,00 € Pendiente" and not the loans of "Lucía Gil""
  it('AC-016-01 REQ-F-010 AC1 al elegir a "Pablo Ruiz" se pinta "Multa 6,00 € Pendiente" y nada de Lucía Gil', async () => {
    const a = api(dePablo);
    await pantallaHistorial({ contenedor, usuario, api: a });
    expect(contenedor.querySelector('h1').textContent).toBe('Historial del socio');
    await ver('Pablo Ruiz');
    expect(a.consultarHistorialSocio).toHaveBeenCalledWith(3);
    expect(contenedor.querySelector('h2').textContent).toBe('Historial de Pablo Ruiz');
    expect(contenedor.textContent).toContain('Multa 6,00 € Pendiente');
    expect(contenedor.querySelector('ul').textContent).not.toContain('Lucía');
    expect(contenedor.querySelector('ul').textContent).not.toContain('Piolet');
  });

  // REQ-F-010 AC2: "the user sees "Piolet 1" with "Devuelto""
  it('AC-016-02 REQ-F-010 AC2 se pinta "Piolet 1" con "Devuelto"', async () => {
    await pantallaHistorial({ contenedor, usuario, api: api(deLucia) });
    await ver('Lucía Gil');
    expect(contenedor.querySelector('li').textContent).toBe('Piolet 1 — 2026-12-05 a 2026-12-07 — Devuelto');
  });

  // REQ-F-010 AC3: "the user sees "Sin préstamos ni multas""
  it('AC-016-03 REQ-F-010 AC3 un socio sin movimientos muestra "Sin préstamos ni multas"', async () => {
    await pantallaHistorial({ contenedor, usuario, api: api(deAna) });
    await ver('Ana Mir');
    expect(contenedor.textContent).toContain('Sin préstamos ni multas');
    expect(contenedor.querySelector('li')).toBeNull();
  });

  // REQ-F-010 AC4: "the user sees "Acceso no permitido" and the junta screens have no button to change data"
  it('AC-016-04 REQ-F-010 AC4 con rol junta Entregar, Inventario y Reservar muestran "Acceso no permitido" y Historial no ofrece botones que cambien datos', async () => {
    const denegado = () => vi.fn().mockRejectedValue(new ErrorApi('E_ACCESO_NO_PERMITIDO'));
    await pantallaPrestamos({ contenedor, usuario, api: { listarPrestamosYReservas: denegado() } });
    expect(contenedor.querySelector('h1').textContent).toBe('Acceso no permitido');
    await pantallaInventario({ contenedor, usuario, api: { listarInventario: denegado() } });
    expect(contenedor.querySelector('h1').textContent).toBe('Acceso no permitido');
    await pantallaReservar({ contenedor, usuario, api: {} });
    expect(contenedor.querySelector('h1').textContent).toBe('Acceso no permitido');
    await pantallaHistorial({ contenedor, usuario, api: api(dePablo) });
    await ver('Pablo Ruiz');
    expect([...contenedor.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Ver historial']);   // solo consulta
    expect(contenedor.querySelectorAll('input:not([type="hidden"]), textarea')).toHaveLength(0);
  });

  it('con E_SOCIO_NO_ENCONTRADO, E_ACCESO_NO_PERMITIDO o E_ALMACEN_NO_DISPONIBLE no se pinta historial y se muestra el mensaje', async () => {
    for (const [codigo, mensaje] of [['E_SOCIO_NO_ENCONTRADO', 'El socio no existe'], ['E_ACCESO_NO_PERMITIDO', 'Acceso no permitido'], ['E_ALMACEN_NO_DISPONIBLE', 'No se pudo guardar. Inténtalo de nuevo']]) {
      await pantallaHistorial({ contenedor, usuario, api: api(dePablo, new ErrorApi(codigo)) });
      await ver('Pablo Ruiz');
      await ver('Lucía Gil');
      expect(contenedor.querySelector('[role="alert"]').textContent).toBe(mensaje);
      expect(contenedor.querySelector('h2')).toBeNull();
      expect(contenedor.querySelector('ul')).toBeNull();
    }
  });

  it('el selector lleva label "Socio" y si no hay sesión de junta (listarSociosHistorial rechazado) muestra "Acceso no permitido"', async () => {
    await pantallaHistorial({ contenedor, usuario, api: api() });
    const s = contenedor.querySelector('select');
    expect(contenedor.querySelector(`label[for="${s.id}"]`).textContent).toBe('Socio');
    await pantallaHistorial({ contenedor, usuario: { nombre: 'Lucía', rol: 'socio' }, api: { listarSociosHistorial: vi.fn().mockRejectedValue(new ErrorApi('E_ACCESO_NO_PERMITIDO')) } });
    expect(contenedor.querySelector('h1').textContent).toBe('Acceso no permitido');
  });
});
