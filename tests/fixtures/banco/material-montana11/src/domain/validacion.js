import { ErrorDominio } from './errores.js';
import { PASSWORD_MIN_LENGTH, MATERIAL_TYPES } from './constantes.js';

const FORMA_CORREO = /^[^\s@]+@[^\s@]+$/;

export function normalizarCorreo(correo) {
  return String(correo ?? '').trim().toLowerCase();
}

/** Texto obligatorio: vacío o no-texto es E_DATOS_INVALIDOS. */
export function exigirTexto(valor) {
  if (typeof valor !== 'string' || valor.trim() === '') throw new ErrorDominio('E_DATOS_INVALIDOS');
  return valor;
}

export function validarCorreo(correo) {
  exigirTexto(correo);
  const normal = normalizarCorreo(correo);
  if (!FORMA_CORREO.test(normal)) throw new ErrorDominio('E_DATOS_INVALIDOS');
  return normal;
}

export function validarNombre(nombre) {
  exigirTexto(nombre);
  return nombre.trim();
}

/** INV-ACC-002: al menos PASSWORD_MIN_LENGTH caracteres. */
export function validarContrasena(contrasena) {
  if (typeof contrasena !== 'string' || contrasena === '') throw new ErrorDominio('E_DATOS_INVALIDOS');
  if (contrasena.length < PASSWORD_MIN_LENGTH) throw new ErrorDominio('E_CONTRASENA_CORTA');
  return contrasena;
}

/** VO-004 / INV-STK-001: ausente o no-texto es E_DATOS_INVALIDOS; un texto fuera del catálogo, E_MATERIAL_INVALIDO. */
export function validarTipo(tipo) {
  exigirTexto(tipo);
  if (!MATERIAL_TYPES.includes(tipo)) throw new ErrorDominio('E_MATERIAL_INVALIDO');
  return tipo;
}

/** VO-009 / INV-STK-002: ausente o no numérica es E_DATOS_INVALIDOS; un número que no es entero ≥ 1, E_CANTIDAD_INVALIDA. */
export function validarCantidad(cantidad) {
  if (typeof cantidad !== 'number' || Number.isNaN(cantidad)) throw new ErrorDominio('E_DATOS_INVALIDOS');
  if (!Number.isInteger(cantidad) || cantidad < 1) throw new ErrorDominio('E_CANTIDAD_INVALIDA');
  return cantidad;
}

/** VO-001: día completo "AAAA-MM-DD" que existe en el calendario; ausente o mal formado es E_DATOS_INVALIDOS. */
export function validarFecha(fecha) {
  exigirTexto(fecha);
  const dia = new Date(`${fecha}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== fecha) throw new ErrorDominio('E_DATOS_INVALIDOS');
  return fecha;
}

/** Días entre dos fechas válidas (`fin` − `inicio`); 0 si es el mismo día. */
export function diasEntre(inicio, fin) {
  return Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000);
}
