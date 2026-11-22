import { T } from './textos.js';
import { h } from './dom.js';

// Router por hash. Cada pantalla se registra aquí con su ruta, sus roles y su cargador; la lista puede crecer.
export const PANTALLAS = {
  '#/entrar': { nombre: 'entrar', publica: true },
  '#/inicio': { nombre: 'inicio', roles: ['socio', 'encargado', 'junta'] },
  '#/mis-reservas': { nombre: 'mis-reservas', roles: ['socio'] },
  '#/reservar': { nombre: 'reservar', roles: ['socio'] },
  '#/inventario': { nombre: 'inventario', roles: ['encargado'] },
  '#/entregas': { nombre: 'entregas', roles: ['encargado', 'junta'] },
  '#/multas': { nombre: 'multas', roles: ['encargado'] },
  '#/historial': { nombre: 'historial', roles: ['encargado', 'junta'] },
  '#/socios': { nombre: 'socios', roles: ['encargado'] },
};

// Cargadores de cada pantalla (import dinámico): cada tarea añade el suyo.
const CARGADORES = {
  entrar: () => import('./pantallas/entrar.js'),
  inventario: () => import('./pantallas/inventario.js'),
  entregas: () => import('./pantallas/entregas.js'),
  multas: () => import('./pantallas/multas.js'),
  historial: () => import('./pantallas/historial.js'),
  socios: () => import('./pantallas/socios.js'),
  'mis-reservas': () => import('./pantallas/mis-reservas.js'),
  reservar: () => import('./pantallas/reservar.js'),
  inicio: () => import('./pantallas/inicio.js'),
};

// Enlaces del menú por rol (RN-016); no es el conjunto cerrado de pantallas.
const MENU = [
  { hash: '#/mis-reservas', texto: () => T.nav.misReservas, roles: ['socio'] },
  { hash: '#/reservar', texto: () => T.nav.reservar, roles: ['socio'] },
  { hash: '#/entregas', texto: () => T.nav.entregas, roles: ['encargado', 'junta'] },
  { hash: '#/multas', texto: () => T.nav.multas, roles: ['encargado'] },
  { hash: '#/historial', texto: () => T.nav.historial, roles: ['encargado', 'junta'] },
  { hash: '#/inventario', texto: () => T.nav.inventario, roles: ['encargado'] },
  { hash: '#/socios', texto: () => T.nav.socios, roles: ['encargado'] },
];

// Pantalla inicial de cada rol (RN-015). La de la junta (Historial) llega en una FASE posterior: entretanto, Inicio.
export const inicioDe = (rol) => ({ socio: '#/mis-reservas', encargado: '#/inventario' }[rol] ?? '#/inicio');

export function resolver(hash) {
  const ruta = (hash ?? '').split('?')[0];
  return PANTALLAS[ruta] ? { ruta, ...PANTALLAS[ruta] } : null;
}

export function crearApp({ raiz, api, ventana = window }) {
  let aviso = null;
  const avisos = { poner: (texto) => { aviso = texto; }, tomar: () => { const t = aviso; aviso = null; return t; } };
  let vuelta = 0;

  const ir = (hash) => { if (ventana.location.hash === hash) return render(); ventana.location.hash = hash; return undefined; };

  async function salir() {
    try { await api.cerrarSesion(); } catch { /* sin sesión: igualmente se vuelve a Entrar */ }
    ir('#/entrar');
  }

  function marco(sesion, pantalla) {
    const enlaces = MENU.filter((m) => m.roles.includes(sesion.rol))
      .map((m) => h('a', { href: m.hash, 'aria-current': m.hash === pantalla.ruta ? 'page' : false }, m.texto()));
    const contenido = h('main', { id: 'contenido' });
    raiz.replaceChildren(
      h('header', {}, h('nav', { 'aria-label': T.app.navegacion }, ...enlaces),
        h('button', { type: 'button', id: 'salir', onclick: salir }, T.nav.salir)),
      contenido,
    );
    return contenido;
  }

  async function render() {
    const pasada = ++vuelta;
    const pantalla = resolver(ventana.location.hash) ?? resolver('#/mis-reservas');
    if (pantalla.publica) {
      raiz.replaceChildren(h('main', { id: 'contenido' }));
      return montar(pantalla, raiz.firstChild, null, pasada);
    }
    let sesion;
    try { sesion = await api.sesion(); } catch (e) {
      if (pasada !== vuelta) return undefined;
      if (e.codigo === 'E_SESION_CADUCADA') avisos.poner(e.mensaje);
      return ir('#/entrar');
    }
    if (pasada !== vuelta) return undefined;
    const contenido = marco(sesion, pantalla);
    if (!pantalla.roles.includes(sesion.rol)) {
      contenido.append(h('div', { role: 'alert' }, T.general.sinPermiso), h('a', { href: inicioDe(sesion.rol) }, T.general.irAInicio));
      return undefined;
    }
    return montar(pantalla, contenido, sesion, pasada);
  }

  async function montar(pantalla, contenido, sesion, pasada) {
    const cargar = CARGADORES[pantalla.nombre];
    if (!cargar) { contenido.append(h('p', {}, T.general.noDisponible)); return undefined; }
    const modulo = await cargar();
    if (pasada !== vuelta) return undefined;
    return modulo.montar({ raiz: contenido, api, sesion, ir, avisos, inicioDe });
  }

  return {
    iniciar() {
      ventana.addEventListener('hashchange', render);
      if (!ventana.location.hash) ventana.location.hash = '#/mis-reservas';
      else render();
    },
    detener() { vuelta += 1; ventana.removeEventListener('hashchange', render); },
    render, ir, avisos,
  };
}
