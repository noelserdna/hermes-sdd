import { error } from './errores.js';
import { puede } from './permisos.js';
import { TIPOS_MATERIAL, RESERVA_MAX_DAYS, CANCEL_MIN_DAYS_BEFORE } from './config.js';

// UC-003 Reservar material (API-002-01) y UC-004 (API-002-02, API-002-03). Orden de comprobación (RN-017, D-T-009):
// rol y tipo > fechas (pasado, orden, duración) > multa Pendiente > reserva idéntica > unidades libres cada día.
const DIA_MS = 86_400_000;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const aDia = (texto) => {
  if (typeof texto !== 'string' || !FECHA.test(texto)) return null;
  const ms = Date.parse(`${texto}T00:00:00Z`);
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== texto ? null : ms;
};

const exigirRol = (actor, operacion) => { if (!puede(actor?.rol, operacion)) throw error('E_SIN_PERMISO'); };

// Una reserva ocupa unidad si está Prestada, o Reservada y no vencida (hoy ≤ hasta; si no, es No recogida, INV-RES-007).
const ocupa = (r, hoy) => r.estado === 'Prestada' || (r.estado === 'Reservada' && r.hasta >= hoy);

export async function reservarMaterial({ almacen, reloj }, actor, { tipo, desde, hasta } = {}) {
  exigirRol(actor, 'reservarMaterial');
  if (!TIPOS_MATERIAL.includes(tipo)) throw error('E_TIPO_INVALIDO');
  // Un valor que no es una fecha AAAA-MM-DD no puede ser un rango válido; el contrato no tiene error propio y se
  // trata como fecha no válida (E_FECHA_PASADA), anotado como hueco del spec en feedback/IMPL-FEEDBACK-FASE-0.md.
  const ini = aDia(desde);
  const fin = aDia(hasta);
  if (ini === null || fin === null) throw error('E_FECHA_PASADA');
  const hoy = reloj.hoy();
  if (desde < hoy) throw error('E_FECHA_PASADA'); // INV-RES-002
  if (fin < ini) throw error('E_FECHAS_INVERTIDAS'); // INV-RES-003
  if ((fin - ini) / DIA_MS + 1 > RESERVA_MAX_DAYS) throw error('E_RESERVA_MUY_LARGA'); // INV-RES-001

  // RN-018 / ADR-002: comprobar unidades libres y crear la reserva es una sola operación indivisible.
  return almacen.transaction((db) => {
    const pendientes = db.multas.filter((m) => m.socioId === actor.id && m.estado === 'Pendiente');
    if (pendientes.length) throw error('E_MULTA_PENDIENTE', { importe: pendientes.reduce((suma, m) => suma + m.importeEur, 0) }); // INV-RES-005

    const identica = db.reservas.find((r) => r.socioId === actor.id && r.estado === 'Reservada' && r.tipo === tipo && r.desde === desde && r.hasta === hasta);
    if (identica) return { reserva: identica, creada: false }; // INV-RES-008

    const activas = db.unidades.filter((u) => u.tipo === tipo && u.estado === 'Activa').length;
    const ocupantes = db.reservas.filter((r) => r.tipo === tipo && ocupa(r, hoy));
    for (let dia = ini; dia <= fin; dia += DIA_MS) {
      const texto = new Date(dia).toISOString().slice(0, 10);
      if (ocupantes.filter((r) => r.desde <= texto && r.hasta >= texto).length >= activas) throw error('E_SIN_UNIDADES_LIBRES', { material: tipo }); // INV-RES-004
    }
    const reserva = {
      id: db.reservas.reduce((max, r) => Math.max(max, r.id), 0) + 1, socioId: actor.id, tipo, desde, hasta,
      estado: 'Reservada', unidadId: null, devueltaEl: null, creadaEl: reloj.ahora().toISOString(),
    };
    db.reservas.push(reserva);
    return { reserva, creada: true };
  });
}

// RN-008 / INV-RES-007 (API-003-07 al leer): una Reservada con hoy posterior a `hasta` se lee como «No recogida».
// Función pura sobre el estado y el día; no escribe nada (la tarea diaria es la que lo persiste).
export const derivarNoRecogidas = (db, hoy) => db.reservas.map((r) => (r.estado === 'Reservada' && r.hasta < hoy ? { ...r, estado: 'No recogida' } : r));

// UC-004 / API-002-02: solo las reservas y multas del propio socio (INV-ACC-009), con «No recogida» derivada.
// `cancelable` es la acción que se le ofrece: solo en las Reservadas (la fecha la decide cancelarReserva).
export async function listarMisReservas({ almacen, reloj }, actor) {
  exigirRol(actor, 'listarMisReservas');
  const db = await almacen.load();
  const reservas = derivarNoRecogidas(db, reloj.hoy()).filter((r) => r.socioId === actor.id)
    .sort((a, b) => (a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : b.id - a.id))
    .map((r) => ({ ...r, cancelable: r.estado === 'Reservada' }));
  return { reservas, multas: db.multas.filter((m) => m.socioId === actor.id) };
}

// UC-004 / API-002-03 cancelarReserva. Orden: rol > existe > es suya (RN-019, INV-ACC-009) > ya Cancelada (sin cambios,
// INV-RES-008) > Reservada y con al menos CANCEL_MIN_DAYS_BEFORE días de margen antes de `desde` (INV-RES-006).
// Una Reservada ya vencida es «No recogida» (INV-RES-007): tampoco se cancela, y por la misma razón (hoy > desde).
export async function cancelarReserva({ almacen, reloj }, actor, { reservaId } = {}) {
  exigirRol(actor, 'cancelarReserva');
  const hoy = reloj.hoy();
  return almacen.transaction((db) => {
    const reserva = db.reservas.find((r) => r.id === reservaId);
    if (!reserva) throw error('E_RESERVA_NO_ENCONTRADA');
    if (reserva.socioId !== actor.id) throw error('E_SIN_PERMISO_CANCELAR');
    if (reserva.estado === 'Cancelada') return reserva;
    const margen = (aDia(reserva.desde) - aDia(hoy)) / DIA_MS;
    if (reserva.estado !== 'Reservada' || margen < CANCEL_MIN_DAYS_BEFORE) throw error('E_CANCELACION_TARDIA');
    reserva.estado = 'Cancelada'; // sus unidades quedan libres: una Cancelada no ocupa (SM-001)
    return reserva;
  });
}
