import { h } from '../dom.js';
import { T } from '../textos.js';

// SCR-006 Socios (UC-002): lista de socios con alta, baja (con confirmación en la fila) y restablecer contraseña (campo en la fila).
// El encargado es el único con acceso (lo corta el router); la baja bloqueada la rechaza el servidor y se muestra su mensaje.
export function montar({ raiz, api }) {
  const t = T.socios;
  const mensajes = h('div', { id: 'mensajes' });
  const cuerpo = h('tbody', {});
  const avisar = (rol, texto) => { mensajes.replaceChildren(h('div', { role: rol }, texto)); };

  async function cargar() {
    try {
      const socios = await api.listarSociosDetalle();
      cuerpo.replaceChildren(...socios.map(fila));
    } catch (e) { avisar('alert', e.mensaje ?? T.general.fallo); }
  }

  function fila(socio) {
    const acciones = h('td', {});
    const tr = h('tr', { 'data-socio': socio.id }, h('td', {}, socio.nombre), h('td', {}, socio.correo), h('td', {}, socio.estado), acciones);
    if (socio.estado === 'Activa') mostrarAcciones(acciones, socio);
    return tr;
  }

  function mostrarAcciones(celda, socio) {
    celda.replaceChildren(
      h('button', { type: 'button', 'data-accion': 'restablecer', onclick: () => pedirContrasena(celda, socio) }, t.restablecer), ' ',
      h('button', { type: 'button', 'data-accion': 'baja', onclick: () => confirmarBaja(celda, socio) }, t.darDeBaja),
    );
  }

  function confirmarBaja(celda, socio) {
    celda.replaceChildren(h('span', { role: 'group' }, t.confirmarBaja(socio.nombre), ' ',
      h('button', { type: 'button', 'data-accion': 'confirmar', onclick: () => darDeBaja(socio) }, t.confirmar), ' ',
      h('button', { type: 'button', 'data-accion': 'mantener', onclick: () => mostrarAcciones(celda, socio) }, t.mantener)));
  }

  async function darDeBaja(socio) {
    try { await api.darDeBajaSocio(socio.id); mensajes.replaceChildren(); } catch (e) { avisar('alert', e.mensaje ?? T.general.fallo); }
    await cargar();
  }

  function pedirContrasena(celda, socio) {
    const campo = h('input', { type: 'password', name: 'contrasena-nueva', 'aria-label': t.contrasenaNuevaDe(socio.nombre), autocomplete: 'new-password' });
    celda.replaceChildren(campo, ' ',
      h('button', { type: 'button', 'data-accion': 'guardar', onclick: () => guardar(celda, socio, campo) }, t.guardar), ' ',
      h('button', { type: 'button', 'data-accion': 'mantener', onclick: () => mostrarAcciones(celda, socio) }, t.mantener));
    campo.focus();
  }

  async function guardar(celda, socio, campo) {
    try {
      await api.restablecerContrasena(socio.id, campo.value);
      avisar('status', t.restablecida);
      mostrarAcciones(celda, socio);
    } catch (e) { avisar('alert', e.mensaje ?? T.general.fallo); }
  }

  const nombre = h('input', { id: 'nombre', name: 'nombre', type: 'text', autocomplete: 'off' });
  const correo = h('input', { id: 'correo', name: 'correo', type: 'email', autocomplete: 'off' });
  const contrasena = h('input', { id: 'contrasena', name: 'contrasena', type: 'password', autocomplete: 'new-password' });
  const boton = h('button', { type: 'submit' }, t.anadir);
  let enviando = false;

  const formulario = h('form', {
    novalidate: true,
    async onsubmit(evento) {
      evento.preventDefault();
      if (enviando) return;
      enviando = true;
      boton.setAttribute('aria-busy', 'true');
      try {
        await api.crearSocio(nombre.value, correo.value, contrasena.value);
        mensajes.replaceChildren();
        nombre.value = ''; correo.value = ''; contrasena.value = '';
        await cargar();
      } catch (e) { avisar('alert', e.mensaje ?? T.general.fallo); }
      enviando = false;
      boton.removeAttribute('aria-busy');
    },
  },
  h('h2', {}, t.anadirTitulo),
  h('label', {}, t.nombre, nombre),
  h('label', {}, t.correo, correo),
  h('label', {}, t.contrasenaInicial, contrasena),
  h('small', {}, t.ayudaContrasena),
  boton);

  const titulo = h('h1', { tabindex: '-1' }, t.titulo);
  const tabla = h('table', { 'aria-label': t.lista },
    h('thead', {}, h('tr', {}, h('th', {}, t.nombre), h('th', {}, t.correo), h('th', {}, t.estado), h('th', {}, t.acciones))), cuerpo);
  raiz.replaceChildren(titulo, mensajes, tabla, formulario);
  titulo.focus();
  return cargar();
}
