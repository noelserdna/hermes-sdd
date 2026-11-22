import { TEXTOS } from '../textos.js';

/** SCR-012: el rol no tiene permiso para esta pantalla. */
export function pantallaProhibido({ contenedor }) {
  const titulo = document.createElement('h1');
  titulo.textContent = TEXTOS.accesoNoPermitido;
  contenedor.replaceChildren(titulo);
}
