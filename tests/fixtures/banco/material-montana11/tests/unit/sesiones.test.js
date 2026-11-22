import { describe, it, expect } from 'vitest';
import { nuevaSesion, leerSid, cookieSesion, cookieBorrada } from '../../src/server/sesiones.js';
import { autorizar, OPERACIONES } from '../../src/domain/permisos.js';
import { ErrorDominio } from '../../src/domain/errores.js';

describe('sesiones', () => {
  it('nuevaSesion guarda un identificador opaco y la última actividad como instante', () => {
    const db = { sesiones: [] };
    const s = nuevaSesion(db, 7, Date.parse('2026-12-05T10:00:00Z'));
    expect(s.id).toMatch(/^[0-9a-f]{64}$/);
    expect(db.sesiones).toEqual([{ id: s.id, cuentaId: 7, ultimaActividad: '2026-12-05T10:00:00.000Z' }]);
    expect(nuevaSesion(db, 7, 0).id).not.toBe(s.id);
  });

  it('SEC-T-004 la cookie sid es HttpOnly y SameSite=Strict; se lee de la cabecera Cookie', () => {
    const c = cookieSesion('abc');
    expect(c).toContain('sid=abc');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Strict');
    expect(leerSid('otra=1; sid=abc; x=y')).toBe('abc');
    expect(leerSid(undefined)).toBeUndefined();
    expect(cookieBorrada()).toContain('Max-Age=0');
  });
});

describe('permisos', () => {
  it('iniciarSesion es la única operación pública y se autoriza sin sesión', () => {
    expect(OPERACIONES.iniciarSesion.publica).toBe(true);
    expect(autorizar({ sid: undefined }, { sesiones: [], cuentas: [] }, 'iniciarSesion')).toBeNull();
  });

  it('una operación con sesión sin sesión devuelve E_NO_AUTENTICADO', () => {
    expect(() => autorizar({ sid: undefined }, { sesiones: [], cuentas: [] }, 'listarSocios')).toThrowError(expect.any(ErrorDominio));
  });
});
