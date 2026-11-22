// SCR-005 · UC-012: mis multas, una fila por multa («Multa de {importe} € — {estado}») y, aparte, los días de retraso; o «No tienes multas».
import { el, zonaMensajes } from '../componentes.js';

export async function paginaMisMultas({ api, T }) {
  const mensajes = zonaMensajes();
  const contenido = el('div', { class: 'lista-multas' });

  const r = await api.misMultas();
  if (r.estado !== 200) mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
  else if (!r.cuerpo.multas.length) contenido.append(el('p', { class: 'vacio' }, T.sinMultasPropias));
  else {
    contenido.append(el('ul', { 'aria-label': T.misMultas, class: 'multas-socio' }, r.cuerpo.multas.map((m) => el('li', { class: 'multa', 'data-estado': m.estado },
      el('span', { class: 'texto' }, T.filaMisMulta(m)),
      m.dias > 0 ? el('span', { class: 'retraso' }, T.retraso(m.dias)) : ''))));
  }
  return el('main', {}, el('h1', {}, T.misMultas), mensajes.zona, contenido);
}
