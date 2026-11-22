// SCR-010 · UC-018: la junta busca un socio por nombre o correo y ve sus préstamos y multas. Solo lectura: ninguna fila lleva acciones
// (INV-SEC-002). Un resultado se muestra al momento; varios, como lista de enlaces para elegir (AC-018-05).
import { el, zonaMensajes } from '../componentes.js';

export async function paginaHistorial({ api, T }) {
  const mensajes = zonaMensajes();
  const resultados = el('div', { class: 'resultados' });
  const detalle = el('div', { class: 'detalle' });

  const limpiar = () => { mensajes.limpiar(); resultados.replaceChildren(); detalle.replaceChildren(); };

  function pintarHistorial(h) {
    const secciones = [el('h2', {}, T.cabeceraSocio(h.socio))];
    if (h.prestamos.length) secciones.push(el('h3', {}, T.prestamos), el('ul', { class: 'prestamos', 'aria-label': T.prestamos }, h.prestamos.map((p) => el('li', {}, T.filaPrestamo(p)))));
    if (h.multas.length) secciones.push(el('h3', {}, T.multas), el('ul', { class: 'multas-historial', 'aria-label': T.multas }, h.multas.map((m) => el('li', {}, T.filaMisMulta(m)))));
    if (!h.prestamos.length && !h.multas.length) secciones.push(el('p', { class: 'vacio' }, T.sinHistorial));
    detalle.replaceChildren(el('section', { class: 'historial' }, ...secciones));
  }

  function mostrar(r) {
    limpiar();
    if (r.estado !== 200) return mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
    const { socios, historial } = r.cuerpo;
    if (historial) return pintarHistorial(historial);
    mensajes.aviso(T.sociosEncontrados(socios.length));
    resultados.replaceChildren(el('ul', { 'aria-label': T.sociosEncontradosLista }, socios.map((s) => el('li', {},
      el('a', { href: '#', onclick: async (e) => { e.preventDefault(); mostrar(await api.historial({ id: s.id })); } }, s.nombre)))));
  }

  const entrada = el('input', { id: 'buscar-socio', type: 'search', autocomplete: 'off' });
  const formulario = el('form', {
    role: 'search', novalidate: true,
    onsubmit: async (e) => { e.preventDefault(); mostrar(await api.historial({ q: entrada.value })); },
  }, el('label', { for: 'buscar-socio' }, T.buscarSocio), entrada, el('button', { type: 'submit' }, T.buscar));

  return el('main', {}, el('h1', {}, T.historialTitulo), el('p', { class: 'solo-lectura' }, T.soloLectura), formulario, mensajes.zona, resultados, detalle);
}
