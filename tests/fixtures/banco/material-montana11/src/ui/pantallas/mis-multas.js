import { TEXTOS, textoImporte, textoEstadoMulta } from '../textos.js';
import { mensajeError } from '../errores.js';
import { mostrarAviso } from '../componentes/aviso.js';
import { pantallaProhibido } from './prohibido.js';

/** UC-011 / SCR-004: las multas del socio con importe y estado; solo lectura, el pago lo anota el encargado. */
export async function pantallaMisMultas({ contenedor, usuario, api }) {
  const titulo = document.createElement('h1');
  titulo.textContent = TEXTOS.misMultas;
  const zonaAviso = document.createElement('div');
  const zonaLista = document.createElement('div');
  contenedor.replaceChildren(titulo, zonaAviso, zonaLista);

  function tabla(multas) {
    const t = document.createElement('table');
    t.setAttribute('aria-label', TEXTOS.misMultas);
    const cabecera = t.createTHead().insertRow();
    for (const texto of [TEXTOS.columnaMaterial, TEXTOS.columnaDevuelto, TEXTOS.columnaImporte, TEXTOS.columnaEstado]) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = texto;
      cabecera.append(th);
    }
    const cuerpo = t.createTBody();
    for (const m of multas) {
      const fila = cuerpo.insertRow();
      fila.insertCell().textContent = m.material;
      fila.insertCell().textContent = m.devueltaEl ?? '';
      fila.insertCell().textContent = textoImporte(m.importeEur);
      fila.insertCell().textContent = textoEstadoMulta(m.estado);
    }
    return t;
  }

  try {
    const multas = await api.listarMisMultas();
    if (multas.length === 0) {
      zonaLista.replaceChildren(Object.assign(document.createElement('p'), { textContent: TEXTOS.sinMultas }));
      return undefined;
    }
    const piezas = [tabla(multas)];
    if (multas.some((m) => m.estado === 'Pendiente')) piezas.push(Object.assign(document.createElement('p'), { textContent: TEXTOS.avisoBloqueoMultas }));
    zonaLista.replaceChildren(...piezas);
  } catch (e) {
    if (e.codigo === 'E_ACCESO_NO_PERMITIDO') return pantallaProhibido({ contenedor, usuario });
    if (e.codigo !== 'E_NO_AUTENTICADO' && e.codigo !== 'E_SESION_CADUCADA') mostrarAviso(zonaAviso, 'error', e.codigo ? e.message : mensajeError('E_ALMACEN_NO_DISPONIBLE'));
  }
  return undefined;
}
