// Catálogo de errores y avisos (VO-010): el texto literal que ve el usuario. Los huecos {n}, {material}, {día}… se rellenan.
export const MENSAJES = {
  E_CREDENCIALES: 'Correo o contraseña incorrectos',
  E_CUENTA_BLOQUEADA: 'Cuenta bloqueada. Vuelve a intentarlo en 15 minutos',
  E_ACCESO_DENEGADO: 'Acceso denegado',
  E_PAGINA_PROHIBIDA: 'No tienes permiso para ver esta página',
  E_CONTRASENA_CORTA: 'La contraseña debe tener al menos 8 caracteres',
  E_BAJA_UNIDADES_NECESARIAS: 'No se puede dar de baja: hay {n} unidades de {material} necesarias el {día}',
  E_BAJA_UNIDADES_INSUFICIENTES: 'No hay tantas unidades para dar de baja',
  E_ALMACEN_NO_DISPONIBLE: 'No se pudo guardar. Inténtalo de nuevo',
  E_CANTIDAD_INVALIDA: 'La cantidad debe ser un número entero de 1 o más',
  E_NOMBRE_VACIO: 'El nombre del material no puede estar vacío',
  E_MATERIAL_NO_ENCONTRADO: 'El material no existe',
  E_YA_SALIDO: 'La sesión ya estaba cerrada',
  E_SOCIO_DUPLICADO: 'Ya existe un socio con ese correo',
  E_SOCIO_DATOS_INVALIDOS: 'Escribe un nombre y un correo válidos',
  E_BUSQUEDA_VACIA: 'Ningún socio coincide',
  E_SOCIO_NO_ENCONTRADO: 'El socio no existe o ya está de baja',
  E_BAJA_PRESTAMOS: 'No se puede dar de baja: tiene material sin devolver',
  E_BAJA_MULTAS: 'No se puede dar de baja: tiene multas sin pagar',
  E_MULTA_PENDIENTE: 'No puedes reservar hasta pagar tu multa de {importe} €',
  E_FECHA_PASADA: 'La fecha de inicio no puede ser pasada',
  E_FECHA_FIN_ANTERIOR: 'La fecha de fin no puede ser anterior a la de inicio',
  E_FECHA_INVALIDA: 'Elige una fecha válida',
  E_MAX_DIAS: 'Máximo 14 días por reserva',
  E_MAX_UNIDADES: 'Máximo 5 unidades por reserva',
  E_SIN_UNIDADES: 'No hay unidades libres: solo queda {libres} de {material} el {día}',
  E_YA_CANCELADA: 'La reserva ya estaba cancelada',
  E_MULTA_NO_ENCONTRADA: 'La multa no existe',
  E_RESERVA_NO_ENCONTRADA: 'La reserva no existe',
  E_ANTES_DE_INICIO: 'No se puede entregar antes de la fecha de inicio',
  E_NO_RECOGIDA: 'No recogida',
  E_RESERVA_NO_ENTREGABLE: 'Solo se puede entregar una reserva pendiente',
  E_NO_PRESTADA: 'No se puede devolver: la reserva no está entregada',
  E_YA_ENTREGADA: 'Ya estaba entregada',
  E_YA_DEVUELTA: 'Ya estaba devuelta',
  E_EMPIEZA_HOY: 'No se puede cancelar: empieza hoy',
  E_YA_EMPEZADA: 'No se puede cancelar: ya ha empezado',
};

// Mensajes de éxito con huecos
export const EXITOS = {
  reservaCreada: 'Reserva creada: {cantidad} × {material} del {inicio} al {fin}',
  reservaCancelada: 'Reserva cancelada',
  devueltaATiempo: 'Devuelto a tiempo',
  devueltaConRetraso: 'Devuelto con {retraso} de retraso: multa de {importe} €',
  sinPrestamos: 'No hay material prestado',
  entregada: 'Entregado: {cantidad} × {material} a {nombre}',
  sinReservas: 'Aún no tienes reservas',
  sinMultas: 'No hay multas',
  sinMultasPropias: 'No tienes multas',
  sinHistorial: 'Sin préstamos ni multas',
  multaPagada: 'Multa pagada',
  socioCreado: 'Socio creado: {nombre}',
  provisionalGuardada: 'Contraseña provisional guardada para {nombre}',
  socioDeBaja: 'Socio dado de baja: {nombre}',
};

// Avisos de repetición (ADR-005): no son un fallo.
export const AVISOS = {
  E_YA_SALIDO: 'La sesión ya estaba cerrada',
  E_YA_CANCELADA: 'La reserva ya estaba cancelada',
  E_YA_ENTREGADA: 'Ya estaba entregada',
  E_YA_DEVUELTA: 'Ya estaba devuelta',
  E_MULTA_YA_PAGADA: 'La multa ya estaba pagada',
  E_YA_DE_BAJA: '{nombre} ya estaba de baja',
};

/** «1 día», «3 días» (RN-015). */
export const diasTexto = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

export const rellenar = (plantilla, params = {}) => plantilla.replace(/\{([^}]+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
export const mensajeDe = (codigo, params = {}) => rellenar(MENSAJES[codigo] ?? codigo, params);

export class ErrorDominio extends Error {
  constructor(codigo, params = {}) {
    super(mensajeDe(codigo, params));
    this.name = 'ErrorDominio';
    this.codigo = codigo;
    this.params = params;
  }
}

export const error = (codigo, params) => new ErrorDominio(codigo, params);
