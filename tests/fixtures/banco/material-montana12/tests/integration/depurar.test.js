import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearManejador } from '../../src/server/http/rutas.js';
import { crearApp, CONFIG } from '../../src/server/app.js';
import { crearAlmacenMemoria } from '../../src/server/store/almacen-memoria.js';
import { crearAlmacenJson } from '../../src/server/store/almacen-json.js';
import { crearRelojManual, restarAnios } from '../../src/server/dominio/fechas.js';
import { eraseRemovedMembers, purgeOldRecords, runPurge } from '../../src/server/servicios/depurar.js';
import { registerMember } from '../../src/server/servicios/cuentas.js';
import { programarDepuracion } from '../../src/server/http/plugin.js';
import { datosSemilla } from '../../demo/sembrar.mjs';

// UC-019 · API-002-07 purgeOldRecords. `hoy` llega por parámetro (D-PA-013): con hoy = 2026-11-22 el límite es 2023-11-22.
// Cada reserva de estos tests es de Marta; el material es un Casco.
const HOY = '2026-11-22';
const CUENTAS = [
  { id: 'c-marta', nombre: 'Marta Ruiz', correo: 'marta@club.test', contrasena: 'Marta2026!', rol: 'socio' },
  { id: 'c-pablo', nombre: 'Pablo Sanz', correo: 'pablo@club.test', contrasena: 'Piolet2026!', rol: 'socio' },
];
const reserva = (fin, estado = 'Devuelta', extra = {}) => ({ socio: 'marta@club.test', material: 'Casco', cantidad: 1, inicio: fin, fin, estado, devueltaEl: estado === 'Devuelta' ? fin : null, ...extra });
const multa = (creada, estado = 'Pagada', extra = {}) => ({ socio: 'marta@club.test', importe: 4, estado, dias: 2, creada, ...extra });

async function montar({ reservas = [], multas = [], cuentas = CUENTAS } = {}) {
  const datos = await datosSemilla({ hoy: HOY, cuentas, material: [{ nombre: 'Casco', total: 6 }], reservas, multas });
  const store = crearAlmacenMemoria(datos);
  return crearApp({ store, reloj: crearRelojManual('2026-11-22T10:00:00Z') });
}
const finales = async (app) => (await app.store.leer()).reservas.map((r) => r.endDate);

