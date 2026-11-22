import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearApp } from '../../src/server/app.js';
import { crearAlmacenJson } from '../../src/server/store/almacen-json.js';
import { crearAlmacenMemoria } from '../../src/server/store/almacen-memoria.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';
import { crearManejador } from '../../src/server/http/rutas.js';
import { authorize } from '../../src/server/http/autorizar.js';
import { datosSemilla } from '../../demo/sembrar.mjs';

// SEC-T-001, SEC-T-003, SEC-T-004 (REQ-NF-001, REQ-NF-003): aislamiento por rol y almacén sin contraseñas legibles, de punta a punta por la
// misma ruta HTTP que usa la web. Va en tests/integration porque vitest.config.js solo recoge unit/ e integration/ (ver feedback/IMPL-FEEDBACK-FASE-5.md).
// RN-020: abrir una página no permitida da E_PAGINA_PROHIBIDA; una operación o un dato ajeno, E_ACCESO_DENEGADO sin datos.
const HOY = '2026-11-22';
let app, http;
const s = {};
const idCookie = (r) => (r.cabeceras['Set-Cookie'] ? `mm_sesion=${/mm_sesion=([^;]+)/.exec(r.cabeceras['Set-Cookie'])[1]}` : null);
const llamar = (metodo, ruta, cookie, cuerpo = {}, consulta = {}) => http({ metodo, ruta, cookie, cuerpo, consulta });

