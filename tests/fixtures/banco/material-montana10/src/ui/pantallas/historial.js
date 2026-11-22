import { h } from '../dom.js';
import { T } from '../textos.js';

// SCR-008 Historial (UC-010): la junta y el encargado eligen un socio y ven sus préstamos y multas. Solo lectura: nada que editar,
// cancelar ni marcar (INV-LOA-402). Un error de la API (socio inexistente) se muestra y deja elegir otro.
export async function montar({ raiz, api }) {
  const t = T.historial;
  const titulo = h('h1', { tabindex: '-1' }, t.titulo);
  const selector = h('select', { id: 'socio' });
  const ver = h('button', { type: 'button', disabled: true, onclick: () => consultar() }, t.ver);
  const resultado = h('div', { id: 'resultado-historial' });
  raiz.replaceChildren(titulo, h('div', { class: 'selector' }, h('label', { for: 'socio' }, t.socio, ' ', selector), ' ', ver), resultado);
  titulo.focus();

  async function consultar() {
    try {
      const { prestamos, multas } = await api.consultarHistorial(Number(selector.value));
      resultado.replaceChildren(...(prestamos.length || multas.length ? [
        ...(prestamos.length ? [h('section', { 'data-seccion': 'prestamos' }, h('h2', {}, t.prestamos),
          h('ul', {}, prestamos.map((p) => h('li', {}, t.prestamo(p.unidad ?? p.material ?? t.sinUnidad, p.desde, p.hasta, p.estado)))))] : []),
        ...(multas.length ? [h('section', { 'data-seccion': 'multas' }, h('h2', {}, t.multas),
          h('ul', {}, multas.map((m) => h('li', {}, t.multa(m.importe, m.estado)))))] : []),
      ] : [h('p', {}, t.vacio)]));
    } catch (e) { resultado.replaceChildren(h('div', { role: 'alert' }, e.mensaje ?? T.general.fallo)); }
  }

  try {
    const socios = await api.listarSocios();
    selector.replaceChildren(...socios.map((s) => h('option', { value: s.id }, s.nombre)));
    ver.disabled = !socios.length;
  } catch (e) { resultado.replaceChildren(h('div', { role: 'alert' }, e.mensaje ?? T.general.fallo)); }
}
