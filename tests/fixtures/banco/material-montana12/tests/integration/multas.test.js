import { describe, it, expect, beforeEach } from 'vitest';
import { crearApp } from '../../src/server/app.js';
import { crearAlmacenMemoria } from '../../src/server/store/almacen-memoria.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';
import { crearManejador } from '../../src/server/http/rutas.js';
import { datosSemilla, semillaFase4 } from '../../demo/sembrar.mjs';

// Hoy es 2026-11-22. Lo que ve cada persona en cada criterio con pantalla (AC-012-01..03, AC-013-01..03, AC-014-01) lo prueba el
// recorrido e2e con su captura (tests/e2e/fase-4-ciclo-prestamo.spec.js); aquí va lo que la pantalla no distingue: datos de
// cada operación, orden, propiedad y roles.
const HOY = '2026-11-22';
let app, http;
const s = {};
const idCookie = (r) => (r.cabeceras['Set-Cookie'] ? `mm_sesion=${/mm_sesion=([^;]+)/.exec(r.cabeceras['Set-Cookie'])[1]}` : null);

const CUENTAS = [
  { id: 'c-lucia', nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026!', rol: 'socio' },
  { id: 'c-pablo', nombre: 'Pablo Sanz', correo: 'pablo@club.test', contrasena: 'Piolet2026!', rol: 'socio' },
  { id: 'c-jorge', nombre: 'Jorge', correo: 'jorge@club.test', contrasena: 'Encargado2026!', rol: 'encargado' },
  { id: 'c-elena', nombre: 'Elena', correo: 'elena@club.test', contrasena: 'Junta2026!', rol: 'junta' },
];

async function montar(opciones = {}) {
  app = crearApp({ store: crearAlmacenMemoria(await datosSemilla({ hoy: HOY, cuentas: CUENTAS, reservas: [], ...opciones })), reloj: crearRelojManual('2026-11-22T10:00:00Z') });
  http = crearManejador(app);
  const entrar = async (correo, contrasena) => idCookie(await http({ metodo: 'POST', ruta: '/api/entrar', cuerpo: { correo, contrasena } }));
  s.lucia = await entrar('lucia@club.test', 'Cumbre2026!');
  s.pablo = await entrar('pablo@club.test', 'Piolet2026!');
  s.jorge = await entrar('jorge@club.test', 'Encargado2026!');
  s.elena = await entrar('elena@club.test', 'Junta2026!');
}
const todas = (cookie = s.jorge) => http({ metodo: 'GET', ruta: '/api/multas', cookie });
const misMultas = (cookie) => http({ metodo: 'GET', ruta: '/api/mis-multas', cookie });

beforeEach(() => montar());

describe('API-004-01 listMyFines (UC-012)', () => {
  it('semilla de la demo: Lucía devuelve su préstamo vencido hace 3 días y su multa Pendiente lleva importe y días', async () => {
    await montar({ ...semillaFase4(HOY) });
    // en la semilla de la demo el encargado es Pablo
    const devuelto = await http({ metodo: 'POST', ruta: '/api/reservas/r-1/devolver', cuerpo: {}, cookie: s.pablo });
    expect(devuelto.estado).toBe(200);
    const r = await misMultas(s.lucia);
    expect(r.estado).toBe(200);
    expect(r.cuerpo.multas).toEqual([{ id: expect.any(String), importe: 6, dias: 3, estado: 'Pendiente' }]);
    expect(r.cuerpo.mensaje).toBeUndefined();
  });

  it('una cuenta sin multas recibe la lista vacía y el mensaje «No tienes multas»', async () => {
    const r = await misMultas(s.lucia);
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({ multas: [], mensaje: 'No tienes multas' });
  });

  it('INV-SEC-001 solo salen las multas de la sesión, aunque otro socio tenga y esté pagada o pendiente', async () => {
    await montar({ multas: [{ socio: 'pablo@club.test', importe: 6 }, { socio: 'lucia@club.test', importe: 2, estado: 'Pagada' }] });
    const lucia = await misMultas(s.lucia);
    expect(lucia.cuerpo.multas.map((m) => [m.importe, m.estado])).toEqual([[2, 'Pagada']]);
    const pablo = await misMultas(s.pablo);
    expect(pablo.cuerpo.multas.map((m) => [m.importe, m.estado])).toEqual([[6, 'Pendiente']]);
  });

  it('AC-012-04 INV-SEC-001 RN-030 el encargado y la junta reciben E_PAGINA_PROHIBIDA y ninguna multa', async () => {
    await montar({ multas: [{ socio: 'pablo@club.test', importe: 6 }] });
    for (const cookie of [s.jorge, s.elena]) {
      const r = await misMultas(cookie);
      expect(r.estado).toBe(403);
      expect(r.cuerpo).toEqual({ error: { codigo: 'E_PAGINA_PROHIBIDA', mensaje: 'No tienes permiso para ver esta página' } });
    }
  });

  it('sin sesión no hay multas: pide entrar', async () => {
    const r = await misMultas(undefined);
    expect(r.estado).toBe(401);
  });
});

const pagar = (id, cookie = s.jorge) => http({ metodo: 'POST', ruta: `/api/multas/${id}/pagar`, cuerpo: {}, cookie });
const guardadas = async () => (await app.store.leer()).multas;
const reservar = async (cookie, cuerpo = {}) => http({
  metodo: 'POST', ruta: '/api/reservas', cookie,
  cuerpo: { materialId: (await app.store.leer()).material[0].id, cantidad: 1, inicio: '2026-12-10', fin: '2026-12-11', ...cuerpo },
});
const CASCO = [{ nombre: 'Casco', total: 6 }];

describe('API-004-02 payFine (UC-013)', () => {
  it('INV-MUL-003 pagar la única Pendiente la deja Pagada con paidOn de hoy y el socio vuelve a poder reservar', async () => {
    await montar({ material: CASCO, multas: [{ socio: 'pablo@club.test', importe: 6 }] });
    expect((await reservar(s.pablo)).cuerpo.error.codigo).toBe('E_MULTA_PENDIENTE');
    const r = await pagar('f-1');
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({ mensaje: 'Multa pagada', estado: 'Pagada', paidOn: HOY, bloqueado: false });
    expect(await guardadas()).toMatchObject([{ id: 'f-1', status: 'Pagada', paidOn: HOY, amountEur: 6 }]);
    expect((await reservar(s.pablo)).estado).toBe(200);
  });

  it('INV-MUL-003 D-PA-012 con otra Pendiente el bloqueo sigue y cita la que queda', async () => {
    await montar({ material: CASCO, multas: [{ socio: 'pablo@club.test', importe: 2 }, { socio: 'pablo@club.test', importe: 4 }] });
    const r = await pagar('f-2');
    expect(r.cuerpo).toMatchObject({ mensaje: 'Multa pagada', estado: 'Pagada', bloqueado: true });
    const bloqueada = await reservar(s.pablo);
    expect(bloqueada.estado).toBe(409);
    expect(bloqueada.cuerpo.error.mensaje).toBe('No puedes reservar hasta pagar tu multa de 2 €');
    await pagar('f-1');
    expect((await reservar(s.pablo)).estado).toBe(200);
  });

  it('INV-MUL-002 las reservas ya hechas siguen mientras hay una multa Pendiente, y el bloqueo no se guarda en la cuenta', async () => {
    await montar({ material: CASCO, multas: [{ socio: 'pablo@club.test', importe: 6 }],
      reservas: [{ socio: 'pablo@club.test', material: 'Casco', cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' }] });
    const antes = JSON.stringify((await app.store.leer()).cuentas);
    const mias = await http({ metodo: 'GET', ruta: '/api/mis-reservas', cookie: s.pablo });
    expect(mias.cuerpo.reservas).toMatchObject([{ cantidad: 2, material: 'Casco', estado: 'Reservada' }]);
    await pagar('f-1');
    expect(JSON.stringify((await app.store.leer()).cuentas)).toBe(antes);
  });

  it('ADR-005 repetir avisa «La multa ya estaba pagada» y deja la misma multa, con su primera fecha de pago', async () => {
    await montar({ multas: [{ socio: 'pablo@club.test', importe: 6 }] });
    await pagar('f-1');
    const antes = JSON.stringify(await guardadas());
    const r = await pagar('f-1');
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({ aviso: { codigo: 'E_MULTA_YA_PAGADA', mensaje: 'La multa ya estaba pagada' } });
    expect(JSON.stringify(await guardadas())).toBe(antes);
    expect(await guardadas()).toHaveLength(1);
  });

  it('AC-013-04 una multa que no existe da E_MULTA_NO_ENCONTRADA y no cambia nada', async () => {
    await montar({ multas: [{ socio: 'pablo@club.test', importe: 6 }] });
    const antes = JSON.stringify(await guardadas());
    const r = await pagar('f-999');
    expect(r.estado).toBe(404);
    expect(r.cuerpo).toEqual({ error: { codigo: 'E_MULTA_NO_ENCONTRADA', mensaje: 'La multa no existe' } });
    expect(JSON.stringify(await guardadas())).toBe(antes);
  });

  it('AC-013-05 INV-SEC-003 un socio o la junta reciben E_ACCESO_DENEGADO y la multa sigue Pendiente', async () => {
    await montar({ multas: [{ socio: 'pablo@club.test', importe: 6 }] });
    for (const cookie of [s.pablo, s.lucia, s.elena]) {
      const r = await pagar('f-1', cookie);
      expect(r.estado).toBe(403);
      expect(r.cuerpo).toEqual({ error: { codigo: 'E_ACCESO_DENEGADO', mensaje: 'Acceso denegado' } });
    }
    expect(await guardadas()).toMatchObject([{ status: 'Pendiente', paidOn: null }]);
  });
});

describe('API-004-03 listFines (UC-014)', () => {
  it('UC-014 el encargado recibe todas las multas con el nombre del socio, importe, estado e id, de la más antigua a la más reciente', async () => {
    await montar({ multas: [{ socio: 'pablo@club.test', importe: 6 }, { socio: 'lucia@club.test', importe: 2, estado: 'Pagada' }] });
    const r = await todas();
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({ multas: [
      { id: 'f-1', socio: 'Pablo Sanz', importe: 6, estado: 'Pendiente' },
      { id: 'f-2', socio: 'Lucía Gil', importe: 2, estado: 'Pagada' }] });
  });

  it('RN-031 sin multas responde la lista vacía con «No hay multas»', async () => {
    expect((await todas()).cuerpo).toEqual({ multas: [], mensaje: 'No hay multas' });
  });

  it('AC-014-02 INV-SEC-003 un socio o la junta reciben E_PAGINA_PROHIBIDA y ninguna multa', async () => {
    await montar({ multas: [{ socio: 'pablo@club.test', importe: 6 }] });
    for (const cookie of [s.pablo, s.elena]) {
      const r = await todas(cookie);
      expect(r.estado).toBe(403);
      expect(r.cuerpo).toEqual({ error: { codigo: 'E_PAGINA_PROHIBIDA', mensaje: 'No tienes permiso para ver esta página' } });
    }
  });
});
