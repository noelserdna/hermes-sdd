// SCR-001 · UC-001: formulario de correo y contraseña. El error del servidor se muestra tal cual, con foco.
import { el, zonaMensajes } from '../componentes.js';

export async function paginaEntrar({ api, T, navegar, avisos }) {
  const mensajes = zonaMensajes();
  const correo = el('input', { id: 'correo', name: 'correo', type: 'email', autocomplete: 'username', required: false });
  const contrasena = el('input', { id: 'contrasena', name: 'contrasena', type: 'password', autocomplete: 'current-password' });
  let enviando = false;

  const formulario = el('form', {
    novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      if (enviando) return;
      enviando = true;
      try {
        const r = await api.entrar(correo.value, contrasena.value);
        if (r.estado === 200) {
          avisos?.vaciar();   // empieza una sesión nueva: nada de lo que avisó otra pasa a ésta
          if (r.cuerpo.destino === '/cambiar-contrasena') avisos?.poner(T.avisoProvisional);   // INV-SOC-006: contraseña provisional
          return navegar(r.cuerpo.destino);
        }
        mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
        contrasena.value = '';
      } finally {
        enviando = false;
      }
    },
  },
  el('label', { for: 'correo' }, T.correo), correo,
  el('label', { for: 'contrasena' }, T.contrasena), contrasena,
  el('button', { type: 'submit' }, T.entrar));

  return el('main', { class: 'entrar' }, el('strong', {}, T.marca), el('h1', {}, T.entrar), mensajes.zona, formulario);
}
