// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pantallaReservar } from '../../src/ui/pantallas/reservar.js';
import { ErrorApi } from '../../src/ui/api.js';

let contenedor;
beforeEach(() => { document.body.replaceChildren(); contenedor = document.createElement('main'); document.body.append(contenedor); });
const socio = { nombre: 'Lucía Gil', rol: 'socio' };
const libres = (n) => vi.fn(async (material, inicio, fin) => ({ material, inicio, fin, libres: material === 'Piolet' ? n : 1 }));
const rellenar = (material, inicio, fin) => {
  contenedor.querySelector('select').value = material;
  for (const [campo, valor] of [['inicio', inicio], ['fin', fin]]) {
    const input = contenedor.querySelector(`input[name="${campo}"]`);
    input.value = valor;
    input.dispatchEvent(new Event('change'));
  }
};
const dd = (material) => [...contenedor.querySelectorAll('dt')].find((dt) => dt.textContent === material)?.nextElementSibling?.textContent;

describe('pantalla Material disponible / Reservar (UC-005)', () => {
  // REQ-F-003 AC1: "GIVEN there are 3 "Piolet" units, all free, and today is 2026-11-21 WHEN "lucia" reserves "Piolet" from 2026-12-05 to 2026-12-07 THEN the user sees "Reserva creada: Piolet, 2026-12-05 a 2026-12-07" and "Piolet" shows "2 libres" for those dates"
  it('AC-005-01 reservar Piolet del 2026-12-05 al 2026-12-07 avisa "Reserva creada: Piolet, 2026-12-05 a 2026-12-07" y refresca a "2 libres"', async () => {
    const consultarDisponibilidad = vi.fn()
      .mockImplementation(async (material, inicio, fin) => ({ material, inicio, fin, libres: material === 'Piolet' ? (reservarMaterial.mock.calls.length ? 2 : 3) : 0 }));
    const reservarMaterial = vi.fn().mockResolvedValue({ id: 1, material: 'Piolet', unidad: 1, inicio: '2026-12-05', fin: '2026-12-07', estado: 'Reservada' });
    await pantallaReservar({ contenedor, usuario: socio, api: { consultarDisponibilidad, reservarMaterial } });
    expect(contenedor.querySelector('h1').textContent).toBe('Material disponible');
    rellenar('Piolet', '2026-12-05', '2026-12-07');
    await vi.waitFor(() => expect(dd('Piolet')).toBe('3 libres'));
    contenedor.querySelector('form').requestSubmit();
    await vi.waitFor(() => expect(dd('Piolet')).toBe('2 libres'));
    expect(reservarMaterial).toHaveBeenCalledWith('Piolet', '2026-12-05', '2026-12-07');
    expect(contenedor.querySelector('[role="status"]').textContent).toBe('Reserva creada: Piolet, 2026-12-05 a 2026-12-07');
    expect(dd('Tienda')).toBe('0 libres');
  });

  it('SCR-002 el error de fecha sale junto a su campo con aria-invalid y enlazado por aria-describedby', async () => {
    const reservarMaterial = vi.fn();
    await pantallaReservar({ contenedor, usuario: socio, api: { consultarDisponibilidad: libres(1), reservarMaterial } });
    rellenar('Casco', '2026-11-20', '2026-11-22');
    for (const [codigo, campo, texto] of [
      ['E_FECHA_PASADA', 'inicio', 'No se puede reservar en fechas pasadas'],
      ['E_FECHAS_INVERTIDAS', 'fin', 'La fecha de fin no puede ser anterior a la de inicio'],
      ['E_RESERVA_MUY_LARGA', 'fin', 'La reserva no puede superar 14 días']]) {
      reservarMaterial.mockRejectedValueOnce(new ErrorApi(codigo));
      contenedor.querySelector('form').requestSubmit();
      await vi.waitFor(() => expect(contenedor.querySelector('[role="alert"]')?.textContent).toBe(texto));
      const input = contenedor.querySelector(`input[name="${campo}"]`);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe(contenedor.querySelector('[role="alert"]').id);
      expect(input.parentElement.contains(contenedor.querySelector('[role="alert"]'))).toBe(true);
    }
  });

  it('SCR-002 sin unidades o con multa el aviso general dice el mensaje literal y ningún campo queda marcado', async () => {
    const reservarMaterial = vi.fn().mockRejectedValueOnce(new ErrorApi('E_SIN_UNIDADES')).mockRejectedValueOnce(new ErrorApi('E_MULTA_PENDIENTE'));
    await pantallaReservar({ contenedor, usuario: socio, api: { consultarDisponibilidad: libres(0), reservarMaterial } });
    rellenar('Tienda', '2026-12-07', '2026-12-09');
    contenedor.querySelector('form').requestSubmit();
    await vi.waitFor(() => expect(contenedor.querySelector('[role="alert"]')?.textContent).toBe('No hay unidades libres esas fechas'));
    expect(contenedor.querySelector('[aria-invalid]')).toBeNull();
    contenedor.querySelector('form').requestSubmit();
    await vi.waitFor(() => expect(contenedor.querySelector('[role="alert"]')?.textContent).toBe('Tienes una multa pendiente: no puedes reservar hasta pagarla'));
  });

  it('el encargado no tiene Reservar: ve "Acceso no permitido"', async () => {
    await pantallaReservar({ contenedor, usuario: { nombre: 'Marta', rol: 'encargado' }, api: {} });
    expect(contenedor.querySelector('h1').textContent).toBe('Acceso no permitido');
  });
});
