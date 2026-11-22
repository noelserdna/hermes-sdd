import { iniciarSesion, cerrarSesion, validarSesion } from '../domain/acceso.js';

// Sesión por petición (ADR-DRAFT-003): la cookie lleva el identificador; cada operación vuelve a leer la cuenta.
export const autenticar = ({ almacen, reloj, sid }) => validarSesion({ almacen, reloj }, sid);

// API-001-01, API-001-02 y la consulta de la sesión actual que necesita la SPA al recargar (sin guardar nada en el navegador).
export const rutasAcceso = [
  {
    metodo: 'POST', ruta: '/api/iniciar-sesion', publica: true,
    async ejecutar({ almacen, reloj, cuerpo }) {
      const { sid, nombre, rol } = await iniciarSesion({ almacen, reloj }, cuerpo);
      return { estado: 200, cuerpo: { nombre, rol }, cookie: { valor: sid } };
    },
  },
  {
    metodo: 'POST', ruta: '/api/cerrar-sesion', publica: true,
    async ejecutar({ almacen, reloj, sid }) {
      await cerrarSesion({ almacen, reloj }, sid);
      return { estado: 204, cookie: 'borrar' };
    },
  },
  {
    metodo: 'GET', ruta: '/api/sesion',
    async ejecutar({ actor }) {
      return { estado: 200, cuerpo: { nombre: actor.nombre, rol: actor.rol } };
    },
  },
];