describe('API-002-07 purgeOldRecords (UC-019)', () => {
  it('AC-019-01 REQ-NF-003 AC2 con hoy 2026-11-22 el préstamo terminado el 2023-11-01 desaparece y el terminado el 2025-01-10 se queda', async () => {
    const app = await montar({ reservas: [reserva('2023-11-01'), reserva('2025-01-10')] });
    const r = await purgeOldRecords(app, { hoy: '2026-11-22' });
    // REQ-NF-003 AC2: "GIVEN a loan that ended 2023-11-01 and today is 2026-11-22 WHEN the cleanup runs THEN that loan is gone and a loan ended 2025-01-10 remains"
    expect(await finales(app)).not.toContain('2023-11-01');
    // REQ-NF-003 AC2 cláusula: "a loan ended 2025-01-10 remains"
    expect(await finales(app)).toEqual(['2025-01-10']);
    expect(r).toEqual({ deletedReservations: 1, deletedFines: 0 });
  });

  it('AC-019-02 un préstamo que termina justo en hoy − 3 años (2023-11-22) se queda y el día anterior (2023-11-21) se borra', async () => {
    // AC-019-02 (UC-019 extensión 3a): "`endDate` igual al límite → se conserva (anterior estricto)"
    const app = await montar({ reservas: [reserva('2023-11-21'), reserva('2023-11-22'), reserva('2023-11-23')] });
    await purgeOldRecords(app, { hoy: '2026-11-22' });
    expect(await finales(app)).toEqual(['2023-11-22', '2023-11-23']);
  });

  it('INV-RES-011 se borran las reservas cerradas (Devuelta, Cancelada, No recogida) y las multas Pagadas creadas antes del límite', async () => {
    const app = await montar({
      reservas: [reserva('2023-01-05', 'Devuelta'), reserva('2023-01-06', 'Cancelada'), reserva('2023-01-07', 'Reservada')],
      multas: [multa('2023-01-05'), multa('2023-11-22'), multa('2026-01-01')],
    });
    const r = await purgeOldRecords(app, { hoy: HOY });
    const d = await app.store.leer();
    expect(d.reservas).toEqual([]);
    expect(d.multas.map((m) => m.createdOn)).toEqual(['2023-11-22', '2026-01-01']);
    expect(r).toEqual({ deletedReservations: 3, deletedFines: 1 });
  });

  it('AC-019-03 RN-033 depurar dos veces deja el mismo estado y la segunda cuenta cero', async () => {
    // AC-019-03 (UC-019 E1): "replay: segunda ejecución el mismo día … recuentos a 0; datos sin cambios"
    const app = await montar({ reservas: [reserva('2023-11-01'), reserva('2025-01-10')], multas: [multa('2023-02-01')] });
    await purgeOldRecords(app, { hoy: HOY });
    const despues = JSON.stringify(await app.store.leer());
    const otra = await purgeOldRecords(app, { hoy: HOY });
    expect(otra).toEqual({ deletedReservations: 0, deletedFines: 0 });
    expect(JSON.stringify(await app.store.leer())).toBe(despues);
  });

  it('AC-019-03 RN-033 nunca borra un préstamo sin devolver ni una multa Pendiente, por antiguos que sean', async () => {
    // AC-019-03 (RN-033): "un préstamo sin devolver o una multa Pendiente no se borra"
    const app = await montar({
      reservas: [reserva('2022-03-01', 'Prestada'), reserva('2022-04-01', 'Devuelta', { devueltaEl: '2022-04-05' })],
      multas: [multa('2022-04-05', 'Pendiente'), multa('2022-05-01', 'Pagada')],
    });
    const r = await purgeOldRecords(app, { hoy: HOY });
    const d = await app.store.leer();
    expect(d.reservas.map((x) => x.status)).toEqual(['Prestada']);
    expect(d.multas.map((m) => m.status)).toEqual(['Pendiente']);
    expect(r).toEqual({ deletedReservations: 1, deletedFines: 1 });
  });

  it('RN-022 el límite de un 29 de febrero cae en el 28 de febrero del año sin bisiesto', () => {
    expect(restarAnios('2026-11-22', 3)).toBe('2023-11-22');
    expect(restarAnios('2028-02-29', 3)).toBe('2025-02-28');
    expect(CONFIG.RETENTION_YEARS).toBe(3);
  });

  it('una sola transacción: si el almacén no puede guardar, no se borra nada y el error sale', async () => {
    const app = await montar({ reservas: [reserva('2023-11-01')], multas: [multa('2023-02-01')] });
    app.store.fallarEscritura = true;
    await expect(purgeOldRecords(app, { hoy: HOY })).rejects.toMatchObject({ codigo: 'E_ALMACEN_NO_DISPONIBLE' });
    app.store.fallarEscritura = false;
    expect((await app.store.leer()).reservas).toHaveLength(1);
    expect((await app.store.leer()).multas).toHaveLength(1);
  });

  it('sin nada que borrar no escribe el almacén (el arranque no crea ficheros)', async () => {
    const app = await montar({ reservas: [reserva('2025-01-10')] });
    const escrituras = vi.spyOn(app.store, 'transaccion');
    expect(await purgeOldRecords(app, { hoy: HOY })).toEqual({ deletedReservations: 0, deletedFines: 0 });
    expect(escrituras).not.toHaveBeenCalled();
  });
});

