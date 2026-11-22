import { describe, it, expect, beforeEach } from 'vitest';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { purgarRegistrosAntiguos } from '../../../src/domain/tareas.js';
import { ejecutarTareasDiarias } from '../../../src/server/tareas-diarias.js';

let almacen;
const reloj = { ahora: () => new Date('2026-11-21T11:00:00Z'), hoy: () => '2026-11-21' };
const cuenta = (id, nombre, estado = 'Activa') => ({ id, nombre, correo: `${nombre.toLowerCase()}@club.es`, hashContrasena: 'scrypt$aa$bb', rol: 'socio', estado, fallosSeguidos: 0, bloqueadaHasta: null });
const reserva = (id, socioId, estado, hasta, devueltaEl = null) => ({ id, socioId, tipo: 'Piolet', desde: hasta, hasta, estado, unidadId: null, devueltaEl, creadaEl: '2024-10-01T10:00:00.000Z' });
const multa = (id, socioId, estado, pagadaEl = null) => ({ id, socioId, reservaId: 1, dias: 1, importeEur: 2, estado, pagadaEl });
const sembrar = (fn) => almacen.transaction((db) => fn(db));
const ids = async (coleccion) => (await almacen.load())[coleccion].map((x) => x.id);

beforeEach(() => { almacen = crearAlmacenMemoria(); });

describe('API-003-08 purgarRegistrosAntiguos (REQ-NF-001, INV-LOA-006)', () => {
  it('REQ-NF-001 AC2 con hoy 2026-11-21, el préstamo devuelto el 2024-11-01 desaparece y el devuelto el 2025-01-10 se queda', async () => {
    await sembrar((db) => {
      db.cuentas.push(cuenta(1, 'Lucía'));
      db.reservas.push(reserva(1, 1, 'Devuelta', '2024-10-30', '2024-11-01'), reserva(2, 1, 'Devuelta', '2025-01-09', '2025-01-10'));
    });
    const resultado = await purgarRegistrosAntiguos({ almacen, reloj });
    // REQ-NF-001 AC2: "GIVEN a loan returned on 2024-11-01 and today is 2026-11-21 WHEN the cleanup runs THEN that loan is gone and a loan returned on 2025-01-10 stays"
    expect(await ids('reservas')).not.toContain(1);
    // REQ-NF-001 AC2 cláusula: "a loan returned on 2025-01-10 stays"
    expect(await ids('reservas')).toEqual([2]);
    expect(resultado).toEqual({ reservas: 1, multas: 0, cuentas: 0 });
  });

  it('INV-LOA-006 una multa Pendiente nunca se borra; una Pagada se borra a los 2 años de su pago; el cierre de un préstamo Cancelado o No recogido es su `hasta`', async () => {
    await sembrar((db) => {
      db.cuentas.push(cuenta(1, 'Lucía'));
      db.reservas.push(
        reserva(1, 1, 'Devuelta', '2020-01-02', '2020-01-03'), // devuelta hace años, con multa Pendiente
        reserva(2, 1, 'Cancelada', '2024-11-05'), reserva(3, 1, 'No recogida', '2024-11-20'), reserva(4, 1, 'No recogida', '2025-03-01'),
        reserva(5, 1, 'Prestada', '2020-01-02'), reserva(6, 1, 'Reservada', '2030-01-02'),
      );
      db.multas.push(multa(1, 1, 'Pendiente'), multa(2, 1, 'Pagada', '2024-11-20'), multa(3, 1, 'Pagada', '2024-11-22'));
    });
    await purgarRegistrosAntiguos({ almacen, reloj });
    // INV-LOA-006: "se borran RETENTION_YEARS años después de su cierre; nunca una multa Pendiente"
    expect(await ids('multas')).toEqual([1, 3]);
    expect(await ids('reservas')).toEqual([4, 5, 6]); // 1 (cierre 2020), 2 y 3 (hasta ≤ 2024-11-20) fuera; Prestada y Reservada nunca
  });

  it('D-PA-005 una cuenta en Baja sin reservas ni multas conservadas se borra con nombre, correo y hash; con registros conservados, o Activa, se queda', async () => {
    await sembrar((db) => {
      db.cuentas.push(cuenta(1, 'Pablo', 'Baja'), cuenta(2, 'Nuria', 'Baja'), cuenta(3, 'Iván', 'Baja'), cuenta(4, 'Lucía'));
      db.reservas.push(reserva(1, 2, 'Devuelta', '2026-11-01', '2026-11-02'), reserva(2, 3, 'Devuelta', '2024-01-01', '2024-01-02'));
      db.multas.push(multa(1, 3, 'Pendiente'));
    });
    const resultado = await purgarRegistrosAntiguos({ almacen, reloj });
    expect((await almacen.load()).cuentas.map((c) => c.nombre)).toEqual(['Nuria', 'Iván', 'Lucía']);
    expect(resultado.cuentas).toBe(1);
    // Pablo ya no está con ningún dato personal
    expect(JSON.stringify(await almacen.load())).not.toMatch(/Pablo|pablo@club\.es/);
    // más tarde, cuando a Nuria le caduque su préstamo, también se borra su cuenta
    await purgarRegistrosAntiguos({ almacen, reloj: { ahora: reloj.ahora, hoy: () => '2028-11-03' } });
    expect((await almacen.load()).cuentas.map((c) => c.nombre)).toEqual(['Iván', 'Lucía']);
  });

  it('es idempotente: repetirla no cambia nada y devuelve 0 en todo', async () => {
    await sembrar((db) => { db.cuentas.push(cuenta(1, 'Pablo', 'Baja')); db.reservas.push(reserva(1, 2, 'Devuelta', '2024-10-30', '2024-11-01')); });
    await purgarRegistrosAntiguos({ almacen, reloj });
    const antes = JSON.stringify(await almacen.load());
    expect(await purgarRegistrosAntiguos({ almacen, reloj })).toEqual({ reservas: 0, multas: 0, cuentas: 0 });
    expect(JSON.stringify(await almacen.load())).toBe(antes);
  });

  it('la tarea diaria la lanza después de resolverNoRecogidas: una Reservada vencida hace más de 2 años pasa a No recogida y se borra', async () => {
    await sembrar((db) => { db.cuentas.push(cuenta(1, 'Lucía')); db.reservas.push(reserva(1, 1, 'Reservada', '2024-06-01'), reserva(2, 1, 'Reservada', '2026-11-20')); });
    await ejecutarTareasDiarias({ almacen, reloj });
    expect(await ids('reservas')).toEqual([2]);
    expect((await almacen.load()).reservas[0].estado).toBe('No recogida');
  });
});
