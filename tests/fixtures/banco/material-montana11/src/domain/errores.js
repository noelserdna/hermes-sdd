// VO-010: catálogo de errores de dominio con su mensaje literal (ADR-004, REQ-C-002). La UI nunca escribe estos
// textos a mano: los traduce desde aquí.
export const ERRORES = {
  E_CREDENCIALES_INVALIDAS: 'Correo o contraseña incorrectos',
  E_CUENTA_BLOQUEADA: 'Cuenta bloqueada durante 15 minutos',
  E_SESION_CADUCADA: 'Sesión caducada, vuelve a entrar',
  E_NO_AUTENTICADO: 'Entrar',
  E_ACCESO_NO_PERMITIDO: 'Acceso no permitido',
  E_DATOS_INVALIDOS: 'Revisa los datos del formulario',
  E_CONTRASENA_CORTA: 'La contraseña debe tener al menos 8 caracteres',
  E_CORREO_DUPLICADO: 'Ya existe un socio con ese correo',
  E_SOCIO_NO_ENCONTRADO: 'El socio no existe',
  E_SOCIO_CON_MATERIAL: 'No se puede dar de baja: tiene material sin devolver',
  E_FECHA_PASADA: 'No se puede reservar en fechas pasadas',
  E_FECHAS_INVERTIDAS: 'La fecha de fin no puede ser anterior a la de inicio',
  E_RESERVA_MUY_LARGA: 'La reserva no puede superar 14 días',
  E_MULTA_PENDIENTE: 'Tienes una multa pendiente: no puedes reservar hasta pagarla',
  E_SIN_UNIDADES: 'No hay unidades libres esas fechas',
  E_MATERIAL_INVALIDO: 'Elige un tipo de material del catálogo',
  E_RESERVA_NO_ENCONTRADA: 'La reserva no existe',
  E_CANCELACION_TARDIA: 'Solo se puede cancelar hasta el día antes',
  E_ENTREGA_ANTICIPADA: 'No se puede entregar antes de la fecha de inicio',
  E_ESTADO_INVALIDO: 'La reserva no está en un estado que permita esa acción',
  E_MULTA_NO_ENCONTRADA: 'La multa no existe',
  E_CANTIDAD_INVALIDA: 'La cantidad debe ser al menos 1',
  E_UNIDAD_NO_ENCONTRADA: 'La unidad no existe',
  E_UNIDAD_PRESTADA: 'No se puede dar de baja: está prestada',
  E_ALMACEN_NO_DISPONIBLE: 'No se pudo guardar. Inténtalo de nuevo',
};

/** VO-010 M_RESERVAS_CANCELADAS_BAJA: «{n} reserva cancelada por la baja» (en plural, «{n} reservas canceladas por la baja»). */
export const mensajeReservasCanceladas = (n) => (n === 1 ? '1 reserva cancelada por la baja' : `${n} reservas canceladas por la baja`);

/** Error de dominio: lleva su código y el mensaje literal del catálogo. */
export class ErrorDominio extends Error {
  constructor(codigo) {
    super(ERRORES[codigo] ?? codigo);
    this.name = 'ErrorDominio';
    this.codigo = codigo;
  }
}
