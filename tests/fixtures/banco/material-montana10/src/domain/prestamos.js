import { error } from './errores.js';
import { puede } from './permisos.js';
import { derivarNoRecogidas } from './reservas.js';
import { NO_RECOGIDA_VISIBLE_DAYS, FINE_PER_DAY_EUR } from './config.js';

const DIA_MS = 86_400_000;

// UC-005 Entregar reserva (API-003-01). Orden de comprobación (D-T-009): rol > la reserva existe > su estado (INV-LOA-301)
// > fecha (INV-LOA-001) > unidad (RN-020, INV-LOA-002). Asignar la unidad y pasar a Prestada es una sola transacción (ADR-002).
const exigirRol = (actor, operacion) => { if (!puede(actor?.rol, operacion)) throw error('E_SIN_PERMISO'); };
export const nombreDeUnidad = (unidad) => `${unidad.tipo} ${unidad.numero}`;
const nombreDeSocio = (db, socioId) => db.cuentas.find((c) => c.id === socioId)?.nombre ?? '';
const ocupada = (db, unidad) => db.reservas.some((r) => r.estado === 'Prestada' && r.unidadId === unidad.id);

export async function entregarReserva({ almacen, reloj }, actor, { reservaId, unidadId } = {}) {
  exigirRol(actor, 'entregarReserva');
  const hoy = reloj.hoy();
  return almacen.transaction((db) => {
    const reserva = db.reservas.find((r) => r.id === reservaId);
    if (!reserva) throw error('E_RESERVA_NO_ENCONTRADA');
    const resultado = (unidad) => ({ reserva, unidad: nombreDeUnidad(unidad), socio: nombreDeSocio(db, reserva.socioId) });
    // Repetir una entrega ya hecha no asigna otra unidad: devuelve la Prestada tal cual.
    if (reserva.estado === 'Prestada') return resultado(db.unidades.find((u) => u.id === reserva.unidadId));
    // Una Reservada con hasta anterior a hoy es «No recogida» (INV-RES-007): tampoco se entrega.
    if (reserva.estado !== 'Reservada' || reserva.hasta < hoy) throw error('E_RESERVA_NO_ENTREGABLE');
    if (hoy < reserva.desde) throw error('E_ENTREGA_ANTICIPADA');

    // RN-020: la unidad la indica el encargado (Activa, del tipo reservado y no Prestada); sin indicarla, la primera libre.
    const valida = (u) => u.tipo === reserva.tipo && u.estado === 'Activa' && !ocupada(db, u);
    const unidad = unidadId === undefined || unidadId === null
      ? db.unidades.filter(valida).sort((a, b) => a.numero - b.numero)[0]
      : db.unidades.find((u) => u.id === unidadId && valida(u));
    if (!unidad) throw error('E_UNIDAD_NO_DISPONIBLE');
    reserva.unidadId = unidad.id;
    reserva.estado = 'Prestada';
    return resultado(unidad);
  });
}

