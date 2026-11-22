import { describe, it, expect, beforeEach } from 'vitest';
import { aplicarMultaPorRetraso, listarMisMultas } from '../../src/domain/multas.js';
import { TEXTOS } from '../../src/ui/textos.js';
import { entregarReserva, registrarDevolucion, listarPrestamosYReservas } from '../../src/domain/prestamos.js';
import { FINE_PER_DAY_EUR } from '../../src/domain/constantes.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';
import { sembrarUnidades, sembrarReserva, sesionDe } from '../helpers/material.js';

// Multa por retraso (UC-010). Casco de Pablo 2026-12-05 a 2026-12-07, entregado el 05; el reloj se mueve con `avanzar`.
let e; let reservaId;
const DIA = 24 * 60;
const marta = () => sesionDe(e, 'marta@club.test');   // tras mover el reloj la sesión caducó: se entra de nuevo
function devolverEl(dia) {   // dia = 7 → 2026-12-07
  e.avanzar((dia - 5) * DIA - (e.reloj.ahora() - Date.parse('2026-12-05T10:00:00Z')) / 60000);
  return registrarDevolucion(e.ctx(marta()), { reservaId });
}
beforeEach(() => {
  e = crearEntorno({ inicio: '2026-12-05T10:00:00Z' });
  e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  sembrarUnidades(e, 'Casco', 1);
  reservaId = sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', inicio: '2026-12-05', fin: '2026-12-07' });
  entregarReserva(e.ctx(marta()), { reservaId });
});
const multas = () => e.store.leer().multas;

