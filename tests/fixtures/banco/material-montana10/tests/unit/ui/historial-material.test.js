// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { montar } from '../../../src/ui/pantallas/historial.js';

// Observación de FASE-2 (Q-task-implementer-003): una reserva aún sin unidad muestra el material, no «Sin unidad».
it('REQ-F-010 una reserva Reservada de Piolet sin unidad sale como «Piolet · 2026-12-20 a 2026-12-21 · Reservada»', async () => {
  const raiz = document.createElement('div');
  document.body.replaceChildren(raiz);
  const api = {
    listarSocios: vi.fn().mockResolvedValue([{ id: 1, nombre: 'Lucía', estado: 'Activa' }]),
    consultarHistorial: vi.fn().mockResolvedValue({ prestamos: [{ unidad: null, material: 'Piolet', desde: '2026-12-20', hasta: '2026-12-21', estado: 'Reservada' }], multas: [] }),
  };
  montar({ raiz, api, sesion: { nombre: 'Ana', rol: 'junta' } });
  await vi.waitFor(() => expect(raiz.querySelectorAll('option')).toHaveLength(1), { timeout: 1000 });
  raiz.querySelector('select').value = '1';
  raiz.querySelector('button').click();
  await vi.waitFor(() => expect(raiz.querySelectorAll('[data-seccion="prestamos"] li')).toHaveLength(1), { timeout: 1000 });
  expect(raiz.querySelector('[data-seccion="prestamos"] li').textContent).toBe('Piolet · 2026-12-20 a 2026-12-21 · Reservada');
});
