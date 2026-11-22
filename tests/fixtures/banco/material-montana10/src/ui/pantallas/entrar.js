import { h } from '../dom.js';
import { T } from '../textos.js';

// SCR-001 Entrar (UC-001). Un solo mensaje para cualquier credencial mala; el doble envío no repite la petición.
export function montar({ raiz, api, ir, avisos, inicioDe }) {
  const titulo = h('h1', { tabindex: '-1' }, T.entrar.titulo);
  const mensajes = h('div', { id: 'mensajes' });
  const correo = h('input', { id: 'correo', name: 'correo', type: 'email', autocomplete: 'username', required: true });
  const contrasena = h('input', { id: 'contrasena', name: 'contrasena', type: 'password', autocomplete: 'current-password', required: true });
  const boton = h('button', { type: 'submit' }, T.entrar.boton);
  let enviando = false;

  const avisar = (texto) => {
    const alerta = h('div', { role: 'alert', tabindex: '-1' }, texto);
    mensajes.replaceChildren(alerta);
    alerta.focus();
  };

  const formulario = h('form', {
    novalidate: true,
    async onsubmit(evento) {
      evento.preventDefault();
      if (enviando) return;
      enviando = true;
      boton.setAttribute('aria-busy', 'true');
      boton.disabled = true;
      try {
        const { rol } = await api.iniciarSesion(correo.value, contrasena.value);
        ir(inicioDe(rol));
      } catch (e) {
        avisar(e.mensaje ?? T.general.fallo);
        enviando = false;
        boton.removeAttribute('aria-busy');
        boton.disabled = false;
      }
    },
  },
  h('label', {}, T.entrar.correo, correo),
  h('label', {}, T.entrar.contrasena, contrasena),
  boton);

  raiz.replaceChildren(titulo, mensajes, formulario);
  const previo = avisos.tomar();
  if (previo) avisar(previo); else titulo.focus();
}
