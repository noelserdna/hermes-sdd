// Prepara el GIVEN de FASE-2 contra el servidor del test: entregas y devoluciones hechas por la API como lo haría el
// encargado, con el reloj del servidor en el día que toca (servidor.reiniciar(día)). Las sesiones de otro día han
// caducado: cada operación entra de nuevo.
import { MARTA } from './servidor.js';
import { sesionDe } from './reservas.js';

async function comoMarta(servidor, operacion, cuerpo) {
  const cookie = await sesionDe(servidor, MARTA);
  const r = await fetch(`${servidor.url}/api/${operacion}`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(cuerpo) });
  const datos = await r.json();
  if (!datos.ok) throw new Error(`No se pudo preparar ${operacion}: ${datos.codigo}`);
  return datos.datos;
}

export const entregarComoMarta = (servidor, reservaId) => comoMarta(servidor, 'entregarReserva', { reservaId });
export const devolverComoMarta = (servidor, reservaId) => comoMarta(servidor, 'registrarDevolucion', { reservaId });

/** Unidades libres de `material` en el rango, vistas por el socio (API-002-01), para comprobar «la unidad queda libre». */
export async function libresPara(servidor, socio, material, inicio, fin) {
  const cookie = await sesionDe(servidor, socio);
  const r = await fetch(`${servidor.url}/api/consultarDisponibilidad?${new URLSearchParams({ material, inicio, fin })}`, { headers: { cookie } });
  return (await r.json()).datos.libres;
}
