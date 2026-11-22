import { describe, it, expect, beforeEach } from 'vitest';
import { crearApp } from '../../src/server/app.js';
import { crearAlmacenMemoria } from '../../src/server/store/almacen-memoria.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';
import { crearManejador } from '../../src/server/http/rutas.js';
import { verificarContrasena } from '../../src/server/servicios/cuentas.js';
import { datosSemilla } from '../../demo/sembrar.mjs';

let app, http;
const PABLO = ['pablo@club.test', 'Piolet2026!'];
const LUCIA = ['lucia@club.test', 'Cumbre2026!'];

async function preparar(opciones = {}) {
  const reloj = crearRelojManual('2026-11-22T10:00:00Z');
  app = crearApp({ store: crearAlmacenMemoria(await datosSemilla({ hoy: '2026-11-22', ...opciones })), reloj });
  http = crearManejador(app);
}
beforeEach(() => preparar());

const cookieDe = (r) => `mm_sesion=${/mm_sesion=([^;]+)/.exec(r.cabeceras['Set-Cookie'])[1]}`;
const entrar = (correo, contrasena) => http({ metodo: 'POST', ruta: '/api/entrar', cuerpo: { correo, contrasena } });
const sesionDe = async ([correo, contrasena]) => cookieDe(await entrar(correo, contrasena));
const alta = (cookie, cuerpo) => http({ metodo: 'POST', ruta: '/api/socios', cuerpo, cookie });
const listar = (cookie) => http({ metodo: 'GET', ruta: '/api/socios', cookie });
const cuentas = async () => (await app.store.leer()).cuentas;
const MARTA = { nombre: 'Marta Ruiz', correo: 'marta@club.test', contrasena: 'Provisional1' };

