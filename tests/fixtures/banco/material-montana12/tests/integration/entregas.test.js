import { describe, it, expect, beforeEach } from 'vitest';
import { crearApp } from '../../src/server/app.js';
import { crearAlmacenMemoria } from '../../src/server/store/almacen-memoria.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';
import { crearManejador } from '../../src/server/http/rutas.js';
import { datosSemilla } from '../../demo/sembrar.mjs';

// Los criterios con pantalla de entregar y devolver (AC-010-01..03, AC-011-01..04) los prueba el recorrido e2e con su captura
// (tests/e2e/fase-2.spec.js), también AC-010-04 (lo que se ve: «No recogida»). Aquí va lo que no se ve en pantalla: los errores, el almacén y los roles.
const LUCIA_CASCO = { socio: 'lucia@club.test', material: 'Casco', cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' };
let app, http, reloj;
const s = {};
const idCookie = (r) => `mm_sesion=${/mm_sesion=([^;]+)/.exec(r.cabeceras['Set-Cookie'])[1]}`;

/** `hoy` es el día del GIVEN; `reservas` se siembran con su estado (Reservada, Prestada, Cancelada…). */
async function montar({ hoy = '2026-12-05', reservas = [LUCIA_CASCO] } = {}) {
  reloj = crearRelojManual(`${hoy}T10:00:00Z`);
  const datos = await datosSemilla({ hoy, reservas });
  app = crearApp({ store: crearAlmacenMemoria(datos), reloj });
  http = crearManejador(app);
  const entrar = async (correo, contrasena) => idCookie(await http({ metodo: 'POST', ruta: '/api/entrar', cuerpo: { correo, contrasena } }));
  s.lucia = await entrar('lucia@club.test', 'Cumbre2026!');
  s.pablo = await entrar('pablo@club.test', 'Piolet2026!');
  s.elena = await entrar('elena@club.test', 'Junta2026!');
}
const entregar = (id, cookie = s.pablo) => http({ metodo: 'POST', ruta: `/api/reservas/${id}/entregar`, cuerpo: {}, cookie });
const reservas = async () => (await app.store.leer()).reservas;
const multas = async () => (await app.store.leer()).multas;

describe('API-002-04 deliverReservation (UC-010)', () => {
  beforeEach(() => montar());

  it('INV-RES-007 entregar una reserva de hoy la pasa a Prestada, guarda deliveredOn y responde con el texto de la entrega', async () => {
    const r = await entregar('r-1');
    expect(r.estado).toBe(200);
    expect(r.cuerpo.mensaje).toBe('Entregado: 2 × Casco a Lucía');
    expect(r.cabeceras['Cache-Control']).toBe('no-store');
    expect((await reservas())[0]).toMatchObject({ status: 'Prestada', deliveredOn: '2026-12-05', returnedOn: null });
  });

  it('INV-RES-009 repetir la entrega avisa «Ya estaba entregada» sin cambiar nada ni duplicar el préstamo', async () => {
    await entregar('r-1');
    const antes = await reservas();
    const r = await entregar('r-1');
    expect(r.estado).toBe(200);
    expect(r.cuerpo.aviso).toEqual({ codigo: 'E_YA_ENTREGADA', mensaje: 'Ya estaba entregada' });
    expect(await reservas()).toEqual(antes);
  });

  it('INV-RES-007 antes de la fecha de inicio no se entrega y la reserva sigue Reservada', async () => {
    await montar({ reservas: [{ ...LUCIA_CASCO, inicio: '2026-12-10', fin: '2026-12-12' }] });
    const r = await entregar('r-1');
    expect(r.estado).toBe(409);
    expect(r.cuerpo.error).toEqual({ codigo: 'E_ANTES_DE_INICIO', mensaje: 'No se puede entregar antes de la fecha de inicio' });
    expect((await reservas())[0]).toMatchObject({ status: 'Reservada', deliveredOn: null });
  });

  it('INV-RES-008 una reserva que acabó el 2026-12-07 sin recoger, el 2026-12-08 no se entrega, no genera multa y sus unidades siguen libres', async () => {
    await montar({ hoy: '2026-12-08' });
    const r = await entregar('r-1');
    expect(r.estado).toBe(409);
    expect(r.cuerpo.error).toEqual({ codigo: 'E_NO_RECOGIDA', mensaje: 'No recogida' });
    expect((await reservas())[0].status).toBe('Reservada');
    // sus unidades están libres: se pueden reservar los 3 Casco de nuevo para esos días… y para hoy
    const material = (await app.store.leer()).material.find((m) => m.name === 'Casco');
    const reservar = await http({ metodo: 'POST', ruta: '/api/reservas', cookie: s.lucia, cuerpo: { materialId: material.id, cantidad: 3, inicio: '2026-12-08', fin: '2026-12-09' } });
    expect(reservar.estado).toBe(200);
    expect(await multas()).toEqual([]);
  });

  // AC-010-05: «When el encargado entrega una reserva que no existe Then error E_RESERVA_NO_ENCONTRADA, sin cambios»
  it('AC-010-05 una reserva que no existe da E_RESERVA_NO_ENCONTRADA y no cambia nada', async () => {
    const antes = await reservas();
    const r = await entregar('r-99');
    expect(r.estado).toBe(404);
    expect(r.cuerpo.error).toEqual({ codigo: 'E_RESERVA_NO_ENCONTRADA', mensaje: 'La reserva no existe' });
    expect(await reservas()).toEqual(antes);
  });

  // AC-010-06: «When un socio o la junta intenta entregar Then error E_ACCESO_DENEGADO, sin cambios»
  it('AC-010-06 un socio y la junta reciben E_ACCESO_DENEGADO y la reserva sigue Reservada', async () => {
    for (const cookie of [s.lucia, s.elena]) {
      const r = await entregar('r-1', cookie);
      expect(r.estado).toBe(403);
      expect(r.cuerpo.error).toEqual({ codigo: 'E_ACCESO_DENEGADO', mensaje: 'Acceso denegado' });
    }
    expect((await reservas())[0]).toMatchObject({ status: 'Reservada', deliveredOn: null });
  });

  // AC-010-07: «Given la reserva está Cancelada When el encargado pulsa "Entregar" Then error E_RESERVA_NO_ENTREGABLE, sin cambios»
  it('AC-010-07 una reserva Cancelada o Devuelta da E_RESERVA_NO_ENTREGABLE y no cambia', async () => {
    for (const estado of ['Cancelada', 'Devuelta']) {
      await montar({ reservas: [{ ...LUCIA_CASCO, estado }] });
      const antes = await reservas();
      const r = await entregar('r-1');
      expect(r.estado).toBe(409);
      expect(r.cuerpo.error.codigo).toBe('E_RESERVA_NO_ENTREGABLE');
      expect(r.cuerpo.error.mensaje).toBe('Solo se puede entregar una reserva pendiente');
      expect(await reservas()).toEqual(antes);
    }
  });

  it('INV-SEC-003 sin sesión la entrega pide entrar', async () => {
    const r = await http({ metodo: 'POST', ruta: '/api/reservas/r-1/entregar', cuerpo: {} });
    expect(r.estado).toBe(401);
  });
});

const PRESTADA = { ...LUCIA_CASCO, estado: 'Prestada' };
const devolver = (id, cookie = s.pablo) => http({ metodo: 'POST', ruta: `/api/reservas/${id}/devolver`, cuerpo: {}, cookie });

describe('API-002-05 returnLoan (UC-011)', () => {
  it('INV-MUL-004 devuelta a tiempo cierra el préstamo con returnedOn y no crea multa', async () => {
    await montar({ hoy: '2026-12-07', reservas: [PRESTADA] });
    const r = await devolver('r-1');
    expect(r.estado).toBe(200);
    expect(r.cuerpo.mensaje).toBe('Devuelto a tiempo');
    expect((await reservas())[0]).toMatchObject({ status: 'Devuelta', returnedOn: '2026-12-07' });
    expect(await multas()).toEqual([]);
  });

  it('INV-MUL-001 INV-MUL-004 con 3 días de retraso crea una multa Pendiente de FINE_PER_DAY_EUR × 3 en la misma operación', async () => {
    await montar({ hoy: '2026-12-10', reservas: [PRESTADA] });
    const r = await devolver('r-1');
    expect(r.cuerpo.mensaje).toBe('Devuelto con 3 días de retraso: multa de 6 €');
    const [multa] = await multas();
    expect(multa).toMatchObject({ reservationId: 'r-1', lateDays: 3, amountEur: 2 * 3, status: 'Pendiente', createdOn: '2026-12-10', paidOn: null });
    expect(multa.accountId).toBe((await reservas())[0].accountId);
    expect((await reservas())[0]).toMatchObject({ status: 'Devuelta', returnedOn: '2026-12-10' });
  });

  it('RN-015 con 1 día de retraso el mensaje va en singular y la multa es de FINE_PER_DAY_EUR × 1', async () => {
    await montar({ hoy: '2026-12-08', reservas: [PRESTADA] });
    const r = await devolver('r-1');
    expect(r.cuerpo.mensaje).toBe('Devuelto con 1 día de retraso: multa de 2 €');
    expect((await multas()).map((m) => m.amountEur)).toEqual([2]);
  });

  it('ADR-005 INV-MUL-001 devolver otra vez avisa «Ya estaba devuelta» y deja una sola multa del mismo importe', async () => {
    await montar({ hoy: '2026-12-10', reservas: [PRESTADA] });
    await devolver('r-1');
    const antes = { reservas: await reservas(), multas: await multas() };
    const r = await devolver('r-1');
    expect(r.estado).toBe(200);
    expect(r.cuerpo.aviso).toEqual({ codigo: 'E_YA_DEVUELTA', mensaje: 'Ya estaba devuelta' });
    expect({ reservas: await reservas(), multas: await multas() }).toEqual(antes);
  });

  it('INV-MUL-001 si la escritura falla no queda ni devolución ni multa (una sola transacción)', async () => {
    await montar({ hoy: '2026-12-10', reservas: [PRESTADA] });
    app.store.fallarEscritura = true;
    const r = await devolver('r-1');
    expect(r.estado).toBe(503);
    app.store.fallarEscritura = false;
    expect((await reservas())[0].status).toBe('Prestada');
    expect(await multas()).toEqual([]);
  });

  // AC-011-05: «Given la reserva está Reservada When el encargado pulsa "Devolver" Then error E_NO_PRESTADA, sin cambios y sin multa»
  it('AC-011-05 devolver una Reservada o una Cancelada da E_NO_PRESTADA, sin cambios y sin multa', async () => {
    for (const estado of ['Reservada', 'Cancelada']) {
      await montar({ hoy: '2026-12-10', reservas: [{ ...LUCIA_CASCO, estado }] });
      const antes = await reservas();
      const r = await devolver('r-1');
      expect(r.estado).toBe(409);
      expect(r.cuerpo.error).toEqual({ codigo: 'E_NO_PRESTADA', mensaje: 'No se puede devolver: la reserva no está entregada' });
      expect(await reservas()).toEqual(antes);
      expect(await multas()).toEqual([]);
    }
  });

  // AC-011-06: «When el encargado devuelve una reserva que no existe Then error E_RESERVA_NO_ENCONTRADA, sin cambios»
  it('AC-011-06 una reserva que no existe da E_RESERVA_NO_ENCONTRADA y no cambia nada', async () => {
    await montar({ reservas: [PRESTADA] });
    const r = await devolver('r-99');
    expect(r.estado).toBe(404);
    expect(r.cuerpo.error).toEqual({ codigo: 'E_RESERVA_NO_ENCONTRADA', mensaje: 'La reserva no existe' });
    expect((await reservas())[0].status).toBe('Prestada');
  });

  // AC-011-07: «When un socio o la junta intenta devolver Then error E_ACCESO_DENEGADO, sin cambios»
  it('AC-011-07 un socio y la junta reciben E_ACCESO_DENEGADO y el préstamo sigue abierto', async () => {
    await montar({ hoy: '2026-12-10', reservas: [PRESTADA] });
    for (const cookie of [s.lucia, s.elena]) {
      const r = await devolver('r-1', cookie);
      expect(r.estado).toBe(403);
      expect(r.cuerpo.error.codigo).toBe('E_ACCESO_DENEGADO');
    }
    expect((await reservas())[0].status).toBe('Prestada');
    expect(await multas()).toEqual([]);
  });
});
