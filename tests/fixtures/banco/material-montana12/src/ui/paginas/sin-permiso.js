// SCR-011 · E_PAGINA_PROHIBIDA: no muestra ningún dato de la página pedida.
import { el, enlace } from '../componentes.js';

export async function paginaSinPermiso({ T, mensaje, inicio, navegar }) {
  const titulo = el('h1', { tabindex: '-1' }, T.sinPermiso);
  const pagina = el('main', { class: 'sin-permiso' }, titulo, el('p', {}, mensaje), enlace(inicio, T.volver, navegar));
  setTimeout(() => titulo.focus(), 0);
  return pagina;
}
