// Router por History API. Cada página privada se autoriza en el servidor (API-001-08) antes de pintarse:
// la guardia no decide por rol, solo muestra lo que `authorize` responde (401 → Entrar, 403 → Sin permiso).
import { cabecera, crearAvisos, el, INICIO } from './componentes.js';

export function crearRouter({ raiz, api, T, paginas, entrar, sinPermiso, destinoDe = (sesion) => INICIO[sesion?.rol] ?? '/mis-reservas' }) {
  const privadas = new Set(Object.keys(paginas));
  let pintando = 0;
  const avisos = crearAvisos(T);
  let dueno = null;   // quién hizo los avisos que hay: nunca pasan a otra sesión
  const vaciarAvisos = () => { avisos.vaciar(); dueno = null; };
  const adoptar = (sesion) => {
    const clave = `${sesion?.rol}|${sesion?.nombre}`;
    if (dueno !== null && dueno !== clave) avisos.vaciar();
    dueno = clave;
  };

  const router = { navegar, iniciar };

  async function navegar(ruta, { reemplazar = false } = {}) {
    const destino = ruta === '/' ? '/mis-reservas' : ruta;
    const conocida = destino === '/entrar' || privadas.has(destino);
    const url = conocida ? destino : '/mis-reservas';
    if (window.location.pathname !== url) window.history[reemplazar || !conocida ? 'replaceState' : 'pushState']({}, '', url);
    await mostrar(url);
  }

  async function mostrar(ruta) {
    const turno = ++pintando;
    const salir = async () => { await api.salir(); vaciarAvisos(); await navegar('/entrar'); };
    const ctx = { api, T, navegar, salir, router, avisos: { ...avisos, vaciar: vaciarAvisos } };

    // Entrar no enseña avisos de nadie: son de la sesión de quien hizo la acción y esa ya no está (o va a empezar otra)
    if (ruta === '/entrar') { vaciarAvisos(); return pintar(turno, [await entrar(ctx)]); }

    const r = await api.autorizarPagina(ruta);
    if (r.estado === 401) { vaciarAvisos(); return pintar(turno, [await entrar(ctx)]); }
    // INV-SOC-006: con contraseña provisional toda otra página lleva a Cambiar contraseña
    if (r.estado === 403 && r.cuerpo?.cambiar && ruta !== '/cambiar-contrasena') {
      window.history.replaceState({}, '', '/cambiar-contrasena');
      return mostrar('/cambiar-contrasena');
    }
    if (r.estado === 403) {
      const sesion = r.cuerpo.sesion;
      adoptar(sesion);
      const cuerpo = await sinPermiso({ ...ctx, sesion, mensaje: r.cuerpo.error.mensaje, inicio: destinoDe(sesion) });
      return pintar(turno, [cabecera({ sesion, T, navegar, salir }), avisos.region, cuerpo]);
    }
    if (r.estado !== 200) {
      return pintar(turno, [el('p', { role: 'alert', class: 'error' }, r.cuerpo?.error?.mensaje ?? T.errorRed)]);
    }
    const sesion = r.cuerpo;
    adoptar(sesion);
    const cuerpo = await paginas[ruta]({ ...ctx, sesion });
    return pintar(turno, [cabecera({ sesion, T, navegar, salir }), avisos.region, cuerpo]);
  }

  function pintar(turno, nodos) {
    if (turno !== pintando) return;   // una navegación más reciente ya ha pintado
    raiz.replaceChildren(...nodos.map((n) => (['HEADER', 'MAIN'].includes(n.tagName) || n === avisos.region ? n : el('main', {}, n))));
  }

  function iniciar() {
    window.addEventListener('popstate', () => mostrar(window.location.pathname === '/' ? '/mis-reservas' : window.location.pathname));
  }

  return router;
}
