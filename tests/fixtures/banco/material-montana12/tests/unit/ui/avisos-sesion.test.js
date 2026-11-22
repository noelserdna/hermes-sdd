// @vitest-environment jsdom
// Los avisos son de quien hizo la acción: se borran al salir y no pasan a otra sesión (petición de la persona tras rechazar FASE-3).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { crearRouter } from '../../../src/ui/router.js';
import { paginaEntrar } from '../../../src/ui/paginas/entrar.js';
import { paginaSinPermiso } from '../../../src/ui/paginas/sin-permiso.js';
import { T } from '../../../src/ui/textos.js';

const BAJA = 'Socio dado de baja: Marta Ruiz';
const PABLO = { nombre: 'Pablo', rol: 'encargado' };
const LUCIA = { nombre: 'Lucía Gil', rol: 'socio' };
const esperar = () => new Promise((r) => setTimeout(r, 20));

/** La web con dos personas: `sesion.actual` es quien tiene la sesión abierta en el servidor (null = nadie). */
function montar() {
  document.body.replaceChildren(Object.assign(document.createElement('div'), { id: 'app' }));
  window.history.replaceState({}, '', '/');
  const estado = { actual: PABLO };
  const api = {
    autorizarPagina: vi.fn(async () => (estado.actual ? { estado: 200, cuerpo: estado.actual } : { estado: 401, cuerpo: { entrar: true } })),
    salir: vi.fn(async () => { estado.actual = null; return { estado: 200, cuerpo: {} }; }),
    entrar: vi.fn(async (correo) => { estado.actual = correo.startsWith('lucia') ? LUCIA : PABLO; return { estado: 200, cuerpo: { destino: '/mis-reservas' } }; }),
  };
  const raiz = document.getElementById('app');
  const router = crearRouter({
    raiz, api, T, sinPermiso: paginaSinPermiso, destinoDe: () => '/mis-reservas',
    paginas: {
      // Socios: el encargado da de baja a Marta y la web avisa
      '/socios': async ({ avisos }) => { avisos.poner(BAJA); return Object.assign(document.createElement('h1'), { textContent: 'Socios' }); },
      '/mis-reservas': async () => Object.assign(document.createElement('h1'), { textContent: 'Mis reservas' }),
    },
    entrar: (ctx) => paginaEntrar(ctx),
  });
  const avisosVisibles = () => [...raiz.querySelectorAll('[role="status"]')].map((p) => p.textContent);
  const entrarComo = async (correo) => {
    raiz.querySelector('#correo').value = correo;
    raiz.querySelector('#contrasena').value = 'Cumbre2026!';
    raiz.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await esperar();
  };
  return { raiz, router, estado, avisosVisibles, entrarComo };
}

beforeEach(() => document.body.replaceChildren());

describe('Avisos de sesión: un socio no ve nada de otro', () => {
  it('el encargado da de baja a Marta, sale, entra Lucía y no ve «Socio dado de baja: Marta Ruiz» ni en Entrar ni en Mis reservas', async () => {
    const { raiz, router, avisosVisibles, entrarComo } = montar();
    await router.navegar('/socios');
    expect(avisosVisibles()).toEqual([BAJA]);   // Pablo sí lo ve, en su pantalla

    [...raiz.querySelectorAll('header button')].find((b) => b.textContent === 'Salir').click();
    await esperar();
    expect(raiz.querySelector('h1').textContent).toBe('Entrar');
    expect(avisosVisibles()).toEqual([]);
    expect(raiz.textContent).not.toContain(BAJA);

    await entrarComo('lucia@club.test');
    expect(raiz.querySelector('h1').textContent).toBe('Mis reservas');
    expect(avisosVisibles()).toEqual([]);
    expect(raiz.textContent).not.toContain(BAJA);
  });

  it('si la sesión cambia sin pulsar «Salir» (caducó, otra pestaña), el aviso del encargado tampoco pasa a Lucía', async () => {
    const { raiz, router, estado, avisosVisibles, entrarComo } = montar();
    await router.navegar('/socios');
    expect(avisosVisibles()).toEqual([BAJA]);

    await router.navegar('/entrar');   // sin «Salir»: Entrar no enseña avisos de nadie
    expect(avisosVisibles()).toEqual([]);
    estado.actual = null;
    await entrarComo('lucia@club.test');
    expect(raiz.querySelector('h1').textContent).toBe('Mis reservas');
    expect(avisosVisibles()).toEqual([]);
  });

  it('si el servidor ya tiene a otra persona en la sesión, sus páginas no enseñan los avisos de la anterior', async () => {
    const { raiz, router, estado, avisosVisibles } = montar();
    await router.navegar('/socios');
    expect(avisosVisibles()).toEqual([BAJA]);
    estado.actual = LUCIA;
    await router.navegar('/mis-reservas');
    expect(raiz.querySelector('h1').textContent).toBe('Mis reservas');
    expect(avisosVisibles()).toEqual([]);
  });

  it('los avisos de quien sigue en la sesión se quedan al cambiar de página', async () => {
    const { router, avisosVisibles } = montar();
    await router.navegar('/socios');
    await router.navegar('/mis-reservas');
    expect(avisosVisibles()).toEqual([BAJA]);
  });
});
