// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pantallaInventario } from '../../src/ui/pantallas/inventario.js';
import { ErrorApi } from '../../src/ui/api.js';

let contenedor;
beforeEach(() => { document.body.replaceChildren(); contenedor = document.createElement('main'); document.body.append(contenedor); });
const encargado = { nombre: 'Marta', rol: 'encargado' };
const tipos = (crampones = 0) => ({
  tipos: ['Piolet', 'Crampones', 'Casco', 'Cuerda', 'Tienda'].map((tipo) => {
    const n = tipo === 'Crampones' ? crampones : 0;
    return { tipo, total: n, unidades: Array.from({ length: n }, (_, i) => ({ id: i + 1, numero: i + 1, estado: 'Alta' })) };
  }),
});

describe('pantalla Inventario (UC-013)', () => {
  // REQ-F-008 AC1: "GIVEN the types are piolets, crampones, cascos, cuerdas and tiendas WHEN the encargado adds 2 units of "Crampones" THEN the user sees "Crampones: 2 unidades" in the inventory"
  it('AC-013-01 añadir 2 Crampones envía tipo y cantidad y muestra "Crampones: 2 unidades" con sus unidades', async () => {
    const api = { listarInventario: vi.fn().mockResolvedValueOnce(tipos(0)).mockResolvedValueOnce(tipos(2)), anadirMaterial: vi.fn().mockResolvedValue({}) };
    await pantallaInventario({ contenedor, usuario: encargado, api });
    expect(contenedor.querySelector('h1').textContent).toBe('Inventario');
    expect(contenedor.textContent).toContain('Tienda: 0 unidades');
    contenedor.querySelector('select[name="tipo"]').value = 'Crampones';
    contenedor.querySelector('input[name="cantidad"]').value = '2';
    contenedor.querySelector('form').requestSubmit();
    await vi.waitFor(() => expect(contenedor.textContent).toContain('Crampones: 2 unidades'));
    expect(api.anadirMaterial).toHaveBeenCalledWith('Crampones', 2);
    expect(contenedor.textContent).toContain('Crampones 1');
    expect(contenedor.textContent).toContain('Crampones 2');
  });

  // REQ-F-008 AC6: "GIVEN an amount of 0 units WHEN the encargado adds material THEN the user sees "La cantidad debe ser al menos 1""
  it('AC-013-03 cantidad 0: el error "La cantidad debe ser al menos 1" sale junto al campo y el recuento no cambia', async () => {
    const api = { listarInventario: vi.fn().mockResolvedValue(tipos(0)), anadirMaterial: vi.fn().mockRejectedValue(new ErrorApi('E_CANTIDAD_INVALIDA')) };
    await pantallaInventario({ contenedor, usuario: encargado, api });
    contenedor.querySelector('input[name="cantidad"]').value = '0';
    contenedor.querySelector('form').requestSubmit();
    await vi.waitFor(() => expect(contenedor.querySelector('[role="alert"]')?.textContent).toBe('La cantidad debe ser al menos 1'));
    const campo = contenedor.querySelector('input[name="cantidad"]');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toBe(contenedor.querySelector('[role="alert"]').id);
    expect(api.anadirMaterial).toHaveBeenCalledWith('Piolet', 0);
    expect(contenedor.textContent).toContain('Casco: 0 unidades');
  });

  // REQ-F-008 AC7: "GIVEN a socio session WHEN the socio opens the address of "Inventario" THEN the user sees "Acceso no permitido""
  it('AC-013-06 un socio ve "Acceso no permitido" y ni formulario ni lista', async () => {
    const api = { listarInventario: vi.fn().mockRejectedValue(new ErrorApi('E_ACCESO_NO_PERMITIDO')) };
    await pantallaInventario({ contenedor, usuario: { nombre: 'Lucía', rol: 'socio' }, api });
    expect(contenedor.querySelector('h1').textContent).toBe('Acceso no permitido');
    expect(contenedor.querySelector('form')).toBeNull();
  });

  it('AC-013-07 con el almacén caído avisa "No se pudo guardar. Inténtalo de nuevo" y conserva la lista', async () => {
    const api = { listarInventario: vi.fn().mockResolvedValue(tipos(2)), anadirMaterial: vi.fn().mockRejectedValue(new ErrorApi('E_ALMACEN_NO_DISPONIBLE')) };
    await pantallaInventario({ contenedor, usuario: encargado, api });
    contenedor.querySelector('form').requestSubmit();
    await vi.waitFor(() => expect(contenedor.querySelector('[role="alert"]')?.textContent).toBe('No se pudo guardar. Inténtalo de nuevo'));
    expect(contenedor.textContent).toContain('Crampones: 2 unidades');
  });
});
