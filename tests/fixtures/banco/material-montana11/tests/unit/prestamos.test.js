import { describe, it, expect, beforeEach } from 'vitest';
import { aplicarNoRecogidas } from '../../src/domain/prestamos.js';
import { crearEntorno } from '../helpers/entorno.js';

let e;
const reserva = (id, inicio, estado = 'Reservada') => ({ id, socioId: 1, unidadId: 1, inicio, fin: '2026-12-07', estado, entregadaEl: null, devueltaEl: null, canceladaEl: null });
beforeEach(() => {
  e = crearEntorno();
  e.store.transaccion((db) => {
    db.unidades.push({ id: 1, tipo: 'Piolet', numero: 1, estado: 'Alta' });
    db.reservas.push(reserva(1, '2026-12-05'), reserva(2, '2026-12-06'), reserva(3, '2026-12-04', 'Cancelada'), reserva(4, '2026-12-04', 'Entregado'));
  });
});
const estados = () => e.store.leer().reservas.map((r) => r.estado);

describe('API-003-03 aplicarNoRecogidas (interna, sin ruta ni fila de rol)', () => {
  // INV-LOA-002: "Una reserva Reservada con `inicio` < hoy pasa a No recogida y libera la unidad"
  it('INV-LOA-002 no recogida: una Reservada con inicio < hoy pasa a "No recogida"; la de hoy y las de otros estados no cambian', () => {
    const cambiadas = e.store.transaccion((db) => aplicarNoRecogidas(db, '2026-12-06'));
    expect(cambiadas).toBe(1);
    expect(estados()).toEqual(['No recogida', 'Reservada', 'Cancelada', 'Entregado']);
  });

  it('INV-LOA-002 libera la unidad: otra reserva del mismo rango ya no solapa con la no recogida', () => {
    e.store.transaccion((db) => aplicarNoRecogidas(db, '2026-12-06'));
    const ocupan = e.store.leer().reservas.filter((r) => ['Reservada', 'Entregado'].includes(r.estado) && r.unidadId === 1 && r.inicio <= '2026-12-05' && r.fin >= '2026-12-05');
    expect(ocupan.map((r) => r.id)).toEqual([4]);
  });

  it('INV-LOA-002 repetición: llamar de nuevo no cambia nada (GAP-002)', () => {
    e.store.transaccion((db) => aplicarNoRecogidas(db, '2026-12-06'));
    const antes = JSON.stringify(e.store.leer());
    const cambiadas = e.store.transaccion((db) => aplicarNoRecogidas(db, '2026-12-06'));
    expect(cambiadas).toBe(0);
    expect(JSON.stringify(e.store.leer())).toBe(antes);
  });

  it('D-PA-003 es interna: ninguna operación de permisos ni ruta de la API la expone', async () => {
    const { OPERACIONES, OPERACIONES_FASE_1 } = await import('../../src/domain/permisos.js');
    const { readFileSync } = await import('node:fs');
    expect(Object.keys({ ...OPERACIONES, ...OPERACIONES_FASE_1 })).not.toContain('aplicarNoRecogidas');
    expect(readFileSync('src/server/plugin.js', 'utf8')).not.toMatch(/aplicarNoRecogidas|marcarNoRecogidas/);
  });
});
