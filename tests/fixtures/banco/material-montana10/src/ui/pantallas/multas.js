import { h } from '../dom.js';
import { T } from '../textos.js';

// SCR-005 Multas (UC-007): todas las multas con «Marcar como pagada» en las Pendientes. Pagar una ya Pagada no cambia nada (lo decide
// el servidor). El acceso del Socio y de la Junta lo corta el router con el mensaje de permiso (INV-ACC-008).
export function montar({ raiz, api }) {
  const t = T.multas;
  const titulo = h('h1', { tabindex: '-1' }, t.titulo);
  const mensajes = h('div', { id: 'mensajes' });
  const cuerpo = h('div', { id: 'lista-multas' });
  raiz.replaceChildren(titulo, mensajes, cuerpo);
  titulo.focus();

  async function cargar() {
    try {
      const multas = await api.listarMultas();
      cuerpo.replaceChildren(multas.length ? h('ul', { 'aria-label': t.lista }, multas.map(fila)) : h('p', {}, t.sinMultas));
    } catch (e) { cuerpo.replaceChildren(h('div', { role: 'alert' }, e.mensaje ?? T.general.fallo)); }
  }

  async function pagar(multa) {
    try {
      const pagada = await api.pagarMulta(multa.id);
      mensajes.replaceChildren(h('div', { role: 'status' }, t.fila(pagada.importeEur, pagada.socio, pagada.estado)));
    } catch (e) { mensajes.replaceChildren(h('div', { role: 'alert' }, e.mensaje ?? T.general.fallo)); }
    await cargar();
  }

  const fila = (m) => h('li', { 'data-multa': m.id }, h('span', { class: 'linea' }, t.fila(m.importeEur, m.socio, m.estado)),
    m.estado === 'Pagada' ? ` ${t.pagadaEl(m.pagadaEl)}` : [' ', h('button', { type: 'button', 'aria-label': t.marcarPagadaDe(m.importeEur, m.socio), onclick: () => pagar(m) }, t.marcarPagada)]);

  return cargar();
}
