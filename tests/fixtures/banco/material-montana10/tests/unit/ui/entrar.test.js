// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { crearApp } from '../../../src/ui/router.js';
import { ErrorApi } from '../../../src/ui/api.js';

let raiz;
let api;
let app;
const texto = () => raiz.textContent;
const llena = (etiqueta, valor) => { raiz.querySelector(`input[name="${etiqueta}"]`).value = valor; };
const enviar = () => raiz.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
const esperar = (condicion) => vi.waitFor(condicion, { timeout: 1000 });

beforeEach(() => {
  raiz = document.createElement('div');
  document.body.replaceChildren(raiz);
  window.location.hash = '';
  api = {
    sesion: vi.fn().mockRejectedValue(new ErrorApi('E_NO_AUTENTICADO', 'Entrar', 401)),
    iniciarSesion: vi.fn(),
    cerrarSesion: vi.fn().mockResolvedValue(null),
    listarMisReservas: vi.fn().mockResolvedValue({ reservas: [], multas: [] }),
    listarInventario: vi.fn().mockResolvedValue([]),
  };
  app = crearApp({ raiz, api, ventana: window });
  app.iniciar();
});

afterEach(() => app.detener());

describe('guarda de rutas y pantalla Entrar (SCR-001)', () => {
  it('abrir #/mis-reservas sin sesión lleva a #/entrar, también al volver atrás tras Salir', async () => {
    window.location.hash = '#/mis-reservas';
    await esperar(() => expect(window.location.hash).toBe('#/entrar'));
    await esperar(() => expect(raiz.querySelector('form')).not.toBeNull());
    expect(raiz.querySelector('h1').textContent).toBe('Entrar');

    // Con sesión se entra; Salir la cierra y el servidor deja de reconocerla.
    api.sesion.mockResolvedValue({ nombre: 'Lucía', rol: 'socio' });
    window.location.hash = '#/mis-reservas';
    await esperar(() => expect(raiz.querySelector('#salir')).not.toBeNull());
    api.sesion.mockRejectedValue(new ErrorApi('E_NO_AUTENTICADO', 'Entrar', 401));
    raiz.querySelector('#salir').click();
    await esperar(() => expect(window.location.hash).toBe('#/entrar'));
    expect(api.cerrarSesion).toHaveBeenCalledTimes(1);
    window.location.hash = '#/mis-reservas';
    await esperar(() => expect(window.location.hash).toBe('#/entrar'));
    await esperar(() => expect(raiz.querySelector('form')).not.toBeNull());
  });

  it('el formulario muestra el mensaje de la API y se queda en Entrar', async () => {
    window.location.hash = '#/entrar';
    await esperar(() => expect(raiz.querySelector('form')).not.toBeNull());
    api.iniciarSesion.mockRejectedValue(new ErrorApi('E_CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos', 401));
    llena('correo', 'lucia@club.es');
    llena('contrasena', 'mala');
    enviar();
    await esperar(() => expect(raiz.querySelector('[role="alert"]').textContent).toBe('Correo o contraseña incorrectos'));
    expect(window.location.hash).toBe('#/entrar');
    expect(api.iniciarSesion).toHaveBeenCalledWith('lucia@club.es', 'mala');
    expect(raiz.querySelector('button').getAttribute('aria-busy')).toBeNull();
  });

  it('al entrar bien lleva a #/mis-reservas (socio), #/inventario (encargado) o #/inicio (junta)', async () => {
    for (const [rol, destino] of [['socio', '#/mis-reservas'], ['encargado', '#/inventario'], ['junta', '#/inicio']]) {
      window.location.hash = '#/entrar';
      api.sesion.mockRejectedValue(new ErrorApi('E_NO_AUTENTICADO', 'Entrar', 401));
      await esperar(() => expect(raiz.querySelector('input[name="correo"]')).not.toBeNull());
      api.iniciarSesion.mockResolvedValue({ nombre: 'Ana', rol });
      api.sesion.mockResolvedValue({ nombre: 'Ana', rol });
      llena('correo', 'ana@club.es');
      llena('contrasena', 'Cumbre2026');
      enviar();
      await esperar(() => expect(window.location.hash).toBe(destino));
    }
  });

  it('INV-ACC-101 un doble envío del formulario hace una sola petición (el botón queda inactivo mientras espera)', async () => {
    window.location.hash = '#/entrar';
    await esperar(() => expect(raiz.querySelector('input[name="correo"]')).not.toBeNull());
    let resolver;
    api.iniciarSesion.mockReturnValue(new Promise((r) => { resolver = r; }));
    llena('correo', 'lucia@club.es');
    llena('contrasena', 'Cumbre2026');
    enviar();
    enviar();
    expect(api.iniciarSesion).toHaveBeenCalledTimes(1);
    expect(raiz.querySelector('button').getAttribute('aria-busy')).toBe('true');
    resolver({ nombre: 'Lucía', rol: 'socio' });
  });

  it('una pantalla a la que el rol no llega muestra el aviso de permiso y un enlace a su inicio', async () => {
    api.sesion.mockResolvedValue({ nombre: 'Pablo', rol: 'socio' });
    window.location.hash = '#/inventario';
    await esperar(() => expect(raiz.querySelector('[role="alert"]')).not.toBeNull());
    expect(raiz.querySelector('[role="alert"]').textContent).toBe('No tienes permiso para ver esta pantalla');
    expect(raiz.querySelector('main a').getAttribute('href')).toBe('#/mis-reservas');
    expect(api.listarInventario).not.toHaveBeenCalled();
    expect(texto()).not.toContain('Inventario ·');
  });
});
