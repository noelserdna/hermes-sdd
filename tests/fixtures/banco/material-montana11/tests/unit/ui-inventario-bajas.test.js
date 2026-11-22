// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pantallaInventario } from '../../src/ui/pantallas/inventario.js';
import { ErrorApi } from '../../src/ui/api.js';

let contenedor;
beforeEach(() => { document.body.replaceChildren(); contenedor = document.createElement('main'); document.body.append(contenedor); });
const encargado = { nombre: 'Marta', rol: 'encargado' };
/** Inventario con `casco` unidades de Casco (la 3.ª "De baja" si `baja3`). */
const inventario = ({ baja3 = false, tienda = 0 } = {}) => ({
  tipos: ['Piolet', 'Crampones', 'Casco', 'Cuerda', 'Tienda'].map((tipo) => {
    const n = tipo === 'Casco' ? 4 : tipo === 'Tienda' ? tienda : 0;
    const unidades = Array.from({ length: n }, (_, i) => ({ id: i + 1, numero: i + 1, estado: tipo === 'Casco' && baja3 && i === 2 ? 'De baja' : 'Alta' }));
    return { tipo, total: unidades.filter((u) => u.estado === 'Alta').length, unidades };
  }),
});
// «{tipo}: {n} unidad(es)»: la forma que enseña la pantalla, «1 unidad» o «3 unidades»
const forma = (tipo, n) => `${tipo}: ${n} ${n === 1 ? 'unidad(es)'.replace('(es)', '') : 'unidad(es)'.replace('(es)', 'es')}`;
const vaciar = () => new Promise((r) => setTimeout(r, 0));
const clic = async (boton) => { boton.click(); await vaciar(); await vaciar(); };
const boton = (nombre) => [...contenedor.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nombre);
const unidad = (texto) => [...contenedor.querySelectorAll('li')].find((li) => li.textContent.startsWith(texto));

describe('pantalla Inventario: Dar de baja por unidad (UC-014, SCR-009)', () => {
  // REQ-F-008 AC2: "GIVEN "Casco" has 4 units and "Casco 3" is broken WHEN the encargado removes "Casco 3" THEN the user sees "Casco: 3 unidades" and "Casco 3" as "De baja""
  it('AC-014-01 REQ-F-008 AC2 "Dar de baja" de "Casco 3" pide confirmación en línea y, al confirmar, se ve "Casco: 3 unidades" y "Casco 3" con "De baja"', async () => {
    const api = {
      listarInventario: vi.fn().mockResolvedValue(inventario()),
      darDeBajaUnidad: vi.fn().mockResolvedValue({ inventario: inventario({ baja3: true }), reservasCanceladas: 0 }),
    };
    await pantallaInventario({ contenedor, usuario: encargado, api });
    expect(contenedor.textContent).toContain('Casco: 4 unidades');
    expect(boton('Dar de baja Casco 3').textContent).toBe('Dar de baja');
    await clic(boton('Dar de baja Casco 3'));
    expect(api.darDeBajaUnidad).not.toHaveBeenCalled();   // primero la confirmación
    expect(contenedor.querySelector('[role="group"]').getAttribute('aria-label')).toBe('¿Dar de baja Casco 3?');
    await clic(boton('Sí, dar de baja'));
    expect(api.darDeBajaUnidad).toHaveBeenCalledWith(3);
    expect(contenedor.textContent).toContain(forma('Casco', 3));
    expect(unidad('Casco 3').textContent).toBe('Casco 3 · De baja');
    expect(boton('Dar de baja Casco 3')).toBeUndefined();   // una unidad De baja no ofrece el botón
    expect(boton('Dar de baja Casco 4')).toBeDefined();
  });

  // REQ-F-008 AC3: "GIVEN "Casco 2" is lent now WHEN the encargado tries to remove it THEN the user sees "No se puede dar de baja: está prestada" and the unit stays"
  it('AC-014-03 REQ-F-008 AC3 con E_UNIDAD_PRESTADA se muestra "No se puede dar de baja: está prestada", "Casco 2" sigue en Alta y el foco vuelve al botón', async () => {
    const api = { listarInventario: vi.fn().mockResolvedValue(inventario()), darDeBajaUnidad: vi.fn().mockRejectedValue(new ErrorApi('E_UNIDAD_PRESTADA')) };
    await pantallaInventario({ contenedor, usuario: encargado, api });
    await clic(boton('Dar de baja Casco 2'));
    await clic(boton('Sí, dar de baja'));
    expect(contenedor.querySelector('[role="alert"]').textContent).toBe('No se puede dar de baja: está prestada');
    // REQ-F-008 AC3 cláusula: "the unit stays"
    expect(unidad('Casco 2').textContent).toContain('Alta');
    expect(contenedor.textContent).toContain('Casco: 4 unidades');
    expect(document.activeElement).toBe(boton('Dar de baja Casco 2'));
  });

  // REQ-F-008 AC4: "GIVEN "Tienda" has 1 unit with a future reservation from 2026-12-20 WHEN the encargado removes it THEN that reservation is cancelled and the user sees "1 reserva cancelada por la baja""
  it('AC-014-02 REQ-F-008 AC4 con 1 reserva cancelada se muestra "1 reserva cancelada por la baja" y "Tienda: 0 unidades"', async () => {
    const api = {
      listarInventario: vi.fn().mockResolvedValue(inventario({ tienda: 1 })),
      darDeBajaUnidad: vi.fn().mockResolvedValue({ inventario: inventario({ tienda: 0 }), reservasCanceladas: 1, mensaje: '1 reserva cancelada por la baja' }),
    };
    await pantallaInventario({ contenedor, usuario: encargado, api });
    await clic(boton('Dar de baja Tienda 1'));
    await clic(boton('Sí, dar de baja'));
    expect(contenedor.querySelector('[role="status"]').textContent).toBe('1 reserva cancelada por la baja');
    expect(contenedor.textContent).toContain('Tienda: 0 unidades');
  });

  it('"No" en la confirmación vuelve al botón sin llamar a la API', async () => {
    const api = { listarInventario: vi.fn().mockResolvedValue(inventario()), darDeBajaUnidad: vi.fn() };
    await pantallaInventario({ contenedor, usuario: encargado, api });
    await clic(boton('Dar de baja Casco 1'));
    await clic(boton('No'));
    expect(api.darDeBajaUnidad).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(boton('Dar de baja Casco 1'));
  });
});
