import { describe, it, expect, beforeEach } from 'vitest';
import { REGISTRO, autorizar } from '../../src/domain/permisos.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';
import { sesionDe } from '../helpers/material.js';

// SEC-T-005: lo que cada rol puede (PERMISSIONS-MATRIX, Q-spec-auditor-001: aplicarNoRecogidas y aplicarMultaPorRetraso son
// del sistema). La tabla nombra las operaciones de cada criterio; no fija la lista cerrada de las de permisos.js.
const SOLO_SESION = ['cerrarSesion', 'comprobarSesion'];
const PERMITIDO = {
  socio: [...SOLO_SESION, 'consultarDisponibilidad', 'reservarMaterial', 'listarMisReservas', 'cancelarReserva', 'listarMisMultas'],
  encargado: [...SOLO_SESION, 'crearSocio', 'listarSocios', 'restablecerContrasena', 'darDeBajaSocio', 'listarInventario', 'anadirMaterial', 'darDeBajaUnidad',
    'listarPrestamosYReservas', 'entregarReserva', 'registrarDevolucion', 'listarMultas', 'marcarMultaPagada', 'consultarPrestado'],
  junta: [...SOLO_SESION, 'consultarHistorialSocio'],
  sistema: ['aplicarNoRecogidas', 'aplicarMultaPorRetraso'],
};
const NOMBRADAS = [...new Set(Object.values(PERMITIDO).flat())];

let e;
beforeEach(() => {
  e = crearEntorno();
  e.cuenta({ nombre: 'Lucía Gil', correo: 'socio@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Marta', correo: 'encargado@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  e.cuenta({ nombre: 'Junta', correo: 'junta@club.test', contrasena: 'Cumbre2026', rol: 'junta' });
  e.cuenta({ nombre: 'Sistema', correo: 'sistema@club.test', contrasena: 'Cumbre2026', rol: 'sistema' });
});

describe('SEC-T-005 cada operación de permisos.js por rol', () => {
  for (const rol of Object.keys(PERMITIDO)) {
    it(`SEC-T-005 el rol ${rol} puede ${PERMITIDO[rol].join(', ')} y ninguna otra de las operaciones nombradas (E_ACCESO_NO_PERMITIDO)`, async () => {
      const ctx = e.ctx(sesionDe(e, `${rol}@club.test`));
      for (const operacion of NOMBRADAS) {
        expect(REGISTRO[operacion], `${operacion} está en permisos.js`).toBeDefined();
        const error = await fallo(() => e.store.transaccion((db) => autorizar(ctx, db, operacion)));
        if (PERMITIDO[rol].includes(operacion)) expect(error, `${rol} ${operacion}`).toBeNull();
        else expect(error?.codigo, `${rol} ${operacion}`).toBe('E_ACCESO_NO_PERMITIDO');
      }
    });
  }

  it('SEC-T-005 solo iniciarSesion es pública y ninguna operación del sistema es de otro rol', () => {
    expect(Object.entries(REGISTRO).filter(([, d]) => d.publica).map(([n]) => n)).toEqual(['iniciarSesion']);
    for (const operacion of PERMITIDO.sistema) expect(REGISTRO[operacion].roles).toEqual(['sistema']);
  });
});
