// Siembra datos de demostración con el mismo hash que usa el login (D-PA-004).
//   node demo/sembrar.mjs fase-0|fase-1|fase-2|fase-3|fase-4|fase-5 [ruta del fichero]      (por defecto MM_DATOS o data/datos.json)
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { crearAlmacenJson, datosVacios } from '../src/server/store/almacen-json.js';
import { hashContrasena } from '../src/server/servicios/cuentas.js';
import { crearReloj, sumarDias } from '../src/server/dominio/fechas.js';

const CUENTAS = [
  { id: 'c-lucia', nombre: 'Lucía', correo: 'lucia@club.test', contrasena: 'Cumbre2026!', rol: 'socio' },
  { id: 'c-pablo', nombre: 'Pablo', correo: 'pablo@club.test', contrasena: 'Piolet2026!', rol: 'encargado' },
  { id: 'c-elena', nombre: 'Elena', correo: 'elena@club.test', contrasena: 'Junta2026!', rol: 'junta' },
];

const slug = (t) => t.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-');

/**
 * Los datos de una semilla. `material`: [{ nombre, total }]; `reservas`: [{ socio (correo), material, cantidad, inicio, fin, estado }];
 * `cuentas` sustituye a las de la demo; `ajustes` retoca cuentas por correo (p. ej. { lockedUntil });
 * `multas`: [{ socio (correo), importe, estado, dias?, creada?, pagadaEl? }]; una reserva Devuelta lleva `devueltaEl`.
 */
export async function datosSemilla({ hoy = crearReloj().hoy(), cuentas = CUENTAS, material, reservas, multas = [], ajustes = {} } = {}) {
  const casco = [{ nombre: 'Casco', total: 3 }, { nombre: 'Cuerda', total: 0 }];
  const filas = material ?? casco;
  const d = datosVacios();
  for (const c of cuentas) {
    d.cuentas.push({
      id: c.id ?? `c-${slug(c.nombre)}`, name: c.nombre, email: c.correo, passwordHash: hashContrasena(c.contrasena), role: c.rol,
      mustChangePassword: false, active: true, failedLogins: 0, lockedUntil: null, bajaEn: null, ...(ajustes[c.correo] ?? {}),
    });
  }
  for (const m of filas) d.material.push({ id: `m-${slug(m.nombre)}`, name: m.nombre, totalUnits: m.total });
  const sembradas = reservas ?? [{ socio: 'lucia@club.test', material: 'Casco', cantidad: 2, inicio: sumarDias(hoy, 13), fin: sumarDias(hoy, 15) }];
  sembradas.forEach((r, i) => {
    d.reservas.push({
      id: `r-${i + 1}`, accountId: d.cuentas.find((c) => c.email === r.socio).id, itemId: d.material.find((m) => m.name === r.material).id,
      quantity: r.cantidad, startDate: r.inicio, endDate: r.fin, status: r.estado ?? 'Reservada', deliveredOn: ['Prestada', 'Devuelta'].includes(r.estado) ? r.inicio : null, returnedOn: r.devueltaEl ?? null,
    });
  });
  multas.forEach((m, i) => {
    d.multas.push({
      id: `f-${i + 1}`, accountId: d.cuentas.find((c) => c.email === m.socio).id, reservationId: null, lateDays: m.dias ?? 0,
      amountEur: m.importe, status: m.estado ?? 'Pendiente', createdOn: m.creada ?? hoy, paidOn: m.pagadaEl ?? null,
    });
  });
  return d;
}