describe('copia de seguridad antes de borrar', () => {
  let carpeta, ruta;
  beforeEach(() => { carpeta = mkdtempSync(path.join(tmpdir(), 'mm-dep-')); ruta = path.join(carpeta, 'datos.json'); });
  afterEach(() => rmSync(carpeta, { recursive: true, force: true }));
  const montarJson = async (reservas) => {
    const store = crearAlmacenJson(ruta);
    await store.transaccion(async (d) => { Object.assign(d, await datosSemilla({ hoy: HOY, cuentas: CUENTAS, material: [{ nombre: 'Casco', total: 6 }], reservas })); });
    return crearApp({ store, reloj: crearRelojManual('2026-11-22T10:00:00Z') });
  };

  it('datos.json.bak guarda el estado de antes de borrar y la depuración siguiente, sin nada que borrar, no lo pisa', async () => {
    const app = await montarJson([reserva('2023-11-01'), reserva('2025-01-10')]);
    await purgeOldRecords(app, { hoy: HOY });
    const copia = JSON.parse(readFileSync(`${ruta}.bak`, 'utf8'));
    expect(copia.reservas.map((r) => r.endDate)).toEqual(['2023-11-01', '2025-01-10']);
    expect((await app.store.leer()).reservas.map((r) => r.endDate)).toEqual(['2025-01-10']);
    await purgeOldRecords(app, { hoy: HOY });
    // La copia sigue guardando el estado de antes de borrar: la reserva de 2023-11-01 sigue en ella.
    const despues = JSON.parse(readFileSync(`${ruta}.bak`, 'utf8')).reservas.map((r) => r.endDate);
    expect(despues).toContain('2023-11-01');
    expect(despues).toContain('2025-01-10');
  });

  it('sin nada que borrar no hay copia', async () => {
    const app = await montarJson([reserva('2025-01-10')]);
    await purgeOldRecords(app, { hoy: HOY });
    expect(existsSync(`${ruta}.bak`)).toBe(false);
  });
});

describe('REQ-NF-003 AC2 con préstamos hechos por el recorrido real y el almacén en fichero', () => {
  let carpeta;
  beforeEach(() => { carpeta = mkdtempSync(path.join(tmpdir(), 'mm-dep-real-')); });
  afterEach(() => rmSync(carpeta, { recursive: true, force: true }));
  const MARTA = ['marta@club.test', 'Marta2026!'];
  const PABLO = ['pablo@club.test', 'Piolet2026!'];
  const CUENTAS_REAL = [
    { id: 'c-marta', nombre: 'Marta Ruiz', correo: MARTA[0], contrasena: MARTA[1], rol: 'socio' },
    { id: 'c-pablo', nombre: 'Pablo Sanz', correo: PABLO[0], contrasena: PABLO[1], rol: 'encargado' },
  ];

  it('AC-019-01 REQ-NF-003 AC2 Marta presta y devuelve dos cascos (fin 2023-11-01 y 2025-01-10); el 2026-11-22 la depuración del plugin borra solo el primero del fichero', async () => {
    const ruta = path.join(carpeta, 'datos.json');
    const store = crearAlmacenJson(ruta);
    await store.transaccion(async (d) => { Object.assign(d, await datosSemilla({ hoy: '2023-10-28', cuentas: CUENTAS_REAL, material: [{ nombre: 'Casco', total: 6 }], reservas: [] })); });
    const reloj = crearRelojManual('2023-10-28T10:00:00Z');
    const app = crearApp({ store, reloj });
    const http = crearManejador(app);
    const entrar = async ([correo, contrasena]) => `mm_sesion=${/mm_sesion=([^;]+)/.exec((await http({ metodo: 'POST', ruta: '/api/entrar', cuerpo: { correo, contrasena } })).cabeceras['Set-Cookie'])[1]}`;
    const irA = (dia) => reloj.avanzar((new Date(`${dia}T10:00:00Z`) - reloj.ahora()) / 60000);
    // Un préstamo completo: Marta reserva, Pablo entrega el día de inicio y lo recibe el día de fin, a tiempo (sin multa).
    const prestamo = async (inicio, fin) => {
      irA(inicio);
      const material = (await store.leer()).material.find((m) => m.name === 'Casco').id;
      const creada = await http({ metodo: 'POST', ruta: '/api/reservas', cuerpo: { materialId: material, cantidad: 1, inicio, fin }, cookie: await entrar(MARTA) });
      expect(creada.estado).toBe(200);
      const { id } = creada.cuerpo;
      expect((await http({ metodo: 'POST', ruta: `/api/reservas/${id}/entregar`, cookie: await entrar(PABLO) })).estado).toBe(200);
      irA(fin);
      expect((await http({ metodo: 'POST', ruta: `/api/reservas/${id}/devolver`, cookie: await entrar(PABLO) })).estado).toBe(200);
    };
    await prestamo('2023-10-28', '2023-11-01');
    await prestamo('2025-01-08', '2025-01-10');
    expect((await store.leer()).reservas.map((r) => [r.endDate, r.status])).toEqual([['2023-11-01', 'Devuelta'], ['2025-01-10', 'Devuelta']]);
    irA('2026-11-22');
    let corrida;
    const temporizador = programarDepuracion(app, { depurar: (a, o) => (corrida = runPurge(a, o)) });
    clearInterval(temporizador);
    await corrida;
    // REQ-NF-003 AC2: "GIVEN a loan that ended 2023-11-01 and today is 2026-11-22 WHEN the cleanup runs THEN that loan is gone and a loan ended 2025-01-10 remains"
    const enDisco = (await crearAlmacenJson(ruta).leer()).reservas.map((r) => r.endDate);
    expect(enDisco).not.toContain('2023-11-01');
    expect(enDisco).toEqual(['2025-01-10']);
  });
});

