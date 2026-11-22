import './estilos.css';
import { crearApi } from './api.js';
import { crearApp } from './router.js';
import { T } from './textos.js';

document.title = T.app.titulo;
crearApp({ raiz: document.getElementById('app'), api: crearApi() }).iniciar();