describe('API-003-05 aplicarMultaPorRetraso (UC-010)', () => {
  // REQ-F-006 AC1: "GIVEN "pablo" has a "Casco" loan ending 2026-12-07 WHEN the encargado marks it returned on 2026-12-10 THEN the user sees the fine "6,00 €" for "Pablo Ruiz" with state "Pendiente""
  it('AC-010-01 REQ-F-006 AC1 el Casco de pablo con fin 2026-12-07 devuelto el 2026-12-10 crea una multa Pendiente de 6 € (2 € × 3 días)', () => {
    const vista = devolverEl(10);
    expect(FINE_PER_DAY_EUR).toBe(2);
    expect(multas()).toEqual([expect.objectContaining({ reservaId, socioId: 1, diasRetraso: 3, importeEur: 6, estado: 'Pendiente', creadaEl: '2026-12-10', pagadaEl: null })]);
    expect(vista.multa).toEqual({ importeEur: 6, estado: 'Pendiente' });
  });

  // REQ-F-006 AC3: "GIVEN a loan ending 2026-12-07 WHEN it is returned on 2026-12-08 THEN the fine is "2,00 €""
  it('AC-010-03 REQ-F-006 AC3 devuelto el 2026-12-08 la multa es de 2 € (1 día)', () => {
    devolverEl(8);
    expect(multas()).toEqual([expect.objectContaining({ diasRetraso: 1, importeEur: 2, estado: 'Pendiente' })]);
  });

  // REQ-F-006 AC2: "GIVEN a loan ending 2026-12-07 WHEN it is returned on 2026-12-07 or earlier THEN no fine is created"
  it('AC-010-02 REQ-F-006 AC2 devuelto el 2026-12-07 (y el 2026-12-06) no crea multa', () => {
    expect(devolverEl(7).multa).toBeNull();
    expect(multas()).toEqual([]);
    // Se ve: "Sin multas" en Multas: sin multa, Pablo no tiene nada que listar y el texto de la pantalla es "Sin multas"
    expect(listarMisMultas(e.ctx(sesionDe(e, 'pablo@club.test', 'Nieve2026')))).toEqual([]);
    expect(TEXTOS.sinMultas).toBe('Sin multas');
  });

  it('AC-010-02 REQ-F-006 AC2 devuelto el día antes de su fin (2026-12-06) tampoco crea multa', () => {
    devolverEl(6);
    expect(multas()).toEqual([]);
  });

  it('AC-009-02 la devolución tardía deja "Devuelto" y la multa Pendiente en la misma escritura', () => {
    devolverEl(10);
    const db = e.store.leer();
    expect(db.reservas.find((r) => r.id === reservaId)).toMatchObject({ estado: 'Devuelto', devueltaEl: '2026-12-10' });
    expect(db.multas).toHaveLength(1);
    expect(db.multas[0]).toMatchObject({ reservaId, estado: 'Pendiente' });
  });

  it('AC-010-06 una reserva, una multa (INV-FIN-002): volver a aplicar conserva la existente y no hay segunda', () => {
    devolverEl(10);
    const primera = multas()[0];
    const devuelta = e.store.transaccion((db) => aplicarMultaPorRetraso(db, reservaId));
    expect(devuelta).toMatchObject({ id: primera.id });
    expect(multas()).toEqual([primera]);
  });

  it('AC-010-06 repetir la devolución tardía el 2026-12-11 no cambia la multa de 6 € ni crea otra', () => {
    devolverEl(10);
    const antes = JSON.stringify(multas());
    e.avanzar(DIA);
    registrarDevolucion(e.ctx(marta()), { reservaId });
    expect(JSON.stringify(multas())).toBe(antes);
  });

  it('AC-010-05 con el almacén caído da E_ALMACEN_NO_DISPONIBLE sin devolución ni multa (ADR-005)', async () => {
    e.avanzar(5 * DIA);
    const sid = marta();
    e.caer();
    expect((await fallo(() => registrarDevolucion(e.ctx(sid), { reservaId }))).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    e.caer(false);
    expect(e.store.leer().reservas.find((r) => r.id === reservaId)).toMatchObject({ estado: 'Entregado', devueltaEl: null });
    expect(multas()).toEqual([]);
  });

  it('la lista de préstamos lleva la multa de cada reserva y null si no tiene', () => {
    const otra = sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', inicio: '2026-12-20', fin: '2026-12-21' });
    devolverEl(10);
    const lista = listarPrestamosYReservas(e.ctx(marta()));
    expect(lista.map((r) => [r.id, r.multa])).toEqual([[reservaId, { importeEur: 6, estado: 'Pendiente' }], [otra, null]]);
  });

  it('D-PA-003 es interna: ni permisos ni la API la exponen', async () => {
    const permisos = await import('../../src/domain/permisos.js');
    const { readFileSync } = await import('node:fs');
    const filas = Object.keys({ ...permisos.OPERACIONES, ...permisos.OPERACIONES_FASE_1, ...permisos.OPERACIONES_FASE_2 });
    expect(filas).not.toContain('aplicarMultaPorRetraso');
    expect(readFileSync('src/server/plugin.js', 'utf8')).not.toMatch(/aplicarMultaPorRetraso/);
  });
});

describe('propiedades de UC-010 / UC-009', () => {
  // INV-FIN-001: "importe = FINE_PER_DAY_EUR × días de retraso"; con devueltaEl <= fin no hay multa
  it('PROP-004 importe = FINE_PER_DAY_EUR × días de retraso, y 0 multas si devueltaEl <= fin', () => {
    for (let dias = -3; dias <= 20; dias++) {
      const entorno = crearEntorno({ inicio: '2026-12-05T10:00:00Z' });
      entorno.store.transaccion((db) => {
        db.cuentas.push({ id: 1, nombre: 'Pablo Ruiz', correo: 'p@club.test', rol: 'socio', estado: 'Activa' });
        db.unidades.push({ id: 1, tipo: 'Casco', numero: 1, estado: 'Alta' });
        const devueltaEl = new Date(Date.parse('2026-12-07T00:00:00Z') + dias * 86400000).toISOString().slice(0, 10);
        db.reservas.push({ id: 1, socioId: 1, unidadId: 1, inicio: '2026-12-05', fin: '2026-12-07', estado: 'Devuelto', entregadaEl: '2026-12-05', devueltaEl, canceladaEl: null });
        aplicarMultaPorRetraso(db, 1);
      });
      const { multas: resultado } = entorno.store.leer();
      if (dias <= 0) expect(resultado).toEqual([]);
      else expect(resultado.map((m) => [m.diasRetraso, m.importeEur])).toEqual([[dias, FINE_PER_DAY_EUR * dias]]);
    }
  });

  // SM-001: Reservada → Entregado → Devuelto; Reservada → No recogida; nada vuelve atrás
  it('PROP-005 el estado de la reserva solo avanza por las transiciones de SM-001 con cualquier secuencia de operaciones', () => {
    const permitidas = { Reservada: ['Entregado', 'No recogida'], Entregado: ['Devuelto'], Devuelto: [], 'No recogida': [] };
    let semilla = 7;
    const azar = (n) => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla % n; };
    for (let ronda = 0; ronda < 25; ronda++) {
      const entorno = crearEntorno({ inicio: '2026-12-03T10:00:00Z' });
      entorno.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
      entorno.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
      sembrarUnidades(entorno, 'Casco', 1);
      const id = sembrarReserva(entorno, { correo: 'pablo@club.test', tipo: 'Casco', inicio: '2026-12-05', fin: '2026-12-07' });
      let estado = 'Reservada';
      for (let paso = 0; paso < 12; paso++) {
        entorno.avanzar(azar(3) * DIA);
        const ctx = entorno.ctx(sesionDe(entorno, 'marta@club.test'));
        const operacion = azar(2) === 0 ? entregarReserva : registrarDevolucion;
        try { operacion(ctx, { reservaId: id }); } catch { /* una operación fuera de su estado se rechaza sin cambiar nada */ }
        const nuevo = entorno.store.leer().reservas[0].estado;
        if (nuevo !== estado) expect(permitidas[estado]).toContain(nuevo);
        estado = nuevo;
      }
    }
  });
});