describe('RN-021 el plugin depura al arrancar y cada 24 horas', () => {
  afterEach(() => vi.useRealTimers());

  it('al programar corre una vez con el día del reloj y vuelve a correr cada 24 h', async () => {
    vi.useFakeTimers();
    const app = await montar({ reservas: [reserva('2023-11-01')] });
    const depurar = vi.fn(async () => ({}));
    const temporizador = programarDepuracion(app, { depurar });
    await vi.advanceTimersByTimeAsync(0);
    expect(depurar).toHaveBeenCalledTimes(1);
    expect(depurar).toHaveBeenLastCalledWith(app, { hoy: '2026-11-22' });
    await vi.advanceTimersByTimeAsync(24 * 3600 * 1000);
    expect(depurar).toHaveBeenCalledTimes(2);
    clearInterval(temporizador);
  });

  it('un fallo de la depuración no tumba el servidor: se anota sin datos personales y sigue', async () => {
    vi.useFakeTimers();
    const app = await montar();
    const aviso = vi.spyOn(console, 'error').mockImplementation(() => {});
    const temporizador = programarDepuracion(app, { depurar: async () => { throw new Error('E_ALMACEN_NO_DISPONIBLE'); } });
    await vi.advanceTimersByTimeAsync(0);
    expect(aviso).toHaveBeenCalledWith('depuración fallida', 'E_ALMACEN_NO_DISPONIBLE');
    clearInterval(temporizador);
    aviso.mockRestore();
  });
});

