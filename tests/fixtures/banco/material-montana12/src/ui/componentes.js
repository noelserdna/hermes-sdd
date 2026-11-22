// Piezas compartidas por las páginas: crear elementos sin innerHTML, cabecera con navegación según rol y zona de mensajes.
export const INICIO = { socio: '/mis-reservas', encargado: '/panel', junta: '/historial' };

const NAVEGACION = {
  socio: [['/mis-reservas', 'navMisReservas'], ['/reservar', 'navReservar'], ['/mis-multas', 'navMisMultas']],
  encargado: [['/panel', 'navPanel'], ['/socios', 'navSocios'], ['/material', 'navMaterial'], ['/multas', 'navMultas']],
  junta: [],
};

export function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos)) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) nodo.addEventListener(k.slice(2), v);
    else nodo.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) nodo.append(h);
  return nodo;
}

/**
 * Avisos de la sesión (éxitos y repeticiones): se quedan en pantalla, en cualquier página privada, hasta cerrarlos o salir.
 * Los errores no van aquí: salen junto al formulario que los provocó.
 */
export function crearAvisos(T) {
  const textos = [];
  const region = el('section', { class: 'avisos', 'aria-label': T.avisos });
  region.hidden = true;
  const pintar = () => {
    region.hidden = textos.length === 0;
    region.replaceChildren(...textos.map((t) => el('p', { role: 'status', class: 'aviso' }, t)),
      textos.length ? el('button', { type: 'button', class: 'secundario', onclick: () => avisos.vaciar() }, T.cerrarAvisos) : '');
  };
  const avisos = {
    region,
    poner(texto) { textos.push(texto); pintar(); },
    quitar(texto) { const i = textos.indexOf(texto); if (i >= 0) textos.splice(i, 1); pintar(); },
    vaciar() { textos.length = 0; pintar(); },
    textos: () => [...textos],
  };
  return avisos;
}

/** Zona de mensajes: `role=alert` para errores y `role=status` para avisos. */
export function zonaMensajes() {
  const zona = el('div', { class: 'mensajes' });
  return {
    zona,
    error(texto) { zona.replaceChildren(el('p', { role: 'alert', class: 'error', tabindex: '-1' }, texto)); zona.firstChild.focus(); },
    aviso(texto) { zona.replaceChildren(el('p', { role: 'status', class: 'aviso' }, texto)); },
    limpiar() { zona.replaceChildren(); },
  };
}

export function enlace(href, texto, navegar, atributos = {}) {
  return el('a', {
    href,
    ...atributos,
    onclick: (e) => { e.preventDefault(); navegar(href); },
  }, texto);
}

/** Cabecera de las páginas privadas: marca, «Hola, {nombre}», navegación del rol y «Salir». */
export function cabecera({ sesion, T, navegar, salir }) {
  const nav = el('nav', { 'aria-label': T.navegacion },
    // con contraseña provisional (INV-SOC-006) no hay a dónde ir: solo «Salir»
    (sesion.debeCambiar ? [] : NAVEGACION[sesion.rol] ?? []).map(([href, clave]) => enlace(href, T[clave], navegar)));
  return el('header', { class: 'cabecera' },
    el('strong', {}, T.marca),
    el('span', { class: 'saludo' }, T.hola(sesion.nombre)),
    nav,
    el('button', { type: 'button', onclick: salir }, T.salir));
}

/**
 * Lista de reservas propias: «{cantidad} × {material} del {inicio} al {fin} — {estado}». Con `alCancelar` cada fila lleva
 * «Cancelar» si se puede, o el motivo en la propia fila si no (SCR-003); sin él, es de solo lectura (SCR-004).
 */
export function listaReservas({ filas, T, alCancelar }) {
  if (!filas.length) return el('p', { class: 'vacio' }, T.sinReservas);
  return el('ul', { 'aria-label': T.misReservas, class: 'reservas' }, filas.map((f) => {
    const accion = !alCancelar ? ''
      : f.cancelable ? el('button', { type: 'button', class: 'peligro', 'aria-describedby': `reserva-${f.id}`, onclick: () => alCancelar(f) }, T.cancelar)
        : f.motivo ? el('span', { class: 'motivo' }, f.motivo) : '';
    return el('li', { class: `reserva estado-${f.estado.toLowerCase().replace(/\s+/g, '-')}` },
      el('span', { id: `reserva-${f.id}`, class: 'texto' }, T.filaReserva(f)), accion);
  }));
}
