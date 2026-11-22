import { TEXTOS } from '../textos.js';

/** Cabecera de las pantallas con sesión: nombre del usuario, menú por rol y botón "Salir". */
export function crearCabecera({ usuario, enlaces = [], alSalir }) {
  const cab = document.createElement('header');
  cab.className = 'cabecera';

  const nombre = document.createElement('span');
  nombre.className = 'usuario';
  nombre.textContent = usuario.nombre;
  cab.append(nombre);

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', TEXTOS.menu);
  for (const { texto, hash } of enlaces) {
    const a = document.createElement('a');
    a.href = hash;
    a.textContent = texto;
    nav.append(a);
  }
  cab.append(nav);

  const salir = document.createElement('button');
  salir.type = 'button';
  salir.textContent = TEXTOS.salir;
  salir.addEventListener('click', () => alSalir?.());
  cab.append(salir);
  return cab;
}