const CUENTAS = [
  { id: 'c-lucia', nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026!', rol: 'socio' },
  { id: 'c-pablo', nombre: 'Pablo Sanz', correo: 'pablo@club.test', contrasena: 'Piolet2026!', rol: 'socio' },
  { id: 'c-jorge', nombre: 'Jorge', correo: 'jorge@club.test', contrasena: 'Encargado2026!', rol: 'encargado' },
  { id: 'c-elena', nombre: 'Elena', correo: 'elena@club.test', contrasena: 'Junta2026!', rol: 'junta' },
];
// Pablo: una reserva futura (r-1), un préstamo vivo (r-2) y una multa Pendiente (f-1). Lucía: una reserva suya (r-3).
const RESERVAS = [
  { socio: 'pablo@club.test', material: 'Casco', cantidad: 1, inicio: '2026-12-05', fin: '2026-12-07' },
  { socio: 'pablo@club.test', material: 'Casco', cantidad: 1, inicio: '2026-11-20', fin: '2026-11-24', estado: 'Prestada' },
  { socio: 'lucia@club.test', material: 'Casco', cantidad: 1, inicio: '2026-12-10', fin: '2026-12-11' },
];
const MULTAS = [{ socio: 'pablo@club.test', importe: 6 }];

async function montar(store) {
  const datos = await datosSemilla({ hoy: HOY, cuentas: CUENTAS, material: [{ nombre: 'Casco', total: 6 }], reservas: RESERVAS, multas: MULTAS });
  app = crearApp({ store: store ?? crearAlmacenMemoria(datos), reloj: crearRelojManual('2026-11-22T10:00:00Z') });
  if (store) await store.transaccion((d) => { Object.assign(d, datos); });
  http = crearManejador(app);
  const entrar = async (correo, contrasena) => idCookie(await llamar('POST', '/api/entrar', undefined, { correo, contrasena }));
  s.lucia = await entrar('lucia@club.test', 'Cumbre2026!');
  s.pablo = await entrar('pablo@club.test', 'Piolet2026!');
  s.jorge = await entrar('jorge@club.test', 'Encargado2026!');
  s.elena = await entrar('elena@club.test', 'Junta2026!');
}
const estadoGuardado = async () => JSON.stringify(await app.store.leer());
const DENEGADO = { error: { codigo: 'E_ACCESO_DENEGADO', mensaje: 'Acceso denegado' } };

beforeEach(() => montar());

describe('SEC-T-001 un socio solo ve lo suyo', () => {
  it('REQ-NF-001 AC1 Lucía pide por id una reserva o una multa de Pablo y recibe «Acceso denegado» sin ningún dato de él', async () => {
    // REQ-NF-001 AC1: "GIVEN Lucía and Pablo are socios WHEN Lucía asks for Pablo's reservations or fines by id THEN the system answers "Acceso denegado" and returns no data of Pablo"
    const antes = await estadoGuardado();
    const reservaDePablo = await llamar('POST', '/api/reservas/r-1/cancelar', s.lucia);
    expect(reservaDePablo.estado).toBe(403);
    expect(reservaDePablo.cuerpo).toEqual(DENEGADO);
    const multaDePablo = await llamar('POST', '/api/multas/f-1/pagar', s.lucia);
    expect(multaDePablo.estado).toBe(403);
    expect(multaDePablo.cuerpo).toEqual(DENEGADO);
    const sociosYMultas = [await llamar('GET', '/api/multas', s.lucia), await llamar('GET', '/api/historial', s.lucia, {}, { id: 'c-pablo' })];
    for (const r of [reservaDePablo, multaDePablo, ...sociosYMultas]) {
      expect(r.estado).toBe(403);
      expect(JSON.stringify(r.cuerpo)).not.toMatch(/Pablo|pablo|r-1|f-1|Piolet/);
    }
    expect(await estadoGuardado()).toBe(antes);
  });

  it('REQ-NF-001 AC1 sus propias listas no llevan nada de Pablo: solo sus reservas y ninguna multa', async () => {
    // REQ-NF-001 AC1: "the system answers "Acceso denegado" and returns no data of Pablo"
    const reservas = await llamar('GET', '/api/mis-reservas', s.lucia);
    expect(reservas.cuerpo.reservas.map((r) => r.id)).toEqual(['r-3']);
    const multas = await llamar('GET', '/api/mis-multas', s.lucia);
    expect(multas.cuerpo).toEqual({ multas: [], mensaje: 'No tienes multas' });
  });
});

describe('SEC-T-001 la junta solo lee', () => {
  it('REQ-NF-001 AC2 la junta envía «entregar», «devolver» o «marcar pagada» y recibe «Acceso denegado» sin que cambie nada', async () => {
    // REQ-NF-001 AC2: "GIVEN a junta member WHEN he sends "marcar pagada" or "entregar" THEN the system answers "Acceso denegado" and nothing changes"
    const antes = await estadoGuardado();
    for (const ruta of ['/api/reservas/r-1/entregar', '/api/reservas/r-2/devolver', '/api/multas/f-1/pagar']) {
      const r = await llamar('POST', ruta, s.elena);
      expect(r.estado).toBe(403);
      expect(r.cuerpo).toEqual(DENEGADO);
    }
    // REQ-NF-001 AC2 cláusula: "nothing changes"
    expect(await estadoGuardado()).toBe(antes);
  });
});

describe('SEC-T-003 páginas y matriz de permisos', () => {
  it('REQ-NF-001 AC3 una socia que abre la lista de socios recibe el rechazo de página y ningún socio', async () => {
    // REQ-NF-001 AC3: "GIVEN a socio WHEN she opens the list of socios THEN the system answers "Acceso denegado"" (RN-020: la página prohibida da E_PAGINA_PROHIBIDA)
    const lista = await llamar('GET', '/api/socios', s.lucia);
    expect(lista.estado).toBe(403);
    expect(lista.cuerpo).toEqual({ error: { codigo: 'E_PAGINA_PROHIBIDA', mensaje: 'No tienes permiso para ver esta página' } });
    expect(JSON.stringify(lista.cuerpo)).not.toMatch(/Pablo|club\.test/);
    const pagina = await llamar('GET', '/api/sesion', s.lucia, {}, { pagina: '/socios' });
    expect(pagina.estado).toBe(403);
    expect(pagina.cuerpo.error.codigo).toBe('E_PAGINA_PROHIBIDA');
  });

  /** Las operaciones de cada rol según spec/contracts/PERMISSIONS-MATRIX.md: «API-001-02, -03; API-002-01..03; API-004-01» → ids. */
  function operacionesDe(celda) {
    const ids = new Set();
    for (const grupo of celda.split(';')) {
      const limpio = grupo.replace(/\([^)]*\)/g, '');
      const base = /API-(\d{3})-/.exec(limpio)?.[1];
      if (!base) continue;
      const numeros = limpio.replace(/API-\d{3}-/, '');
      for (const [, de, hasta, uno] of numeros.matchAll(/(\d{2})\.\.(\d{2})|(\d{2})/g)) {
        const [a, b] = uno ? [Number(uno), Number(uno)] : [Number(de), Number(hasta)];
        for (let n = a; n <= b; n += 1) ids.add(`API-${base}-${String(n).padStart(2, '0')}`);
      }
    }
    return ids;
  }
  const matriz = () => {
    const filas = readFileSync('spec/contracts/PERMISSIONS-MATRIX.md', 'utf8').split('\n').filter((l) => /^\| (socio|encargado|junta|sistema) \|/.test(l));
    return Object.fromEntries(filas.map((f) => { const c = f.split('|').map((x) => x.trim()); return [c[1], operacionesDe(c[2])]; }));
  };

  it('REQ-NF-001 AC3 SEC-T-003 cada rol puede las operaciones de la matriz y se le deniegan, con E_ACCESO_DENEGADO, las que la matriz da a otros', () => {
    // REQ-NF-001 AC3: "the system answers "Acceso denegado"" · PERMISSIONS-MATRIX: «junta: solo lectura (INV-SEC-002)»
    const m = matriz();
    const todas = new Set(Object.values(m).flatMap((ids) => [...ids]));
    // lo que cada criterio nombra tiene que estar en la matriz: reservar (socio), entregar, marcar pagada, listar socios (encargado), historial (junta)
    for (const op of ['API-002-01', 'API-002-04', 'API-004-02', 'API-001-04', 'API-001-07']) expect(todas).toContain(op);
    for (const rol of ['socio', 'encargado', 'junta']) {
      const sesion = { rol, debeCambiar: false, renovar() {} };
      for (const op of todas) {
        const decision = authorize(sesion, { operacion: op });
        if (m[rol].has(op)) expect(decision, `${rol} ${op}`).toEqual({ ok: true });
        else expect(decision, `${rol} ${op}`).toEqual({ ok: false, codigo: 'E_ACCESO_DENEGADO' });
      }
    }
    // la depuración la lanza el sistema: ningún rol humano la tiene ni existe una ruta que la exponga
    expect(m.sistema).toContain('API-002-07');
  });

  it('SEC-T-003 la junta no tiene ninguna operación de gestión: nada que entregar, devolver, cobrar, dar de alta, baja ni cambiar material', async () => {
    const m = matriz();
    for (const op of ['API-002-04', 'API-002-05', 'API-004-02', 'API-001-04', 'API-001-05', 'API-001-06', 'API-003-01', 'API-003-02', 'API-002-01', 'API-002-03']) {
      expect(m.junta.has(op), op).toBe(false);
    }
    expect((await llamar('POST', '/api/depurar', s.jorge)).estado).toBe(404);
    expect((await llamar('GET', '/api/depurar', s.elena)).estado).toBe(404);
  });

  it('INV-SEC-001 sin sesión ninguna operación responde datos: se pide entrar', async () => {
    for (const [metodo, ruta] of [['GET', '/api/mis-reservas'], ['GET', '/api/mis-multas'], ['GET', '/api/historial'], ['GET', '/api/socios'], ['POST', '/api/multas/f-1/pagar']]) {
      const r = await llamar(metodo, ruta, null);
      expect(r.estado, ruta).toBe(401);
      expect(r.cuerpo).toEqual({ entrar: true });
    }
  });
});

