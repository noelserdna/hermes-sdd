import { LOGIN_LOCK_MINUTES, RESERVA_MAX_DAYS, PASSWORD_MIN_LENGTH } from './config.js';

// Catálogo VO-010: mensaje literal tal y como lo ve la persona; {x} se sustituye con los parámetros del error.
const e = (clase, mensaje) => ({ clase, mensaje });

export const CATALOGO = {
  E_CREDENCIALES_INVALIDAS: e('AuthError', 'Correo o contraseña incorrectos'),
  E_CUENTA_BLOQUEADA: e('AuthError', `Cuenta bloqueada. Inténtalo de nuevo en ${LOGIN_LOCK_MINUTES} minutos`),
  E_SESION_CADUCADA: e('AuthError', 'Tu sesión ha caducado'),
  E_NO_AUTENTICADO: e('AuthError', 'Entrar'),
  E_SIN_PERMISO: e('PermissionError', 'No tienes permiso para ver esta pantalla'),
  E_SIN_PERMISO_CANCELAR: e('PermissionError', 'No tienes permiso para cancelar esta reserva'),
  E_CORREO_DUPLICADO: e('ConflictError', 'Ya existe un socio con ese correo'),
  E_CONTRASENA_CORTA: e('ValidationError', `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`),
  E_BAJA_SOCIO_BLOQUEADA: e('ConflictError', 'No se puede dar de baja: tiene material prestado o multas pendientes'),
  E_SIN_UNIDADES_LIBRES: e('ConflictError', 'No quedan unidades libres de {material} esas fechas'),
  E_FECHA_PASADA: e('ValidationError', 'Las fechas no pueden estar en el pasado'),
  E_FECHAS_INVERTIDAS: e('ValidationError', 'La fecha final no puede ser anterior a la inicial'),
  E_RESERVA_MUY_LARGA: e('ValidationError', `Máximo ${RESERVA_MAX_DAYS} días por reserva`),
  E_MULTA_PENDIENTE: e('ConflictError', 'Tienes una multa pendiente de {importe} €. Págala al encargado para poder reservar'),
  E_CANCELACION_TARDIA: e('ConflictError', 'Solo se puede cancelar hasta el día antes'),
  E_ENTREGA_ANTICIPADA: e('ConflictError', 'Aún no es la fecha de entrega'),
  E_RESERVA_NO_PRESTADA: e('ConflictError', 'Esa reserva no está prestada'),
  E_BAJA_UNIDAD_PRESTADA: e('ConflictError', 'No se puede dar de baja: está prestada'),
  E_ALMACEN_NO_DISPONIBLE: e('SystemError', 'No se pudo completar la operación. Inténtalo de nuevo'),
  E_DATOS_SOCIO_INVALIDOS: e('ValidationError', 'Indica un nombre y un correo válido'),
  E_SOCIO_NO_ENCONTRADO: e('NotFoundError', 'El socio elegido no existe'),
  E_TIPO_INVALIDO: e('ValidationError', 'Tipo de material no válido'),
  E_CANTIDAD_INVALIDA: e('ValidationError', 'La cantidad debe ser un número entero de 1 o más'),
  E_RESERVA_NO_ENCONTRADA: e('NotFoundError', 'No existe esa reserva'),
  E_RESERVA_NO_ENTREGABLE: e('ConflictError', 'Esa reserva no se puede entregar'),
  E_UNIDAD_NO_DISPONIBLE: e('ConflictError', 'Esa unidad no sirve para esta reserva'),
  E_UNIDAD_NO_ENCONTRADA: e('NotFoundError', 'No existe esa unidad'),
  E_MULTA_NO_ENCONTRADA: e('NotFoundError', 'No se encontró esa multa'),
};

export class ErrorDominio extends Error {
  constructor(codigo, parametros = {}) {
    const definicion = CATALOGO[codigo];
    if (!definicion) throw new Error(`Error de dominio fuera del catálogo VO-010: ${codigo}`);
    const mensaje = definicion.mensaje.replace(/\{(\w+)\}/g, (_, nombre) => String(parametros[nombre] ?? ''));
    super(mensaje);
    this.name = definicion.clase;
    this.codigo = codigo;
    this.clase = definicion.clase;
    this.mensaje = mensaje;
  }
}

export const error = (codigo, parametros) => new ErrorDominio(codigo, parametros);
