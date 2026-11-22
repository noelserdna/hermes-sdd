import { describe, it, expect, beforeEach } from 'vitest';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { resolverNoRecogidas } from '../../../src/domain/tareas.js';

let almacen;
const relojDe = (dia) => ({ ahora: () => new Date(`${dia}T11:00:00Z`), hoy: () => dia });
const sembrarReserva = (tipo, desde, hasta, estado = 'Reservada') => almacen.transaction((db) => {
  db.reservas.push({ id: db.reservas.length + 1, socioId: 1, tipo, desde, hasta, estado, unidadId: null, devueltaEl: null, creadaEl: '2026-11-20T10:00:00.000Z' });
});

beforeEach(() => { almacen = crearAlmacenMemoria(); });

describe('D-T-010 resolverNoRecogidas (API-003-07)', () => {
  it('D-T-010 persiste «No recogida» solo en las Reservadas con hasta anterior a hoy, devuelve contadores y no crea multas', async () => {
    await sembrarReserva('Piolet', '2026-12-05', '2026-12-07');
    await sembrarReserva('Casco', '2026-12-08', '2026-12-09');
    await sembrarReserva('Cuerda', '2026-12-01', '2026-12-03', 'Prestada');
    const resultado = await resolverNoRecogidas({ almacen, reloj: relojDe('2026-12-08') });
    expect(resultado).toEqual({ noRecogidas: 1 });
    const db = await almacen.load();
    expect(db.reservas.map((r) => r.estado)).toEqual(['No recogida', 'Reservada', 'Prestada']);
    expect(db.multas).toEqual([]);
  });

  it('D-PA-008 es idempotente: repetirla no cambia nada y devuelve 0', async () => {
    await sembrarReserva('Piolet', '2026-12-05', '2026-12-07');
    await resolverNoRecogidas({ almacen, reloj: relojDe('2026-12-08') });
    const antes = JSON.stringify(await almacen.load());
    expect(await resolverNoRecogidas({ almacen, reloj: relojDe('2026-12-08') })).toEqual({ noRecogidas: 0 });
    expect(JSON.stringify(await almacen.load())).toBe(antes);
  });
});