describe('UC-003 · API-001-04 registerMember', () => {
  it('API-001-04 Pablo da de alta a Marta Ruiz con «Provisional1»: «Socio creado: Marta Ruiz», cuenta provisional y sin hash en la respuesta', async () => {
    const pablo = await sesionDe(PABLO);
    const r = await alta(pablo, MARTA);
    expect(r.estado).toBe(200);
    expect(r.cuerpo.mensaje).toBe('Socio creado: Marta Ruiz');
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/hash|scrypt|Provisional1/i);
    const marta = (await cuentas()).find((c) => c.email === 'marta@club.test');
    expect(marta).toMatchObject({ name: 'Marta Ruiz', role: 'socio', mustChangePassword: true, active: true });
    expect(verificarContrasena('Provisional1', marta.passwordHash)).toBe(true);
    const lista = (await listar(pablo)).cuerpo.socios;
    expect(lista).toContainEqual(expect.objectContaining({ nombre: 'Marta Ruiz', estado: 'Activo' }));
  });

  it('INV-SOC-001 el correo repetido (también el de una cuenta de baja, sin importar mayúsculas) o el mismo envío dos veces da E_SOCIO_DUPLICADO sin duplicar', async () => {
    const pablo = await sesionDe(PABLO);
    await alta(pablo, MARTA);
    for (const correo of ['marta@club.test', ' Marta@Club.TEST ']) {
      const r = await alta(pablo, { ...MARTA, correo });
      expect(r.estado).toBe(409);
      expect(r.cuerpo.error).toEqual({ codigo: 'E_SOCIO_DUPLICADO', mensaje: 'Ya existe un socio con ese correo' });
    }
    await app.store.transaccion((d) => { d.cuentas.find((c) => c.email === 'lucia@club.test').active = false; });
    expect((await alta(pablo, { ...MARTA, correo: 'lucia@club.test' })).cuerpo.error.codigo).toBe('E_SOCIO_DUPLICADO');
    expect((await cuentas()).filter((c) => c.name === 'Marta Ruiz')).toHaveLength(1);
    const lista = (await listar(pablo)).cuerpo.socios.filter((s) => s.nombre === 'Marta Ruiz');
    expect(lista).toHaveLength(1);
  });

  it('INV-SOC-001 dos altas simultáneas con el mismo correo dejan una sola cuenta', async () => {
    const pablo = await sesionDe(PABLO);
    const [a, b] = await Promise.all([alta(pablo, MARTA), alta(pablo, MARTA)]);
    expect([a.estado, b.estado].sort()).toEqual([200, 409]);
    expect((await cuentas()).filter((c) => c.email === 'marta@club.test')).toHaveLength(1);
  });

  it('INV-SOC-002 con la contraseña «corta» da E_CONTRASENA_CORTA y no crea la cuenta', async () => {
    const r = await alta(await sesionDe(PABLO), { ...MARTA, contrasena: 'corta' });
    expect(r.estado).toBe(400);
    expect(r.cuerpo.error).toEqual({ codigo: 'E_CONTRASENA_CORTA', mensaje: 'La contraseña debe tener al menos 8 caracteres' });
    expect((await cuentas()).some((c) => c.email === 'marta@club.test')).toBe(false);
  });

  it('RN-024 nombre vacío o correo mal formado da E_SOCIO_DATOS_INVALIDOS sin crear la cuenta', async () => {
    const pablo = await sesionDe(PABLO);
    for (const malo of [{ nombre: '  ' }, { correo: 'marta' }, { correo: '' }]) {
      const r = await alta(pablo, { ...MARTA, ...malo });
      expect(r.cuerpo.error).toEqual({ codigo: 'E_SOCIO_DATOS_INVALIDOS', mensaje: 'Escribe un nombre y un correo válidos' });
    }
    expect((await cuentas()).some((c) => c.email === 'marta@club.test')).toBe(false);
  });

  it('AC-003-04 solo el encargado da de alta: un socio recibe E_ACCESO_DENEGADO y sin sesión se pide entrar', async () => {
    const r = await alta(await sesionDe(LUCIA), MARTA);
    expect(r.estado).toBe(403);
    expect(r.cuerpo.error.codigo).toBe('E_ACCESO_DENEGADO');
    expect((await alta(undefined, MARTA)).estado).toBe(401);
    expect((await cuentas()).some((c) => c.email === 'marta@club.test')).toBe(false);
  });

  it('INV-SOC-009 INV-SOC-003 la cuenta guardada solo tiene nombre, correo, hash con sal, rol e indicadores: la contraseña no está en claro', async () => {
    await alta(await sesionDe(PABLO), MARTA);
    const marta = (await cuentas()).find((c) => c.email === 'marta@club.test');
    expect(Object.keys(marta).sort()).toEqual(['active', 'bajaEn', 'email', 'failedLogins', 'id', 'lockedUntil', 'mustChangePassword', 'name', 'passwordHash', 'role']);
    expect(marta.passwordHash).toMatch(/^scrypt\$\d+\$[0-9a-f]{32}\$[0-9a-f]+$/);
    expect(JSON.stringify(await app.store.leer())).not.toContain('Provisional1');
  });

  it('GET /api/socios lista los socios con su estado y solo la ve el encargado', async () => {
    const lista = await listar(await sesionDe(PABLO));
    expect(lista.cuerpo.socios).toEqual([{ id: 'c-lucia', nombre: 'Lucía', correo: 'lucia@club.test', estado: 'Activo' }]);
    expect((await listar(await sesionDe(LUCIA))).estado).toBe(403);
  });
});

const cambiar = (cookie, contrasena) => http({ metodo: 'PUT', ruta: '/api/cuenta/contrasena', cuerpo: { contrasena }, cookie });
const pagina = (cookie, ruta) => http({ metodo: 'GET', ruta: '/api/sesion', consulta: { pagina: ruta }, cookie });

/** Pablo da de alta a Marta y ella entra con su provisional. */
async function martaProvisional() {
  await alta(await sesionDe(PABLO), MARTA);
  const r = await entrar('marta@club.test', 'Provisional1');
  return { r, cookie: cookieDe(r) };
}

