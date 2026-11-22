// Valores de spec/VALUE-REGISTRY.md: única fuente en el código. El resto de módulos importa de aquí.
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;
export const SESSION_IDLE_HOURS = 8;
export const PASSWORD_MIN_LENGTH = 8;
export const RESERVA_MAX_DAYS = 14;
export const CANCEL_MIN_DAYS_BEFORE = 1;
export const FINE_PER_DAY_EUR = 2;
export const RETENTION_YEARS = 2;
export const TIPOS_MATERIAL = ['Piolet', 'Crampones', 'Casco', 'Cuerda', 'Tienda'];
export const ESTADOS_RESERVA = ['Reservada', 'Prestada', 'Devuelta', 'Cancelada', 'No recogida'];
export const ZONA_HORARIA = 'Europe/Madrid';
// Supuesto de FASE-1 (feedback/IMPL-FEEDBACK-FASE-1.md, IF-1-001): cuántos días después de `hasta` sigue a la vista una «No recogida».
export const NO_RECOGIDA_VISIBLE_DAYS = 7;