/** Semilla de la demo de FASE-1: Lucía, Pablo, 3 «Casco», sin reservas, y Marta con una multa Pendiente de 6 €. */
export const SEMILLA_FASE_1 = {
  cuentas: [...CUENTAS, { id: 'c-marta', nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Marta2026!', rol: 'socio' }],
  reservas: [],
  multas: [{ socio: 'marta@club.test', importe: 6 }],
};

/**
 * Semilla de la demo de FASE-2, relativa a `hoy`: Lucía Gil con 2 × Casco reservados desde hoy, un préstamo de 2 × Casco vencido
 * hace 3 días y otro de 1 × Casco que vence hoy. Pablo es el encargado y Elena la junta.
 */
export function semillaFase2(hoy = crearReloj().hoy()) {
  const lucia = { ...CUENTAS[0], nombre: 'Lucía Gil' };
  return {
    hoy,
    cuentas: [lucia, ...CUENTAS.slice(1)],
    material: [{ nombre: 'Casco', total: 6 }],
    reservas: [
      { socio: lucia.correo, material: 'Casco', cantidad: 2, inicio: hoy, fin: sumarDias(hoy, 2) },
      { socio: lucia.correo, material: 'Casco', cantidad: 2, inicio: sumarDias(hoy, -6), fin: sumarDias(hoy, -3), estado: 'Prestada' },
      { socio: lucia.correo, material: 'Casco', cantidad: 1, inicio: sumarDias(hoy, -2), fin: hoy, estado: 'Prestada' },
    ],
  };
}

/**
 * Semilla de la demo de FASE-3, relativa a `hoy`: Pablo (encargado), Lucía Gil con 2 × Casco reservados dentro de unos días y Marta Ruiz
 * con 1 × Casco prestado sin devolver. Álvaro no existe: Pablo lo da de alta en la demo.
 */
export function semillaFase3(hoy = crearReloj().hoy()) {
  const lucia = { ...CUENTAS[0], nombre: 'Lucía Gil' };
  const marta = { id: 'c-marta', nombre: 'Marta Ruiz', correo: 'marta@club.test', contrasena: 'Marta2026!', rol: 'socio' };
  return {
    hoy,
    cuentas: [lucia, CUENTAS[1], marta],
    material: [{ nombre: 'Casco', total: 6 }],
    reservas: [
      { socio: lucia.correo, material: 'Casco', cantidad: 2, inicio: sumarDias(hoy, 13), fin: sumarDias(hoy, 15) },
      { socio: marta.correo, material: 'Casco', cantidad: 1, inicio: sumarDias(hoy, -2), fin: sumarDias(hoy, 1), estado: 'Prestada' },
    ],
  };
}

/**
 * Semilla de la demo de FASE-4, relativa a `hoy`: Pablo (encargado), Lucía Gil con un préstamo de 2 × Casco vencido hace 3 días y Elena (junta).
 * Pablo lo devuelve en la demo y se crea la multa de 3 días.
 */
export function semillaFase4(hoy = crearReloj().hoy()) {
  const lucia = { ...CUENTAS[0], nombre: 'Lucía Gil' };
  return {
    hoy,
    cuentas: [lucia, ...CUENTAS.slice(1)],
    material: [{ nombre: 'Casco', total: 6 }],
    reservas: [{ socio: lucia.correo, material: 'Casco', cantidad: 2, inicio: sumarDias(hoy, -6), fin: sumarDias(hoy, -3), estado: 'Prestada' }],
  };
}

/**
 * Semilla de la demo de FASE-5, relativa a `hoy`: Lucía Gil con 2 × Casco del 2026-12-05 al 2026-12-07 devueltos el 2026-12-09 y su multa de 4 €
 * Pagada, Marta Ruiz con dos préstamos devueltos (uno terminado el 2023-11-01 y otro el 2025-01-10) y Elena (junta). Pablo es el encargado.
 */
export function semillaFase5(hoy = crearReloj().hoy()) {
  const lucia = { ...CUENTAS[0], nombre: 'Lucía Gil' };
  const marta = { id: 'c-marta', nombre: 'Marta Ruiz', correo: 'marta@club.test', contrasena: 'Marta2026!', rol: 'socio' };
  return {
    hoy,
    cuentas: [lucia, CUENTAS[1], CUENTAS[2], marta],
    material: [{ nombre: 'Casco', total: 6 }],
    reservas: [
      { socio: lucia.correo, material: 'Casco', cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07', estado: 'Devuelta', devueltaEl: '2026-12-09' },
      { socio: marta.correo, material: 'Casco', cantidad: 1, inicio: '2023-10-28', fin: '2023-11-01', estado: 'Devuelta', devueltaEl: '2023-11-01' },
      { socio: marta.correo, material: 'Casco', cantidad: 1, inicio: '2025-01-08', fin: '2025-01-10', estado: 'Devuelta', devueltaEl: '2025-01-10' },
    ],
    multas: [{ socio: lucia.correo, importe: 4, estado: 'Pagada', dias: 2, creada: '2026-12-09', pagadaEl: '2026-12-09' }],
  };
}

/** Sustituye el fichero de datos por la semilla (escritura atómica). */
export async function sembrar(ruta, opciones = {}) {
  const datos = await datosSemilla(opciones);
  await rm(ruta, { force: true });
  await crearAlmacenJson(ruta).transaccion((d) => { Object.assign(d, datos); });
  return datos;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [nombre, destino] = process.argv.slice(2);
  if (!['fase-0', 'fase-1', 'fase-2', 'fase-3', 'fase-4', 'fase-5'].includes(nombre)) {
    console.error('Uso: node demo/sembrar.mjs fase-0|fase-1|fase-2|fase-3|fase-4|fase-5 [ruta]');
    process.exit(1);
  }
  const ruta = path.resolve(destino ?? process.env.MM_DATOS ?? 'data/datos.json');
  await sembrar(ruta, nombre === 'fase-5' ? semillaFase5() : nombre === 'fase-4' ? semillaFase4() : nombre === 'fase-3' ? semillaFase3() : nombre === 'fase-2' ? semillaFase2() : nombre === 'fase-1' ? SEMILLA_FASE_1 : {});
  console.log(`Datos de la ${nombre.toUpperCase()} sembrados en ${ruta}`);
}
