// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { arrancar } from '../../src/ui/main.js';
import { ErrorApi } from '../../src/ui/api.js';

let raiz;
beforeEach(() => { document.body.replaceChildren(); raiz = document.createElement('div'); document.body.append(raiz); });

describe('#/reservas (versión mínima, D-PA-020)', () => {
  it('un socio con sesión ve la cabecera con su nombre y Salir, y el título "Mis reservas"', async () => {
    window.location.hash = '#/reservas';
    const api = { comprobarSesion: vi.fn().mockResolvedValue({ nombre: 'Lucía Gil', correo: 'lucia@club.test', rol: 'socio' }), cerrarSesion: vi.fn() };
    const app = arrancar({ raiz, ventana: window, api });
    await app.router.iniciar();
    expect(raiz.querySelector('h1').textContent).toBe('Mis reservas');
    expect(raiz.querySelector('header').textContent).toContain('Lucía Gil');
    expect([...raiz.querySelectorAll('button')].some((b) => b.textContent === 'Salir')).toBe(true);
  });

  it('sin sesión lleva a Entrar, y con la sesión caducada Entrar avisa "Sesión caducada, vuelve a entrar"', async () => {
    window.location.hash = '#/reservas';
    const api = { comprobarSesion: vi.fn().mockRejectedValue(new ErrorApi('E_NO_AUTENTICADO')) };
    const app = arrancar({ raiz, ventana: window, api });
    await app.router.iniciar();
    expect(window.location.hash).toBe('#/entrar');
    expect(raiz.querySelector('h1').textContent).toBe('Entrar');
    expect(raiz.querySelector('[role="alert"]')).toBeNull();

    api.comprobarSesion.mockRejectedValue(new ErrorApi('E_SESION_CADUCADA'));
    await app.router.navegar('#/reservas');
    await vi.waitFor(() => expect(raiz.querySelector('[role="alert"]')?.textContent).toBe('Sesión caducada, vuelve a entrar'));
  });
});