// UC-009 / API-003-05: solo lectura (INV-LOA-401). Cuatro listas (RN-022, RN-009) y, aparte, las No recogidas recientes
// (REQ-F-005 AC4 las muestra en esta pantalla; AC-009-07: no cuentan como «Entregar hoy» ni como prestadas).
const dias = (desde, hasta) => (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS;

export async function consultarEntregasYDevoluciones({ almacen, reloj }, actor) {
  exigirRol(actor, 'consultarEntregasYDevoluciones');
  const hoy = reloj.hoy();
  const db = await almacen.load();
  const reservas = derivarNoRecogidas(db, hoy);
  const unidadDe = (r) => db.unidades.find((u) => u.id === r.unidadId);
  const porFecha = (a, b) => (a.hasta < b.hasta ? -1 : a.hasta > b.hasta ? 1 : a.id - b.id);
  const prestadas = reservas.filter((r) => r.estado === 'Prestada').sort(porFecha);
  const prestamo = (r) => ({ reservaId: r.id, unidad: nombreDeUnidad(unidadDe(r)), socio: nombreDeSocio(db, r.socioId), hasta: r.hasta });
  const esEncargado = actor.rol === 'encargado';
  const libres = (tipo) => db.unidades.filter((u) => u.tipo === tipo && u.estado === 'Activa' && !ocupada(db, u)).sort((a, b) => a.numero - b.numero)
    .map((u) => ({ id: u.id, nombre: nombreDeUnidad(u) }));
  return {
    entregarHoy: reservas.filter((r) => r.estado === 'Reservada' && r.desde <= hoy && r.hasta >= hoy).sort(porFecha).map((r) => ({
      reservaId: r.id, material: r.tipo, socio: nombreDeSocio(db, r.socioId), desde: r.desde, hasta: r.hasta, ...(esEncargado ? { unidadesLibres: libres(r.tipo) } : {}),
    })),
    vuelveHoy: prestadas.filter((r) => r.hasta === hoy).map(prestamo),
    conRetraso: prestadas.filter((r) => r.hasta < hoy).map((r) => ({ ...prestamo(r), dias: dias(r.hasta, hoy) })),
    prestado: prestadas.filter((r) => r.hasta >= hoy).map(prestamo),
    noRecogidas: reservas.filter((r) => r.estado === 'No recogida' && dias(r.hasta, hoy) <= NO_RECOGIDA_VISIBLE_DAYS).sort(porFecha)
      .map((r) => ({ reservaId: r.id, material: r.tipo, socio: nombreDeSocio(db, r.socioId), hasta: r.hasta })),
  };
}

// UC-006 Devolver y multar (API-003-02). Orden: rol > la reserva existe > su estado (INV-LOA-003). La devolución y su multa
// son una sola transacción (INV-LOA-004, ADR-002). Repetirla sobre una Devuelta no cambia nada: devuelve lo mismo (INV-RES-008).
export async function devolverPrestamo({ almacen, reloj }, actor, { reservaId } = {}) {
  exigirRol(actor, 'devolverPrestamo');
  const hoy = reloj.hoy();
  return almacen.transaction((db) => {
    const reserva = db.reservas.find((r) => r.id === reservaId);
    if (!reserva) throw error('E_RESERVA_NO_ENCONTRADA');
    const resultado = () => {
      const multa = db.multas.find((m) => m.reservaId === reserva.id);
      return {
        unidad: nombreDeUnidad(db.unidades.find((u) => u.id === reserva.unidadId)), socio: nombreDeSocio(db, reserva.socioId),
        estado: 'Devuelta', multa: multa ? { importeEur: multa.importeEur, dias: multa.dias } : null,
      };
    };
    if (reserva.estado === 'Devuelta') return resultado();
    if (reserva.estado !== 'Prestada') throw error('E_RESERVA_NO_PRESTADA');
    reserva.estado = 'Devuelta';
    reserva.devueltaEl = hoy;
    const retraso = Math.max(0, dias(reserva.hasta, hoy)); // días naturales desde `hasta` (RN-009)
    if (retraso > 0) {
      db.multas.push({
        id: db.multas.reduce((max, m) => Math.max(max, m.id), 0) + 1, socioId: reserva.socioId, reservaId: reserva.id,
        dias: retraso, importeEur: FINE_PER_DAY_EUR * retraso, estado: 'Pendiente', pagadaEl: null,
      });
    }
    return resultado();
  });
}

// UC-007 Pagar multa (API-003-03, API-003-04). Solo el encargado (INV-ACC-008). Pagar una ya Pagada no cambia nada y conserva su
// fecha (INV-LOA-005). El desbloqueo para reservar no se guarda: se deduce de «sin multas Pendientes» (INV-RES-005, reservarMaterial).
const filaDeMulta = (db, m) => ({ id: m.id, socio: nombreDeSocio(db, m.socioId), importeEur: m.importeEur, estado: m.estado, pagadaEl: m.pagadaEl });

export async function pagarMulta({ almacen, reloj }, actor, { multaId } = {}) {
  exigirRol(actor, 'pagarMulta');
  const hoy = reloj.hoy();
  return almacen.transaction((db) => {
    const multa = db.multas.find((m) => m.id === multaId);
    if (!multa) throw error('E_MULTA_NO_ENCONTRADA');
    if (multa.estado !== 'Pagada') {
      multa.estado = 'Pagada';
      multa.pagadaEl = hoy;
    }
    return filaDeMulta(db, multa);
  });
}

export async function listarMultas({ almacen }, actor) {
  exigirRol(actor, 'listarMultas');
  const db = await almacen.load();
  return db.multas.map((m) => filaDeMulta(db, m));
}

// UC-010 Consultar historial (API-003-06): solo lectura (INV-LOA-402). Todas las reservas del socio (con «No recogida» derivada,
// las más recientes primero) y sus multas (RN-012). Orden: rol > el socio existe. No expone datos de la cuenta.
export async function consultarHistorial({ almacen, reloj }, actor, { socioId } = {}) {
  exigirRol(actor, 'consultarHistorial');
  const db = await almacen.load();
  if (!db.cuentas.some((c) => c.id === socioId && c.rol === 'socio')) throw error('E_SOCIO_NO_ENCONTRADO');
  const unidadDe = (r) => db.unidades.find((u) => u.id === r.unidadId);
  return {
    prestamos: derivarNoRecogidas(db, reloj.hoy()).filter((r) => r.socioId === socioId)
      .sort((a, b) => (a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : b.id - a.id))
      .map((r) => ({ unidad: unidadDe(r) ? nombreDeUnidad(unidadDe(r)) : null, material: r.tipo, desde: r.desde, hasta: r.hasta, estado: r.estado })),
    multas: db.multas.filter((m) => m.socioId === socioId).map((m) => ({ importe: m.importeEur, estado: m.estado })),
  };
}
