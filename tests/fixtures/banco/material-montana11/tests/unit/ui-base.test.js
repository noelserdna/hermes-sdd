// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { TEXTOS } from '../../src/ui/textos.js';
import { mensajeError, MENSAJES } from '../../src/ui/errores.js';
import { ERRORES } from '../../src/domain/errores.js';
import { crearRouter } from '../../src/ui/router.js';
import { crearAviso } from '../../src/ui/componentes/aviso.js';
import { crearCabecera } from '../../src/ui/componentes/cabecera.js';
import { crearApi } from '../../src/ui/api.js';

describe('textos y errores', () => {
  it('REQ-C-002 textos únicos: textos.js y errores.js exportan los literales y errores.js traduce cada código', () => {
    expect(TEXTOS.entrar).toBe('Entrar');
    expect(TEXTOS.salir).toBe('Salir');
    expect(TEXTOS.materialDisponible).toBe('Material disponible');
    expect(TEXTOS.panelEncargado).toBe('Panel del encargado');
    expect(MENSAJES.E_ACCESO_NO_PERMITIDO).toBe('Acceso no permitido');
    for (const [codigo, mensaje] of Object.entries(ERRORES)) expect(mensajeError(codigo)).toBe(mensaje);
    expect(mensajeError('E_DESCONOCIDO')).toBe(ERRORES.E_ALMACEN_NO_DISPONIBLE);
  });
});

describe('router', () => {
  const montar = (hash) => {
    window.location.hash = hash;
    const raiz = document.createElement('div');
    const registro = [];
    const rutas = {
      '#/inicio': () => { registro.push('inicio'); raiz.textContent = 'pantalla inicio'; },
      '#/entrar': () => { registro.push('entrar'); raiz.textContent = 'pantalla entrar'; },
    };
    return { raiz, registro, router: crearRouter({ raiz, rutas, ventana: window }) };
  };

  it('router navega por hash: cambiar a #/inicio monta la pantalla registrada', async () => {
    const { raiz, registro, router } = montar('#/entrar');
    await router.iniciar();
    await router.navegar('#/inicio');
    expect(registro).toEqual(['entrar', 'inicio']);
    expect(raiz.textContent).toBe('pantalla inicio');
  });

  it('router navega por hash: una ruta desconocida lleva a #/entrar', async () => {
    const { raiz, router } = montar('#/no-existe');
    await router.iniciar();
    expect(window.location.hash).toBe('#/entrar');
    expect(raiz.textContent).toBe('pantalla entrar');
  });
});

describe('router pinta una sola vez', () => {
  it('navegar a otra ruta pinta una vez aunque después llegue el hashchange', async () => {
    window.location.hash = '#/entrar';
    const raiz = document.createElement('div');
    const pintadas = [];
    const rutas = { '#/entrar': () => pintadas.push('entrar'), '#/inicio': () => pintadas.push('inicio') };
    const router = crearRouter({ raiz, rutas, ventana: window });
    await router.iniciar();
    await router.navegar('#/inicio');
    await new Promise((r) => setTimeout(r, 20));
    expect(pintadas).toEqual(['entrar', 'inicio']);
  });
});

describe('aviso', () => {
  it('aviso accesible: un error se pinta con role="alert" y un éxito con role="status", con textContent', () => {
    const error = crearAviso('error', '<b>x</b>');
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.textContent).toBe('<b>x</b>');
    expect(error.querySelector('b')).toBeNull();
    const ok = crearAviso('exito', 'Hecho');
    expect(ok.getAttribute('role')).toBe('status');
  });
});

describe('cabecera', () => {
  it('la cabecera muestra el nombre del usuario y un botón "Salir"', () => {
    const alSalir = vi.fn();
    const c = crearCabecera({ usuario: { nombre: 'Lucía', rol: 'socio' }, enlaces: [{ texto: 'Mis reservas', hash: '#/reservas' }], alSalir });
    expect(c.textContent).toContain('Lucía');
    const boton = [...c.querySelectorAll('button')].find((b) => b.textContent === 'Salir');
    boton.click();
    expect(alSalir).toHaveBeenCalledTimes(1);
    expect(c.querySelector('a[href="#/reservas"]').textContent).toBe('Mis reservas');
  });
});

describe('cliente de la API', () => {
  const respuesta = (cuerpo) => ({ json: async () => cuerpo });

  it('devuelve los datos y lanza el error con su código y mensaje literal', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(respuesta({ ok: true, datos: { nombre: 'Marta' } }))
      .mockResolvedValueOnce(respuesta({ ok: false, codigo: 'E_CREDENCIALES_INVALIDAS', mensaje: 'x' }));
    const api = crearApi({ fetch });
    expect(await api.comprobarSesion()).toEqual({ nombre: 'Marta' });
    await expect(api.iniciarSesion('a@b.c', 'x')).rejects.toMatchObject({ codigo: 'E_CREDENCIALES_INVALIDAS', message: 'Correo o contraseña incorrectos' });
    expect(fetch.mock.calls[0][0]).toBe('/api/comprobarSesion');
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
  });

  it('avisa cuando la sesión no vale y trata un fallo de red como almacén no disponible', async () => {
    const alExpirar = vi.fn();
    const fetch = vi.fn()
      .mockResolvedValueOnce(respuesta({ ok: false, codigo: 'E_SESION_CADUCADA' }))
      .mockRejectedValueOnce(new Error('red'));
    const api = crearApi({ fetch, alExpirar });
    await expect(api.comprobarSesion()).rejects.toMatchObject({ codigo: 'E_SESION_CADUCADA' });
    expect(alExpirar).toHaveBeenCalledWith('E_SESION_CADUCADA');
    await expect(api.listarSocios()).rejects.toMatchObject({ codigo: 'E_ALMACEN_NO_DISPONIBLE' });
  });
});
