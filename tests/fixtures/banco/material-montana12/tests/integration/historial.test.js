import { describe, it, expect, beforeEach } from 'vitest';
import { crearApp } from '../../src/server/app.js';
import { crearAlmacenMemoria } from '../../src/server/store/almacen-memoria.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';
import { crearManejador } from '../../src/server/http/rutas.js';
import { datosSemilla, semillaFase5 } from '../../demo/sembrar.mjs';

// UC-018 · API-001-07 getMemberHistory. Lo que ve la junta en pantalla en AC-018-01..04 (REQ-F-009 AC1..AC4) lo prueba el recorrido e2e con
// su captura (tests/e2e/fase-5.spec.js); aquí van los datos de la operación, la búsqueda parcial, los varios resultados (AC-018-05), el
// rechazo de otros roles (AC-018-06) y que la respuesta no lleve nada más que lo mínimo (INV-SOC-009, INV-SEC-002).
const HOY = '2026-11-22';
let app, http;
const s = {};
const idCookie = (r) => (r.cabeceras['Set-Cookie'] ? `mm_sesion=${/mm_sesion=([^;]+)/.exec(r.cabeceras['Set-Cookie'])[1]}` : null);

const CUENTAS = [
  { id: 'c-lucia', nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026!', rol: 'socio' },
  { id: 'c-lucas', nombre: 'Lucas Gil', correo: 'lucas@club.test', contrasena: 'Cumbre2026!', rol: 'socio' },
  { id: 'c-marta', nombre: 'Marta Ruiz', correo: 'marta@club.test', contrasena: 'Marta2026!', rol: 'socio' },
  { id: 'c-jorge', nombre: 'Jorge', correo: 'jorge@club.test', contrasena: 'Encargado2026!', rol: 'encargado' },
  { id: 'c-elena', nombre: 'Elena', correo: 'elena@club.test', contrasena: 'Junta2026!', rol: 'junta' },
];

async function montar(opciones = {}) {
  app = crearApp({ store: crearAlmacenMemoria(await datosSemilla({ hoy: HOY, cuentas: CUENTAS, reservas: [], ...opciones })), reloj: crearRelojManual('2026-11-22T10:00:00Z') });
  http = crearManejador(app);
  const entrar = async (correo, contrasena) => idCookie(await http({ metodo: 'POST', ruta: '/api/entrar', cuerpo: { correo, contrasena } }));
  s.lucia = await entrar('lucia@club.test', 'Cumbre2026!');
  s.jorge = await entrar('jorge@club.test', 'Encargado2026!');
  s.elena = await entrar('elena@club.test', 'Junta2026!');
}
const buscar = (consulta, cookie = s.elena) => http({ metodo: 'GET', ruta: '/api/historial', consulta, cookie });

const LUCIA_DEVUELTA = { socio: 'lucia@club.test', material: 'Casco', cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07', estado: 'Devuelta', devueltaEl: '2026-12-09' };
const MULTA_PAGADA = { socio: 'lucia@club.test', importe: 4, estado: 'Pagada', dias: 2, creada: '2026-12-09', pagadaEl: '2026-12-09' };

beforeEach(() => montar({ material: [{ nombre: 'Casco', total: 6 }], reservas: [LUCIA_DEVUELTA], multas: [MULTA_PAGADA] }));

describe('API-001-07 getMemberHistory (UC-018)', () => {
  it('buscar «lucia» (sin tilde ni mayúscula) da un solo socio con sus préstamos y su multa pagada', async () => {
    const r = await buscar({ q: 'lucia' });
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({
      socios: [{ id: 'c-lucia', nombre: 'Lucía Gil' }],
      historial: {
        socio: { id: 'c-lucia', nombre: 'Lucía Gil', correo: 'lucia@club.test' },
        prestamos: [{ cantidad: 2, material: 'Casco', inicio: '2026-12-05', fin: '2026-12-07', devueltoEl: '2026-12-09' }],
        multas: [{ importe: 4, estado: 'Pagada' }],
      },
    });
  });

  it('RN-019 la búsqueda es parcial y vale por correo: «CLUB.TEST» encuentra a todos los socios, y solo a socios', async () => {
    const r = await buscar({ q: 'CLUB.TEST' });
    expect(r.cuerpo.socios.map((x) => x.nombre)).toEqual(['Lucas Gil', 'Lucía Gil', 'Marta Ruiz']);
    const porCorreo = await buscar({ q: 'marta@club' });
    expect(porCorreo.cuerpo.socios).toEqual([{ id: 'c-marta', nombre: 'Marta Ruiz' }]);
  });

  it('la respuesta nunca lleva el hash ni otros datos personales, y no se guarda en caché (INV-SOC-009, INV-SEC-003)', async () => {
    const r = await buscar({ q: 'lucia' });
    expect(r.cabeceras['Cache-Control']).toBe('no-store');
    const texto = JSON.stringify(r.cuerpo);
    expect(texto).not.toMatch(/scrypt|passwordHash|hash/i);
    expect(Object.keys(r.cuerpo.historial.socio).sort()).toEqual(['correo', 'id', 'nombre']);
  });

  it('solo cuentan como préstamos los entregados: una reserva sin entregar o cancelada no sale; uno sin devolver sale sin fecha de devolución', async () => {
    await montar({
      material: [{ nombre: 'Casco', total: 6 }],
      reservas: [
        { ...LUCIA_DEVUELTA, estado: 'Reservada', devueltaEl: null },
        { ...LUCIA_DEVUELTA, estado: 'Cancelada', devueltaEl: null, inicio: '2026-12-10', fin: '2026-12-11' },
        { ...LUCIA_DEVUELTA, estado: 'Prestada', devueltaEl: null, inicio: '2026-11-20', fin: '2026-11-24', cantidad: 1 },
      ],
    });
    const r = await buscar({ q: 'lucia' });
    expect(r.cuerpo.historial.prestamos).toEqual([{ cantidad: 1, material: 'Casco', inicio: '2026-11-20', fin: '2026-11-24', devueltoEl: null }]);
  });

  it('un socio sin préstamos ni multas recibe el historial vacío con su mensaje', async () => {
    const r = await buscar({ q: 'marta' });
    expect(r.estado).toBe(200);
    expect(r.cuerpo.historial).toEqual({ socio: { id: 'c-marta', nombre: 'Marta Ruiz', correo: 'marta@club.test' }, prestamos: [], multas: [], mensaje: 'Sin préstamos ni multas' });
  });

  it('sin coincidencias o con la búsqueda vacía da E_BUSQUEDA_VACIA «Ningún socio coincide» y ningún dato', async () => {
    for (const consulta of [{ q: 'zzz' }, { q: '   ' }, {}, { id: 'c-nadie' }, { id: 'c-jorge' }]) {
      const r = await buscar(consulta);
      expect(r.estado).toBe(404);
      expect(r.cuerpo).toEqual({ error: { codigo: 'E_BUSQUEDA_VACIA', mensaje: 'Ningún socio coincide' } });
    }
  });

  it('AC-018-05 varios resultados: la junta recibe la lista para elegir, sin historial, y al elegir uno por id recibe el suyo', async () => {
    // AC-018-05 (extensión 4a de UC-018): "varios resultados → se muestra la lista para elegir"
    const lista = await buscar({ q: 'gil' });
    expect(lista.estado).toBe(200);
    expect(lista.cuerpo).toEqual({ socios: [{ id: 'c-lucas', nombre: 'Lucas Gil' }, { id: 'c-lucia', nombre: 'Lucía Gil' }] });
    const elegido = await buscar({ id: 'c-lucia' });
    expect(elegido.cuerpo.historial.socio.nombre).toBe('Lucía Gil');
    expect(elegido.cuerpo.historial.multas).toEqual([{ importe: 4, estado: 'Pagada' }]);
  });

  it('AC-018-06 INV-SEC-002 un socio o el encargado reciben E_ACCESO_DENEGADO y ningún dato; sin sesión se pide entrar', async () => {
    // AC-018-06 (UC-018 E1): "rol distinto de junta … `E_ACCESO_DENEGADO` sin cambios ni datos de socios"
    for (const cookie of [s.lucia, s.jorge]) {
      const r = await buscar({ q: 'lucia' }, cookie);
      expect(r.estado).toBe(403);
      expect(r.cuerpo).toEqual({ error: { codigo: 'E_ACCESO_DENEGADO', mensaje: 'Acceso denegado' } });
    }
    expect((await buscar({ q: 'lucia' }, null)).estado).toBe(401);
  });

  it('INV-SEC-002 buscar no cambia ningún dato', async () => {
    const antes = JSON.stringify(await app.store.leer());
    await buscar({ q: 'lucia' });
    await buscar({ q: 'gil' });
    await buscar({ q: 'zzz' });
    expect(JSON.stringify(await app.store.leer())).toBe(antes);
  });
});

describe('semilla de la demo de FASE-5', () => {
  it('Lucía tiene su préstamo devuelto y su multa pagada, Marta un préstamo de 2023 y otro de 2025, y hay una cuenta de junta', async () => {
    const d = await datosSemilla(semillaFase5(HOY));
    const de = (correo) => d.cuentas.find((c) => c.email === correo).id;
    expect(d.reservas.filter((r) => r.accountId === de('lucia@club.test')).map((r) => [r.quantity, r.startDate, r.endDate, r.returnedOn])).toEqual([[2, '2026-12-05', '2026-12-07', '2026-12-09']]);
    expect(d.multas.map((m) => [m.accountId, m.amountEur, m.status])).toEqual([[de('lucia@club.test'), 4, 'Pagada']]);
    expect(d.reservas.filter((r) => r.accountId === de('marta@club.test')).map((r) => r.endDate)).toEqual(['2023-11-01', '2025-01-10']);
    expect(d.cuentas.filter((c) => c.role === 'junta')).toHaveLength(1);
  });
});
