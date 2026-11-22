// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { montar } from '../../../src/ui/pantallas/mis-reservas.js';

let raiz;
const esperar = (condicion) => vi.waitFor(condicion, { timeout: 1000 });
const avisos = { poner: vi.fn(), tomar: () => null };
const sesion = { nombre: 'Lucía', rol: 'socio' };
const reserva = (id, tipo, desde, hasta, estado = 'Reservada') => ({ id, socioId: 1, tipo, desde, hasta, estado, cancelable: estado === 'Reservada' });
const filas = () => [...raiz.querySelectorAll('tbody tr')];
const resumen = (fila) => fila.querySelector('th').textContent;

beforeEach(() => {
  raiz = document.createElement('div');
  document.body.replaceChildren(raiz);
});

describe('pantalla Mis reservas con Cancelar y multas (SCR-002, UC-004)', () => {
  it('cada fila dice «{material} · {desde} a {hasta} · {estado}» y solo las Reservadas ofrecen Cancelar', async () => {
    const api = { listarMisReservas: vi.fn().mockResolvedValue({ multas: [], reservas: [
      reserva(3, 'Piolet', '2026-12-05', '2026-12-07'), reserva(2, 'Casco', '2026-11-01', '2026-11-02', 'No recogida'),
      reserva(1, 'Cuerda', '2026-10-01', '2026-10-02', 'Cancelada')] }) };
    montar({ raiz, api, sesion, avisos });
    await esperar(() => expect(filas()).toHaveLength(3));
    expect(filas().map(resumen)).toEqual(['Piolet · 2026-12-05 a 2026-12-07 · Reservada', 'Casco · 2026-11-01 a 2026-11-02 · No recogida', 'Cuerda · 2026-10-01 a 2026-10-02 · Cancelada']);
    expect(filas().map((f) => f.querySelectorAll('button').length)).toEqual([1, 0, 0]);
    expect(filas()[0].querySelector('button').textContent).toBe('Cancelar');
  });

  it('pulsar Cancelar llama a la API con la reserva y la fila pasa a «Cancelada» sin botón', async () => {
    const api = {
      listarMisReservas: vi.fn()
        .mockResolvedValueOnce({ multas: [], reservas: [reserva(3, 'Piolet', '2026-12-05', '2026-12-07')] })
        .mockResolvedValue({ multas: [], reservas: [reserva(3, 'Piolet', '2026-12-05', '2026-12-07', 'Cancelada')] }),
      cancelarReserva: vi.fn().mockResolvedValue({ id: 3, estado: 'Cancelada' }),
    };
    montar({ raiz, api, sesion, avisos });
    await esperar(() => expect(raiz.querySelector('tbody button')).not.toBeNull());
    raiz.querySelector('tbody button').click();
    await esperar(() => expect(resumen(filas()[0])).toBe('Piolet · 2026-12-05 a 2026-12-07 · Cancelada'));
    expect(api.cancelarReserva).toHaveBeenCalledWith(3);
    expect(raiz.querySelector('tbody button')).toBeNull();
    expect(filas()).toHaveLength(1);
  });

  it('un rechazo de la API se muestra con su mensaje y la reserva sigue Reservada con su botón', async () => {
    const api = {
      listarMisReservas: vi.fn().mockResolvedValue({ multas: [], reservas: [reserva(3, 'Piolet', '2026-12-05', '2026-12-07')] }),
      cancelarReserva: vi.fn().mockRejectedValue({ codigo: 'E_CANCELACION_TARDIA', mensaje: 'Solo se puede cancelar hasta el día antes' }),
    };
    montar({ raiz, api, sesion, avisos });
    await esperar(() => expect(raiz.querySelector('tbody button')).not.toBeNull());
    raiz.querySelector('tbody button').click();
    await esperar(() => expect(raiz.querySelector('[role="alert"]').textContent).toBe('Solo se puede cancelar hasta el día antes'));
    expect(resumen(filas()[0])).toBe('Piolet · 2026-12-05 a 2026-12-07 · Reservada');
    expect(raiz.querySelector('tbody button')).not.toBeNull();
  });

  it('las multas Pendientes salen como «Multa pendiente: {importe} €» y las pagadas no', async () => {
    const api = { listarMisReservas: vi.fn().mockResolvedValue({ reservas: [], multas: [
      { id: 1, socioId: 1, importeEur: 4, estado: 'Pendiente' }, { id: 2, socioId: 1, importeEur: 2, estado: 'Pagada' }] }) };
    montar({ raiz, api, sesion, avisos });
    await esperar(() => expect(raiz.textContent).toContain('Multa pendiente: 4 €'));
    expect(raiz.textContent).not.toContain('Multa pendiente: 2 €');
    expect(raiz.textContent).toContain('No tienes reservas');
  });
});
