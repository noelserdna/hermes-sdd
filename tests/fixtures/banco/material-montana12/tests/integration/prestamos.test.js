import { describe, it, expect, beforeEach } from 'vitest';
import { crearApp } from '../../src/server/app.js';
import { crearAlmacenMemoria } from '../../src/server/store/almacen-memoria.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';
import { crearManejador } from '../../src/server/http/rutas.js';
import { datosSemilla, SEMILLA_FASE_1 } from '../../demo/sembrar.mjs';

// Hoy es 2026-11-22. Los criterios con pantalla (AC-007-01..09, AC-008-01..04, AC-009-01..02) los prueba el recorrido
// e2e con su captura (tests/e2e/fase-1.spec.js); aquí va la lógica que no se ve: orden, almacén, propiedad, roles.
const HOY = '2026-11-22';
let app, http;
const s = {};
const idCookie = (r) => `mm_sesion=${/mm_sesion=([^;]+)/.exec(r.cabeceras['Set-Cookie'])[1]}`;

async function montar(opciones = {}) {
  app = crearApp({ store: crearAlmacenMemoria(await datosSemilla({ hoy: HOY, ...opciones })), reloj: crearRelojManual('2026-11-22T10:00:00Z') });
  http = crearManejador(app);
  const entrar = async (correo, contrasena) => idCookie(await http({ metodo: 'POST', ruta: '/api/entrar', cuerpo: { correo, contrasena } }));
  s.lucia = await entrar('lucia@club.test', 'Cumbre2026!');
  s.pablo = await entrar('pablo@club.test', 'Piolet2026!');
  s.elena = await entrar('elena@club.test', 'Junta2026!');
  if (opciones.cuentas?.some((c) => c.correo === 'marta@club.test')) s.marta = await entrar('marta@club.test', 'Marta2026!');
}
const idMaterial = async (nombre) => (await app.store.leer()).material.find((m) => m.name === nombre).id;
const reservar = async (cuerpo, cookie = s.lucia) => http({ metodo: 'POST', ruta: '/api/reservas', cuerpo: { materialId: await idMaterial('Casco'), cantidad: 1, inicio: '2026-12-05', fin: '2026-12-07', ...cuerpo }, cookie });
const reservas = async () => (await app.store.leer()).reservas;

beforeEach(() => montar({ reservas: [] }));

