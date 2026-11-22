// REQ-C-002: todos los literales en español de la interfaz viven aquí (los de error, en errores.js).
export const TEXTOS = {
  entrar: 'Entrar',
  salir: 'Salir',
  correo: 'Correo',
  contrasena: 'Contraseña',
  nombre: 'Nombre',
  materialDisponible: 'Material disponible',
  panelEncargado: 'Panel del encargado',
  historialSocio: 'Historial del socio',
  misReservas: 'Mis reservas',
  socios: 'Socios',
  accesoNoPermitido: 'Acceso no permitido',
  crearSocio: 'Crear socio',
  socioCreado: 'Socio creado',
  columnaNombre: 'Nombre',
  columnaCorreo: 'Correo',
  columnaEstado: 'Estado',
  estadoActiva: 'Activa',
  estadoBaja: 'Baja',
  cargando: 'Cargando…',
  enlaceInicio: 'Inicio',
  enlaceReservas: 'Mis reservas',
  enlaceSocios: 'Socios',
  descripcionSocio: 'Aquí aparecerá el material que puedes reservar.',
  descripcionEncargado: 'Gestiona las cuentas de los socios del club.',
  descripcionJunta: 'Consulta de solo lectura.',
  menu: 'Menú principal',
  inventario: 'Inventario',
  enlaceInventario: 'Inventario',
  tipo: 'Tipo',
  cantidad: 'Cantidad',
  anadir: 'Añadir',
  estadoUnidadAlta: 'Alta',
  estadoUnidadBaja: 'De baja',
  material: 'Material',
  inicio: 'Inicio',
  fin: 'Fin',
  reservar: 'Reservar',
  disponibilidad: 'Disponibilidad para esas fechas',
  reservas: 'Reservas',
  sinReservas: 'No tienes reservas',
  columnaMaterial: 'Material',
  columnaInicio: 'Inicio',
  columnaFin: 'Fin',
  columnaAccion: 'Acción',
  estadoReservada: 'Reservada',
  estadoEntregado: 'Entregado',
  estadoDevuelto: 'Devuelto',
  estadoCancelada: 'Cancelada',
  estadoNoRecogida: 'No recogida',
  cancelarReserva: 'Cancelar reserva',
  confirmarSi: 'Sí, cancelar',
  confirmarNo: 'No',
  reservaCancelada: 'Reserva cancelada',
  prestamos: 'Préstamos',
  enlacePrestamos: 'Préstamos',
  columnaSocio: 'Socio',
  columnaDevuelta: 'Devuelta el',
  columnaMulta: 'Multa',
  estadoMultaPendiente: 'Pendiente',
  estadoMultaPagada: 'Pagada',
  entregar: 'Entregar',
  registrarDevolucion: 'Registrar devolución',
  sinPrestamos: 'No hay reservas ni préstamos',
  misMultas: 'Mis multas',
  enlaceMisMultas: 'Mis multas',
  multas: 'Multas',
  enlaceMultas: 'Multas',
  sinMultas: 'Sin multas',
  columnaDevuelto: 'Devuelto',
  columnaImporte: 'Importe',
  avisoBloqueoMultas: 'Pendiente: no puedes reservar hasta pagarla. Habla con el encargado.',
  marcarPagada: 'Marcar pagada',
  confirmarPagarSi: 'Sí, marcar pagada',
  columnaPagadaEl: 'Pagada el',
  acciones: 'Acciones',
  restablecerContrasena: 'Restablecer contraseña',
  nuevaContrasena: 'Nueva contraseña',
  guardarContrasena: 'Guardar contraseña',
  cancelar: 'Cancelar',
  contrasenaRestablecida: 'Contraseña restablecida',
  darDeBaja: 'Dar de baja',
  confirmarBajaSi: 'Sí, dar de baja',
  confirmarBajaUnidadSi: 'Sí, dar de baja',
  elegirFechas: 'Elige las fechas para ver cuántas unidades quedan libres.',
};

/** Título de la pantalla de inicio de cada rol (RN-012). */
export function tituloInicio(rol) {
  return { socio: TEXTOS.materialDisponible, encargado: TEXTOS.panelEncargado, junta: TEXTOS.historialSocio }[rol];
}

/** UC-013 paso 2: recuento de un tipo. */
export const textoRecuento = (tipo, n) => `${tipo}: ${n} unidades`;

/** VO-010 M_RESERVA_CREADA. */
export const textoReservaCreada = (material, inicio, fin) => `Reserva creada: ${material}, ${inicio} a ${fin}`;

/** Disponibilidad de un tipo en el rango elegido: "2 libres" (se escribe también "0 libres", ACCESSIBILITY-SPEC). */
export const textoLibres = (n) => `${n} libres`;

