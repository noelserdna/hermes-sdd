import { describe, it, expect } from 'vitest';
import { authorize, cookieSesion, leerCookieSesion } from '../../src/server/http/autorizar.js';
import { crearSesiones } from '../../src/server/servicios/sesiones.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';
import { crearApp } from '../../src/server/app.js';
import { crearAlmacenMemoria } from '../../src/server/store/almacen-memoria.js';

const con = (rol) => {
  const reloj = crearRelojManual('2026-11-22T10:00:00Z');
  const sesiones = crearSesiones({ reloj });
  const id = sesiones.abrir({ cuentaId: 'a1', rol, nombre: 'X' });
  return { reloj, sesiones, id, sesion: sesiones.obtener(id) };
};

describe('API-001-08 authorize', () => {
  // AC-001-08 (REQ-F-001, INV-SEC-003): "GIVEN socio with a session WHEN he opens a page of the encargado THEN E_PAGINA_PROHIBIDA, sin datos de otros socios"
  it('AC-001-08 un socio en /material recibe E_PAGINA_PROHIBIDA', () => {
    const { sesion } = con('socio');
    expect(authorize(sesion, { pagina: '/material' })).toEqual({ ok: false, codigo: 'E_PAGINA_PROHIBIDA' });
  });

  it('AC-001-08 una operación fuera del rol recibe E_ACCESO_DENEGADO (socio y junta no gestionan material)', () => {
    expect(authorize(con('socio').sesion, { operacion: 'API-003-01' })).toEqual({ ok: false, codigo: 'E_ACCESO_DENEGADO' });
    expect(authorize(con('junta').sesion, { operacion: 'API-003-02' })).toEqual({ ok: false, codigo: 'E_ACCESO_DENEGADO' });
  });

  it('la tabla sigue PERMISSIONS-MATRIX.md: encargado gestiona material y no reserva; socio lista tipos y reserva', () => {
    const encargado = con('encargado').sesion;
    for (const op of ['API-003-01', 'API-003-02', 'API-003-03', 'API-001-02']) expect(authorize(encargado, { operacion: op }).ok).toBe(true);
    expect(authorize(encargado, { operacion: 'API-002-01' }).ok).toBe(false);
    const socio = con('socio').sesion;
    for (const op of ['API-003-03', 'API-002-01', 'API-001-02']) expect(authorize(socio, { operacion: op }).ok).toBe(true);
    expect(authorize(con('junta').sesion, { operacion: 'API-001-07' }).ok).toBe(true);
    expect(authorize(socio, { operacion: 'API-001-07' }).ok).toBe(false);
  });

  it('páginas por rol: cada rol entra en las suyas y en ninguna de otro', () => {
    expect(authorize(con('socio').sesion, { pagina: '/mis-reservas' }).ok).toBe(true);
    expect(authorize(con('socio').sesion, { pagina: '/reservar' }).ok).toBe(true);
    expect(authorize(con('encargado').sesion, { pagina: '/panel' }).ok).toBe(true);
    expect(authorize(con('encargado').sesion, { pagina: '/material' }).ok).toBe(true);
    expect(authorize(con('encargado').sesion, { pagina: '/reservar' }).ok).toBe(false);
    expect(authorize(con('socio').sesion, { pagina: '/panel' }).codigo).toBe('E_PAGINA_PROHIBIDA');
  });

  it('sin sesión pide Entrar, sin código de error', () => {
    expect(authorize(null, { pagina: '/mis-reservas' })).toEqual({ ok: false, entrar: true });
  });

  it('renueva la actividad solo cuando autoriza', () => {
    const { reloj, sesiones, id, sesion } = con('socio');
    reloj.avanzar(20);
    authorize(sesion, { pagina: '/panel' });          // denegado: no renueva
    reloj.avanzar(11);
    expect(sesiones.obtener(id)).toBeNull();

    const b = con('socio');
    b.reloj.avanzar(20);
    expect(authorize(b.sesion, { pagina: '/mis-reservas' }).ok).toBe(true);   // autorizado: renueva
    b.reloj.avanzar(20);
    expect(b.sesiones.obtener(b.id)).not.toBeNull();
  });
});

describe('INV-SOC-005 cookie de sesión', () => {
  it('la cookie es HttpOnly y SameSite=Strict; Secure solo con MM_COOKIE_SECURE', () => {
    const c = cookieSesion('abc', { secure: false });
    expect(c).toContain('mm_sesion=abc');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Strict');
    expect(c).toContain('Path=/');
    expect(c).not.toContain('Secure');
    expect(cookieSesion('abc', { secure: true })).toContain('Secure');
    expect(cookieSesion('', { secure: false, borrar: true })).toContain('Max-Age=0');
  });

  it('leerCookieSesion extrae el id de la cabecera Cookie', () => {
    expect(leerCookieSesion('otra=1; mm_sesion=xyz; z=2')).toBe('xyz');
    expect(leerCookieSesion(undefined)).toBeNull();
  });
});

describe('D-PA-008 crearApp', () => {
  it('construye almacén, reloj y sesiones con los límites del registro de valores', () => {
    const app = crearApp({ store: crearAlmacenMemoria(), reloj: crearRelojManual('2026-11-22T10:00:00Z') });
    expect(app.config).toMatchObject({ LOGIN_MAX_FAILURES: 5, LOGIN_LOCK_MINUTES: 15, SESSION_IDLE_MINUTES: 30 });
    expect(typeof app.sesiones.abrir).toBe('function');
    expect(app.store).toBeDefined();
  });
});
