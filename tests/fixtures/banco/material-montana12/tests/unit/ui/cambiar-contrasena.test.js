// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginaCambiarContrasena } from '../../../src/ui/paginas/cambiar-contrasena.js';
import { crearAvisos } from '../../../src/ui/componentes.js';
import { T } from '../../../src/ui/textos.js';

// SCR-002. Lo que ve Marta en cada criterio (AC-004-01) lo prueba el recorrido e2e con su captura (tests/e2e/fase-3-alta-primer-acceso.spec.js);
// aquí va cómo se arma la página: título, campo, «Mostrar», «Guardar» y el error bajo el campo.
beforeEach(() => document.body.replaceChildren());
const esperar = () => new Promise((r) => setTimeout(r, 0));

async function pagina(respuesta) {
  const api = { cambiarContrasena: vi.fn(async () => respuesta) };
  const navegar = vi.fn();
  const avisos = crearAvisos(T);
  avisos.poner(T.avisoProvisional);
  const main = await paginaCambiarContrasena({ api, T, navegar, avisos });
  document.body.append(main);
  return { main, api, navegar, avisos };
}
const enviar = async (main, valor) => {
  main.querySelector('input').value = valor;
  main.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await esperar();
};

describe('SCR-002 Cambiar contraseña', () => {
  it('SCR-002 muestra «Elige una contraseña nueva», el campo «Contraseña nueva» con «Mostrar» y el botón «Guardar»', async () => {
    const { main } = await pagina({ estado: 200, cuerpo: { destino: '/mis-reservas' } });
    expect(main.querySelector('h1').textContent).toBe('Elige una contraseña nueva');
    const campo = main.querySelector('input');
    expect(main.querySelector(`label[for="${campo.id}"]`).textContent).toBe('Contraseña nueva');
    expect(campo.type).toBe('password');
    expect(campo.getAttribute('autocomplete')).toBe('new-password');
    const mostrar = [...main.querySelectorAll('button')].find((b) => b.textContent === 'Mostrar');
    mostrar.click();
    expect(campo.type).toBe('text');
    expect(mostrar.getAttribute('aria-pressed')).toBe('true');
    expect([...main.querySelectorAll('button')].some((b) => b.textContent === 'Guardar' && b.type === 'submit')).toBe(true);
  });

  it('SCR-002 una contraseña corta enseña el error bajo el campo, lo marca inválido y no navega', async () => {
    const { main, navegar } = await pagina({ estado: 400, cuerpo: { error: { codigo: 'E_CONTRASENA_CORTA', mensaje: 'La contraseña debe tener al menos 8 caracteres' } } });
    await enviar(main, 'corta');
    const campo = main.querySelector('input');
    const error = main.querySelector('[role="alert"]');
    expect(error.textContent).toBe('La contraseña debe tener al menos 8 caracteres');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toContain(error.id);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('SCR-002 una contraseña guardada lleva a la página del rol y quita el aviso de contraseña provisional', async () => {
    const { main, api, navegar, avisos } = await pagina({ estado: 200, cuerpo: { destino: '/panel' } });
    await enviar(main, 'MiClave2026');
    expect(api.cambiarContrasena).toHaveBeenCalledWith('MiClave2026');
    expect(navegar).toHaveBeenCalledWith('/panel');
    expect(avisos.textos()).toEqual([]);
  });
});

describe('INV-SOC-006 el router y Entrar con contraseña provisional', () => {
  it('AC-004-02 una página que el servidor contesta con «cambiar» lleva a /cambiar-contrasena y pinta esa página', async () => {
    const { crearRouter } = await import('../../../src/ui/router.js');
    const { paginaSinPermiso } = await import('../../../src/ui/paginas/sin-permiso.js');
    document.body.replaceChildren(Object.assign(document.createElement('div'), { id: 'app' }));
    const autorizarPagina = vi.fn(async (ruta) => (ruta === '/cambiar-contrasena'
      ? { estado: 200, cuerpo: { nombre: 'Marta Ruiz', rol: 'socio', debeCambiar: true } }
      : { estado: 403, cuerpo: { cambiar: true, sesion: { nombre: 'Marta Ruiz', rol: 'socio', debeCambiar: true } } }));
    const titulo = (t) => async () => Object.assign(document.createElement('h1'), { textContent: t });
    const router = crearRouter({
      raiz: document.getElementById('app'), api: { autorizarPagina }, T, entrar: titulo('Entrar'), sinPermiso: paginaSinPermiso,
      paginas: { '/mis-reservas': titulo('Mis reservas'), '/cambiar-contrasena': titulo('Elige una contraseña nueva') },
    });
    await router.navegar('/mis-reservas');
    expect(document.querySelector('h1').textContent).toBe('Elige una contraseña nueva');
    expect(window.location.pathname).toBe('/cambiar-contrasena');
    expect([...document.querySelectorAll('nav a')].map((a) => a.textContent)).not.toContain('Mis reservas');   // sin navegación a otras páginas: solo «Salir»
    expect(document.querySelector('header button').textContent).toBe('Salir');
  });

  it('AC-004-01 entrar con la provisional deja en los avisos «Elige una contraseña nueva para seguir usando la web» y navega a Cambiar contraseña', async () => {
    const { paginaEntrar } = await import('../../../src/ui/paginas/entrar.js');
    const api = { entrar: vi.fn(async () => ({ estado: 200, cuerpo: { destino: '/cambiar-contrasena' } })) };
    const navegar = vi.fn();
    const avisos = crearAvisos(T);
    const main = await paginaEntrar({ api, T, navegar, avisos });
    document.body.append(main);
    main.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await esperar();
    expect(avisos.textos()).toEqual(['Elige una contraseña nueva para seguir usando la web']);
    expect(navegar).toHaveBeenCalledWith('/cambiar-contrasena');
  });
});
