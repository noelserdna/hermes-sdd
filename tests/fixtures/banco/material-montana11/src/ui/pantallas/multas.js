import { TEXTOS, textoImporte, textoEstadoMulta, textoMarcarPagadaDe, textoConfirmarPagar } from '../textos.js';
import { mensajeError } from '../errores.js';
import { mostrarAviso } from '../componentes/aviso.js';
import { crearConfirmar } from '../componentes/confirmar.js';
import { pantallaProhibido } from './prohibido.js';

/** UC-012 / SCR-008: todas las multas con socio, importe y estado, y "Marcar pagada" con confirmación en línea (encargado). */
export async function pantallaMultas({ contenedor, usuario, api }) {
  const titulo = document.createElement('h1');
  titulo.textContent = TEXTOS.multas;
  const zonaAviso = document.createElement('div');
  zonaAviso.tabIndex = -1;   // tras pagar el foco vuelve al aviso (SCR-008)
  const zonaLista = document.createElement('div');
  contenedor.replaceChildren(titulo, zonaAviso, zonaLista);

  const caducada = (e) => e.codigo === 'E_NO_AUTENTICADO' || e.codigo === 'E_SESION_CADUCADA';   // la API ya llevó a Entrar
  const textoDe = (e) => (e.codigo ? e.message : mensajeError('E_ALMACEN_NO_DISPONIBLE'));

  function celdaAccion(m, celda) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = TEXTOS.marcarPagada;
    boton.setAttribute('aria-label', textoMarcarPagadaDe(m.socio, textoImporte(m.importeEur)));
    boton.addEventListener('click', () => {
      const cerrar = () => { confirmar.elemento.replaceWith(boton); boton.focus(); };
      const confirmar = crearConfirmar({
        pregunta: textoConfirmarPagar(m.socio), textoSi: TEXTOS.confirmarPagarSi, textoNo: TEXTOS.confirmarNo,
        alSi: async () => {
          confirmar.elemento.querySelectorAll('button').forEach((b) => { b.disabled = true; });
          mostrarAviso(zonaAviso, 'error', '');
          try {
            await api.marcarMultaPagada(m.id);
          } catch (e) {
            if (caducada(e)) return;
            mostrarAviso(zonaAviso, 'error', textoDe(e));
          }
          try { await cargar(); } catch { /* la lista anterior se queda */ }
          zonaAviso.focus();
        },
        alNo: cerrar,
      });
      boton.replaceWith(confirmar.elemento);
      confirmar.enfocar();
    });
    celda.append(boton);
  }

  function tabla(multas) {
    const t = document.createElement('table');
    t.setAttribute('aria-label', TEXTOS.multas);
    const cabecera = t.createTHead().insertRow();
    for (const texto of [TEXTOS.columnaSocio, TEXTOS.columnaImporte, TEXTOS.columnaEstado, TEXTOS.columnaPagadaEl, TEXTOS.columnaAccion]) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = texto;
      cabecera.append(th);
    }
    const cuerpo = t.createTBody();
    for (const m of multas) {
      const fila = cuerpo.insertRow();
      fila.insertCell().textContent = m.socio;
      fila.insertCell().textContent = textoImporte(m.importeEur);
      fila.insertCell().textContent = textoEstadoMulta(m.estado);
      fila.insertCell().textContent = m.pagadaEl ?? '';
      const accion = fila.insertCell();
      if (m.estado === 'Pendiente') celdaAccion(m, accion);
    }
    return t;
  }

  async function cargar() {
    const multas = await api.listarMultas();
    zonaLista.replaceChildren(multas.length === 0
      ? Object.assign(document.createElement('p'), { textContent: TEXTOS.sinMultas })
      : tabla(multas));
  }

  try {
    await cargar();
  } catch (e) {
    if (e.codigo === 'E_ACCESO_NO_PERMITIDO') return pantallaProhibido({ contenedor, usuario });
    if (!caducada(e)) mostrarAviso(zonaAviso, 'error', textoDe(e));
  }
  return undefined;
}
