// Semilla de pruebas del recorrido: escribe el almacén que lee el servidor (STORE_FILE) con las cuentas de la demo.
// Se hace por el mismo módulo que usa la app para guardar contraseñas (hash scrypt con sal), no con datos «de fábrica».
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { nuevaCuenta } from '../../../src/domain/acceso.js';
import { storeFile } from '../../../playwright.config.js';

export const HOY = '2026-12-01';
export const AHORA = '2026-12-01T11:00:00.000Z';

export const CUENTAS = {
  lucia: { nombre: 'Lucía', correo: 'lucia@club.es', contrasena: 'Cumbre2026', rol: 'socio' },
  pablo: { nombre: 'Pablo', correo: 'pablo@club.es', contrasena: 'Arista2026', rol: 'socio' },
  ines: { nombre: 'Inés', correo: 'ines@club.es', contrasena: 'Nieve20266', rol: 'socio' },
  encargado: { nombre: 'Encargado', correo: 'encargado@club.es', contrasena: 'Glaciar2026', rol: 'encargado' },
  junta: { nombre: 'Junta', correo: 'junta@club.es', contrasena: 'Serac20266', rol: 'junta' },
  marta: { nombre: 'Marta', correo: 'marta@club.es', contrasena: 'Hielo20266', rol: 'socio', estado: 'Baja' },
};

// Los hashes se calculan una vez: scrypt es lento a propósito.
const base = { schemaVersion: 1, cuentas: [], unidades: [], reservas: [], multas: [], sesiones: [] };
const ids = {};
for (const [clave, datos] of Object.entries(CUENTAS)) ids[clave] = nuevaCuenta(base, datos).id;

export function leerAlmacen() { return JSON.parse(readFileSync(storeFile, 'utf8')); }
export function escribirAlmacen(datos) {
  mkdirSync(path.dirname(storeFile), { recursive: true });
  writeFileSync(storeFile, JSON.stringify(datos, null, 2));
}
export function modificarAlmacen(fn) { const datos = leerAlmacen(); fn(datos); escribirAlmacen(datos); }

/**
 * @param unidades  { Piolet: 3 } unidades Activas por tipo
 * @param bajas     ['Casco 3'] unidades que ya están De baja
 * @param reservas  [{ socio: 'ines', tipo, desde, hasta, estado?, unidad? }]  (unidad: «Casco 1» si está Prestada)
 * @param multas    [{ socio: 'lucia', importeEur: 4, estado? }]
 * @param cuentas   { lucia: { fallosSeguidos: 5, bloqueadaHasta: '…' } } cambios sobre las cuentas
 */
export function sembrar({ unidades = {}, bajas = [], reservas = [], multas = [], cuentas = {} } = {}) {
  const datos = structuredClone(base);
  for (const cuenta of datos.cuentas) {
    const clave = Object.keys(ids).find((k) => ids[k] === cuenta.id);
    Object.assign(cuenta, cuentas[clave] ?? {});
  }
  for (const [tipo, cantidad] of Object.entries(unidades)) {
    for (let numero = 1; numero <= cantidad; numero += 1) {
      datos.unidades.push({ id: datos.unidades.length + 1, tipo, numero, estado: bajas.includes(`${tipo} ${numero}`) ? 'DeBaja' : 'Activa' });
    }
  }
  for (const r of reservas) {
    const unidad = r.unidad ? datos.unidades.find((u) => `${u.tipo} ${u.numero}` === r.unidad) : null;
    datos.reservas.push({
      id: datos.reservas.length + 1, socioId: ids[r.socio], tipo: r.tipo, desde: r.desde, hasta: r.hasta,
      estado: r.estado ?? 'Reservada', unidadId: unidad?.id ?? null, devueltaEl: null, creadaEl: '2026-11-25T10:00:00.000Z',
    });
  }
  for (const m of multas) {
    datos.multas.push({ id: datos.multas.length + 1, socioId: ids[m.socio], reservaId: 1, dias: m.importeEur / 2, importeEur: m.importeEur, estado: m.estado ?? 'Pendiente', pagadaEl: null });
  }
  escribirAlmacen(datos);
}

// Con el reloj fijo no pasa el tiempo: «8 horas sin actividad» se provoca retrasando la última actividad de la sesión.
export function envejecerSesion(correo, horas) {
  modificarAlmacen((datos) => {
    const cuenta = datos.cuentas.find((c) => c.correo === correo);
    for (const s of datos.sesiones.filter((x) => x.cuentaId === cuenta.id)) s.ultimaActividad = new Date(Date.parse(AHORA) - horas * 3_600_000).toISOString();
  });
}
