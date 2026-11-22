/**
 * Confirmación en línea (mol-confirm): una pregunta con dos botones, el foco en el primero y Esc para cerrarla.
 * `alSi` y `alNo` los decide quien la usa; el componente solo se pinta y devuelve `elemento` y `enfocar()`.
 */
export function crearConfirmar({ pregunta, textoSi, textoNo, alSi, alNo }) {
  const elemento = document.createElement('div');
  elemento.setAttribute('role', 'group');
  elemento.setAttribute('aria-label', pregunta);
  const texto = document.createElement('span');
  texto.textContent = pregunta;
  const si = document.createElement('button');
  si.type = 'button'; si.textContent = textoSi;
  const no = document.createElement('button');
  no.type = 'button'; no.textContent = textoNo;
  si.addEventListener('click', () => alSi());
  no.addEventListener('click', () => alNo());
  elemento.addEventListener('keydown', (evento) => { if (evento.key === 'Escape') alNo(); });
  elemento.append(texto, si, no);
  return { elemento, enfocar: () => si.focus() };
}