describe('UC-004 · API-001-03 changePassword', () => {
  // AC-004-02 (INV-SOC-006): "con contraseña provisional solo se permiten salir y cambiar la contraseña; cualquier otra ruta lleva a /cambiar-contrasena"
  it('AC-004-02 INV-SOC-006 entrar con la provisional lleva a /cambiar-contrasena y todo lo demás pide cambiarla', async () => {
    const { r, cookie } = await martaProvisional();
    expect(r.cuerpo).toMatchObject({ nombre: 'Marta Ruiz', rol: 'socio', destino: '/cambiar-contrasena' });
    for (const consulta of [{ metodo: 'GET', ruta: '/api/mis-reservas' }, { metodo: 'GET', ruta: '/api/material' }, { metodo: 'POST', ruta: '/api/reservas', cuerpo: {} }]) {
      const x = await http({ ...consulta, cookie });
      expect(x.estado).toBe(403);
      expect(x.cuerpo).toEqual({ cambiar: true });
    }
    const guardia = await pagina(cookie, '/mis-reservas');
    expect(guardia.estado).toBe(403);
    expect(guardia.cuerpo).toMatchObject({ cambiar: true, sesion: { nombre: 'Marta Ruiz', rol: 'socio', debeCambiar: true } });
    expect((await pagina(cookie, '/cambiar-contrasena')).estado).toBe(200);
    expect((await http({ metodo: 'POST', ruta: '/api/salir', cookie })).estado).toBe(200);
  });

  it('AC-004-03 una contraseña corta se rechaza con E_CONTRASENA_CORTA y la cuenta sigue provisional', async () => {
    const { cookie } = await martaProvisional();
    const antes = (await cuentas()).find((c) => c.email === 'marta@club.test').passwordHash;
    const r = await cambiar(cookie, 'corta');
    expect(r.estado).toBe(400);
    expect(r.cuerpo.error).toEqual({ codigo: 'E_CONTRASENA_CORTA', mensaje: 'La contraseña debe tener al menos 8 caracteres' });
    const marta = (await cuentas()).find((c) => c.email === 'marta@club.test');
    expect(marta).toMatchObject({ passwordHash: antes, mustChangePassword: true });
    expect((await pagina(cookie, '/mis-reservas')).estado).toBe(403);
  });

  it('AC-004-04 una contraseña válida se guarda cifrada, activa la cuenta y lleva a la home del rol', async () => {
    const { cookie } = await martaProvisional();
    const r = await cambiar(cookie, 'MiClave2026');
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({ destino: '/mis-reservas' });
    const marta = (await cuentas()).find((c) => c.email === 'marta@club.test');
    expect(marta.mustChangePassword).toBe(false);
    expect(verificarContrasena('MiClave2026', marta.passwordHash)).toBe(true);
    expect(JSON.stringify(await app.store.leer())).not.toContain('MiClave2026');
    expect((await http({ metodo: 'GET', ruta: '/api/mis-reservas', cookie })).estado).toBe(200);
    expect((await entrar('marta@club.test', 'MiClave2026')).cuerpo.destino).toBe('/mis-reservas');
    expect((await entrar('marta@club.test', 'Provisional1')).estado).toBe(401);
  });

  it('AC-004-04 el encargado y la junta con provisional van a su propia home', async () => {
    await app.store.transaccion((d) => { d.cuentas.find((c) => c.email === 'pablo@club.test').mustChangePassword = true; });
    const cookie = await sesionDe(PABLO);
    expect((await cambiar(cookie, 'OtraClave123')).cuerpo).toEqual({ destino: '/panel' });
  });

  it('AC-004-05 sin sesión se rechaza y no cambia nada', async () => {
    const antes = JSON.stringify(await app.store.leer());
    const r = await cambiar(undefined, 'MiClave2026');
    expect(r.estado).toBe(401);
    expect(r.cuerpo).toEqual({ entrar: true });
    expect(JSON.stringify(await app.store.leer())).toBe(antes);
  });

  it('AC-004-06 repetir el cambio deja la última contraseña enviada, sin duplicar nada', async () => {
    const { cookie } = await martaProvisional();
    await cambiar(cookie, 'MiClave2026');
    expect((await cambiar(cookie, 'MiClave2026')).estado).toBe(200);
    expect((await cambiar(cookie, 'Otra12345')).estado).toBe(200);
    expect((await cuentas()).filter((c) => c.email === 'marta@club.test')).toHaveLength(1);
    expect((await entrar('marta@club.test', 'Otra12345')).estado).toBe(200);
    expect((await entrar('marta@club.test', 'MiClave2026')).estado).toBe(401);
  });

  // REQ-F-002 REQ-NF-001 (INV-SEC-003): "un socio no abre /socios: E_PAGINA_PROHIBIDA"
  it('REQ-F-002 REQ-NF-001 un socio que abre /socios recibe E_PAGINA_PROHIBIDA y el encargado la abre', async () => {
    const r = await pagina(await sesionDe(LUCIA), '/socios');
    expect(r.estado).toBe(403);
    expect(r.cuerpo.error).toEqual({ codigo: 'E_PAGINA_PROHIBIDA', mensaje: 'No tienes permiso para ver esta página' });
    expect((await pagina(await sesionDe(PABLO), '/socios')).estado).toBe(200);
  });
});

