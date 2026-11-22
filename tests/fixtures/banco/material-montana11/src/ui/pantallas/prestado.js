import { TEXTOS, textoFilaPrestado, textoRetrasado } from '../textos.js';
import { mensajeError } from '../errores.js';
import { mostrarAviso } from '../componentes/aviso.js';
import { pantallaProhibido } from './prohibido.js';

/** UC-015 / SCR-010: lo prestado ahora, con "Retrasado n día" y, bajo "Vuelven hoy", lo que vuelve el día elegido (encargado). */
export async function pantallaPrestado({ contenedor, usuario, api }) {
  const titulo = document.createElement('h1');
  titulo.textContent = TEXTOS.prestado;

  const formulario = document.createElement('form');
  const etiqueta = document.createElement('label');
  etiqueta.htmlFor = 'prestado-dia';
  etiqueta.textContent = TEXTOS.dia;
  const campo = document.createElement('input');
  campo.type = 'date';
  campo.id = 'prestado-dia';
  const ver = document.createElement('button');
  ver.type = 'submit';
  ver.textContent = TEXTOS.ver;
  formulario.append(etiqueta, campo, ver);

  const zonaAviso = document.createElement('div');
  const zonaLista = document.createElement('div');
  contenedor.replaceChildren(titulo, formulario, zonaAviso, zonaLista);

  const caducada = (e) => e.codigo === 'E_NO_AUTENTICADO' || e.codigo === 'E_SESION_CADUCADA';   // la API ya llevó a Entrar
  const textoDe = (e) => (e.codigo ? e.message : mensajeError('E_ALMACEN_NO_DISPONIBLE'));

  function seccion(texto, prestados) {
    const s = document.createElement('section');
    const h = document.createElement('h2');
    h.textContent = texto;
    const ul = document.createElement('ul');
    for (const p of prestados) {
      const li = document.createElement('li');
      li.textContent = textoFilaPrestado(p.material, p.unidad, p.socio, p.fin);
      if (p.retrasoDias > 0) {
        const insignia = document.createElement('span');
        insignia.className = 'insignia insignia-retraso';
        insignia.textContent = textoRetrasado(p.retrasoDias);
        li.append(' ', insignia);
      }
      ul.append(li);
    }
    s.append(h, ul);
    return s;
  }

  function pintar(prestados) {
    zonaLista.replaceChildren(prestados.length === 0
      ? Object.assign(document.createElement('p'), { textContent: TEXTOS.sinPrestado })
      : (() => {
        const f = document.createDocumentFragment();
        f.append(seccion(TEXTOS.vuelvenHoy, prestados.filter((p) => p.vuelveHoy)), seccion(TEXTOS.prestadoAhora, prestados.filter((p) => !p.vuelveHoy)));
        return f;
      })());
  }

  async function cargar(dia) {
    mostrarAviso(zonaAviso, 'error', '');
    try {
      pintar(await api.consultarPrestado(dia));
    } catch (e) {
      if (caducada(e)) return false;
      if (e.codigo === 'E_ACCESO_NO_PERMITIDO') { pantallaProhibido({ contenedor, usuario }); return false; }
      if (e.codigo !== 'E_DATOS_INVALIDOS') zonaLista.replaceChildren();   // con un día mal formado se conserva la lista anterior
      mostrarAviso(zonaAviso, 'error', textoDe(e));
    }
    return true;
  }

  formulario.addEventListener('submit', (ev) => { ev.preventDefault(); cargar(campo.value || undefined); });
  await cargar(undefined);
  return undefined;
}
