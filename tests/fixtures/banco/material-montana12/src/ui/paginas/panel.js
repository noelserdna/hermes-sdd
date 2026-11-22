// SCR-006 · versión mínima de FASE-0 (solo el título); el panel con listas y acciones es paginaPanelConLista, más abajo.
// UC-017, UC-010, UC-011: el panel del encargado. Entregar y devolver llaman al servidor; el texto de cada resultado
// (éxito y aviso de repetición) es el suyo y va a los avisos de la sesión; un error, junto a la lista.
import { el, zonaMensajes } from '../componentes.js';
import { aIso, campoFecha } from '../campo-fecha.js';

export async function paginaPanel({ T }) {
  return el('main', {}, el('h1', {}, T.panelEncargado));
}

/** SCR-006 · el panel completo: fecha, grupos y «Entregar»/«Devolver» por fila. */
export async function paginaPanelConLista({ api, T, avisos }) {
  const mensajes = zonaMensajes();
  const contenido = el('div', { class: 'panel' });
  let fechaActual;   // la última fecha válida: tras entregar o devolver se recarga la misma lista

  const boton = (texto, alPulsar) => el('button', { type: 'button', onclick: alPulsar }, texto);
  const filas = (lista, texto, accion, estado) => el('ul', { class: 'panel' }, lista.map((f) => el('li', {},
    el('span', { class: 'texto' }, texto(f)),
    el('span', { class: 'detalle' }, T.filaReserva({ ...f, estado })),
    f.retraso > 0 ? el('span', { class: 'retraso' }, T.retraso(f.retraso)) : '',
    boton(accion.texto, () => ejecutar(accion.operacion, f)))));
  const filasSinAccion = (lista, texto) => el('ul', { class: 'panel' }, lista.map((f) => el('li', {},
    el('span', { class: 'texto' }, texto(f)), el('span', { class: 'detalle' }, T.filaReserva({ ...f, estado: 'No recogida' })))));
  const grupo = (titulo, lista, ...resto) => (lista.length ? [el('h2', {}, titulo), filas(lista, ...resto)] : []);

  function pintar(p) {
    contenido.replaceChildren(
      ...grupo(T.porEntregar, p.porEntregar, T.filaPorEntregar, { texto: T.entregar, operacion: 'entregar' }, 'Reservada'),
      ...(p.noRecogidas?.length ? [el('h2', {}, T.noRecogida), filasSinAccion(p.noRecogidas, T.filaNoRecogida)] : []),
      ...(p.mensaje ? [el('p', { class: 'vacio' }, p.mensaje)] : [
        ...grupo(p.fecha === p.hoy ? T.vuelvenHoy : T.vuelvenEl(p.fecha), p.vuelven, T.filaPrestado, { texto: T.devolver, operacion: 'devolver' }, 'Prestada'),
        ...grupo(T.prestado, p.prestados, T.filaPrestado, { texto: T.devolver, operacion: 'devolver' }, 'Prestada')]),
      el('h2', {}, T.multas),
      p.multas.length
        ? el('ul', { class: 'multas' }, p.multas.map((m) => el('li', {}, T.filaMulta(m))))
        : el('div', { class: 'multas' }, el('p', { class: 'vacio' }, T.sinMultas)));
  }

  /** Pide el panel de `fecha` (hoy si no se da). Una fecha no válida deja la lista como estaba con el mensaje del servidor. */
  async function cargar(fecha) {
    const r = await api.panel(fecha);
    if (r.estado !== 200) return mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
    fechaActual = fecha;
    pintar(r.cuerpo);
  }

  async function ejecutar(operacion, fila) {
    const r = await api[operacion](fila.id);
    if (r.estado === 200) {
      mensajes.limpiar();
      avisos.poner(r.cuerpo.aviso?.mensaje ?? r.cuerpo.mensaje);
    } else {
      mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
    }
    await cargar(fechaActual);
  }

  const campo = campoFecha({ id: 'fecha', name: 'fecha' });
  const formulario = el('form', {
    class: 'fecha', novalidate: true,
    onsubmit: async (e) => { e.preventDefault(); mensajes.limpiar(); await cargar(aIso(campo.value)); },
  }, el('label', { for: 'fecha' }, T.fechaCampo), campo, el('button', { type: 'submit', class: 'principal' }, T.ver));

  await cargar();
  return el('main', {}, el('h1', {}, T.panelEncargado), mensajes.zona, formulario, contenido);
}
