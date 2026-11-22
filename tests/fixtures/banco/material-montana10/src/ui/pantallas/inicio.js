import { h } from '../dom.js';
import { T } from '../textos.js';

// Pantalla inicial provisional de los roles cuya pantalla de RN-015 llega en una FASE posterior (la junta, hasta Historial).
export function montar({ raiz, sesion }) {
  const titulo = h('h1', { tabindex: '-1' }, T.inicio.titulo);
  raiz.replaceChildren(titulo, h('p', { id: 'saludo' }, T.inicio.saludo(sesion.nombre)), h('p', {}, T.inicio.rol(sesion.rol)));
  titulo.focus();
}