const restablecer = (cookie, id, contrasena) => http({ metodo: 'PUT', ruta: `/api/socios/${id}/contrasena`, cuerpo: { contrasena }, cookie });
/** Marta ya eligió su contraseña («MiClave2026»); devuelve su id. */
async function martaActiva() {
  const { cookie } = await martaProvisional();
  await cambiar(cookie, 'MiClave2026');
  return (await cuentas()).find((c) => c.email === 'marta@club.test').id;
}

describe('UC-005 · API-001-05 resetMemberPassword', () => {
  // INV-SOC-102: "restablecer deja mustChangePassword y la contraseña anterior deja de valer"
  it('AC-005-02 AC-005-03 INV-SOC-102 la provisional se guarda cifrada, Marta entra con ella y debe elegir otra, y la antigua ya no vale', async () => {
    const id = await martaActiva();
    const r = await restablecer(await sesionDe(PABLO), id, 'Otra12345');
    expect(r.estado).toBe(200);
    expect(r.cuerpo.mensaje).toBe('Contraseña provisional guardada para Marta Ruiz');
    const marta = (await cuentas()).find((c) => c.id === id);
    expect(marta.mustChangePassword).toBe(true);
    expect(verificarContrasena('Otra12345', marta.passwordHash)).toBe(true);
    expect(JSON.stringify(await app.store.leer())).not.toContain('Otra12345');
    const nueva = await entrar('marta@club.test', 'Otra12345');
    expect(nueva.cuerpo.destino).toBe('/cambiar-contrasena');
    expect((await http({ metodo: 'GET', ruta: '/api/mis-reservas', cookie: cookieDe(nueva) })).estado).toBe(403);
    const antigua = await entrar('marta@club.test', 'MiClave2026');
    expect(antigua.estado).toBe(401);
    expect(antigua.cuerpo.error).toEqual({ codigo: 'E_CREDENCIALES', mensaje: 'Correo o contraseña incorrectos' });
  });

  it('INV-SOC-102 una sesión que Marta ya tenía abierta pasa a pedirle la contraseña nueva', async () => {
    const id = await martaActiva();
    const abierta = cookieDe(await entrar('marta@club.test', 'MiClave2026'));
    expect((await http({ metodo: 'GET', ruta: '/api/mis-reservas', cookie: abierta })).estado).toBe(200);
    await restablecer(await sesionDe(PABLO), id, 'Otra12345');
    expect((await http({ metodo: 'GET', ruta: '/api/mis-reservas', cookie: abierta })).estado).toBe(403);
  });

  it('AC-005-04 una contraseña corta da E_CONTRASENA_CORTA y la contraseña de Marta queda como estaba', async () => {
    const id = await martaActiva();
    const antes = (await cuentas()).find((c) => c.id === id).passwordHash;
    const r = await restablecer(await sesionDe(PABLO), id, 'corta');
    expect(r.cuerpo.error.codigo).toBe('E_CONTRASENA_CORTA');
    expect((await cuentas()).find((c) => c.id === id)).toMatchObject({ passwordHash: antes, mustChangePassword: false });
  });

  it('AC-005-05 un socio o la junta reciben E_ACCESO_DENEGADO y nada cambia', async () => {
    const id = await martaActiva();
    const antes = JSON.stringify(await app.store.leer());
    for (const quien of [LUCIA, ['elena@club.test', 'Junta2026!']]) {
      const r = await restablecer(await sesionDe(quien), id, 'Otra12345');
      expect(r.estado).toBe(403);
      expect(r.cuerpo.error.codigo).toBe('E_ACCESO_DENEGADO');
    }
    expect(JSON.stringify(await app.store.leer())).toBe(antes);
  });

  it('AC-005-06 repetir el restablecimiento deja la última provisional', async () => {
    const id = await martaActiva();
    const pablo = await sesionDe(PABLO);
    await restablecer(pablo, id, 'Otra12345');
    expect((await restablecer(pablo, id, 'Otra12345')).estado).toBe(200);
    expect((await restablecer(pablo, id, 'Tercera1234')).estado).toBe(200);
    expect((await entrar('marta@club.test', 'Tercera1234')).estado).toBe(200);
    expect((await entrar('marta@club.test', 'Otra12345')).estado).toBe(401);
  });

  it('RN-027 un socio inexistente o de baja da E_SOCIO_NO_ENCONTRADO sin cambios', async () => {
    const id = await martaActiva();
    const pablo = await sesionDe(PABLO);
    const nadie = await restablecer(pablo, 'c-no-existe', 'Otra12345');
    expect(nadie.estado).toBe(404);
    expect(nadie.cuerpo.error).toEqual({ codigo: 'E_SOCIO_NO_ENCONTRADO', mensaje: 'El socio no existe o ya está de baja' });
    await app.store.transaccion((d) => { d.cuentas.find((c) => c.id === id).active = false; });
    expect((await restablecer(pablo, id, 'Otra12345')).cuerpo.error.codigo).toBe('E_SOCIO_NO_ENCONTRADO');
    expect(verificarContrasena('MiClave2026', (await cuentas()).find((c) => c.id === id).passwordHash)).toBe(true);
  });
});

