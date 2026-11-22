import { describe, it, expect, beforeEach } from 'vitest';
import { REGISTRO, autorizar } from '../../src/domain/permisos.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';
import { sesionDe } from '../helpers/material.js';

let e;
beforeEach(() => {
  e = crearEntorno();
  e.cuenta({ nombre: 'Junta', correo: 'junta@club.test', contrasena: 'Cumbre2026', rol: 'junta' });
});
const PERMITIDAS_A_LA_JUNTA = ['iniciarSesion', 'cerrarSesion', 'comprobarSesion', 'consultarHistorialSocio', 'listarSociosHistorial'];

describe('INV-SEC-002 la junta solo lee', () => {
  // INV-SEC-002: "la junta solo puede API-001-02, API-001-03 y API-003-10; cualquier otra operación da E_ACCESO_NO_PERMITIDO"
  it('SEC-T-005 INV-SEC-002 la junta solo puede cerrar sesión, comprobarla y consultar el historial (y listar socios en lectura); cualquier otra operación da E_ACCESO_NO_PERMITIDO', async () => {
    const ctx = e.ctx(sesionDe(e, 'junta@club.test'));
    for (const operacion of Object.keys(REGISTRO)) {
      const error = await fallo(() => e.store.transaccion((db) => autorizar(ctx, db, operacion)));
      if (PERMITIDAS_A_LA_JUNTA.includes(operacion)) expect(error, operacion).toBeNull();
      else expect(error?.codigo, operacion).toBe('E_ACCESO_NO_PERMITIDO');
    }
  });

  it('INV-SEC-002 la junta no tiene ninguna operación de escritura', () => {
    const delaJunta = Object.entries(REGISTRO).filter(([, d]) => d.roles?.includes('junta')).map(([n]) => n);
    expect(delaJunta.sort()).toEqual(['cerrarSesion', 'comprobarSesion', 'consultarHistorialSocio', 'listarSociosHistorial']);
  });
});
