// SCR-004 · versión mínima de FASE-0 (REQ-F-007 AC6): los tipos con unidades se ofrecen; los de 0 unidades se nombran aparte.
// El formulario y el botón «Reservar» llegan en FASE-1.
import { el, listaReservas, zonaMensajes } from '../componentes.js';
import { aIso, campoFecha } from '../campo-fecha.js';

export async function paginaReservar({ api, T }) {
  const mensajes = zonaMensajes();
  const r = await api.listarMaterial();
  if (r.estado !== 200) mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
  const tipos = r.estado === 200 ? r.cuerpo.material : [];
  const ofrecidos = tipos.filter((t) => t.reservable);
  const agotados = tipos.filter((t) => !t.reservable);
  const lista = ofrecidos.length
    ? el('ul', { 'aria-label': T.material }, ofrecidos.map((t) => el('li', {}, t.nombre)))
    : r.estado === 200 ? el('p', {}, T.sinTipos) : '';
  const aparte = agotados.length ? el('p', { class: 'sin-unidades' }, T.sinUnidades(agotados.map((t) => t.nombre).join(', '))) : '';
  return el('main', {}, el('h1', {}, T.reservar), mensajes.zona, lista, aparte);
}

/**
 * SCR-004 · UC-007: la página de FASE-0 (tipos con unidades, los de 0 aparte) más el formulario y mis reservas debajo.
 * Valida solo el servidor; tras un error los campos se quedan como estaban. Éxito → aviso y a «Mis reservas».
 */
export async function paginaReservarConFormulario(ctx) {
  const { api, T, navegar, avisos } = ctx;
  const base = await paginaReservar(ctx);
  const mensajes = zonaMensajes();
  const r = await api.listarMaterial();
  const ofrecidos = r.estado === 200 ? r.cuerpo.material.filter((t) => t.reservable) : [];

  const material = el('select', { id: 'material', name: 'material', 'aria-required': 'true' },
    ofrecidos.map((t) => el('option', { value: t.id }, t.nombre)));
  const cantidad = el('input', { id: 'cantidad', name: 'cantidad', type: 'number', inputmode: 'numeric', value: '1', 'aria-required': 'true', 'aria-describedby': 'ayuda-cantidad' });
  const inicio = campoFecha({ id: 'inicio', name: 'inicio', 'aria-required': 'true', 'aria-describedby': 'ayuda-fecha' });
  const fin = campoFecha({ id: 'fin', name: 'fin', 'aria-required': 'true', 'aria-describedby': ['ayuda-fecha', 'ayuda-dias'].join(' ') });
  const boton = el('button', { type: 'submit', class: 'principal' }, T.reservar);
  let enviando = false;

  const formulario = el('form', {
    class: 'reservar', novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      if (enviando) return;
      enviando = true;
      boton.disabled = true;
      try {
        const res = await api.reservar({ materialId: material.value, cantidad: cantidad.value === '' ? null : Number(cantidad.value), inicio: aIso(inicio.value), fin: aIso(fin.value) });
        if (res.estado === 200) {
          avisos.poner(res.cuerpo.mensaje);
          return navegar('/mis-reservas');
        }
        mensajes.error(res.cuerpo?.error?.mensaje ?? T.errorRed);
      } finally {
        enviando = false;
        boton.disabled = false;
      }
    },
  },
  el('label', { for: 'material' }, T.materialCampo), material,
  el('label', { for: 'cantidad' }, T.cantidadCampo), cantidad, el('span', { id: 'ayuda-cantidad', class: 'ayuda' }, T.ayudaCantidad),
  el('label', { for: 'inicio' }, T.inicioCampo), inicio,
  el('label', { for: 'fin' }, T.finCampo), fin,
  el('span', { id: 'ayuda-fecha', class: 'ayuda' }, T.ayudaFecha), el('span', { id: 'ayuda-dias', class: 'ayuda' }, T.ayudaDias),
  boton);

  const mias = await api.misReservas();
  const lista = mias.estado === 200 ? listaReservas({ filas: mias.cuerpo.reservas, T }) : '';
  base.append(mensajes.zona, formulario, el('h2', {}, T.misReservas), lista);
  return base;
}
