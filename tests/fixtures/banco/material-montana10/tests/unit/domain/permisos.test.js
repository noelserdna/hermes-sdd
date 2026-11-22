import { describe, it, expect } from 'vitest';
import { puede } from '../../../src/domain/permisos.js';

describe('permisos', () => {
  it('PERMISSIONS-MATRIX Socio no puede anadirUnidades; Encargado sí; Junta solo lectura', () => {
    expect(puede('socio', 'anadirUnidades')).toBe(false);
    expect(puede('encargado', 'anadirUnidades')).toBe(true);
    expect(puede('junta', 'anadirUnidades')).toBe(false);
    expect(puede('junta', 'consultarHistorial')).toBe(true);
    expect(puede('junta', 'listarSocios')).toBe(true);
  });

  it('PERMISSIONS-MATRIX el socio reserva y el encargado no reserva ni cancela reservas', () => {
    expect(puede('socio', 'reservarMaterial')).toBe(true);
    expect(puede('socio', 'listarMisReservas')).toBe(true);
    expect(puede('encargado', 'reservarMaterial')).toBe(false);
    expect(puede('encargado', 'cancelarReserva')).toBe(false);
    expect(puede('junta', 'reservarMaterial')).toBe(false);
  });

  it('PERMISSIONS-MATRIX todos los roles entran y salen; un rol o una operación desconocidos no pueden nada', () => {
    for (const rol of ['socio', 'encargado', 'junta']) {
      expect(puede(rol, 'iniciarSesion')).toBe(true);
      expect(puede(rol, 'cerrarSesion')).toBe(true);
    }
    expect(puede('visitante', 'iniciarSesion')).toBe(false);
    expect(puede('encargado', 'operacionInventada')).toBe(false);
  });
});
