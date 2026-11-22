// SCR-007 · UC-003, UC-005, UC-006: alta de socios, «Restablecer» y «Dar de baja» por fila. Los éxitos y las repeticiones van a los avisos
// de la sesión; los errores, junto al campo o a la lista que los provocó.
import { el, zonaMensajes } from '../componentes.js';

// Qué campo del alta señala cada error del servidor
const CAMPO_DEL_ERROR = { E_SOCIO_DUPLICADO: 'correo', E_CONTRASENA_CORTA: 'contrasena', E_SOCIO_DATOS_INVALIDOS: 'correo' };

/** Un campo con su etiqueta y, bajo él, el hueco de su error. Devuelve los nodos y cómo mostrar u ocultar el error. */
function campoConError({ id, etiqueta, atributos = {}, ayuda }) {
  const entrada = el('input', { id, type: 'text', autocomplete: 'off', ...atributos });
  const error = el('p', { id: `error-${id}`, class: 'error', role: 'alert' });
  error.hidden = true;
  const describe = (ids) => entrada.setAttribute('aria-describedby', ids.join(' '));
  if (ayuda) describe([`ayuda-${id}`]);
  return {
    entrada,
    nodos: [el('label', { for: id }, etiqueta), ayuda ? el('span', { id: `ayuda-${id}`, class: 'ayuda' }, ayuda) : '', entrada, error],
    mostrar(texto) {
      error.textContent = texto; error.hidden = false;
      entrada.setAttribute('aria-invalid', 'true');
      describe([...(ayuda ? [`ayuda-${id}`] : []), error.id]);
    },
    limpiar() {
      error.hidden = true; error.textContent = '';
      entrada.removeAttribute('aria-invalid');
      describe(ayuda ? [`ayuda-${id}`] : []);
      if (!ayuda) entrada.removeAttribute('aria-describedby');
    },
  };
}

export async function paginaSocios({ api, T, avisos }) {
  const mensajes = zonaMensajes();
  const lista = el('ul', { 'aria-label': T.listaSocios, class: 'socios' });
  let socios = [];
  let abierto = null;   // { id, modo: 'restablecer' | 'baja' } de la fila con su campo o su confirmación abiertos

  async function cargar() {
    const r = await api.listarSocios();
    if (r.estado !== 200) return mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
    socios = r.cuerpo.socios;
    pintar();
  }

  async function restablecer(socio, campo) {
    campo.limpiar();
    const r = await api.restablecerSocio(socio.id, campo.entrada.value);
    if (r.estado === 200) { abierto = null; mensajes.limpiar(); avisos.poner(r.cuerpo.mensaje); return pintar(); }
    campo.mostrar(r.cuerpo?.error?.mensaje ?? T.errorRed);
  }

  async function darDeBaja(socio) {
    abierto = null;
    const r = await api.bajaSocio(socio.id);
    if (r.estado === 200) { mensajes.limpiar(); avisos.poner(r.cuerpo.aviso?.mensaje ?? r.cuerpo.mensaje); } else mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
    await cargar();
  }

  function fila(socio) {
    const id = `socio-${socio.id}`;
    const activo = socio.estado === 'Activo';
    const acciones = [];
    if (activo) {
      acciones.push(
        el('button', { type: 'button', 'aria-describedby': id, onclick: () => { abierto = { id: socio.id, modo: 'restablecer' }; pintar(); } }, T.restablecer),
        el('button', { type: 'button', class: 'peligro', 'aria-describedby': id, onclick: () => { abierto = { id: socio.id, modo: 'baja' }; pintar(); } }, T.darDeBaja));
    }
    let extra = '';
    if (activo && abierto?.id === socio.id && abierto.modo === 'restablecer') {
      const campo = campoConError({ id: `provisional-${socio.id}`, etiqueta: T.contrasenaProvisional });
      extra = el('form', { class: 'en-fila', novalidate: true, onsubmit: (e) => { e.preventDefault(); restablecer(socio, campo); } },
        ...campo.nodos, el('button', { type: 'submit' }, T.guardar),
        el('button', { type: 'button', class: 'secundario', onclick: () => { abierto = null; pintar(); } }, T.no));
      setTimeout(() => campo.entrada.focus(), 0);
    } else if (activo && abierto?.id === socio.id && abierto.modo === 'baja') {
      extra = el('p', { class: 'confirmar', role: 'group' }, T.confirmarBajaSocio(socio.nombre),
        el('button', { type: 'button', class: 'peligro', onclick: () => darDeBaja(socio) }, T.confirmar),
        el('button', { type: 'button', onclick: () => { abierto = null; pintar(); } }, T.no));
    }
    return el('li', { class: [`socio`, `estado-${socio.estado.toLowerCase()}`].join(String.fromCharCode(32)) }, el('span', { id, class: 'texto' }, T.filaSocio(socio)), acciones, extra);
  }
  const pintar = () => lista.replaceChildren(...socios.map(fila));

  const nombre = campoConError({ id: 'alta-nombre', etiqueta: T.nombre });
  const correo = campoConError({ id: 'alta-correo', etiqueta: T.correo, atributos: { type: 'email', inputmode: 'email' } });
  const contrasena = campoConError({ id: 'alta-contrasena', etiqueta: T.contrasenaProvisional, ayuda: T.ayudaProvisional });
  const campos = { nombre, correo, contrasena };
  const formulario = el('form', {
    class: 'alta', novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      for (const c of Object.values(campos)) c.limpiar();
      const r = await api.altaSocio({ nombre: nombre.entrada.value, correo: correo.entrada.value, contrasena: contrasena.entrada.value });
      if (r.estado === 200) {
        mensajes.limpiar();
        avisos.poner(r.cuerpo.mensaje);
        for (const c of Object.values(campos)) c.entrada.value = '';
        return cargar();
      }
      const codigo = r.cuerpo?.error?.codigo;
      const destino = codigo === 'E_SOCIO_DATOS_INVALIDOS' && !nombre.entrada.value.trim() ? nombre : campos[CAMPO_DEL_ERROR[codigo]];
      if (destino) { destino.mostrar(r.cuerpo.error.mensaje); destino.entrada.focus(); } else mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
    },
  },
  el('h2', {}, T.altaTitulo), ...nombre.nodos, ...correo.nodos, ...contrasena.nodos, el('button', { type: 'submit' }, T.darDeAlta));

  await cargar();
  return el('main', {}, el('h1', {}, T.socios), mensajes.zona, formulario, el('h2', {}, T.listaSocios), lista);
}
