import { describe, it, expect, beforeEach } from 'vitest';
import { listarMultas, marcarMultaPagada } from '../../src/domain/multas.js';
import { reservarMaterial, listarMisReservas } from '../../src/domain/reservas.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';
import { sembrarUnidades, sembrarMulta, sembrarReserva, sesionDe } from '../helpers/material.js';

// UC-012 · API-003-07 listarMultas y API-003-08 marcarMultaPagada. Pablo devolvió su Casco tarde: multa de 6 €.
let e;
const DIA = 24 * 60;
const marta = () => sesionDe(e, 'marta@club.test');
const pablo = () => sesionDe(e, 'pablo@club.test', 'Nieve2026');
const multas = () => e.store.leer().multas;
beforeEach(() => {
  e = crearEntorno({ inicio: '2026-12-11T10:00:00Z' });
  e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  sembrarUnidades(e, 'Casco', 1);
});

describe('API-003-08 marcarMultaPagada (UC-012)', () => {
  // REQ-F-007 AC1: "GIVEN "pablo" has one pending fine of 6,00 € WHEN the encargado marks it "Pagada" THEN the user sees the fine with state "Pagada" and "pablo" can reserve "Casco""
  it('AC-012-01 REQ-F-007 AC1 pagar la única multa de 6 € de pablo la deja Pagada y reservar "Casco" ya no falla', () => {
    sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
    expect(marcarMultaPagada(e.ctx(marta()), { multaId: 1 })).toMatchObject({ id: 1, socio: 'Pablo Ruiz', importeEur: 6, estado: 'Pagada', pagadaEl: '2026-12-11' });
    expect(multas()).toEqual([expect.objectContaining({ estado: 'Pagada', pagadaEl: '2026-12-11' })]);
    const reserva = reservarMaterial(e.ctx(pablo()), { material: 'Casco', inicio: '2026-12-15', fin: '2026-12-16' });
    expect(reserva).toMatchObject({ material: 'Casco', inicio: '2026-12-15', estado: 'Reservada' });
  });

  // REQ-F-006 AC5: "GIVEN "pablo" has 2 pending fines WHEN only one is marked paid THEN he is still blocked"
  it('AC-012-02 REQ-F-006 AC5 con 2 multas Pendiente y una pagada, reservar da E_MULTA_PENDIENTE (INV-FIN-004)', async () => {
    sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
    sembrarMulta(e, 'pablo@club.test', { importeEur: 2 });
    sembrarMulta(e, 'pablo@club.test', { importeEur: 4, estado: 'Pagada' });
    marcarMultaPagada(e.ctx(marta()), { multaId: 1 });
    expect(multas().map((m) => m.estado)).toEqual(['Pagada', 'Pendiente', 'Pagada']);
    const error = await fallo(() => reservarMaterial(e.ctx(pablo()), { material: 'Casco', inicio: '2026-12-15', fin: '2026-12-16' }));
    expect(error.codigo).toBe('E_MULTA_PENDIENTE');
    expect(error.message).toBe('Tienes una multa pendiente: no puedes reservar hasta pagarla');
  });

  // REQ-F-006 AC4: "GIVEN "pablo" has a pending fine of 6,00 € WHEN he tries to reserve THEN the reservation is rejected (see REQ-F-003) and his other existing reservations stay"
  it('AC-010-04 REQ-F-006 AC4 con multa Pendiente de 6 € y una reserva existente, reservar da E_MULTA_PENDIENTE y la reserva se conserva (INV-RES-005)', async () => {
    sembrarUnidades(e, 'Casco', 1);
    sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
    const existente = sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', inicio: '2026-12-20', fin: '2026-12-21' });
    const sid = pablo();
    const antes = listarMisReservas(e.ctx(sid));
    expect(antes).toEqual([expect.objectContaining({ id: existente, estado: 'Reservada', inicio: '2026-12-20' })]);
    expect((await fallo(() => reservarMaterial(e.ctx(sid), { material: 'Casco', inicio: '2026-12-12', fin: '2026-12-13' }))).codigo).toBe('E_MULTA_PENDIENTE');
    // REQ-F-006 AC4 cláusula: "his other existing reservations stay"
    const reservas = listarMisReservas(e.ctx(sid));
    expect(reservas).toEqual(antes);
    expect(e.store.leer().reservas).toHaveLength(1);
  });

  // REQ-F-007 AC2: "GIVEN a fine already "Pagada" WHEN "Pagada" is sent again THEN it stays "Pagada" with the first payment date"
  it('AC-012-03 REQ-F-007 AC2 multa pagada el 2026-12-11 y pago repetido el 2026-12-12 sigue Pagada con pagadaEl 2026-12-11', () => {
    sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
    marcarMultaPagada(e.ctx(marta()), { multaId: 1 });
    const antes = multas()[0];
    expect(antes).toMatchObject({ estado: 'Pagada', pagadaEl: '2026-12-11' });
    e.avanzar(DIA);
    const repetida = marcarMultaPagada(e.ctx(marta()), { multaId: 1 });
    // REQ-F-007 AC2 cláusula: "it stays "Pagada" with the first payment date"
    expect(repetida).toMatchObject({ estado: antes.estado, pagadaEl: antes.pagadaEl });
    expect(multas()).toEqual([antes]);
  });

  // REQ-F-007 AC3: "GIVEN a socio session WHEN the socio opens the address of "Multas" of the encargado THEN the user sees "Acceso no permitido""
  it('AC-012-04 REQ-F-007 AC3 con rol socio listarMultas y marcarMultaPagada dan E_ACCESO_NO_PERMITIDO y la multa sigue Pendiente', async () => {
    sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
    const rechazo = await fallo(() => listarMultas(e.ctx(pablo())));
    expect(rechazo.codigo).toBe('E_ACCESO_NO_PERMITIDO');
    expect(rechazo.message).toBe('Acceso no permitido');
    expect((await fallo(() => marcarMultaPagada(e.ctx(pablo()), { multaId: 1 }))).codigo).toBe('E_ACCESO_NO_PERMITIDO');
    expect(multas()[0]).toMatchObject({ estado: 'Pendiente', pagadaEl: null });
  });

  it('AC-012-05 una multa inexistente da E_MULTA_NO_ENCONTRADA y no cambia nada', async () => {
    sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
    const antes = JSON.stringify(multas());
    expect((await fallo(() => marcarMultaPagada(e.ctx(marta()), { multaId: 99 }))).codigo).toBe('E_MULTA_NO_ENCONTRADA');
    expect((await fallo(() => marcarMultaPagada(e.ctx(marta()), { multaId: 'x' }))).codigo).toBe('E_DATOS_INVALIDOS');
    expect(JSON.stringify(multas())).toBe(antes);
  });

  it('AC-012-06 con el almacén caído da E_ALMACEN_NO_DISPONIBLE y la multa sigue Pendiente', async () => {
    sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
    const sid = marta();
    e.caer();
    expect((await fallo(() => marcarMultaPagada(e.ctx(sid), { multaId: 1 }))).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    e.caer(false);
    expect(multas()[0]).toMatchObject({ estado: 'Pendiente', pagadaEl: null });
  });
});

describe('API-003-07 listarMultas (UC-012)', () => {
  it('lista todas las multas con el nombre del socio, el importe sin formatear y las Pendiente primero', () => {
    sembrarMulta(e, 'lucia@club.test', { importeEur: 2, estado: 'Pagada' });
    sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
    expect(listarMultas(e.ctx(marta()))).toEqual([
      { id: 2, socio: 'Pablo Ruiz', importeEur: 6, estado: 'Pendiente', pagadaEl: null },
      { id: 1, socio: 'Lucía Gil', importeEur: 2, estado: 'Pagada', pagadaEl: null },
    ]);
  });

  it('sin multas devuelve una lista vacía', () => {
    expect(listarMultas(e.ctx(marta()))).toEqual([]);
  });
});
