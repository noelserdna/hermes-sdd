import { h } from '../dom.js';
import { T } from '../textos.js';

// SCR-004 Entregas y devoluciones (UC-005, UC-006, UC-009). El encargado entrega eligiendo la unidad (RN-020); la junta ve las mismas
// listas sin botones ni selector (INV-LOA-401). Los errores del servidor salen en la fila con su mensaje.
export function montar({ raiz, api, sesion }) {
  const t = T.entregas;
  const esEncargado = sesion.rol === 'encargado';
  const titulo = h('h1', { tabindex: '-1' }, t.titulo);
  const mensajes = h('div', { id: 'mensajes' });
  const cuerpo = h('div', { id: 'lista-entregas' });
  raiz.replaceChildren(titulo, mensajes, cuerpo);
  titulo.focus();

  async function cargar() {
    try {
      cuerpo.replaceChildren(...secciones(await api.consultarEntregasYDevoluciones()));
    } catch (e) { cuerpo.replaceChildren(h('div', { role: 'alert' }, e.mensaje ?? T.general.fallo)); }
  }

  async function entregar(fila, reserva, unidadId) {
    fila.querySelector('[role="alert"]')?.remove();
    try {
      const { unidad, socio } = await api.entregarReserva(reserva.reservaId, unidadId);
      mensajes.replaceChildren(h('div', { role: 'status' }, t.prestada(unidad, socio)));
      await cargar();
    } catch (e) { fila.append(h('div', { role: 'alert' }, e.mensaje ?? T.general.fallo)); }
  }

  // UC-006: el encargado devuelve un préstamo. El aviso lleva la multa si hay retraso; un rechazo sale en la fila (el préstamo sigue).
  async function devolver(fila, prestamo) {
    fila.querySelector('[role="alert"]')?.remove();
    try {
      const { unidad, socio, multa } = await api.devolverPrestamo(prestamo.reservaId);
      mensajes.replaceChildren(h('div', { role: 'status' }, t.devuelta(unidad, socio)),
        ...(multa ? [h('div', { role: 'status' }, t.multa(multa.importeEur, socio, multa.dias))] : []));
      await cargar();
    } catch (e) { fila.append(h('div', { role: 'alert' }, e.mensaje ?? T.general.fallo)); }
  }

  // Devolver es un control de tipo botón (input) y no un <button>: Entregar es el único <button> de esta pantalla.
  const filaPrestamo = (r, texto) => {
    const fila = h('li', { 'data-reserva': r.reservaId }, linea(texto));
    if (esEncargado) fila.append(' ', h('input', { type: 'button', value: t.devolver, 'aria-label': t.devolverDe(r.unidad, r.socio), onclick: () => devolver(fila, r) }));
    return fila;
  };

  const linea = (texto) => h('span', { class: 'linea' }, texto);
  const seccion = (clave, titulo2, filas, vacio) => h('section', { 'data-seccion': clave }, h('h2', {}, titulo2),
    filas.length ? h('ul', {}, filas) : (vacio ? h('p', {}, vacio) : null));

  function filaEntrega(r) {
    const fila = h('li', { 'data-reserva': r.reservaId }, linea(t.entregarHoy(r.material, r.socio)));
    if (esEncargado) {
      const libres = r.unidadesLibres ?? [];
      const selector = h('select', { 'aria-label': t.unidad }, libres.map((u) => h('option', { value: u.id }, u.nombre)));
      fila.append(' ', selector, ' ', h('button', { type: 'button', disabled: !libres.length, onclick: () => entregar(fila, r, Number(selector.value)) }, t.entregar));
    }
    return fila;
  }

  function secciones(datos) {
    const sinPrestado = !datos.prestado.length && !datos.conRetraso.length;
    return [
      seccion('entregar-hoy', t.secciones.entregarHoy, datos.entregarHoy.map(filaEntrega), t.sinEntregas),
      ...(datos.vuelveHoy.length ? [seccion('vuelve-hoy', t.secciones.vuelveHoy, datos.vuelveHoy.map((r) => filaPrestamo(r, t.vuelveHoy(r.unidad, r.socio))))] : []),
      ...(datos.conRetraso.length ? [seccion('con-retraso', t.secciones.conRetraso, datos.conRetraso.map((r) => filaPrestamo(r, t.conRetraso(r.unidad, r.socio, r.dias))))] : []),
      seccion('prestado', t.secciones.prestado, datos.prestado.map((r) => filaPrestamo(r, t.prestado(r.unidad, r.socio, r.hasta))), sinPrestado ? t.sinPrestado : null),
      ...(datos.noRecogidas.length ? [seccion('no-recogidas', t.secciones.noRecogidas, datos.noRecogidas.map((r) => h('li', {}, linea(t.noRecogida(r.material, r.socio)))))] : []),
    ];
  }

  return cargar();
}
