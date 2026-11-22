// ADR-002: «No recogida» se deriva de las fechas y nunca se guarda (INV-RES-008). `hoy` llega por parámetro (reloj inyectable).
/** Estado que ve el usuario: el guardado, salvo la Reservada cuyo fin ya pasó. */
export function estadoReserva(reserva, hoy) {
  return reserva.status === 'Reservada' && reserva.endDate < hoy ? 'No recogida' : reserva.status;
}