/** VO-006: el estado de una reserva tal como lo ve el socio. */
export const textoEstadoReserva = (estado) => ({
  Reservada: TEXTOS.estadoReservada, Entregado: TEXTOS.estadoEntregado, Devuelto: TEXTOS.estadoDevuelto,
  Cancelada: TEXTOS.estadoCancelada, 'No recogida': TEXTOS.estadoNoRecogida,
}[estado] ?? estado);

/** Nombre accesible del botón de cada fila: contiene el texto visible y distingue las filas (ACCESSIBILITY-SPEC). */
export const textoCancelarDe = (material, inicio) => `Cancelar reserva de ${material} ${inicio}`;

/** Pregunta de la confirmación en línea (SCR-003). */
export const textoConfirmarCancelar = (material) => `¿Cancelar la reserva de ${material}?`;

/** Nombre accesible del botón de cada fila de Préstamos: contiene el texto visible y distingue las filas. */
export const textoEntregarDe = (material, unidad) => `${TEXTOS.entregar} ${material} ${unidad}`;

/** Nombre accesible del botón de devolución de cada fila de Préstamos. */
export const textoDevolverDe = (material, unidad) => `${TEXTOS.registrarDevolucion} de ${material} ${unidad}`;

/** VO-008: importe en euros con coma decimal, "6,00 €". */
export const textoImporte = (euros) => `${euros.toFixed(2).replace('.', ',')} €`;

/** VO-007: estado de una multa. */
export const textoEstadoMulta = (estado) => ({ Pendiente: TEXTOS.estadoMultaPendiente, Pagada: TEXTOS.estadoMultaPagada }[estado] ?? estado);

/** Aviso al devolver con retraso (SCR-007): la multa creada. */
export const textoMultaCreada = (euros) => `Multa creada: ${textoImporte(euros)}`;

/** Nombre accesible del botón de cada fila de Multas: contiene el texto visible y distingue las filas (SCR-008). */
export const textoMarcarPagadaDe = (socio, importe) => `${TEXTOS.marcarPagada}: ${socio} ${importe}`;

/** Pregunta de la confirmación en línea de Multas (SCR-008). */
export const textoConfirmarPagar = (socio) => `¿Marcar pagada la multa de ${socio}?`;

/** Pregunta de la confirmación en línea de la baja de un socio (SCR-006). */
export const textoConfirmarBajaSocio = (socio) => `¿Dar de baja a ${socio}?`;

/** Nombre accesible del botón de cada unidad de Inventario: contiene el texto visible y distingue las unidades (SCR-009). */
export const textoDarDeBajaUnidadDe = (tipo, numero) => `${TEXTOS.darDeBaja} ${tipo} ${numero}`;

/** Pregunta de la confirmación en línea de la baja de una unidad (SCR-009). */
export const textoConfirmarBajaUnidad = (tipo, numero) => `¿Dar de baja ${tipo} ${numero}?`;

/** UC-015 / SCR-010: textos de Prestado. */
Object.assign(TEXTOS, {
  prestado: 'Prestado',
  enlacePrestado: 'Prestado',
  irAPrestado: 'Ir a Prestado',
  irAPrestamos: 'Ir a Préstamos',
  dia: 'Día',
  ver: 'Ver',
  vuelvenHoy: 'Vuelven hoy',
  prestadoAhora: 'Prestado ahora',
  sinPrestado: 'No hay material prestado',
});

/** UC-015 paso 2: «Piolet 1 — Lucía Gil — hasta 2026-12-07». */
export const textoFilaPrestado = (material, unidad, socio, fin) => `${material} ${unidad} — ${socio} — hasta ${fin}`;

/** UC-015 paso 3: «Retrasado 1 día», «Retrasado 2 días». */
export const textoRetrasado = (n) => `Retrasado ${n} ${n === 1 ? 'día' : 'días'}`;

/** UC-016 / SCR-011: textos de Historial. */
Object.assign(TEXTOS, {
  enlaceHistorial: 'Historial',
  socio: 'Socio',
  elegirSocio: 'Elige un socio',
  verHistorial: 'Ver historial',
  sinHistorial: 'Sin préstamos ni multas',
  elegirSocioDescripcion: 'Elige un socio para ver sus préstamos y multas.',
});

/** UC-016 paso 4: título del historial de un socio. */
export const textoHistorialDe = (socio) => `Historial de ${socio}`;

/** UC-016 paso 4: «Piolet 1 — 2026-12-05 a 2026-12-07 — Devuelto». */
export const textoFilaHistorial = (material, unidad, inicio, fin, estado) => `${material} ${unidad} — ${inicio} a ${fin} — ${textoEstadoReserva(estado)}`;

/** UC-016 paso 4: «Multa 6,00 € Pendiente». */
export const textoFilaMultaHistorial = (importeEur, estado) => `Multa ${textoImporte(importeEur)} ${textoEstadoMulta(estado)}`;
