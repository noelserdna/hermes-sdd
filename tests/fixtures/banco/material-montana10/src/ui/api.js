import { T } from './textos.js';

// Cliente de la API JSON (rutas de design/OPERATION-MAPPING.md). La sesión viaja en una cookie HttpOnly.
export class ErrorApi extends Error {
  constructor(codigo, mensaje, estado) {
    super(mensaje);
    this.codigo = codigo;
    this.mensaje = mensaje;
    this.estado = estado;
  }
}

export function crearApi({ peticion = (...args) => fetch(...args) } = {}) {
  async function llamar(metodo, ruta, cuerpo) {
    let respuesta;
    try {
      respuesta = await peticion(ruta, {
        method: metodo, credentials: 'same-origin',
        headers: cuerpo === undefined ? {} : { 'content-type': 'application/json' },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      });
    } catch {
      throw new ErrorApi('E_ALMACEN_NO_DISPONIBLE', T.general.fallo, 0);
    }
    if (respuesta.status === 204) return null;
    let datos = null;
    try { datos = await respuesta.json(); } catch { /* sin cuerpo legible */ }
    if (!respuesta.ok) throw new ErrorApi(datos?.error ?? 'E_ALMACEN_NO_DISPONIBLE', datos?.mensaje ?? T.general.fallo, respuesta.status);
    return datos;
  }
  return {
    sesion: () => llamar('GET', '/api/sesion'),
    iniciarSesion: (correo, contrasena) => llamar('POST', '/api/iniciar-sesion', { correo, contrasena }),
    cerrarSesion: () => llamar('POST', '/api/cerrar-sesion', {}),
    listarInventario: () => llamar('GET', '/api/inventario'),
    anadirUnidades: (tipo, cantidad) => llamar('POST', '/api/inventario/unidades', { tipo, cantidad }),
    darDeBajaUnidad: (unidadId) => llamar('POST', '/api/inventario/unidades/baja', { unidadId }),
    reservarMaterial: (tipo, desde, hasta) => llamar('POST', '/api/reservas', { tipo, desde, hasta }),
    listarMisReservas: () => llamar('GET', '/api/mis-reservas'),
    consultarEntregasYDevoluciones: () => llamar('GET', '/api/entregas-y-devoluciones'),
    entregarReserva: (reservaId, unidadId) => llamar('POST', '/api/prestamos/entregar', { reservaId, unidadId }),
    devolverPrestamo: (reservaId) => llamar('POST', '/api/prestamos/devolver', { reservaId }),
    listarMultas: () => llamar('GET', '/api/multas'),
    pagarMulta: (multaId) => llamar('POST', '/api/multas/pagar', { multaId }),
    listarSocios: () => llamar('GET', '/api/socios'),
    listarSociosDetalle: () => llamar('GET', '/api/socios?detalle=1'),
    crearSocio: (nombre, correo, contrasena) => llamar('POST', '/api/socios', { nombre, correo, contrasena }),
    darDeBajaSocio: (cuentaId) => llamar('POST', '/api/socios/baja', { cuentaId }),
    restablecerContrasena: (cuentaId, contrasena) => llamar('POST', '/api/socios/restablecer', { cuentaId, contrasena }),
    consultarHistorial: (socioId) => llamar('GET', `/api/historial?socioId=${encodeURIComponent(socioId)}`),
    cancelarReserva: (reservaId) => llamar('POST', '/api/reservas/cancelar', { reservaId }),
  };
}
