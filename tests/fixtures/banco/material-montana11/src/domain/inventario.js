// Inventario (API-004-01, API-004-02). Cada operación es una transacción del almacén (INV-SEC-003).
import { MATERIAL_TYPES } from './constantes.js';
import { ErrorDominio, mensajeReservasCanceladas } from './errores.js';
import { validarTipo, validarCantidad } from './validacion.js';
import { operar } from './cuentas.js';
import { siguienteId } from '../server/store.js';

const vistaUnidad = (u) => ({ id: u.id, numero: u.numero, estado: u.estado });

/** API-004-01: recuento de unidades en Alta por tipo y detalle de cada unidad, también las De baja. */
export function listarInventario(ctx) {
  return operar(ctx, 'listarInventario', inventarioDe);
}

function inventarioDe(db) {
  return {
    tipos: MATERIAL_TYPES.map((tipo) => {
      const unidades = db.unidades.filter((u) => u.tipo === tipo).sort((a, b) => a.numero - b.numero);
      return { tipo, total: unidades.filter((u) => u.estado === 'Alta').length, unidades: unidades.map(vistaUnidad) };
    }),
  };
}

/** API-004-02: crea `cantidad` unidades en Alta con los números siguientes de su tipo (INV-STK-001, INV-STK-002, RN-016). */
export function anadirMaterial(ctx, { tipo, cantidad } = {}) {
  return operar(ctx, 'anadirMaterial', (db) => {
    validarTipo(tipo);
    validarCantidad(cantidad);
    let numero = Math.max(0, ...db.unidades.filter((u) => u.tipo === tipo).map((u) => u.numero));
    const creadas = [];
    for (let i = 0; i < cantidad; i++) {
      const unidad = { id: siguienteId(db, 'unidades'), tipo, numero: ++numero, estado: 'Alta' };
      db.unidades.push(unidad);
      creadas.push(vistaUnidad(unidad));
    }
    return { tipo, unidades: creadas };
  });
}

/**
 * API-004-03: pasa la unidad a De baja y cancela sus reservas Reservada en la misma escritura (INV-STK-005, ADR-005).
 * Con una reserva Entregado no cambia nada (INV-STK-003); repetirla no cambia nada (INV-STK-004). Devuelve el
 * inventario nuevo, cuántas reservas canceló y, si fueron alguna, M_RESERVAS_CANCELADAS_BAJA.
 */
export function darDeBajaUnidad(ctx, { unidadId } = {}) {
  return operar(ctx, 'darDeBajaUnidad', (db) => {
    if (!Number.isInteger(unidadId)) throw new ErrorDominio('E_DATOS_INVALIDOS');
    const unidad = db.unidades.find((u) => u.id === unidadId);
    if (!unidad) throw new ErrorDominio('E_UNIDAD_NO_ENCONTRADA');
    let canceladas = 0;
    if (unidad.estado !== 'De baja') {
      if (db.reservas.some((r) => r.unidadId === unidad.id && r.estado === 'Entregado')) throw new ErrorDominio('E_UNIDAD_PRESTADA');
      const hoy = ctx.reloj.hoy();
      for (const r of db.reservas) {
        if (r.unidadId === unidad.id && r.estado === 'Reservada') { r.estado = 'Cancelada'; r.canceladaEl = hoy; canceladas += 1; }
      }
      unidad.estado = 'De baja';
    }
    return { inventario: inventarioDe(db), reservasCanceladas: canceladas, ...(canceladas ? { mensaje: mensajeReservasCanceladas(canceladas) } : {}) };
  });
}
