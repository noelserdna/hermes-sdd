import { h } from '../dom.js';
import { T } from '../textos.js';

// SCR-002 Mis reservas (UC-004): saludo, aviso de reserva creada, lista propia con Cancelar en las Reservadas y multas Pendientes.
// El servidor decide qué se ofrece (`cancelable`) y qué día vale (INV-RES-006): un rechazo se muestra con su mensaje.
export async function montar({ raiz, api, sesion, avisos }) {
  const titulo = h('h1', { tabindex: '-1' }, T.misReservas.titulo);
  const saludo = h('p', { id: 'saludo' }, T.misReservas.saludo(sesion.nombre));
  const aviso = avisos.tomar();
  const mensajes = h('div', { id: 'mensajes' });
  const cuerpo = h('div', { id: 'lista-reservas' });
  raiz.replaceChildren(titulo, saludo, ...(aviso ? [h('div', { role: 'status' }, aviso)] : []), mensajes, cuerpo);
  titulo.focus();

  async function cargar() {
    try {
      const { reservas, multas } = await api.listarMisReservas();
      const pendientes = (multas ?? []).filter((m) => m.estado === 'Pendiente');
      cuerpo.replaceChildren(
        ...(pendientes.length ? [h('section', { 'aria-label': T.misReservas.multas }, pendientes.map((m) => h('p', { 'data-multa': m.id }, T.misReservas.multaPendiente(m.importeEur))))] : []),
        reservas.length ? tabla(reservas) : h('p', {}, T.misReservas.sinReservas),
      );
    } catch (e) {
      cuerpo.replaceChildren(h('div', { role: 'alert' }, e.mensaje ?? T.general.fallo));
    }
  }

  async function cancelar(reserva) {
    try {
      await api.cancelarReserva(reserva.id);
      mensajes.replaceChildren();
    } catch (e) {
      mensajes.replaceChildren(h('div', { role: 'alert' }, e.mensaje ?? T.general.fallo));
    }
    await cargar();
  }

  // La fila se lee como una línea («Piolet · 2026-12-05 a 2026-12-07 · Reservada»); las celdas por columna siguen ahí para
  // lectores de pantalla y tablas (clase `solo-lectores`: fuera de la vista, no del árbol de accesibilidad).
  function tabla(reservas) {
    const c = T.misReservas.columnas;
    return h('table', { 'aria-label': T.misReservas.lista },
      h('thead', { class: 'solo-lectores' }, h('tr', {}, [c.material, c.desde, c.hasta, c.estado].map((texto) => h('th', { scope: 'col' }, texto)))),
      h('tbody', {}, reservas.map((r) => {
        const resumen = T.misReservas.fila(r.tipo, r.desde, r.hasta, r.estado);
        return h('tr', { 'data-reserva': r.id },
          h('th', { scope: 'row', 'aria-hidden': 'true' }, resumen),
          [r.tipo, r.desde, r.hasta, r.estado].map((texto) => h('td', { class: 'solo-lectores' }, texto)),
          r.cancelable ? h('td', {}, h('button', { type: 'button', 'aria-label': T.misReservas.cancelarDe(resumen), onclick: () => cancelar(r) }, T.misReservas.cancelar)) : null);
      })));
  }

  return cargar();
}
