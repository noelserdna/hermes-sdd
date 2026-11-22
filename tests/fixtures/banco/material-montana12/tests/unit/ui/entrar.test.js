// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginaEntrar } from '../../../src/ui/paginas/entrar.js';
import { paginaMisReservas } from '../../../src/ui/paginas/mis-reservas.js';
import { paginaPanel } from '../../../src/ui/paginas/panel.js';
import { cabecera } from '../../../src/ui/componentes.js';
import { T } from '../../../src/ui/textos.js';

beforeEach(() => document.body.replaceChildren());

async function formulario(respuesta) {
  const api = { entrar: vi.fn(async () => respuesta) };
  const navegar = vi.fn();
  const main = await paginaEntrar({ api, T, navegar });
  document.body.append(main);
  const escribir = (campo, valor) => { main.querySelector(`[name="${campo}"]`).value = valor; };
  const enviar = () => main.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  return { main, api, navegar, escribir, enviar };
}

const esperar = () => new Promise((r) => setTimeout(r, 0));

describe('SCR-001 formulario Entrar', () => {
  it('tiene título, correo y contraseña con su etiqueta y un botón Entrar', async () => {
    const { main } = await formulario({ estado: 200, cuerpo: {} });
    expect(main.querySelector('h1').textContent).toBe('Entrar');
    expect(main.querySelector('label[for="correo"]').textContent).toBe('Correo');
    expect(main.querySelector('input#correo').getAttribute('autocomplete')).toBe('username');
    expect(main.querySelector('label[for="contrasena"]').textContent).toBe('Contraseña');
    expect(main.querySelector('input#contrasena').type).toBe('password');
    expect(main.querySelector('input#contrasena').getAttribute('autocomplete')).toBe('current-password');
    expect(main.querySelector('button[type="submit"]').textContent).toBe('Entrar');
  });

  it('envía el correo y la contraseña y, si entra, navega a la página de su rol', async () => {
    const { api, navegar, escribir, enviar } = await formulario({ estado: 200, cuerpo: { nombre: 'Lucía', rol: 'socio', destino: '/mis-reservas' } });
    escribir('correo', 'lucia@club.test');
    escribir('contrasena', 'Cumbre2026!');
    enviar();
    await esperar();
    expect(api.entrar).toHaveBeenCalledWith('lucia@club.test', 'Cumbre2026!');
    expect(navegar).toHaveBeenCalledWith('/mis-reservas');
  });

  it('un error del servidor sale en una alerta con foco, conserva el correo, vacía la contraseña y no navega', async () => {
    const { main, navegar, escribir, enviar } = await formulario({
      estado: 423, cuerpo: { error: { codigo: 'E_CUENTA_BLOQUEADA', mensaje: 'Cuenta bloqueada. Vuelve a intentarlo en 15 minutos' } },
    });
    escribir('correo', 'lucia@club.test');
    escribir('contrasena', 'Cumbre2026!');
    enviar();
    await esperar();
    const alerta = main.querySelector('[role="alert"]');
    expect(alerta.textContent).toBe('Cuenta bloqueada. Vuelve a intentarlo en 15 minutos');
    expect(document.activeElement).toBe(alerta);
    expect(main.querySelector('input#correo').value).toBe('lucia@club.test');
    expect(main.querySelector('input#contrasena').value).toBe('');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('un segundo error sustituye al primero: nunca hay dos mensajes', async () => {
    const { main, escribir, enviar, api } = await formulario({ estado: 401, cuerpo: { error: { codigo: 'E_CREDENCIALES', mensaje: 'Correo o contraseña incorrectos' } } });
    escribir('correo', 'a@b.c');
    enviar(); await esperar();
    api.entrar.mockResolvedValueOnce({ estado: 401, cuerpo: { error: { codigo: 'E_CREDENCIALES', mensaje: 'Correo o contraseña incorrectos' } } });
    enviar(); await esperar();
    expect(main.querySelectorAll('[role="alert"]')).toHaveLength(1);
  });

  it('si no hay conexión muestra el texto de red', async () => {
    const { main, enviar } = await formulario({ estado: 0, cuerpo: { error: { codigo: 'E_RED', mensaje: null } } });
    enviar(); await esperar();
    expect(main.querySelector('[role="alert"]').textContent).toBe(T.errorRed);
  });
});

describe('cabecera de las páginas privadas', () => {
  it('muestra «Hola, {nombre}», la navegación del rol y el botón Salir que cierra la sesión', () => {
    const salir = vi.fn();
    const h = cabecera({ sesion: { nombre: 'Lucía', rol: 'socio' }, T, navegar: vi.fn(), salir });
    document.body.append(h);
    expect(h.textContent).toContain('Hola, Lucía');
    const enlaces = [...h.querySelectorAll('nav a')].map((a) => a.textContent);
    expect(enlaces).toContain('Mis reservas');
    expect(enlaces).toContain('Reservar');
    expect(enlaces).not.toContain('Material');
    h.querySelector('button').click();
    expect(h.querySelector('button').textContent).toBe('Salir');
    expect(salir).toHaveBeenCalledOnce();
  });

  it('el encargado ve Panel y Material', () => {
    const h = cabecera({ sesion: { nombre: 'Pablo', rol: 'encargado' }, T, navegar: vi.fn(), salir: vi.fn() });
    const enlaces = [...h.querySelectorAll('nav a')].map((a) => a.textContent);
    expect(enlaces).toContain('Panel');
    expect(enlaces).toContain('Material');
  });
});

describe('páginas de inicio por rol', () => {
  it('Mis reservas y Panel del encargado tienen su título', async () => {
    expect((await paginaMisReservas({ T })).querySelector('h1').textContent).toBe('Mis reservas');
    expect((await paginaPanel({ T })).querySelector('h1').textContent).toBe('Panel del encargado');
  });
});
