import { crearRouter } from './router.js';
import { crearApi } from './api.js';
import { crearCabecera } from './componentes/cabecera.js';
import { crearAviso } from './componentes/aviso.js';
import { TEXTOS } from './textos.js';
import { pantallaEntrar } from './pantallas/entrar.js';
import { pantallaInicio } from './pantallas/inicio.js';
import { pantallaReservar } from './pantallas/reservar.js';
import { pantallaMisReservas } from './pantallas/mis-reservas.js';
import { pantallaInventario } from './pantallas/inventario.js';
import { pantallaSocios } from './pantallas/socios.js';
import { pantallaPrestamos } from './pantallas/prestamos.js';
import { pantallaPrestado } from './pantallas/prestado.js';
import { pantallaHistorial } from './pantallas/historial.js';
import { pantallaMisMultas } from './pantallas/mis-multas.js';
import { pantallaMultas } from './pantallas/multas.js';
import { pantallaProhibido } from './pantallas/prohibido.js';

const ENLACES = {
  socio: [{ texto: TEXTOS.enlaceInicio, hash: '#/inicio' }, { texto: TEXTOS.enlaceReservas, hash: '#/reservas' }, { texto: TEXTOS.enlaceMisMultas, hash: '#/mis-multas' }],
  encargado: [{ texto: TEXTOS.enlaceInicio, hash: '#/inicio' }, { texto: TEXTOS.enlaceSocios, hash: '#/socios' }, { texto: TEXTOS.enlaceInventario, hash: '#/inventario' }, { texto: TEXTOS.enlacePrestamos, hash: '#/prestamos' }, { texto: TEXTOS.enlaceMultas, hash: '#/multas' }, { texto: TEXTOS.enlacePrestado, hash: '#/prestado' }],
  junta: [{ texto: TEXTOS.enlaceInicio, hash: '#/inicio' }, { texto: TEXTOS.enlaceHistorial, hash: '#/historial' }],
};

/**
 * Arranca la SPA. Cada pantalla registra aquí su ruta; las pantallas se añaden FASE a FASE.
 * Las rutas con sesión pasan por `conSesion`: comprueban la sesión (API-001-03), pintan la cabecera y, sin sesión,
 * llevan a Entrar.
 */
export function arrancar({ raiz, ventana = window, api } = {}) {
  const estado = {};
  const rutas = {};
  const router = crearRouter({ raiz, rutas, ventana });
  // La sesión no vale (sin sesión o caducada): se vuelve a Entrar, avisando solo de la caducidad.
  const volverAEntrar = (codigo) => {
    if (ventana.location.hash === '#/entrar') return;
    estado.avisoEntrar = codigo === 'E_SESION_CADUCADA' ? codigo : undefined;
    router.navegar('#/entrar');
  };
  const cliente = api ?? crearApi({ alExpirar: volverAEntrar });

  const conSesion = (pantalla) => async (ctx) => {
    let usuario;
    try {
      usuario = await cliente.comprobarSesion();
    } catch (e) {
      if (e.codigo === 'E_NO_AUTENTICADO' || e.codigo === 'E_SESION_CADUCADA') return volverAEntrar(e.codigo);
      return raiz.replaceChildren(crearAviso('error', e.message));
    }
    const salir = async () => {
      try { await cliente.cerrarSesion(); } catch { /* sin sesión o almacén caído: se vuelve a Entrar igualmente */ }
      estado.avisoEntrar = undefined;
      router.navegar('#/entrar');
    };
    const cabecera = crearCabecera({ usuario, enlaces: ENLACES[usuario.rol] ?? [], alSalir: salir });
    const contenedor = document.createElement('main');
    raiz.replaceChildren(cabecera, contenedor);
    return pantalla({ ...ctx, contenedor, usuario, api: cliente, estado });
  };

  rutas['#/entrar'] = (ctx) => pantallaEntrar({ ...ctx, api: cliente, estado });
  rutas['#/inicio'] = conSesion(pantallaInicio);
  rutas['#/reservar'] = conSesion(pantallaReservar);
  rutas['#/reservas'] = conSesion(pantallaMisReservas);
  rutas['#/mis-multas'] = conSesion(pantallaMisMultas);
  rutas['#/multas'] = conSesion(pantallaMultas);
  rutas['#/inventario'] = conSesion(pantallaInventario);
  rutas['#/prestamos'] = conSesion(pantallaPrestamos);
  rutas['#/prestado'] = conSesion(pantallaPrestado);
  rutas['#/historial'] = conSesion(pantallaHistorial);
  rutas['#/socios'] = conSesion(pantallaSocios);
  rutas['#/acceso-no-permitido'] = conSesion(pantallaProhibido);
  return { router, rutas, api: cliente, estado, conSesion };
}

if (typeof document !== 'undefined' && document.getElementById('app')) {
  arrancar({ raiz: document.getElementById('app') }).router.iniciar();
}