// D-PA-003 (Q-security-auditor-001): a los 3 años de la baja se borran el nombre y el correo de la cuenta. Regla: `bajaEn` ≤ hoy − 3 años.
describe('REQ-NF-003 borrado de los datos personales a los 3 años de la baja (D-PA-003, INV-SOC-009, ADR-003)', () => {
  const DE_BAJA = { active: false };
  async function conBajas(bajas, reservas = []) {
    const cuentas = [...CUENTAS, ...bajas.map(([id, nombre, correo]) => ({ id, nombre, correo, contrasena: 'Baja2026!', rol: 'socio' }))];
    const ajustes = Object.fromEntries(bajas.map(([, , correo, bajaEn]) => [correo, { ...DE_BAJA, bajaEn }]));
    const datos = await datosSemilla({ hoy: HOY, cuentas, material: [{ nombre: 'Casco', total: 6 }], reservas, ajustes });
    return crearApp({ store: crearAlmacenMemoria(datos), reloj: crearRelojManual('2026-11-22T10:00:00Z') });
  }
  const cuenta = async (app, id) => (await app.store.leer()).cuentas.find((c) => c.id === id);
  const BAJAS = [
    ['c-vieja', 'Álvaro Pérez', 'alvaro@club.test', '2023-01-15'],
    ['c-justo', 'Berta Soler', 'berta@club.test', '2023-11-22'],
    ['c-casi', 'Carlos Ruiz', 'carlos@club.test', '2023-11-23'],
    ['c-reciente', 'Diana Mora', 'diana@club.test', '2026-06-01'],
  ];

  it('una cuenta con baja de hace más de 3 años y la de justo 3 años pierden nombre y correo; la de un día menos y la reciente los conservan', async () => {
    const app = await conBajas(BAJAS);
    const r = await eraseRemovedMembers(app, { hoy: HOY });
    expect(r).toEqual({ erasedAccounts: 2 });
    for (const [id, nombre, correo] of [BAJAS[0], BAJAS[1]]) {
      const c = await cuenta(app, id);
      expect(c.name).toBe(`Socio ${id}`);
      expect(c.email).toBe(`${id}@borrado.invalid`);
      expect(JSON.stringify(c)).not.toContain(nombre.split(' ')[0]);
      expect(JSON.stringify(c)).not.toContain(correo.split('@')[0]);
      expect(c).toMatchObject({ active: false, bajaEn: BAJAS.find((b) => b[0] === id)[3] });
    }
    expect(await cuenta(app, 'c-casi')).toMatchObject({ name: 'Carlos Ruiz', email: 'carlos@club.test' });
    expect(await cuenta(app, 'c-reciente')).toMatchObject({ name: 'Diana Mora', email: 'diana@club.test' });
  });

  it('los marcadores son únicos por cuenta y el correo borrado queda libre para un alta nueva (ADR-003)', async () => {
    const app = await conBajas(BAJAS);
    const antes = await registerMember({ ...app, sesion: {} }, { nombre: 'Otro', correo: 'alvaro@club.test', contrasena: 'Cumbre2026!' }).catch((e) => e.codigo);
    expect(antes).toBe('E_SOCIO_DUPLICADO');
    await eraseRemovedMembers(app, { hoy: HOY });
    const d = await app.store.leer();
    expect(new Set(d.cuentas.map((c) => c.email)).size).toBe(d.cuentas.length);
    expect(new Set(d.cuentas.map((c) => c.name)).size).toBe(d.cuentas.length);
    const nueva = await registerMember({ ...app, sesion: {} }, { nombre: 'Álvaro Nuevo', correo: 'alvaro@club.test', contrasena: 'Cumbre2026!' });
    expect(nueva.socio).toMatchObject({ nombre: 'Álvaro Nuevo', correo: 'alvaro@club.test' });
  });

  it('INV-SOC-009 repetirlo no cambia nada y no cuenta cuentas; una cuenta activa nunca se borra', async () => {
    const app = await conBajas(BAJAS);
    await eraseRemovedMembers(app, { hoy: HOY });
    const despues = JSON.stringify(await app.store.leer());
    expect(await eraseRemovedMembers(app, { hoy: HOY })).toEqual({ erasedAccounts: 0 });
    expect(JSON.stringify(await app.store.leer())).toBe(despues);
    expect(await cuenta(app, 'c-marta')).toMatchObject({ name: 'Marta Ruiz', email: 'marta@club.test', active: true });
  });

  it('INV-SOC-009 el historial del socio borrado sigue su propia retención: la depuración de datos personales no toca sus préstamos', async () => {
    const reservas = [{ socio: 'alvaro@club.test', material: 'Casco', cantidad: 1, inicio: '2025-01-08', fin: '2025-01-10', estado: 'Devuelta', devueltaEl: '2025-01-10' }];
    const app = await conBajas(BAJAS, reservas);
    await eraseRemovedMembers(app, { hoy: HOY });
    expect((await app.store.leer()).reservas.map((r) => [r.accountId, r.endDate])).toEqual([['c-vieja', '2025-01-10']]);
    await runPurge(app, { hoy: '2028-02-01' });
    expect((await app.store.leer()).reservas).toEqual([]);
  });

  it('runPurge depura los registros y los datos personales con el mismo día y suma los recuentos', async () => {
    const app = await conBajas(BAJAS, [{ socio: 'marta@club.test', material: 'Casco', cantidad: 1, inicio: '2023-10-28', fin: '2023-11-01', estado: 'Devuelta', devueltaEl: '2023-11-01' }]);
    expect(await runPurge(app, { hoy: HOY })).toEqual({ deletedReservations: 1, deletedFines: 0, erasedAccounts: 2 });
    expect(await runPurge(app, { hoy: HOY })).toEqual({ deletedReservations: 0, deletedFines: 0, erasedAccounts: 0 });
  });
});
