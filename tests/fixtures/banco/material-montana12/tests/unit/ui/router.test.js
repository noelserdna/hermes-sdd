// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { crearRouter } from '../../../src/ui/router.js';
import { paginaSinPermiso } from '../../../src/ui/paginas/sin-permiso.js';
import { T } from '../../../src/ui/textos.js';

const pagina = (titulo) => async () => { const h = document.createElement('h1'); h.textContent = titulo; return h; };

function montar({ autorizar, paginas } = {}) {
  document.body.replaceChildren(Object.assign(document.createElement('div'), { id: 'app' }));
  const raiz = document.getElementById('app');
  const api = { autorizarPagina: vi.fn(autorizar) };
  const router = crearRouter({
    raiz, api, T,
    paginas: { '/mis-reservas': pagina('Mis reservas'), '/material': pagina('Material'), ...paginas },
    entrar: pagina('Entrar'),
    sinPermiso: paginaSinPermiso,
    destinoDe: () => '/mis-reservas',
  });
  return { raiz, api, router };
}

beforeEach(() => { window.history.replaceState({}, '', '/'); });

describe('API-001-08 guardia del router', () => {
  it('sin sesión, una página privada muestra el formulario Entrar y no su contenido', async () => {
    const { raiz, router } = montar({ autorizar: async () => ({ estado: 401, cuerpo: { entrar: true } }) });
    await router.navegar('/mis-reservas');
    expect(raiz.querySelector('h1').textContent).toBe('Entrar');
    expect(raiz.textContent).not.toContain('Mis reservas');
  });

  it('con sesión autorizada pinta la página pedida y deja la URL en ella', async () => {
    const { raiz, router } = montar({ autorizar: async () => ({ estado: 200, cuerpo: { nombre: 'Lucía', rol: 'socio' } }) });
    await router.navegar('/mis-reservas');
    expect(raiz.querySelector('h1').textContent).toBe('Mis reservas');
    expect(window.location.pathname).toBe('/mis-reservas');
  });

  // AC-001-08: "GIVEN socio with a session WHEN he opens a page of the encargado THEN E_PAGINA_PROHIBIDA sin datos de otros socios"
  it('AC-001-08 un socio en /material ve la página «Sin permiso» con el mensaje de E_PAGINA_PROHIBIDA y nada de /material', async () => {
    const { raiz, router } = montar({
      autorizar: async () => ({ estado: 403, cuerpo: { error: { codigo: 'E_PAGINA_PROHIBIDA', mensaje: 'No tienes permiso para ver esta página' }, sesion: { nombre: 'Lucía', rol: 'socio' } } }),
    });
    await router.navegar('/material');
    expect(raiz.querySelector('h1').textContent).toBe('Sin permiso');
    expect(raiz.textContent).toContain('No tienes permiso para ver esta página');
    expect(raiz.textContent).not.toContain('Material:');
    expect(raiz.querySelector('main a').textContent).toBe('Volver a mi página');
  });

  it('el botón atrás vuelve a pedir la autorización: tras salir no se pintan datos privados', async () => {
    let sesion = true;
    const { raiz, router } = montar({
      autorizar: async () => (sesion ? { estado: 200, cuerpo: { nombre: 'Lucía', rol: 'socio' } } : { estado: 401, cuerpo: { entrar: true } }),
    });
    router.iniciar();
    await router.navegar('/mis-reservas');
    await router.navegar('/entrar');
    sesion = false;
    window.history.back();
    await new Promise((r) => setTimeout(r, 20));
    expect(window.location.pathname).toBe('/mis-reservas');
    expect(raiz.querySelector('h1').textContent).toBe('Entrar');
  });

  it('una ruta desconocida lleva a la página de inicio y /entrar no pide sesión', async () => {
    const { raiz, router, api } = montar({ autorizar: async () => ({ estado: 200, cuerpo: { nombre: 'Lucía', rol: 'socio' } }) });
    await router.navegar('/nada');
    expect(window.location.pathname).toBe('/mis-reservas');
    api.autorizarPagina.mockClear();
    await router.navegar('/entrar');
    expect(api.autorizarPagina).not.toHaveBeenCalled();
    expect(raiz.querySelector('h1').textContent).toBe('Entrar');
  });

  it('si el servidor falla muestra su mensaje en una alerta, no una página en blanco', async () => {
    const { raiz, router } = montar({ autorizar: async () => ({ estado: 503, cuerpo: { error: { codigo: 'E_ALMACEN_NO_DISPONIBLE', mensaje: 'No se pudo guardar. Inténtalo de nuevo' } } }) });
    await router.navegar('/mis-reservas');
    expect(raiz.querySelector('[role="alert"]').textContent).toBe('No se pudo guardar. Inténtalo de nuevo');
  });
});
