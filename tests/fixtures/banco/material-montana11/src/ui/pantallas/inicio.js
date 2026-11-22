import { TEXTOS, tituloInicio } from '../textos.js';
import { pantallaReservar } from './reservar.js';

const DESCRIPCION = { encargado: TEXTOS.descripcionEncargado, junta: TEXTOS.descripcionJunta };
// Accesos del Panel del encargado (SCR-005).
const ACCESOS_ENCARGADO = [{ texto: TEXTOS.irAPrestamos, hash: '#/prestamos' }, { texto: TEXTOS.irAPrestado, hash: '#/prestado' }];

/** Inicio por rol (RN-012). El del socio es Reservar (SCR-002); el del encargado, su Panel (SCR-005). */
export function pantallaInicio(contexto) {
  const { contenedor, usuario } = contexto;
  if (usuario.rol === 'socio') return pantallaReservar(contexto);
  const titulo = document.createElement('h1');
  titulo.textContent = tituloInicio(usuario.rol);
  const texto = document.createElement('p');
  texto.textContent = DESCRIPCION[usuario.rol];
  const contenido = [titulo, texto];
  if (usuario.rol === 'encargado') {
    const accesos = document.createElement('p');
    for (const { texto: t, hash } of ACCESOS_ENCARGADO) {
      const a = document.createElement('a');
      a.href = hash;
      a.textContent = t;
      accesos.append(a, ' ');
    }
    contenido.push(accesos);
  }
  contenedor.replaceChildren(...contenido);
  return undefined;
}
