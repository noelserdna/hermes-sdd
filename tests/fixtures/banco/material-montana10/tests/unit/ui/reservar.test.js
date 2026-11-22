// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { montar } from '../../../src/ui/pantallas/reservar.js';
import { ErrorApi } from '../../../src/ui/api.js';

let raiz;
let api;
let ir;
let avisos;
const esperar = (condicion) => vi.waitFor(condicion, { timeout: 1000 });
const enviar = (tipo, desde, hasta) => {
  raiz.querySelector('select[name="tipo"]').value = tipo;
  raiz.querySelector('input[name="desde"]').value = desde;
  raiz.querySelector('input[name="hasta"]').value = hasta;
  raiz.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

beforeEach(() => {
  raiz = document.createElement('div');
  document.body.replaceChildren(raiz);
  api = { reservarMaterial: vi.fn() };
  ir = vi.fn();
  avisos = { poner: vi.fn(), tomar: () => null };
  montar({ raiz, api, sesion: { nombre: 'Lucía', rol: 'socio' }, ir, avisos });
});

describe('pantalla Reservar (SCR-003)', () => {
  it('al reservar con éxito deja el aviso «Reserva creada: …» y lleva a #/mis-reservas', async () => {
    api.reservarMaterial.mockResolvedValue({ id: 1, tipo: 'Piolet', desde: '2026-12-03', hasta: '2026-12-05' });
    enviar('Piolet', '2026-12-03', '2026-12-05');
    await esperar(() => expect(ir).toHaveBeenCalledWith('#/mis-reservas'));
    expect(api.reservarMaterial).toHaveBeenCalledWith('Piolet', '2026-12-03', '2026-12-05');
    expect(avisos.poner).toHaveBeenCalledWith('Reserva creada: Piolet del 2026-12-03 al 2026-12-05');
  });

  it('un rechazo de la API se muestra con su mensaje y no navega', async () => {
    api.reservarMaterial.mockRejectedValue(new ErrorApi('E_SIN_UNIDADES_LIBRES', 'No quedan unidades libres de Piolet esas fechas', 409));
    enviar('Piolet', '2026-12-04', '2026-12-04');
    await esperar(() => expect(raiz.querySelector('[role="alert"]').textContent).toBe('No quedan unidades libres de Piolet esas fechas'));
    expect(ir).not.toHaveBeenCalled();
    expect(avisos.poner).not.toHaveBeenCalled();
    expect(raiz.querySelector('button').getAttribute('aria-busy')).toBeNull();
    expect(raiz.querySelector('h1').textContent).toBe('Reservar material');
  });

  it('el envío doble no manda dos reservas mientras la primera espera', async () => {
    let resolver;
    api.reservarMaterial.mockReturnValue(new Promise((r) => { resolver = r; }));
    enviar('Casco', '2026-12-03', '2026-12-05');
    enviar('Casco', '2026-12-03', '2026-12-05');
    expect(api.reservarMaterial).toHaveBeenCalledTimes(1);
    resolver({ tipo: 'Casco', desde: '2026-12-03', hasta: '2026-12-05' });
    await esperar(() => expect(ir).toHaveBeenCalledTimes(1));
  });

  it('ofrece los cinco tipos de material y las fechas como campos de fecha', () => {
    expect([...raiz.querySelectorAll('select[name="tipo"] option')].map((o) => o.value)).toEqual(['Piolet', 'Crampones', 'Casco', 'Cuerda', 'Tienda']);
    expect(raiz.querySelector('input[name="desde"]').type).toBe('date');
    expect(raiz.querySelector('input[name="hasta"]').type).toBe('date');
  });
});
