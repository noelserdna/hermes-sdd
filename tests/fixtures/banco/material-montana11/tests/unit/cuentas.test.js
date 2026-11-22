import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { iniciarSesion, cerrarSesion, comprobarSesion } from '../../src/domain/cuentas.js';
import { LOGIN_MAX_FAILURES, LOCK_MINUTES } from '../../src/domain/constantes.js';
import { tituloInicio } from '../../src/ui/textos.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';

let e;
beforeEach(() => {
  e = crearEntorno();
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  e.cuenta({ nombre: 'Junta', correo: 'junta@club.test', contrasena: 'Cumbre2026', rol: 'junta' });
});
const entrar = (correo, contrasena) => iniciarSesion(e.ctx(), { correo, contrasena });
const cuenta = (correo) => e.store.leer().cuentas.find((c) => c.correo === correo);

describe('UC-001 iniciarSesion', () => {
  it('UC-001 la junta entra: se abre sesión con su rol y su título de inicio', async () => {
    const r = await entrar('junta@club.test', 'Cumbre2026');
    expect(r.rol).toBe('junta');
    expect(tituloInicio(r.rol)).toBe('Historial del socio');
  });

  it('el socio y el encargado reciben su rol y la sesión queda en el almacén', async () => {
    const socio = await entrar('lucia@club.test', 'Cumbre2026');
    expect(socio).toMatchObject({ nombre: 'Lucía Gil', rol: 'socio' });
    expect((await entrar('MARTA@club.test', 'Cumbre2026')).rol).toBe('encargado');
    expect(e.store.leer().sesiones.map((s) => s.id)).toContain(socio.sid);
  });

  it('INV-ACC-006 contraseña errónea y correo inexistente dan el mismo error E_CREDENCIALES_INVALIDAS', async () => {
    const errorClave = await fallo(() => entrar('lucia@club.test', 'x'));
    const errorCorreo = await fallo(() => entrar('nadie@club.test', 'Cumbre2026'));
    expect(errorClave.codigo).toBe('E_CREDENCIALES_INVALIDAS');
    expect(errorClave.message).toBe('Correo o contraseña incorrectos');
    expect(errorCorreo.codigo).toBe(errorClave.codigo);
    expect(cuenta('lucia@club.test').fallosSeguidos).toBe(1);
  });

  // REQ-F-001 AC9: "GIVEN a deactivated member "pablo@club.test" WHEN he submits his correct password THEN the user sees "Correo o contraseña incorrectos""
  it('INV-ACC-006 cuenta en Baja: mismo error que con la clave errónea', async () => {
    e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026', estado: 'Baja' });
    const error = await fallo(() => entrar('pablo@club.test', 'Nieve2026'));
    expect(error.codigo).toBe('E_CREDENCIALES_INVALIDAS');
    expect(error.message).toBe('Correo o contraseña incorrectos');
    expect(cuenta('pablo@club.test').fallosSeguidos).toBe(0);
  });

  it('INV-ACC-004 el quinto fallo bloquea 15 minutos y 10 minutos después la clave buena también se rechaza', async () => {
    expect(LOGIN_MAX_FAILURES).toBe(5);
    expect(LOCK_MINUTES).toBe(15);
    for (let i = 0; i < 4; i++) expect((await fallo(() => entrar('lucia@club.test', 'x'))).codigo).toBe('E_CREDENCIALES_INVALIDAS');
    const quinto = await fallo(() => entrar('lucia@club.test', 'x'));
    expect(quinto.codigo).toBe('E_CUENTA_BLOQUEADA');
    expect(quinto.message).toBe('Cuenta bloqueada durante 15 minutos');
    e.avanzar(10);
    const sexto = await fallo(() => entrar('lucia@club.test', 'Cumbre2026'));
    expect(sexto.codigo).toBe('E_CUENTA_BLOQUEADA');
    expect(e.store.leer().sesiones).toEqual([]);
  });

  // REQ-F-001 AC5: "GIVEN "lucia@club.test" was blocked 15 minutes ago WHEN she submits the correct password THEN the user sees the heading "Material disponible""
  it('INV-ACC-004 bloqueo cumplido: pasados 15 minutos la clave Cumbre2026 abre sesión', async () => {
    for (let i = 0; i < 5; i++) await fallo(() => entrar('lucia@club.test', 'x'));
    e.avanzar(LOCK_MINUTES);
    const r = await entrar('lucia@club.test', 'Cumbre2026');
    expect(tituloInicio(r.rol)).toBe('Material disponible');
    expect(cuenta('lucia@club.test')).toMatchObject({ fallosSeguidos: 0, bloqueadaHasta: null });
  });

  it('INV-ACC-004 un acierto fuera del bloqueo pone los fallos a 0', async () => {
    await fallo(() => entrar('lucia@club.test', 'x'));
    await fallo(() => entrar('lucia@club.test', 'x'));
    await entrar('lucia@club.test', 'Cumbre2026');
    expect(cuenta('lucia@club.test').fallosSeguidos).toBe(0);
  });

  it('AC-001-05 datos vacíos: E_DATOS_INVALIDOS y el contador de fallos no cambia', async () => {
    await fallo(() => entrar('lucia@club.test', 'x'));
    for (const [correo, contrasena] of [['', 'Cumbre2026'], ['lucia@club.test', ''], [undefined, undefined]]) {
      const error = await fallo(() => entrar(correo, contrasena));
      expect(error.codigo).toBe('E_DATOS_INVALIDOS');
    }
    expect(cuenta('lucia@club.test').fallosSeguidos).toBe(1);
  });

  it('AC-001-09 almacén caído: E_ALMACEN_NO_DISPONIBLE y no se abre sesión', async () => {
    e.caer();
    const error = await fallo(() => entrar('lucia@club.test', 'Cumbre2026'));
    expect(error.codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    expect(error.message).toBe('No se pudo guardar. Inténtalo de nuevo');
    e.caer(false);
    expect(e.store.leer().sesiones).toEqual([]);
  });

  it('AC-001-10 el mismo envío correcto otra vez abre otra sesión, los fallos siguen a 0 y no se duplica la cuenta', async () => {
    const a = await entrar('lucia@club.test', 'Cumbre2026');
    const b = await entrar('lucia@club.test', 'Cumbre2026');
    expect(b.sid).not.toBe(a.sid);
    expect(e.store.leer().sesiones).toHaveLength(2);
    expect(cuenta('lucia@club.test').fallosSeguidos).toBe(0);
    expect(e.store.leer().cuentas.filter((c) => c.correo === 'lucia@club.test')).toHaveLength(1);
  });

  it('SEC-T-003 solo hash: el almacén guarda scrypt y nunca Cumbre2026 en claro', async () => {
    await entrar('lucia@club.test', 'Cumbre2026');
    const texto = readFileSync(e.archivo, 'utf8');
    expect(texto).not.toContain('Cumbre2026');
    expect(cuenta('lucia@club.test').hashContrasena).toMatch(/^scrypt\$/);
  });
});

describe('UC-002 sesión', () => {
  const abrir = (correo = 'lucia@club.test') => iniciarSesion(e.ctx(), { correo, contrasena: 'Cumbre2026' }).sid;
  const actividad = (sid) => e.store.leer().sesiones.find((s) => s.id === sid)?.ultimaActividad;

  it('comprobarSesion devuelve la cuenta y el rol, y la junta y el encargado también pueden', () => {
    expect(comprobarSesion(e.ctx(abrir()))).toEqual({ nombre: 'Lucía Gil', correo: 'lucia@club.test', rol: 'socio' });
    expect(comprobarSesion(e.ctx(abrir('junta@club.test'))).rol).toBe('junta');
    expect(comprobarSesion(e.ctx(abrir('marta@club.test'))).rol).toBe('encargado');
  });

  it('AC-002-02 con la sesión cerrada, la operación devuelve E_NO_AUTENTICADO ("Entrar")', async () => {
    const sid = abrir();
    cerrarSesion(e.ctx(sid));
    const error = await fallo(() => comprobarSesion(e.ctx(sid)));
    // REQ-F-001 AC7: "GIVEN a signed-in member WHEN she presses \"Salir\" THEN the user sees the login form and going back to a member screen shows the login form again"
    expect(error.codigo).toBe('E_NO_AUTENTICADO');
    expect(error.message).toBe('Entrar');
    expect(e.store.leer().sesiones).toEqual([]);
  });

  it('AC-002-07 salir dos veces no rompe: el segundo es E_NO_AUTENTICADO', async () => {
    const sid = abrir();
    cerrarSesion(e.ctx(sid));
    expect((await fallo(() => cerrarSesion(e.ctx(sid)))).codigo).toBe('E_NO_AUTENTICADO');
  });

  it('cerrarSesion admite a la junta y al encargado (exentas de INV-SEC-002, D-PA-004)', () => {
    for (const correo of ['junta@club.test', 'marta@club.test']) {
      const sid = abrir(correo);
      cerrarSesion(e.ctx(sid));
      expect(actividad(sid)).toBeUndefined();
    }
  });

  // REQ-F-001 AC6: "GIVEN a session with no activity for 30 minutes WHEN the member opens any screen THEN the user sees the login form with "Sesión caducada, vuelve a entrar""
  it('INV-ACC-005 a los 30 minutos y 1 segundo sin actividad comprobarSesion lanza E_SESION_CADUCADA', async () => {
    const sid = abrir();
    e.avanzar(30, 1);
    const error = await fallo(() => comprobarSesion(e.ctx(sid)));
    expect(error.codigo).toBe('E_SESION_CADUCADA');
    expect(error.message).toBe('Sesión caducada, vuelve a entrar');
    expect((await fallo(() => comprobarSesion(e.ctx(sid)))).codigo).toBe('E_NO_AUTENTICADO');
  });

  it('AC-002-04 la actividad renueva: una operación válida a los 29 min mantiene viva la sesión (INV-ACC-005)', () => {
    const sid = abrir();
    e.avanzar(29);
    comprobarSesion(e.ctx(sid));
    e.avanzar(29);
    expect(comprobarSesion(e.ctx(sid)).rol).toBe('socio');
    e.avanzar(30);
    expect(comprobarSesion(e.ctx(sid)).rol).toBe('socio');
  });

  it('AC-002-06 con el almacén caído: E_ALMACEN_NO_DISPONIBLE y la actividad no se renueva', async () => {
    const sid = abrir();
    const antes = actividad(sid);
    e.avanzar(5);
    e.caer();
    expect((await fallo(() => comprobarSesion(e.ctx(sid)))).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    expect((await fallo(() => cerrarSesion(e.ctx(sid)))).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    e.caer(false);
    expect(actividad(sid)).toBe(antes);
  });
});
