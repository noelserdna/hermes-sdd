// Punto de entrada de la web: construye el router con las páginas y pinta la ruta actual.
import './estilos.css';
import { crearApi } from './api.js';
import { crearRouter } from './router.js';
import { T } from './textos.js';
import { paginaEntrar } from './paginas/entrar.js';
import { paginaMisReservasConLista } from './paginas/mis-reservas.js';
import { paginaPanelConLista } from './paginas/panel.js';
import { paginaMaterial } from './paginas/material.js';
import { paginaReservarConFormulario } from './paginas/reservar.js';
import { paginaMisMultas } from './paginas/mis-multas.js';
import { paginaMultas } from './paginas/multas.js';
import { paginaSocios } from './paginas/socios.js';
import { paginaHistorial } from './paginas/historial.js';
import { paginaCambiarContrasena } from './paginas/cambiar-contrasena.js';
import { paginaSinPermiso } from './paginas/sin-permiso.js';

// Las páginas privadas se registran aquí a medida que llegan; el router no conoce ninguna por nombre.
const paginas = {
  '/mis-reservas': paginaMisReservasConLista,
  '/panel': paginaPanelConLista,
  '/material': paginaMaterial,
  '/reservar': paginaReservarConFormulario,
  '/socios': paginaSocios,
  '/mis-multas': paginaMisMultas,
  '/multas': paginaMultas,
  '/historial': paginaHistorial,
  '/cambiar-contrasena': paginaCambiarContrasena,
};

const router = crearRouter({ raiz: document.getElementById('app'), api: crearApi(), T, paginas, entrar: paginaEntrar, sinPermiso: paginaSinPermiso });
router.iniciar();
router.navegar(window.location.pathname, { reemplazar: true });
