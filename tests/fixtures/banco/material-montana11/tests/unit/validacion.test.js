import { describe, it, expect } from 'vitest';
import { normalizarCorreo, validarCorreo, validarNombre, validarContrasena, exigirTexto } from '../../src/domain/validacion.js';
import { PASSWORD_MIN_LENGTH } from '../../src/domain/constantes.js';

const codigo = (fn) => { try { fn(); } catch (e) { return [e.codigo, e.message]; } return null; };

describe('validacion', () => {
  it('validacion rechaza vacíos: correo sin forma válida o nombre vacío lanza E_DATOS_INVALIDOS', () => {
    expect(codigo(() => validarCorreo(''))).toEqual(['E_DATOS_INVALIDOS', 'Revisa los datos del formulario']);
    expect(codigo(() => validarCorreo('sin-arroba'))[0]).toBe('E_DATOS_INVALIDOS');
    expect(codigo(() => validarCorreo(undefined))[0]).toBe('E_DATOS_INVALIDOS');
    expect(codigo(() => validarNombre('   '))).toEqual(['E_DATOS_INVALIDOS', 'Revisa los datos del formulario']);
    expect(codigo(() => exigirTexto(''))[0]).toBe('E_DATOS_INVALIDOS');
  });

  it('el correo se normaliza a minúsculas y sin espacios', () => {
    expect(normalizarCorreo(' PABLO@club.test ')).toBe('pablo@club.test');
    expect(validarCorreo('PABLO@club.test')).toBe('pablo@club.test');
  });

  it('la contraseña corta lanza E_CONTRASENA_CORTA y la de 8 caracteres vale', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(codigo(() => validarContrasena('corta1'))).toEqual(['E_CONTRASENA_CORTA', 'La contraseña debe tener al menos 8 caracteres']);
    expect(validarContrasena('Nieve2026')).toBe('Nieve2026');
    expect(validarContrasena('12345678')).toBe('12345678');
  });

  it('una contraseña vacía es dato inválido, no contraseña corta', () => {
    expect(codigo(() => validarContrasena(''))[0]).toBe('E_DATOS_INVALIDOS');
  });
});
