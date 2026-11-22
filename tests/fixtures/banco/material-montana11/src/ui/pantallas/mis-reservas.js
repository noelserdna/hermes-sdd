import { TEXTOS, textoEstadoReserva, textoCancelarDe, textoConfirmarCancelar } from '../textos.js';
import { mensajeError } from '../errores.js';
import { mostrarAviso } from '../componentes/aviso.js';
import { crearConfirmar } from '../componentes/confirmar.js';

/** UC-006, UC-007 / SCR-003: solo las reservas del socio, las más recientes primero, y "Cancelar reserva" en las Reservadas. */
export async function pantallaMisReservas({ contenedor, api }) {
  const titulo = document.createElement('h1');
  titulo.textContent = TEXTOS.misReservas;
  const zonaAviso = document.createElement('div');
  zonaAviso.tabIndex = -1;   // tras cancelar el foco vuelve al aviso (SCR-003)
  const zonaLista = document.createElement('div');
  contenedor.replaceChildren(titulo, zonaAviso, zonaLista);

  const caducada = (e) => e.codigo === 'E_NO_AUTENTICADO' || e.codigo === 'E_SESION_CADUCADA';   // la API ya llevó a Entrar
  const textoDe = (e) => (e.codigo ? e.message : mensajeError('E_ALMACEN_NO_DISPONIBLE'));

  function celdaAccion(r, celda) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = TEXTOS.cancelarReserva;
    boton.setAttribute('aria-label', textoCancelarDe(r.material, r.inicio));
    boton.addEventListener('click', () => {
      const cerrar = () => { confirmar.elemento.replaceWith(boton); boton.focus(); };
      const confirmar = crearConfirmar({
        pregunta: textoConfirmarCancelar(r.material), textoSi: TEXTOS.confirmarSi, textoNo: TEXTOS.confirmarNo,
        alSi: async () => {
          confirmar.elemento.querySelectorAll('button').forEach((b) => { b.disabled = true; });
          mostrarAviso(zonaAviso, 'error', '');
          try {
            await api.cancelarReserva(r.id);
            mostrarAviso(zonaAviso, 'exito', TEXTOS.reservaCancelada);
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

  function tabla(reservas) {
    const t = document.createElement('table');
    t.setAttribute('aria-label', TEXTOS.reservas);
    const cabecera = t.createTHead().insertRow();
    for (const texto of [TEXTOS.columnaMaterial, TEXTOS.columnaInicio, TEXTOS.columnaFin, TEXTOS.columnaEstado, TEXTOS.columnaAccion]) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = texto;
      cabecera.append(th);
    }
    const cuerpo = t.createTBody();
    for (const r of reservas) {
      const fila = cuerpo.insertRow();
      fila.insertCell().textContent = r.material;
      fila.insertCell().textContent = r.inicio;
      fila.insertCell().textContent = r.fin;
      fila.insertCell().textContent = textoEstadoReserva(r.estado);
      const accion = fila.insertCell();
      if (r.estado === 'Reservada') celdaAccion(r, accion);
    }
    return t;
  }

  async function cargar() {
    const reservas = await api.listarMisReservas();
    if (reservas.length === 0) {
      zonaLista.replaceChildren(Object.assign(document.createElement('p'), { textContent: TEXTOS.sinReservas }));
      return;
    }
    zonaLista.replaceChildren(tabla(reservas));
  }

  try {
    await cargar();
  } catch (e) {
    if (!caducada(e)) mostrarAviso(zonaAviso, 'error', textoDe(e));
  }
}
