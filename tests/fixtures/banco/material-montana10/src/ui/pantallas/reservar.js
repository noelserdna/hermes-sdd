import { h } from '../dom.js';
import { T } from '../textos.js';
import { TIPOS_MATERIAL } from '../../domain/config.js';

// SCR-003 Reservar (UC-003). Al éxito, vuelve a Mis reservas con la confirmación; un rechazo se muestra y no navega.
export function montar({ raiz, api, ir, avisos }) {
  const titulo = h('h1', { tabindex: '-1' }, T.reservar.titulo);
  const mensajes = h('div', { id: 'mensajes' });
  const tipo = h('select', { id: 'tipo', name: 'tipo' }, TIPOS_MATERIAL.map((t) => h('option', { value: t }, t)));
  const desde = h('input', { id: 'desde', name: 'desde', type: 'date', required: true });
  const hasta = h('input', { id: 'hasta', name: 'hasta', type: 'date', required: true });
  const boton = h('button', { type: 'submit' }, T.reservar.boton);
  let enviando = false;

  const formulario = h('form', {
    novalidate: true,
    async onsubmit(evento) {
      evento.preventDefault();
      if (enviando) return;
      enviando = true;
      boton.setAttribute('aria-busy', 'true');
      boton.disabled = true;
      try {
        const reserva = await api.reservarMaterial(tipo.value, desde.value, hasta.value);
        avisos.poner(T.misReservas.creada(reserva.tipo, reserva.desde, reserva.hasta));
        ir('#/mis-reservas');
      } catch (e) {
        const alerta = h('div', { role: 'alert', tabindex: '-1' }, e.mensaje ?? T.general.fallo);
        mensajes.replaceChildren(alerta);
        alerta.focus();
        enviando = false;
        boton.removeAttribute('aria-busy');
        boton.disabled = false;
      }
    },
  },
  h('label', {}, T.reservar.material, tipo),
  h('label', {}, T.reservar.desde, desde),
  h('label', {}, T.reservar.hasta, hasta),
  boton);

  raiz.replaceChildren(titulo, mensajes, formulario);
  titulo.focus();
}