const baja = (cookie, id) => http({ metodo: 'POST', ruta: `/api/socios/${id}/baja`, cuerpo: {}, cookie });
const idDe = async (correo) => (await cuentas()).find((c) => c.email === correo).id;
const reservasDe = async (correo) => { const id = await idDe(correo); return (await app.store.leer()).reservas.filter((r) => r.accountId === id); };

describe('UC-006 · API-001-06 removeMember', () => {
  it('AC-006-02 INV-SOC-008 INV-SOC-007 la baja guarda bajaEn y conserva los datos; Marta ya no entra y recibe E_CREDENCIALES, y su sesión abierta se cierra', async () => {
    const id = await martaActiva();
    const abierta = cookieDe(await entrar('marta@club.test', 'MiClave2026'));
    const r = await baja(await sesionDe(PABLO), id);
    expect(r.estado).toBe(200);
    expect(r.cuerpo.mensaje).toBe('Socio dado de baja: Marta Ruiz');
    expect((await cuentas()).find((c) => c.id === id)).toMatchObject({ name: 'Marta Ruiz', email: 'marta@club.test', active: false, bajaEn: '2026-11-22' });
    const intento = await entrar('marta@club.test', 'MiClave2026');
    expect(intento.estado).toBe(401);
    expect(intento.cuerpo.error).toEqual({ codigo: 'E_CREDENCIALES', mensaje: 'Correo o contraseña incorrectos' });
    expect((await http({ metodo: 'GET', ruta: '/api/mis-reservas', cookie: abierta })).estado).toBe(401);   // RN-026: su sesión ya no existe
    const estado = (await listar(await sesionDe(PABLO))).cuerpo.socios.find((s) => s.id === id).estado;
    expect(estado).toBe('Baja');
  });

  it('INV-SOC-101 D-PA-011 la baja cancela sus reservas Reservada (también la que empieza hoy) y no toca las de otros socios ni las ya devueltas', async () => {
    await preparar({ reservas: [
      { socio: 'lucia@club.test', material: 'Casco', cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' },
      { socio: 'lucia@club.test', material: 'Casco', cantidad: 1, inicio: '2026-11-22', fin: '2026-11-24' },
      { socio: 'lucia@club.test', material: 'Casco', cantidad: 1, inicio: '2026-11-01', fin: '2026-11-03', estado: 'Devuelta' },
      { socio: 'elena@club.test', material: 'Casco', cantidad: 1, inicio: '2026-12-05', fin: '2026-12-07' },
    ] });
    const r = await baja(await sesionDe(PABLO), await idDe('lucia@club.test'));
    expect(r.estado).toBe(200);
    expect((await reservasDe('lucia@club.test')).map((x) => x.status)).toEqual(['Cancelada', 'Cancelada', 'Devuelta']);
    expect((await reservasDe('elena@club.test')).map((x) => x.status)).toEqual(['Reservada']);
  });

  it('D-PA-011 si el almacén falla en mitad de la baja no cambia nada: ni la cuenta ni las reservas', async () => {
    await preparar({ reservas: [{ socio: 'lucia@club.test', material: 'Casco', cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' }] });
    const pablo = await sesionDe(PABLO);
    const antes = JSON.stringify(await app.store.leer());
    app.store.fallarEscritura = true;
    const r = await baja(pablo, await idDe('lucia@club.test'));
    expect(r.cuerpo.error.codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    app.store.fallarEscritura = false;
    expect(JSON.stringify(await app.store.leer())).toBe(antes);
    expect((await entrar(...LUCIA)).estado).toBe(200);
  });

  it('INV-SOC-007 con material sin devolver da E_BAJA_PRESTAMOS, y si además hay multa gana este error (RN-006); no cambia nada', async () => {
    await preparar({
      reservas: [{ socio: 'lucia@club.test', material: 'Casco', cantidad: 1, inicio: '2026-11-20', fin: '2026-11-25', estado: 'Prestada' }, { socio: 'lucia@club.test', material: 'Casco', cantidad: 1, inicio: '2026-12-05', fin: '2026-12-07' }],
      multas: [{ socio: 'lucia@club.test', importe: 4 }],
    });
    const antes = JSON.stringify(await app.store.leer());
    const r = await baja(await sesionDe(PABLO), await idDe('lucia@club.test'));
    expect(r.estado).toBe(409);
    expect(r.cuerpo.error).toEqual({ codigo: 'E_BAJA_PRESTAMOS', mensaje: 'No se puede dar de baja: tiene material sin devolver' });
    expect(JSON.stringify(await app.store.leer())).toBe(antes);
    expect((await entrar(...LUCIA)).estado).toBe(200);
  });

  it('INV-SOC-007 con una multa Pendiente da E_BAJA_MULTAS y no cambia nada; una multa Pagada no impide la baja', async () => {
    await preparar({
      reservas: [{ socio: 'lucia@club.test', material: 'Casco', cantidad: 1, inicio: '2026-12-05', fin: '2026-12-07' }],
      multas: [{ socio: 'lucia@club.test', importe: 4 }],
    });
    const pablo = await sesionDe(PABLO);
    const id = await idDe('lucia@club.test');
    const antes = JSON.stringify(await app.store.leer());
    const r = await baja(pablo, id);
    expect(r.estado).toBe(409);
    expect(r.cuerpo.error).toEqual({ codigo: 'E_BAJA_MULTAS', mensaje: 'No se puede dar de baja: tiene multas sin pagar' });
    expect(JSON.stringify(await app.store.leer())).toBe(antes);
    await app.store.transaccion((d) => { d.multas[0].status = 'Pagada'; });
    expect((await baja(pablo, id)).estado).toBe(200);
  });

  it('AC-006-06 solo el encargado da de baja: un socio recibe E_ACCESO_DENEGADO y no cambia nada', async () => {
    const id = await martaActiva();
    const antes = JSON.stringify(await app.store.leer());
    const r = await baja(await sesionDe(LUCIA), id);
    expect(r.estado).toBe(403);
    expect(r.cuerpo.error.codigo).toBe('E_ACCESO_DENEGADO');
    expect(JSON.stringify(await app.store.leer())).toBe(antes);
  });

  // D-PA-002, ADR-005: "dar de baja a quien ya está de baja avisa «ya estaba de baja», sin error y sin cambios"
  it('AC-006-07 dar de baja a quien ya está de baja responde 200 con el aviso «Marta Ruiz ya estaba de baja», sin error ni cambios', async () => {
    const id = await martaActiva();
    const pablo = await sesionDe(PABLO);
    await baja(pablo, id);
    const antes = JSON.stringify(await app.store.leer());
    const r = await baja(pablo, id);
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({ aviso: { codigo: 'E_YA_DE_BAJA', mensaje: 'Marta Ruiz ya estaba de baja' } });
    expect(JSON.stringify(await app.store.leer())).toBe(antes);
  });

  it('RN-027 dar de baja a un socio que no existe da E_SOCIO_NO_ENCONTRADO', async () => {
    const r = await baja(await sesionDe(PABLO), 'c-no-existe');
    expect(r.estado).toBe(404);
    expect(r.cuerpo.error.codigo).toBe('E_SOCIO_NO_ENCONTRADO');
  });
});
