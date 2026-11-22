// Prepara el GIVEN de FASE-1 contra el servidor del test: material, reservas y multas, sin pasar por las pantallas
// que el test no está comprobando (TEST-PLAN R-5). El encargado de la semilla (MARTA) añade el material.
import { readFileSync, writeFileSync } from 'node:fs';
import { MARTA } from './servidor.js';

async function llamar(servidor, operacion, cuerpo, cookie) {
  const r = await fetch(`${servidor.url}/api/${operacion}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(cuerpo),
  });
  return { respuesta: r, cuerpo: await r.json() };
}

export async function sesionDe(servidor, { correo, contrasena }) {
  const { respuesta } = await llamar(servidor, 'iniciarSesion', { correo, contrasena });
  return respuesta.headers.get('set-cookie').split(';')[0];
}

export async function anadirMaterial(servidor, tipo, cantidad) {
  const { cuerpo } = await llamar(servidor, 'anadirMaterial', { tipo, cantidad }, await sesionDe(servidor, MARTA));
  if (!cuerpo.ok) throw new Error(`No se pudo preparar ${cantidad} de ${tipo}: ${cuerpo.codigo}`);
}

/** `socio` entra y reserva por la API (no por la pantalla): el GIVEN de una reserva ya hecha. */
export async function reservarComo(servidor, socio, datos) {
  const { cuerpo } = await llamar(servidor, 'reservarMaterial', datos, await sesionDe(servidor, socio));
  if (!cuerpo.ok) throw new Error(`No se pudo preparar la reserva de ${datos.material}: ${cuerpo.codigo}`);
  return cuerpo.datos;
}

/** Multa Pendiente sembrada en el almacén: las multas nacen en FASE-2 (aquí solo se prueba su efecto). */
export function sembrarMultaPendiente(servidor, correo, importeEur = 4) {
  const db = JSON.parse(readFileSync(servidor.archivo, 'utf8'));
  const socio = db.cuentas.find((c) => c.correo === correo);
  db.contadores.multas = (db.contadores.multas ?? 0) + 1;
  db.multas.push({ id: db.contadores.multas, socioId: socio.id, reservaId: 0, diasRetraso: 2, importeEur, estado: 'Pendiente', creadaEl: '2026-11-10', pagadaEl: null });
  writeFileSync(servidor.archivo, JSON.stringify(db));
}