describe('API-002-01 reserve (UC-007)', () => {
  it('crea una reserva Reservada de la cuenta de la sesión y responde con su texto', async () => {
    const r = await reservar({ cantidad: 2 });
    expect(r.estado).toBe(200);
    expect(r.cuerpo.mensaje).toBe('Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07');
    const [guardada] = await reservas();
    expect(guardada).toMatchObject({ quantity: 2, startDate: '2026-12-05', endDate: '2026-12-07', status: 'Reservada', deliveredOn: null, returnedOn: null });
    expect(guardada.accountId).toBe((await app.store.leer()).cuentas.find((c) => c.email === 'lucia@club.test').id);
  });

  it('INV-RES-004 las unidades se cuentan por día: un día intermedio lleno se cita aunque el primero esté libre', async () => {
    await montar({ reservas: [{ socio: 'pablo@club.test', material: 'Casco', cantidad: 3, inicio: '2026-12-06', fin: '2026-12-06' }] });
    const r = await reservar({ cantidad: 1 });
    expect(r.estado).toBe(409);
    expect(r.cuerpo.error).toEqual({ codigo: 'E_SIN_UNIDADES', mensaje: 'No hay unidades libres: solo queda 0 de Casco el 2026-12-06' });
    expect(await reservas()).toHaveLength(1);
  });

  it('INV-RES-005 una Cancelada no ocupa unidades y una Prestada vencida ocupa hasta hoy', async () => {
    await montar({ reservas: [
      { socio: 'pablo@club.test', material: 'Casco', cantidad: 3, inicio: '2026-12-05', fin: '2026-12-07', estado: 'Cancelada' },
      { socio: 'pablo@club.test', material: 'Casco', cantidad: 1, inicio: '2026-11-18', fin: '2026-11-20', estado: 'Prestada' },
    ] });
    expect((await reservar({ cantidad: 3 })).estado).toBe(200);
    const hoy = await reservar({ cantidad: 3, inicio: HOY, fin: HOY });
    expect(hoy.cuerpo.error.mensaje).toBe('No hay unidades libres: solo queda 2 de Casco el 2026-11-22');
  });

  it('RN-012 el mismo formulario repetido con unidades de sobra crea una segunda reserva; sin ellas no duplica', async () => {
    await reservar({ cantidad: 1 });
    expect((await reservar({ cantidad: 1 })).estado).toBe(200);
    expect(await reservas()).toHaveLength(2);
    const tercera = await reservar({ cantidad: 2 });
    expect(tercera.cuerpo.error.codigo).toBe('E_SIN_UNIDADES');
    expect(await reservas()).toHaveLength(2);
  });

  it('D-T-006 valida en orden: fecha pasada, fin anterior, días máximos, unidades máximas', async () => {
    const todo = { inicio: '2026-11-21', fin: '2026-11-20', cantidad: 6 };
    const codigo = async (cuerpo) => (await reservar(cuerpo)).cuerpo.error.codigo;
    expect(await codigo(todo)).toBe('E_FECHA_PASADA');
    expect(await codigo({ ...todo, inicio: '2026-12-05' })).toBe('E_FECHA_FIN_ANTERIOR');
    expect(await codigo({ ...todo, inicio: '2026-12-01', fin: '2026-12-15' })).toBe('E_MAX_DIAS');
    expect(await codigo({ ...todo, inicio: '2026-12-01', fin: '2026-12-14' })).toBe('E_MAX_UNIDADES');
    expect((await reservar({ ...todo, inicio: '2026-12-01', fin: '2026-12-14', cantidad: 3 })).estado).toBe(200);
    expect(await reservas()).toHaveLength(1);
  });

  it('INV-RES-001 empezar hoy es válido', async () => {
    expect((await reservar({ inicio: HOY, fin: HOY })).estado).toBe(200);
  });

  it('RN-034 cantidad no entera o menor que 1, o fecha vacía o no válida: error y nada guardado', async () => {
    for (const cantidad of [0, -1, 1.5, null, 'dos']) expect((await reservar({ cantidad })).cuerpo.error.codigo).toBe('E_CANTIDAD_INVALIDA');
    for (const inicio of ['', undefined, '2026-13-40', 'mañana']) expect((await reservar({ inicio })).cuerpo.error).toEqual({ codigo: 'E_FECHA_INVALIDA', mensaje: 'Elige una fecha válida' });
    expect((await reservar({ materialId: 'm-no-existe' })).cuerpo.error.codigo).toBe('E_MATERIAL_NO_ENCONTRADO');
    expect(await reservas()).toHaveLength(0);
  });

  it('INV-MUL-002 la multa Pendiente propia bloquea antes que cualquier otra validación; la de otro socio, una pagada o ninguna no', async () => {
    await montar({ ...SEMILLA_FASE_1, multas: [{ socio: 'marta@club.test', importe: 6 }, { socio: 'pablo@club.test', importe: 3, estado: 'Pagada' }] });
    const bloqueada = await reservar({ inicio: '2026-11-01' }, s.marta);
    expect(bloqueada.estado).toBe(409);
    expect(bloqueada.cuerpo.error).toEqual({ codigo: 'E_MULTA_PENDIENTE', mensaje: 'No puedes reservar hasta pagar tu multa de 6 €' });
    expect((await reservar({}, s.lucia)).estado).toBe(200);
    expect(await reservas()).toHaveLength(1);
  });

  it('INV-MUL-002 las reservas ya hechas siguen cuando aparece una multa', async () => {
    await reservar({ cantidad: 2 });
    await app.store.transaccion((d) => { d.multas.push({ id: 'f-9', accountId: d.reservas[0].accountId, reservationId: null, lateDays: 1, amountEur: 2, status: 'Pendiente', createdOn: HOY, paidOn: null }); });
    expect((await reservar({})).cuerpo.error.mensaje).toBe('No puedes reservar hasta pagar tu multa de 2 €');
    expect(await reservas()).toHaveLength(1);
  });

  it('ADR-001 dos peticiones a la vez por la última unidad: solo una reserva se crea (una transacción cada una)', async () => {
    await montar({ reservas: [{ socio: 'pablo@club.test', material: 'Casco', cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' }] });
    const [a, b] = await Promise.all([reservar({}), reservar({})]);
    expect([a.estado, b.estado].sort()).toEqual([200, 409]);
    expect(await reservas()).toHaveLength(2);
  });

  it('un fallo de escritura no deja reserva a medias', async () => {
    app.store.fallarEscritura = true;
    const r = await reservar({});
    expect(r.estado).toBe(503);
    app.store.fallarEscritura = false;
    expect(await reservas()).toHaveLength(0);
  });

  it('INV-MAT-003 un tipo sin unidades no admite reservas (solo queda 0)', async () => {
    const r = await reservar({ materialId: await idMaterial('Cuerda') });
    expect(r.cuerpo.error.mensaje).toBe('No hay unidades libres: solo queda 0 de Cuerda el 2026-12-05');
    expect(await reservas()).toHaveLength(0);
  });

  it('AC-007-11 solo el socio reserva: encargado y junta reciben E_ACCESO_DENEGADO y sin sesión se pide entrar', async () => {
    for (const cookie of [s.pablo, s.elena]) {
      const r = await reservar({}, cookie);
      expect(r.estado).toBe(403);
      expect(r.cuerpo.error.codigo).toBe('E_ACCESO_DENEGADO');
    }
    expect((await reservar({}, null)).estado).toBe(401);
    expect(await reservas()).toHaveLength(0);
  });
});

const mis = (cookie = s.lucia) => http({ metodo: 'GET', ruta: '/api/mis-reservas', cookie });

describe('API-002-02 listMyReservations (UC-008)', () => {
  const R = (socio, material, cantidad, inicio, fin, estado = 'Reservada') => ({ socio, material, cantidad, inicio, fin, estado });

  it('INV-RES-010 devuelve solo las filas de la sesión, ordenadas por inicio, con cantidad, material, fechas y estado', async () => {
    await montar({ reservas: [
      R('lucia@club.test', 'Casco', 2, '2026-12-10', '2026-12-11'),
      R('pablo@club.test', 'Casco', 1, '2026-12-01', '2026-12-02'),
      R('lucia@club.test', 'Cuerda', 1, '2026-12-05', '2026-12-06'),
    ], material: [{ nombre: 'Casco', total: 3 }, { nombre: 'Cuerda', total: 2 }] });
    const r = await mis();
    expect(r.estado).toBe(200);
    expect(r.cuerpo.reservas.map((f) => [f.cantidad, f.material, f.inicio, f.fin, f.estado])).toEqual([
      [1, 'Cuerda', '2026-12-05', '2026-12-06', 'Reservada'],
      [2, 'Casco', '2026-12-10', '2026-12-11', 'Reservada'],
    ]);
    expect(JSON.stringify(r.cuerpo)).not.toContain('accountId');
  });

  it('ADR-002 el estado sale derivado: una Reservada ya vencida es «No recogida» y las demás se quedan como están', async () => {
    await montar({ reservas: [
      R('lucia@club.test', 'Casco', 1, '2026-11-10', '2026-11-12'),
      R('lucia@club.test', 'Casco', 1, '2026-11-01', '2026-11-03', 'Devuelta'),
      R('lucia@club.test', 'Casco', 1, '2026-11-20', '2026-11-23', 'Prestada'),
      R('lucia@club.test', 'Casco', 1, '2026-12-20', '2026-12-21', 'Cancelada'),
    ] });
    expect((await mis()).cuerpo.reservas.map((f) => f.estado)).toEqual(['Devuelta', 'No recogida', 'Prestada', 'Cancelada']);
  });

  it('INV-RES-006 solo una Reservada que empieza después de hoy se puede cancelar; las demás llevan su motivo', async () => {
    await montar({ reservas: [
      R('lucia@club.test', 'Casco', 1, '2026-12-05', '2026-12-06'),
      R('lucia@club.test', 'Casco', 1, '2026-11-22', '2026-11-23'),
      R('lucia@club.test', 'Casco', 1, '2026-11-20', '2026-11-24'),
      R('lucia@club.test', 'Casco', 1, '2026-12-08', '2026-12-09', 'Cancelada'),
      R('lucia@club.test', 'Casco', 1, '2026-11-01', '2026-11-02'),
    ] });
    const filas = (await mis()).cuerpo.reservas;
    expect(filas.map((f) => [f.inicio, f.cancelable, f.motivo])).toEqual([
      ['2026-11-01', false, null],
      ['2026-11-20', false, 'No se puede cancelar: ya ha empezado'],
      ['2026-11-22', false, 'No se puede cancelar: empieza hoy'],
      ['2026-12-05', true, null],
      ['2026-12-08', false, null],
    ]);
  });

  it('sin reservas devuelve la lista vacía con el texto «Aún no tienes reservas» y no cambia nada', async () => {
    await montar({ reservas: [R('pablo@club.test', 'Casco', 1, '2026-12-01', '2026-12-02')] });
    const antes = JSON.stringify(await app.store.leer());
    const r = await mis();
    expect(r.cuerpo).toEqual({ reservas: [], mensaje: 'Aún no tienes reservas' });
    expect(JSON.stringify(await app.store.leer())).toBe(antes);
  });

  it('AC-008-05 encargado y junta reciben E_ACCESO_DENEGADO y sin sesión se pide entrar', async () => {
    for (const cookie of [s.pablo, s.elena]) {
      const r = await mis(cookie);
      expect(r.estado).toBe(403);
      expect(r.cuerpo.error.codigo).toBe('E_ACCESO_DENEGADO');
      expect(r.cuerpo.reservas).toBeUndefined();
    }
    expect((await mis(null)).estado).toBe(401);
  });
});

const cancelar = (id, cookie = s.lucia) => http({ metodo: 'POST', ruta: `/api/reservas/${id}/cancelar`, cuerpo: {}, cookie });
const unaReserva = async (cuerpo, cookie = s.lucia) => (await reservar(cuerpo, cookie)).cuerpo.id;

describe('API-002-03 cancelReservation (UC-009)', () => {
  it('INV-RES-005 cancelar una reserva futura responde «Reserva cancelada», la pasa a Cancelada y libera sus unidades', async () => {
    const id = await unaReserva({ cantidad: 2 });
    expect((await reservar({ cantidad: 2 })).cuerpo.error.mensaje).toBe('No hay unidades libres: solo queda 1 de Casco el 2026-12-05');
    const r = await cancelar(id);
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({ mensaje: 'Reserva cancelada' });
    expect((await reservas()).find((x) => x.id === id).status).toBe('Cancelada');
    expect((await reservar({ cantidad: 3 })).estado).toBe(200);
  });

  it('ADR-005 INV-RES-009 cancelar otra vez responde 200 con un aviso y no cambia el almacén ni libera dos veces', async () => {
    const id = await unaReserva({ cantidad: 2 });
    await cancelar(id);
    const antes = JSON.stringify(await app.store.leer());
    const otra = await cancelar(id);
    expect(otra.estado).toBe(200);
    expect(otra.cuerpo).toEqual({ aviso: { codigo: 'E_YA_CANCELADA', mensaje: 'La reserva ya estaba cancelada' } });
    expect(JSON.stringify(await app.store.leer())).toBe(antes);
  });

  it('AC-009-03 una reserva que empieza hoy no se cancela: E_EMPIEZA_HOY y sigue Reservada', async () => {
    const id = await unaReserva({ inicio: HOY, fin: '2026-11-23' });
    const r = await cancelar(id);
    expect(r.estado).toBe(409);
    expect(r.cuerpo.error).toEqual({ codigo: 'E_EMPIEZA_HOY', mensaje: 'No se puede cancelar: empieza hoy' });
    expect((await reservas())[0].status).toBe('Reservada');
  });

  it('AC-009-04 una reserva que ya empezó no se cancela: E_YA_EMPEZADA y nada cambia', async () => {
    await montar({ reservas: [
      { socio: 'lucia@club.test', material: 'Casco', cantidad: 1, inicio: '2026-11-20', fin: '2026-11-25' },
      { socio: 'lucia@club.test', material: 'Casco', cantidad: 1, inicio: '2026-11-20', fin: '2026-11-25', estado: 'Prestada' },
    ] });
    const antes = JSON.stringify(await app.store.leer());
    for (const id of ['r-1', 'r-2']) {
      const r = await cancelar(id);
      expect(r.estado).toBe(409);
      expect(r.cuerpo.error).toEqual({ codigo: 'E_YA_EMPEZADA', mensaje: 'No se puede cancelar: ya ha empezado' });
    }
    expect(JSON.stringify(await app.store.leer())).toBe(antes);
  });

  it('AC-009-05 INV-RES-010 la reserva de otro socio, una inexistente y un rol que no es socio se rechazan igual y sin cambios', async () => {
    const id = await unaReserva({ cantidad: 2 }, s.lucia);
    await montar({ reservas: [{ socio: 'pablo@club.test', material: 'Casco', cantidad: 1, inicio: '2026-12-05', fin: '2026-12-06' }] });
    const antes = JSON.stringify(await app.store.leer());
    const ajena = await cancelar('r-1', s.lucia);
    const inexistente = await cancelar(id, s.lucia);
    expect(ajena.estado).toBe(403);
    expect(ajena.cuerpo).toEqual(inexistente.cuerpo);
    expect(ajena.cuerpo.error.codigo).toBe('E_ACCESO_DENEGADO');
    for (const cookie of [s.pablo, s.elena]) expect((await cancelar('r-1', cookie)).cuerpo.error.codigo).toBe('E_ACCESO_DENEGADO');
    expect((await cancelar('r-1', null)).estado).toBe(401);
    expect(JSON.stringify(await app.store.leer())).toBe(antes);
  });
});
