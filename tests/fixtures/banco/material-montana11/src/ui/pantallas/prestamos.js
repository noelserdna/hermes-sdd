import { TEXTOS, textoEstadoReserva, textoEntregarDe, textoDevolverDe, textoImporte, textoEstadoMulta, textoMultaCreada } from '../textos.js';
import { mensajeError } from '../errores.js';
import { mostrarAviso } from '../componentes/aviso.js';
import { pantallaProhibido } from './prohibido.js';

/** UC-008 / SCR-007: lista de reservas y préstamos con la acción válida de cada estado (solo el encargado). */
export async function pantallaPrestamos({ contenedor, usuario, api }) {
  const titulo = document.createElement('h1');
  titulo.textContent = TEXTOS.prestamos;
  const zonaAviso = document.createElement('div');
  zonaAviso.tabIndex = -1;   // tras una acción el foco vuelve al aviso (SCR-007)
  const zonaLista = document.createElement('div');
  contenedor.replaceChildren(titulo, zonaAviso, zonaLista);

  const caducada = (e) => e.codigo === 'E_NO_AUTENTICADO' || e.codigo === 'E_SESION_CADUCADA';   // la API ya llevó a Entrar
  const textoDe = (e) => (e.codigo ? e.message : mensajeError('E_ALMACEN_NO_DISPONIBLE'));

  async function ejecutar(boton, accion) {
    boton.disabled = true;
    mostrarAviso(zonaAviso, 'error', '');
    try {
      const resultado = await accion();
      if (resultado?.multa) mostrarAviso(zonaAviso, 'exito', textoMultaCreada(resultado.multa.importeEur));
    } catch (e) {
      if (caducada(e)) return;
      mostrarAviso(zonaAviso, 'error', textoDe(e));
    }
    try { await cargar(); } catch { /* la lista anterior se queda */ }
    zonaAviso.focus();
  }

  // Solo la acción válida del estado: Reservada "Entregar", Entregado "Registrar devolución"; el resto, ninguna.
  function celdaAccion(r, celda) {
    const accion = { Reservada: [TEXTOS.entregar, textoEntregarDe, () => api.entregarReserva(r.id)],
      Entregado: [TEXTOS.registrarDevolucion, textoDevolverDe, () => api.registrarDevolucion(r.id)] }[r.estado];
    if (!accion) return;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = accion[0];
    boton.setAttribute('aria-label', accion[1](r.material, r.unidad));
    boton.addEventListener('click', () => ejecutar(boton, accion[2]));
    celda.append(boton);
  }

  function tabla(reservas) {
    const t = document.createElement('table');
    t.setAttribute('aria-label', TEXTOS.prestamos);
    const cabecera = t.createTHead().insertRow();
    for (const texto of [TEXTOS.columnaMaterial, TEXTOS.columnaSocio, TEXTOS.columnaInicio, TEXTOS.columnaFin, TEXTOS.columnaEstado, TEXTOS.columnaDevuelta, TEXTOS.columnaMulta, TEXTOS.columnaAccion]) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = texto;
      cabecera.append(th);
    }
    const cuerpo = t.createTBody();
    for (const r of reservas) {
      const fila = cuerpo.insertRow();
      fila.insertCell().textContent = `${r.material} ${r.unidad}`;
      fila.insertCell().textContent = r.socio;
      fila.insertCell().textContent = r.inicio;
      fila.insertCell().textContent = r.fin;
      fila.insertCell().textContent = textoEstadoReserva(r.estado);
      fila.insertCell().textContent = r.devueltaEl ?? '';
      fila.insertCell().textContent = r.multa ? `${textoImporte(r.multa.importeEur)} ${textoEstadoMulta(r.multa.estado)}` : '';
      celdaAccion(r, fila.insertCell());
    }
    return t;
  }

  async function cargar() {
    const reservas = await api.listarPrestamosYReservas();
    zonaLista.replaceChildren(reservas.length === 0
      ? Object.assign(document.createElement('p'), { textContent: TEXTOS.sinPrestamos })
      : tabla(reservas));
  }

  try {
    await cargar();
  } catch (e) {
    if (e.codigo === 'E_ACCESO_NO_PERMITIDO') return pantallaProhibido({ contenedor, usuario });
    if (!caducada(e)) mostrarAviso(zonaAviso, 'error', textoDe(e));
  }
  return undefined;
}
