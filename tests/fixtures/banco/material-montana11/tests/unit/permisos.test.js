import { describe, it, expect, beforeEach } from 'vitest';
import { OPERACIONES } from '../../src/domain/permisos.js';
import { iniciarSesion, cerrarSesion, comprobarSesion, crearSocio, listarSocios } from '../../src/domain/cuentas.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';

const FUNCIONES = { iniciarSesion, cerrarSesion, comprobarSesion, crearSocio, listarSocios };
const CON_SESION = ['cerrarSesion', 'comprobarSesion', 'crearSocio', 'listarSocios'];
let e;
beforeEach(() => {
  e = crearEntorno();
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  e.cuenta({ nombre: 'Junta', correo: 'junta@club.test', contrasena: 'Cumbre2026', rol: 'junta' });
});
const sesion = (correo) => e.ctx(iniciarSesion(e.ctx(), { correo, contrasena: 'Cumbre2026' }).sid);
const datos = { nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' };

describe('permisos', () => {
  it('permisos.js contiene las 5 operaciones de esta FASE, solo iniciarSesion pública', () => {
    expect(Object.keys(OPERACIONES).sort()).toEqual(['cerrarSesion', 'comprobarSesion', 'crearSocio', 'iniciarSesion', 'listarSocios']);
    expect(Object.entries(OPERACIONES).filter(([, d]) => d.publica).map(([n]) => n)).toEqual(['iniciarSesion']);
  });

  // REQ-NF-001 AC2: "GIVEN no session WHEN any data address is requested THEN the response is refused"
  it('SEC-T-002 REQ-NF-001 AC2 sin sesión toda operación salvo iniciarSesion devuelve E_NO_AUTENTICADO', async () => {
    for (const operacion of CON_SESION) {
      const error = await fallo(() => FUNCIONES[operacion](e.ctx(undefined), datos));
      expect(error.codigo, operacion).toBe('E_NO_AUTENTICADO');
    }
    expect((await fallo(() => listarSocios(e.ctx('inventada')))).codigo).toBe('E_NO_AUTENTICADO');
  });

  it('INV-ACC-007 un socio recibe E_ACCESO_NO_PERMITIDO en crearSocio y listarSocios; la junta también (INV-SEC-002)', async () => {
    for (const correo of ['lucia@club.test', 'junta@club.test']) {
      const ctx = sesion(correo);
      for (const operacion of ['crearSocio', 'listarSocios']) {
        const error = await fallo(() => FUNCIONES[operacion](ctx, datos));
        expect(error.codigo).toBe('E_ACCESO_NO_PERMITIDO');
        expect(error.message).toBe('Acceso no permitido');
      }
    }
    expect(e.store.leer().cuentas.some((c) => c.correo === 'pablo@club.test')).toBe(false);
  });

  it('D-T-006 el orden de errores es sesión → rol → validación', async () => {
    const vacio = { nombre: '', correo: '', contrasena: '' };
    expect((await fallo(() => crearSocio(e.ctx(undefined), vacio))).codigo).toBe('E_NO_AUTENTICADO');
    expect((await fallo(() => crearSocio(sesion('lucia@club.test'), vacio))).codigo).toBe('E_ACCESO_NO_PERMITIDO');
    expect((await fallo(() => crearSocio(sesion('marta@club.test'), vacio))).codigo).toBe('E_DATOS_INVALIDOS');
  });

  it('un error de rol no deshace la renovación de la actividad de una sesión válida', async () => {
    const ctx = sesion('lucia@club.test');
    e.avanzar(20);
    await fallo(() => listarSocios(ctx));
    e.avanzar(20);
    expect(comprobarSesion(ctx).rol).toBe('socio');
  });
});
