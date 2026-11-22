// UC-015 añadir y UC-016 retirar unidades; API-003-01..03. Las unidades ocupadas se calculan al leer, nunca se guardan.
import { randomUUID } from 'node:crypto';
import { error } from '../mensajes.js';
import { primerDiaSinCobertura } from '../dominio/disponibilidad.js';

const cantidadValida = (c) => Number.isInteger(c) && c >= 1;
const filas = (d) => d.material.map((m) => ({ id: m.id, nombre: m.name, total: m.totalUnits, reservable: m.totalUnits > 0 }));

/** API-003-03: todos los tipos con su total; `reservable` solo si total > 0 (INV-MAT-003). Quien reserva ofrece solo esos. */
export async function listMaterial(ctx) {
  return { material: filas(await ctx.store.leer()) };
}

/** API-003-01: suma al tipo existente (sin distinguir mayúsculas) o crea el tipo (INV-MAT-004). */
export async function addUnits(ctx, { nombre, cantidad }) {
  const limpio = String(nombre ?? '').trim();
  if (!limpio) throw error('E_NOMBRE_VACIO');
  if (!cantidadValida(cantidad)) throw error('E_CANTIDAD_INVALIDA');
  return ctx.store.transaccion((d) => {
    const tipo = d.material.find((m) => m.name.toLowerCase() === limpio.toLowerCase());
    if (tipo) tipo.totalUnits += cantidad;
    else d.material.push({ id: `m-${randomUUID().slice(0, 8)}`, name: limpio, totalUnits: cantidad });
    return { material: filas(d) };
  });
}

/** API-003-02: retira si el total no baja de lo que las reservas necesitan ningún día desde hoy (INV-MAT-001, INV-MAT-002). */
export async function withdrawUnits(ctx, { id, cantidad }) {
  if (!cantidadValida(cantidad)) throw error('E_CANTIDAD_INVALIDA');
  return ctx.store.transaccion((d) => {
    const tipo = d.material.find((m) => m.id === id);
    if (!tipo) throw error('E_MATERIAL_NO_ENCONTRADO');
    if (cantidad > tipo.totalUnits) throw error('E_BAJA_UNIDADES_INSUFICIENTES');
    const conflicto = primerDiaSinCobertura(d.reservas, { id: tipo.id, totalUnits: tipo.totalUnits }, cantidad, ctx.reloj.hoy());
    if (conflicto) throw error('E_BAJA_UNIDADES_NECESARIAS', { n: conflicto.necesarias, material: tipo.name, día: conflicto.dia });
    tipo.totalUnits -= cantidad;
    return { material: filas(d) };
  });
}
