// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pantallaEntrar } from '../../src/ui/pantallas/entrar.js';
import { pantallaInicio } from '../../src/ui/pantallas/inicio.js';
import { ErrorApi } from '../../src/ui/api.js';

let raiz;
beforeEach(() => { document.body.replaceChildren(); raiz = document.createElement('div'); document.body.append(raiz); });

const rellenar = (correo, contrasena) => {
  raiz.querySelector('input[name="correo"]').value = correo;
  raiz.querySelector('input[name="contrasena"]').value = contrasena;
};

describe('pantalla Entrar', () => {
  it('muestra el formulario "Entrar" con Correo, Contraseña y el botón Entrar', () => {
    pantallaEntrar({ raiz, navegar: vi.fn(), api: {} });
    expect(raiz.querySelector('h1').textContent).toBe('Entrar');
    expect(raiz.querySelector('label[for="correo"]').textContent).toBe('Correo');
    expect(raiz.querySelector('label[for="contrasena"]').textContent).toBe('Contraseña');
    expect(raiz.querySelector('button[type="submit"]').textContent).toBe('Entrar');
  });

  // Envío repetido: botón deshabilitado mientras espera, una sola petición
  it('envío repetido: dos pulsaciones seguidas de Entrar envían una sola petición', async () => {
    let resolver;
    const api = { iniciarSesion: vi.fn(() => new Promise((r) => { resolver = r; })) };
    const navegar = vi.fn();
    pantallaEntrar({ raiz, navegar, api });
    rellenar('lucia@club.test', 'Cumbre2026');
    const boton = raiz.querySelector('button[type="submit"]');
    boton.click();
    boton.click();
    raiz.querySelector('form').requestSubmit();
    expect(api.iniciarSesion).toHaveBeenCalledTimes(1);
    expect(boton.disabled).toBe(true);
    resolver({ nombre: 'Lucía Gil', rol: 'socio' });
    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('#/inicio'));
  });

  it('un error del servidor se muestra con role="alert" y se puede reintentar', async () => {
    const api = { iniciarSesion: vi.fn().mockRejectedValue(new ErrorApi('E_CREDENCIALES_INVALIDAS')) };
    pantallaEntrar({ raiz, navegar: vi.fn(), api });
    rellenar('lucia@club.test', 'x');
    raiz.querySelector('form').requestSubmit();
    await vi.waitFor(() => expect(raiz.querySelector('[role="alert"]')?.textContent).toBe('Correo o contraseña incorrectos'));
    expect(raiz.querySelector('button[type="submit"]').disabled).toBe(false);
    api.iniciarSesion.mockRejectedValue(new ErrorApi('E_CUENTA_BLOQUEADA'));
    raiz.querySelector('form').requestSubmit();
    await vi.waitFor(() => expect(raiz.querySelector('[role="alert"]').textContent).toBe('Cuenta bloqueada durante 15 minutos'));
  });

  it('el aviso pendiente (sesión caducada) se muestra al abrir Entrar y se consume', () => {
    const estado = { avisoEntrar: 'E_SESION_CADUCADA' };
    pantallaEntrar({ raiz, navegar: vi.fn(), api: {}, estado });
    expect(raiz.querySelector('[role="alert"]').textContent).toBe('Sesión caducada, vuelve a entrar');
    expect(estado.avisoEntrar).toBeUndefined();
  });
});

describe('pantalla Inicio', () => {
  const inicio = (rol) => { const c = document.createElement('main'); raiz.replaceChildren(c); pantallaInicio({ contenedor: c, usuario: { nombre: 'X', rol } }); return c; };

  it('el título de inicio depende del rol: socio, encargado y junta', () => {
    expect(inicio('socio').querySelector('h1').textContent).toBe('Material disponible');
    expect(inicio('encargado').querySelector('h1').textContent).toBe('Panel del encargado');
  });

  // Escenario AC-001-03: la junta entra y ve "Historial del socio"; es solo lectura (INV-SEC-002)
  it('AC-001-03 la junta ve "Historial del socio" y ninguna acción de escritura', () => {
    const c = inicio('junta');
    expect(c.querySelector('h1').textContent).toBe('Historial del socio');
    expect(c.querySelectorAll('button, form, input, select, textarea')).toHaveLength(0);
  });
});
