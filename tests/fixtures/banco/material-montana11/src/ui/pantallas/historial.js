import { TEXTOS, textoHistorialDe, textoFilaHistorial, textoFilaMultaHistorial } from '../textos.js';
import { mensajeError } from '../errores.js';
import { mostrarAviso } from '../componentes/aviso.js';
import { pantallaProhibido } from './prohibido.js';

/** UC-016 / SCR-011: la junta elige un socio y ve sus préstamos y multas. Solo lectura: ningún botón cambia datos (INV-SEC-002). */
export async function pantallaHistorial({ contenedor, usuario, api }) {
  const titulo = document.createElement('h1');
  titulo.textContent = TEXTOS.historialSocio;

  const formulario = document.createElement('form');
  const etiqueta = document.createElement('label');
  etiqueta.htmlFor = 'historial-socio';
  etiqueta.textContent = TEXTOS.socio;
  const selector = document.createElement('select');
  selector.id = 'historial-socio';
  const ver = document.createElement('button');
  ver.type = 'submit';
  ver.textContent = TEXTOS.verHistorial;
  formulario.append(etiqueta, selector, ver);

  const zonaAviso = document.createElement('div');
  const zonaHistorial = document.createElement('div');
  contenedor.replaceChildren(titulo, formulario, zonaAviso, zonaHistorial);

  const caducada = (e) => e.codigo === 'E_NO_AUTENTICADO' || e.codigo === 'E_SESION_CADUCADA';   // la API ya llevó a Entrar
  const textoDe = (e) => (e.codigo ? e.message : mensajeError('E_ALMACEN_NO_DISPONIBLE'));

  function pintar({ socio, prestamos, multas }) {
    const h = document.createElement('h2');
    h.textContent = textoHistorialDe(socio.nombre);
    if (prestamos.length === 0 && multas.length === 0) {
      zonaHistorial.replaceChildren(h, Object.assign(document.createElement('p'), { textContent: TEXTOS.sinHistorial }));
      return;
    }
    const ul = document.createElement('ul');
    for (const texto of [
      ...prestamos.map((p) => textoFilaHistorial(p.material, p.unidad, p.inicio, p.fin, p.estado)),
      ...multas.map((m) => textoFilaMultaHistorial(m.importeEur, m.estado)),
    ]) ul.append(Object.assign(document.createElement('li'), { textContent: texto }));
    zonaHistorial.replaceChildren(h, ul);
  }

  async function cargar(socioId) {
    mostrarAviso(zonaAviso, 'error', '');
    zonaHistorial.replaceChildren();
    try {
      pintar(await api.consultarHistorialSocio(socioId));
    } catch (e) {
      if (caducada(e)) return;
      mostrarAviso(zonaAviso, 'error', textoDe(e));
    }
  }

  formulario.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (selector.value) cargar(Number(selector.value));
  });

  try {
    const socios = await api.listarSociosHistorial();
    const opcion = (texto, valor) => Object.assign(document.createElement('option'), { textContent: texto, value: valor });
    selector.append(opcion(TEXTOS.elegirSocio, ''), ...socios.map((s) => opcion(s.nombre, String(s.id))));
  } catch (e) {
    if (e.codigo === 'E_ACCESO_NO_PERMITIDO') return pantallaProhibido({ contenedor, usuario });
    if (!caducada(e)) mostrarAviso(zonaAviso, 'error', textoDe(e));
  }
  return undefined;
}
