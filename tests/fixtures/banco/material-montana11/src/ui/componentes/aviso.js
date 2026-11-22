// Errores con role="alert", éxitos con role="status". Siempre textContent: nunca HTML con datos.
export function crearAviso(tipo, texto) {
  const el = document.createElement('p');
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  el.className = `aviso aviso-${tipo === 'error' ? 'error' : 'exito'}`;
  el.textContent = texto;
  return el;
}

/** Sustituye el aviso anterior de un contenedor por uno nuevo (o lo quita si no hay texto). */
export function mostrarAviso(contenedor, tipo, texto) {
  contenedor.replaceChildren(...(texto ? [crearAviso(tipo, texto)] : []));
}
