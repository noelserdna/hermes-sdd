// SCR-003 · versión mínima de FASE-0 (cabecera sin lógica); la lista con «Cancelar» es paginaMisReservasConLista, más abajo.
import { el, listaReservas, zonaMensajes } from '../componentes.js';

export async function paginaMisReservas({ T }) {
  return el('main', {}, el('h1', {}, T.misReservas), el('p', {}, T.sinReservas));
}

/**
 * SCR-003 · UC-008 y UC-009: mis reservas con su estado y «Cancelar» en las que aún no han empezado.
 * El éxito y el aviso de repetición van a los avisos de la sesión; un error, junto a la lista.
 */
export async function paginaMisReservasConLista({ api, T, avisos }) {
  const mensajes = zonaMensajes();
  const contenido = el('div', { class: 'lista-reservas' });

  async function cargar() {
    const r = await api.misReservas();
    if (r.estado !== 200) return mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
    contenido.replaceChildren(listaReservas({ filas: r.cuerpo.reservas, T, alCancelar: cancelar }));
  }

  async function cancelar(fila) {
    const r = await api.cancelarReserva(fila.id);
    if (r.estado === 200) {
      mensajes.limpiar();
      avisos.poner(r.cuerpo.aviso?.mensaje ?? r.cuerpo.mensaje);
    } else {
      mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
    }
    await cargar();
  }

  await cargar();
  return el('main', {}, el('h1', {}, T.misReservas), mensajes.zona, contenido);
}
