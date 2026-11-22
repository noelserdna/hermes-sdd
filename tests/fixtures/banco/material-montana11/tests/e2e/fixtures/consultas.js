// Prepara el GIVEN de FASE-5 contra el servidor del test: la cuenta de la junta (`SEED_ROL=junta npm run seed`, como la
// prepara quien instala la web) y los préstamos y multas de la Demo, hechos por la API moviendo el reloj del servidor.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { MARTA } from './servidor.js';
import { anadirMaterial, reservarComo, sesionDe } from './reservas.js';
import { entregarComoMarta, devolverComoMarta } from './prestamos.js';

const raiz = path.resolve(import.meta.dirname, '../../..');
export const JUNTA = { correo: 'junta@club.test', nombre: 'Junta del club', contrasena: 'Cumbre2026' };
export const LUCIA = { nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' };
export const PABLO = { nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' };

/** `SEED_ROL=junta npm run seed` sobre el almacén del servidor del test. */
export function sembrarJunta(servidor, cuenta = JUNTA) {
  execFileSync(process.execPath, ['scripts/seed.js'], { cwd: raiz, stdio: 'ignore', env: {
    PATH: process.env.PATH, DATA_FILE: servidor.archivo, SEED_ROL: 'junta',
    SEED_ENCARGADO_CORREO: cuenta.correo, SEED_ENCARGADO_NOMBRE: cuenta.nombre, SEED_ENCARGADO_CONTRASENA: cuenta.contrasena } });
}

async function post(servidor, operacion, cuerpo, socio) {
  const r = await fetch(`${servidor.url}/api/${operacion}`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: await sesionDe(servidor, socio) }, body: JSON.stringify(cuerpo) });
  const datos = await r.json();
  if (!datos.ok) throw new Error(`No se pudo preparar ${operacion}: ${datos.codigo}`);
  return datos.datos;
}

/**
 * GIVEN de UC-015: Lucía reservó el Piolet del 2026-12-05 al 2026-12-07 y Pablo el Casco 2 hasta el 2026-12-08
 * (reservó dos Cascos, con otro fin el primero, y canceló el primero: así el suyo es el Casco 2); ambos los recogieron el 05.
 * El reloj queda en `hoy`. Con `piolet: 'devuelto'`, Lucía lo devolvió el 07. Devuelve los ids de las reservas.
 */
export async function lucia_y_pablo_con_material_fuera(servidor, { hoy = '2026-12-06', piolet = 'prestado' } = {}) {
  await anadirMaterial(servidor, 'Piolet', 1);
  await anadirMaterial(servidor, 'Casco', 2);
  const delPiolet = (await reservarComo(servidor, LUCIA, { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' })).id;
  const primerCasco = (await reservarComo(servidor, PABLO, { material: 'Casco', inicio: '2026-12-05', fin: '2026-12-09' })).id;
  const delCasco = (await reservarComo(servidor, PABLO, { material: 'Casco', inicio: '2026-12-05', fin: '2026-12-08' })).id;
  await post(servidor, 'cancelarReserva', { reservaId: primerCasco }, PABLO);
  await servidor.reiniciar('2026-12-05');
  await entregarComoMarta(servidor, delPiolet);
  await entregarComoMarta(servidor, delCasco);
  if (piolet === 'devuelto') { await servidor.reiniciar('2026-12-07'); await devolverComoMarta(servidor, delPiolet); }
  await servidor.reiniciar(hoy);
  return { delPiolet, delCasco };
}

/**
 * GIVEN de UC-016: Lucía devolvió el Piolet 1 el 2026-12-07 y Pablo el Casco 1 el 2026-12-10, con 3 días de retraso:
 * una multa de 6,00 € Pendiente. El reloj queda el 2026-12-11.
 */
export async function lucia_devolvio_y_pablo_tiene_multa(servidor) {
  await anadirMaterial(servidor, 'Piolet', 1);
  await anadirMaterial(servidor, 'Casco', 1);
  const delPiolet = (await reservarComo(servidor, LUCIA, { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' })).id;
  const delCasco = (await reservarComo(servidor, PABLO, { material: 'Casco', inicio: '2026-12-05', fin: '2026-12-07' })).id;
  await servidor.reiniciar('2026-12-05');
  await entregarComoMarta(servidor, delPiolet);
  await entregarComoMarta(servidor, delCasco);
  await servidor.reiniciar('2026-12-07');
  await devolverComoMarta(servidor, delPiolet);
  await servidor.reiniciar('2026-12-10');
  await devolverComoMarta(servidor, delCasco);
  await servidor.reiniciar('2026-12-11');
}

export { MARTA };
