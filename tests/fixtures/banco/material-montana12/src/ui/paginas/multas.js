// SCR-009 · UC-013, UC-014: todas las multas con «Marcar pagada» en las Pendientes. El éxito y la repetición («La multa ya estaba pagada»)
// van a los avisos de la sesión; un error, junto a la lista.
import { el, zonaMensajes } from '../componentes.js';

export async function paginaMultas({ api, T, avisos }) {
  const mensajes = zonaMensajes();
  const contenido = el('div', { class: 'lista-multas' });

  async function cargar() {
    const r = await api.listarMultas();
    if (r.estado !== 200) return mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
    if (!r.cuerpo.multas.length) return contenido.replaceChildren(el('p', { class: 'vacio' }, T.sinMultas));
    contenido.replaceChildren(el('ul', { 'aria-label': T.multas, class: 'multas-todas' }, r.cuerpo.multas.map((m) => el('li', { class: 'multa', 'data-estado': m.estado },
      el('span', { id: `multa-${m.id}`, class: 'texto' }, T.filaMulta(m)),
      m.estado === 'Pendiente' ? el('button', { type: 'button', 'aria-describedby': `multa-${m.id}`, onclick: () => pagar(m) }, T.marcarPagada) : ''))));
  }

  async function pagar(multa) {
    const r = await api.pagarMulta(multa.id);
    if (r.estado === 200) {
      mensajes.limpiar();
      avisos.poner(r.cuerpo.aviso?.mensaje ?? r.cuerpo.mensaje);
    } else {
      mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
    }
    await cargar();
  }

  await cargar();
  return el('main', {}, el('h1', {}, T.multas), mensajes.zona, contenido);
}