describe('SEC-T-004 el almacén guarda solo lo mínimo y ninguna contraseña legible', () => {
  let carpeta, ruta;
  beforeEach(async () => {
    carpeta = mkdtempSync(path.join(tmpdir(), 'mm-sec-'));
    ruta = path.join(carpeta, 'datos.json');
    await montar(crearAlmacenJson(ruta));
  });
  afterEach(() => rmSync(carpeta, { recursive: true, force: true }));

  const PERMITIDOS = ['id', 'name', 'email', 'passwordHash', 'role', 'mustChangePassword', 'active', 'failedLogins', 'lockedUntil', 'bajaEn'];

  async function registrarYRestablecer() {
    await llamar('POST', '/api/socios', s.jorge, { nombre: 'Álvaro Pérez', correo: 'alvaro@club.test', contrasena: 'Provisional2026!' });
    const alvaro = (await app.store.leer()).cuentas.find((c) => c.email === 'alvaro@club.test');
    await llamar('PUT', `/api/socios/${alvaro.id}/contrasena`, s.jorge, { contrasena: 'Restablecida2026!' });
  }

  it('REQ-NF-003 AC1 un socio registrado queda con nombre, correo y un hash con sal, y ningún otro dato personal', async () => {
    // REQ-NF-003 AC1: "GIVEN a socio registered WHEN the stored record is read THEN it holds name, email and a password hash only"
    await registrarYRestablecer();
    const guardado = JSON.parse(readFileSync(ruta, 'utf8'));
    const alvaro = guardado.cuentas.find((c) => c.email === 'alvaro@club.test');
    expect(alvaro.name).toBe('Álvaro Pérez');
    expect(alvaro.passwordHash).toMatch(/^scrypt\$\d+\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    for (const c of guardado.cuentas) {
      expect(Object.keys(c).filter((k) => !PERMITIDOS.includes(k)), c.email).toEqual([]);
      expect(c.passwordHash).toMatch(/^scrypt\$\d+\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    }
  });

  it('REQ-NF-001 AC4 REQ-NF-003 AC1 tras entrar, cambiar y restablecer contraseñas ninguna aparece en claro en lo guardado', async () => {
    // REQ-NF-001 AC4: "GIVEN the passwords WHEN the stored data is read THEN no password appears in plain text"
    await registrarYRestablecer();
    await llamar('PUT', '/api/cuenta/contrasena', s.lucia, { contrasena: 'Nueva2026Cumbre!' });
    const texto = readFileSync(ruta, 'utf8');
    for (const clara of ['Cumbre2026!', 'Piolet2026!', 'Encargado2026!', 'Junta2026!', 'Provisional2026!', 'Restablecida2026!', 'Nueva2026Cumbre!']) {
      expect(texto, clara).not.toContain(clara);
    }
  });
});
