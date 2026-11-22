import { describe, it, expect } from 'vitest';
import { crearApp } from '../../src/server/app.js';
import { crearAlmacenMemoria } from '../../src/server/store/almacen-memoria.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';
import { crearManejador } from '../../src/server/http/rutas.js';
import { datosSemilla } from '../../demo/sembrar.mjs';

// Lo que se ve en el panel (AC-017-01..09) lo prueba el recorrido e2e con su captura (tests/e2e/fase-2.spec.js).
// Aquí va el cálculo de las listas, la fecha elegida, los roles y que abrir el panel no cambia nada.
const LUCIA = 'lucia@club.test';
const CASCO = { socio: LUCIA, material: 'Casco', cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' };
const s = {};
let app, http;
const idCookie = (r) => `mm_sesion=${/mm_sesion=([^;]+)/.exec(r.cabeceras['Set-Cookie'])[1]}`;

async function montar({ hoy, reservas, multas = [] }) {
  const datos = await datosSemilla({ hoy, reservas, multas, material: [{ nombre: 'Casco', total: 5 }] });
  app = crearApp({ store: crearAlmacenMemoria(datos), reloj: crearRelojManual(`${hoy}T10:00:00Z`) });
  http = crearManejador(app);
  const entrar = async (correo, contrasena) => idCookie(await http({ metodo: 'POST', ruta: '/api/entrar', cuerpo: { correo, contrasena } }));
  s.lucia = await entrar(LUCIA, 'Cumbre2026!');
  s.pablo = await entrar('pablo@club.test', 'Piolet2026!');
  s.elena = await entrar('elena@club.test', 'Junta2026!');
}
const panel = (consulta = {}, cookie = s.pablo) => http({ metodo: 'GET', ruta: '/api/panel', consulta, cookie });
const ids = (lista) => lista.map((f) => f.id);

describe('API-002-06 getPanel (UC-017)', () => {
  it('RN-018 reparte por entregar (Reservada con inicio ≤ hoy ≤ fin), vuelven hoy (Prestada con fin = hoy) y el resto de prestadas', async () => {
    await montar({ hoy: '2026-12-07', reservas: [
      { ...CASCO, inicio: '2026-12-06' },                                    // r-1 por entregar (hoy dentro)
      { ...CASCO, inicio: '2026-12-09', fin: '2026-12-10' },                 // r-2 futura: no sale
      { ...CASCO, estado: 'Prestada' },                                      // r-3 fin hoy: vuelve hoy
      { ...CASCO, estado: 'Prestada', fin: '2026-12-12' },                   // r-4 prestada
      { ...CASCO, estado: 'Cancelada' }, { ...CASCO, estado: 'Devuelta' },   // r-5, r-6 no salen
    ] });
    const r = await panel();
    expect(r.estado).toBe(200);
    expect(r.cabeceras['Cache-Control']).toBe('no-store');
    expect(r.cuerpo).toMatchObject({ hoy: '2026-12-07', fecha: '2026-12-07' });
    expect(ids(r.cuerpo.porEntregar)).toEqual(['r-1']);
    expect(ids(r.cuerpo.vuelven)).toEqual(['r-3']);
    expect(ids(r.cuerpo.prestados)).toEqual(['r-4']);
    expect(r.cuerpo.porEntregar[0]).toEqual({ id: 'r-1', cantidad: 2, material: 'Casco', socio: 'Lucía', inicio: '2026-12-06', fin: '2026-12-07', retraso: 0 });
    expect(r.cuerpo.mensaje).toBeUndefined();
  });

  it('RN-018 con una fecha elegida «vuelven» se recalcula para ese día y el préstamo no sale repetido en «prestados»', async () => {
    await montar({ hoy: '2026-12-05', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    const hoy = await panel();
    expect(ids(hoy.cuerpo.prestados)).toEqual(['r-1']);
    expect(hoy.cuerpo.vuelven).toEqual([]);
    const elegida = await panel({ fecha: '2026-12-07' });
    expect(elegida.cuerpo.fecha).toBe('2026-12-07');
    expect(ids(elegida.cuerpo.vuelven)).toEqual(['r-1']);
    expect(elegida.cuerpo.prestados).toEqual([]);
  });

  it('RN-032 una fecha vacía o no válida da E_FECHA_INVALIDA y no cambia nada', async () => {
    await montar({ hoy: '2026-12-05', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    for (const fecha of ['', '2026-13-45', 'mañana']) {
      const r = await panel({ fecha });
      expect(r.estado).toBe(400);
      expect(r.cuerpo.error).toEqual({ codigo: 'E_FECHA_INVALIDA', mensaje: 'Elige una fecha válida' });
    }
  });

  it('INV-MUL-004 ADR-004 marca el retraso en días desde hoy y abrir el panel no crea ninguna multa', async () => {
    await montar({ hoy: '2026-12-10', reservas: [{ ...CASCO, estado: 'Prestada' }, { ...CASCO, estado: 'Prestada', fin: '2026-12-09' }] });
    const antes = await app.store.leer();
    const r = await panel();
    expect(r.cuerpo.prestados.map((f) => [f.id, f.retraso])).toEqual([['r-1', 3], ['r-2', 1]]);
    expect(r.cuerpo.multas).toEqual([]);
    expect(await app.store.leer()).toEqual(antes);
  });

  it('AC-010-04 RN-029 ADR-002 una Reservada con fin pasado sale en «noRecogidas» (hasta 7 días), sin multa, sin multa y sin cambiar nada', async () => {
    await montar({ hoy: '2026-12-08', reservas: [
      CASCO,                                                                   // r-1 acabó el 12-07: no recogida
      { ...CASCO, inicio: '2026-11-25', fin: '2026-12-01' },                   // r-2 acabó hace 7 días: aún sale
      { ...CASCO, inicio: '2026-11-20', fin: '2026-11-30' },                   // r-3 hace 8 días: ya no sale
      { ...CASCO, estado: 'Cancelada' },                                       // r-4 no es Reservada
    ] });
    const r = await panel();
    expect(r.cuerpo.noRecogidas).toEqual([
      { id: 'r-2', cantidad: 2, material: 'Casco', socio: 'Lucía', inicio: '2026-11-25', fin: '2026-12-01', retraso: 0 },
      { id: 'r-1', cantidad: 2, material: 'Casco', socio: 'Lucía', inicio: '2026-12-05', fin: '2026-12-07', retraso: 0 }]);
    expect(r.cuerpo.porEntregar).toEqual([]);
    expect(r.cuerpo.multas).toEqual([]);
    // «sus unidades están libres»: lo prueba tests/unit/disponibilidad.test.js (una No recogida no ocupa unidades)
    expect((await app.store.leer()).multas).toEqual([]);
  });

  it('sin préstamos lleva el mensaje de lista vacía', async () => {
    await montar({ hoy: '2026-12-05', reservas: [] });
    expect((await panel()).cuerpo.mensaje).toBe('No hay material prestado');
  });

  it('REQ-F-005 lista las multas Pendientes con el nombre del socio y el importe', async () => {
    await montar({ hoy: '2026-12-10', reservas: [], multas: [{ socio: LUCIA, importe: 6 }] });
    expect((await panel()).cuerpo.multas).toEqual([{ socio: 'Lucía', importe: 6, estado: 'Pendiente' }]);
  });

  it('INV-SEC-003 un socio y la junta reciben E_PAGINA_PROHIBIDA y ningún dato del panel', async () => {
    await montar({ hoy: '2026-12-05', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    for (const cookie of [s.lucia, s.elena]) {
      const r = await panel({}, cookie);
      expect(r.estado).toBe(403);
      expect(r.cuerpo).toEqual({ error: { codigo: 'E_PAGINA_PROHIBIDA', mensaje: 'No tienes permiso para ver esta página' } });
    }
  });

  it('INV-SEC-003 sin sesión el panel pide entrar', async () => {
    await montar({ hoy: '2026-12-05', reservas: [] });
    expect((await http({ metodo: 'GET', ruta: '/api/panel', cookie: undefined })).estado).toBe(401);
  });
});
