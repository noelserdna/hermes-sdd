import { error } from './errores.js';
import { puede } from './permisos.js';
import { TIPOS_MATERIAL } from './config.js';

// UC-008 Gestionar inventario (API-004-01..03). Orden de comprobación: rol > validación > estado (D-T-009).
const exigirRol = (actor, operacion) => { if (!puede(actor?.rol, operacion)) throw error('E_SIN_PERMISO'); };
const siguiente = (coleccion) => coleccion.reduce((max, x) => Math.max(max, x.id), 0) + 1;
const nombreDe = (unidad) => `${unidad.tipo} ${unidad.numero}`;

export async function anadirUnidades({ almacen }, actor, { tipo, cantidad } = {}) {
  exigirRol(actor, 'anadirUnidades');
  if (!TIPOS_MATERIAL.includes(tipo)) throw error('E_TIPO_INVALIDO');
  if (!Number.isInteger(cantidad) || cantidad < 1) throw error('E_CANTIDAD_INVALIDA');
  // INV-STK-003: cada llamada suma `cantidad` unidades; no es idempotente por diseño.
  return almacen.transaction((db) => {
    let numero = db.unidades.filter((u) => u.tipo === tipo).reduce((max, u) => Math.max(max, u.numero), 0);
    let id = siguiente(db.unidades);
    for (let i = 0; i < cantidad; i += 1) db.unidades.push({ id: id++, tipo, numero: ++numero, estado: 'Activa' });
    return { tipo, anadidas: cantidad };
  });
}

const estaPrestada = (db, unidad) => db.reservas.some((r) => r.estado === 'Prestada' && r.unidadId === unidad.id);

export async function darDeBajaUnidad({ almacen }, actor, { unidadId } = {}) {
  exigirRol(actor, 'darDeBajaUnidad');
  return almacen.transaction((db) => {
    const unidad = db.unidades.find((u) => u.id === unidadId);
    if (!unidad) throw error('E_UNIDAD_NO_ENCONTRADA');
    if (unidad.estado === 'DeBaja') return { id: unidad.id, nombre: nombreDe(unidad), estado: unidad.estado }; // INV-STK-001: sin cambios
    if (estaPrestada(db, unidad)) throw error('E_BAJA_UNIDAD_PRESTADA'); // INV-STK-002
    unidad.estado = 'DeBaja';
    return { id: unidad.id, nombre: nombreDe(unidad), estado: unidad.estado };
  });
}

export async function listarInventario({ almacen }, actor) {
  exigirRol(actor, 'listarInventario');
  const db = await almacen.load();
  return TIPOS_MATERIAL
    .map((tipo) => {
      const unidades = db.unidades.filter((u) => u.tipo === tipo).sort((a, b) => a.numero - b.numero)
        .map((u) => ({ id: u.id, nombre: nombreDe(u), estado: u.estado, prestada: estaPrestada(db, u) }));
      return { tipo, activas: unidades.filter((u) => u.estado === 'Activa').length, unidades };
    })
    .filter((t) => t.unidades.length > 0);
}
