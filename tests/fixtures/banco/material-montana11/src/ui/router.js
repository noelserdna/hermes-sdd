/**
 * Router por hash. `rutas` asocia '#/ruta' con una función que pinta en `raiz`; una ruta desconocida lleva a `inicial`.
 */
export function crearRouter({ raiz, rutas, ventana = window, inicial = '#/entrar' }) {
  let ultimoPintado;   // evita pintar dos veces: navegar() ya pinta y luego llega el hashchange que provocó

  async function pintar() {
    const hash = ventana.location.hash;
    ultimoPintado = hash;
    const pantalla = rutas[hash];
    if (!pantalla) {
      if (hash !== inicial && rutas[inicial]) { ventana.location.hash = inicial; return pintar(); }
      return undefined;
    }
    raiz.replaceChildren();
    return pantalla({ raiz, navegar });
  }

  async function navegar(hash) {
    if (ventana.location.hash !== hash) ventana.location.hash = hash;
    return pintar();
  }

  let escuchando = false;
  async function iniciar() {
    if (!escuchando) {
      escuchando = true;
      ventana.addEventListener('hashchange', () => { if (ventana.location.hash !== ultimoPintado) pintar(); });
    }
    return pintar();
  }

  return { iniciar, navegar, actual: () => ventana.location.hash };
}
