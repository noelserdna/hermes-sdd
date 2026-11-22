import { describe, it, expect } from 'vitest';
import { authorize } from '../../src/server/http/autorizar.js';
import { crearSesiones } from '../../src/server/servicios/sesiones.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';

const provisional = (rol = 'socio') => {
  const sesiones = crearSesiones({ reloj: crearRelojManual('2026-11-22T10:00:00Z') });
  return sesiones.obtener(sesiones.abrir({ cuentaId: 'a1', rol, nombre: 'Marta', debeCambiar: true }));
};

describe('INV-SOC-006 authorize con contraseña provisional', () => {
  // INV-SOC-006: "con mustChangePassword el único acceso permitido es cambiar la contraseña": solo API-001-02 y API-001-03
  it('AC-004-02 solo se permiten salir y cambiar la contraseña; cualquier otra operación pide cambiarla', () => {
    for (const op of ['API-001-02', 'API-001-03']) expect(authorize(provisional(), { operacion: op })).toEqual({ ok: true });
    for (const op of ['API-002-01', 'API-002-02', 'API-002-03', 'API-003-03', 'API-004-01']) {
      expect(authorize(provisional(), { operacion: op })).toEqual({ ok: false, cambiar: true });
    }
    for (const op of ['API-001-04', 'API-003-01', 'API-002-06']) expect(authorize(provisional('encargado'), { operacion: op })).toEqual({ ok: false, cambiar: true });
  });

  it('AC-004-02 de las páginas solo se abre /cambiar-contrasena; el resto lleva allí, también las que el rol no tiene', () => {
    expect(authorize(provisional(), { pagina: '/cambiar-contrasena' })).toEqual({ ok: true });
    for (const pagina of ['/mis-reservas', '/reservar', '/socios', '/panel']) expect(authorize(provisional(), { pagina })).toEqual({ ok: false, cambiar: true });
  });

  it('sin la marca el socio no queda atado: las operaciones de siempre siguen permitidas', () => {
    const sesiones = crearSesiones({ reloj: crearRelojManual('2026-11-22T10:00:00Z') });
    const normal = sesiones.obtener(sesiones.abrir({ cuentaId: 'a1', rol: 'socio', nombre: 'Marta' }));
    expect(authorize(normal, { operacion: 'API-002-01' })).toEqual({ ok: true });
  });
});
