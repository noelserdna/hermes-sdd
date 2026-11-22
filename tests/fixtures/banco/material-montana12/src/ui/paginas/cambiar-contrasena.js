// SCR-002 · UC-004: elegir contraseña nueva en el primer acceso o tras un restablecimiento (INV-SOC-006).
// Una sola contraseña (con «Mostrar»); el error del servidor sale bajo el campo, que queda marcado como inválido.
import { el } from '../componentes.js';

export async function paginaCambiarContrasena({ api, T, navegar, avisos }) {
  const campo = el('input', { id: 'contrasena-nueva', name: 'contrasena', type: 'password', autocomplete: 'new-password', 'aria-describedby': 'ayuda-contrasena' });
  const error = el('p', { id: 'error-contrasena', class: 'error', role: 'alert', tabindex: '-1' });
  error.hidden = true;
  const mostrar = el('button', {
    type: 'button', class: 'secundario', 'aria-pressed': 'false',
    onclick: () => {
      const visible = campo.type === 'password';
      campo.type = visible ? 'text' : 'password';
      mostrar.setAttribute('aria-pressed', String(visible));
      mostrar.textContent = visible ? T.ocultar : T.mostrar;
    },
  }, T.mostrar);
  let enviando = false;

  const formulario = el('form', {
    novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      if (enviando) return;
      enviando = true;
      try {
        const r = await api.cambiarContrasena(campo.value);
        if (r.estado === 200) {
          avisos?.quitar(T.avisoProvisional);
          return navegar(r.cuerpo.destino);
        }
        error.textContent = r.cuerpo?.error?.mensaje ?? T.errorRed;
        error.hidden = false;
        campo.setAttribute('aria-invalid', 'true');
        campo.setAttribute('aria-describedby', ['ayuda-contrasena', 'error-contrasena'].join(' '));
        error.focus();
      } finally {
        enviando = false;
      }
    },
  },
  el('label', { for: 'contrasena-nueva' }, T.contrasenaNueva),
  el('span', { id: 'ayuda-contrasena', class: 'ayuda' }, T.ayudaContrasena),
  el('div', { class: 'con-boton' }, campo, mostrar),
  error,
  el('button', { type: 'submit' }, T.guardar));

  return el('main', {}, el('h1', {}, T.cambiarTitulo), formulario);
}
