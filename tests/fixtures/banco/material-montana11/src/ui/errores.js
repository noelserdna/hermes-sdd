import { ERRORES } from '../domain/errores.js';

// REQ-C-002: traduce cada código de dominio con el mensaje literal de src/domain/errores.js.
export const MENSAJES = ERRORES;

export function mensajeError(codigo) {
  return ERRORES[codigo] ?? ERRORES.E_ALMACEN_NO_DISPONIBLE;
}
