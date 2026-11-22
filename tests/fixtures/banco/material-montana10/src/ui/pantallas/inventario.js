import { h } from '../dom.js';
import { T } from '../textos.js';
import { TIPOS_MATERIAL } from '../../domain/config.js';

// SCR-007 Inventario (UC-008). El recuento por tipo cuenta solo unidades Activas; la baja pide confirmación en la fila y, en una unidad prestada, el servidor la rechaza (INV-STK-002) y se muestra su mensaje.
export function montar({ raiz, api }) {
  const mensajes = h('div', { id: 'mensajes' });
  const lista = h('div', { id: 'lista-inventario' });
  const avisar = (rol, texto) => { mensajes.replaceChildren(h('div', { role: rol }, texto)); };

  async function cargar() {
    try {
      const tipos = await api.listarInventario();
      lista.replaceChildren(...(tipos.length ? tipos.map(seccion) : [h('p', {}, T.inventario.sinUnidades)]));
    } catch (e) { avisar('alert', e.mensaje); }
  }

  function seccion({ tipo, activas, unidades }) {
    return h('section', { 'data-tipo': tipo }, h('h2', {}, T.inventario.recuento(tipo, activas)), h('ul', {}, unidades.map(fila)));
  }

  function fila(unidad) {
    const estado = unidad.prestada ? 'Prestada' : unidad.estado;
    const texto = h('span', {}, T.inventario.unidad(unidad.nombre, T.inventario.estados[estado]));
    const li = h('li', { 'data-unidad': unidad.id }, texto);
    if (unidad.estado === 'Activa') li.append(' ', botonBaja(li, unidad));
    return li;
  }

  function botonBaja(li, unidad) {
    const boton = h('button', { type: 'button', onclick: () => confirmar(li, unidad, boton) }, T.inventario.marcarRota);
    return boton;
  }

  function confirmar(li, unidad, boton) {
    const pregunta = h('span', { role: 'group' },
      T.inventario.confirmarRota(unidad.nombre), ' ',
      h('button', { type: 'button', 'data-accion': 'confirmar', onclick: () => darDeBaja(unidad) }, T.inventario.confirmar), ' ',
      h('button', { type: 'button', 'data-accion': 'mantener', onclick: () => pregunta.replaceWith(boton) }, T.inventario.mantener));
    boton.replaceWith(pregunta);
  }

  async function darDeBaja(unidad) {
    try { await api.darDeBajaUnidad(unidad.id); mensajes.replaceChildren(); } catch (e) { avisar('alert', e.mensaje); }
    await cargar();
  }

  const tipo = h('select', { id: 'tipo', name: 'tipo' }, TIPOS_MATERIAL.map((t) => h('option', { value: t }, t)));
  const cantidad = h('input', { id: 'cantidad', name: 'cantidad', type: 'number', min: '1', step: '1', value: '1', required: true });
  const boton = h('button', { type: 'submit' }, T.inventario.anadir);
  let enviando = false;

  const formulario = h('form', {
    novalidate: true,
    async onsubmit(evento) {
      evento.preventDefault();
      if (enviando) return;
      enviando = true;
      boton.setAttribute('aria-busy', 'true');
      try {
        const { tipo: material, anadidas } = await api.anadirUnidades(tipo.value, cantidad.value === '' ? null : Number(cantidad.value));
        avisar('status', T.inventario.anadidas(anadidas, material));
        await cargar();
      } catch (e) { avisar('alert', e.mensaje); }
      enviando = false;
      boton.removeAttribute('aria-busy');
    },
  },
  h('h2', {}, T.inventario.anadirTitulo),
  h('label', {}, T.inventario.material, tipo),
  h('label', {}, T.inventario.cantidad, cantidad),
  boton);

  const titulo = h('h1', { tabindex: '-1' }, T.inventario.titulo);
  raiz.replaceChildren(titulo, mensajes, lista, formulario);
  titulo.focus();
  return cargar();
}
