// Ayuda mínima para construir DOM sin innerHTML (los datos nunca se interpretan como HTML).
export function h(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos ?? {})) {
    if (valor === false || valor === null || valor === undefined) continue;
    if (nombre.startsWith('on') && typeof valor === 'function') nodo.addEventListener(nombre.slice(2), valor);
    else if (valor === true) nodo.setAttribute(nombre, '');
    else nodo.setAttribute(nombre, String(valor));
  }
  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(typeof hijo === 'object' && hijo.nodeType ? hijo : document.createTextNode(String(hijo)));
  }
  return nodo;
}
