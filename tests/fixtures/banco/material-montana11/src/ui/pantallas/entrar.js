import { TEXTOS } from '../textos.js';
import { mensajeError } from '../errores.js';
import { mostrarAviso } from '../componentes/aviso.js';

function campo(id, etiqueta, tipo, autocompletar) {
  const fila = document.createElement('div');
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = etiqueta;
  const input = document.createElement('input');
  input.id = id; input.name = id; input.type = tipo; input.autocomplete = autocompletar;
  fila.append(label, input);
  return { fila, input };
}

/** UC-001: formulario Entrar. El botón queda deshabilitado mientras espera, así un doble clic envía una sola petición. */
export function pantallaEntrar({ raiz, navegar, api, estado = {} }) {
  const titulo = document.createElement('h1');
  titulo.textContent = TEXTOS.entrar;

  const form = document.createElement('form');
  form.noValidate = true;
  const correo = campo('correo', TEXTOS.correo, 'email', 'username');
  const contrasena = campo('contrasena', TEXTOS.contrasena, 'password', 'current-password');
  const boton = document.createElement('button');
  boton.type = 'submit';
  boton.textContent = TEXTOS.entrar;
  const zonaAviso = document.createElement('div');
  form.append(correo.fila, contrasena.fila, boton);

  if (estado.avisoEntrar) {
    mostrarAviso(zonaAviso, 'error', mensajeError(estado.avisoEntrar));
    delete estado.avisoEntrar;
  }

  let enviando = false;
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    enviando = true;
    boton.disabled = true;
    mostrarAviso(zonaAviso, 'error', '');
    try {
      await api.iniciarSesion(correo.input.value, contrasena.input.value);
      navegar('#/inicio');
    } catch (e) {
      mostrarAviso(zonaAviso, 'error', e.message ?? mensajeError(e.codigo));
      contrasena.input.value = '';
    } finally {
      enviando = false;
      boton.disabled = false;
    }
  });

  raiz.replaceChildren(titulo, form, zonaAviso);
}
