import { mensajeError } from './errores.js';

export class ErrorApi extends Error {
  constructor(codigo) {
    super(mensajeError(codigo));
    this.name = 'ErrorApi';
    this.codigo = codigo;
  }
}

/**
 * Cliente de /api/<operacion> (design/OPERATION-MAPPING.md). Lecturas con GET; escrituras con POST y JSON.
 * `alExpirar(codigo)` se llama cuando la sesión no vale (E_NO_AUTENTICADO, E_SESION_CADUCADA).
 */
export function crearApi({ fetch: f = (...a) => globalThis.fetch(...a), alExpirar } = {}) {
  async function llamar(operacion, datos, metodo) {
    let cuerpo;
    try {
      const opciones = metodo === 'GET'
        ? { method: 'GET', credentials: 'same-origin' }
        : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos ?? {}) };
      const respuesta = await f(`/api/${operacion}`, opciones);
      cuerpo = await respuesta.json();
    } catch {
      throw new ErrorApi('E_ALMACEN_NO_DISPONIBLE');
    }
    if (cuerpo.ok) return cuerpo.datos;
    if (cuerpo.codigo === 'E_NO_AUTENTICADO' || cuerpo.codigo === 'E_SESION_CADUCADA') alExpirar?.(cuerpo.codigo);
    throw new ErrorApi(cuerpo.codigo);
  }

  return {
    iniciarSesion: (correo, contrasena) => llamar('iniciarSesion', { correo, contrasena }, 'POST'),
    cerrarSesion: () => llamar('cerrarSesion', {}, 'POST'),
    comprobarSesion: () => llamar('comprobarSesion', undefined, 'GET'),
    crearSocio: (nombre, correo, contrasena) => llamar('crearSocio', { nombre, correo, contrasena }, 'POST'),
    listarSocios: () => llamar('listarSocios', undefined, 'GET'),
    restablecerContrasena: (socioId, contrasena) => llamar('restablecerContrasena', { socioId, contrasena }, 'POST'),
    darDeBajaSocio: (socioId) => llamar('darDeBajaSocio', { socioId }, 'POST'),
    listarInventario: () => llamar('listarInventario', undefined, 'GET'),
    consultarDisponibilidad: (material, inicio, fin) => llamar(`consultarDisponibilidad?${new URLSearchParams({ material, inicio, fin })}`, undefined, 'GET'),
    reservarMaterial: (material, inicio, fin) => llamar('reservarMaterial', { material, inicio, fin }, 'POST'),
    listarMisReservas: () => llamar('listarMisReservas', undefined, 'GET'),
    cancelarReserva: (reservaId) => llamar('cancelarReserva', { reservaId }, 'POST'),
    listarPrestamosYReservas: () => llamar('listarPrestamosYReservas', undefined, 'GET'),
    consultarPrestado: (dia) => llamar(dia ? `consultarPrestado?${new URLSearchParams({ dia })}` : 'consultarPrestado', undefined, 'GET'),
    listarSociosHistorial: () => llamar('listarSociosHistorial', undefined, 'GET'),
    consultarHistorialSocio: (socioId) => llamar(`consultarHistorialSocio?${new URLSearchParams({ socioId })}`, undefined, 'GET'),
    entregarReserva: (reservaId) => llamar('entregarReserva', { reservaId }, 'POST'),
    registrarDevolucion: (reservaId) => llamar('registrarDevolucion', { reservaId }, 'POST'),
    listarMisMultas: () => llamar('listarMisMultas', undefined, 'GET'),
    listarMultas: () => llamar('listarMultas', undefined, 'GET'),
    marcarMultaPagada: (multaId) => llamar('marcarMultaPagada', { multaId }, 'POST'),
    darDeBajaUnidad: (unidadId) => llamar('darDeBajaUnidad', { unidadId }, 'POST'),
    anadirMaterial: (tipo, cantidad) => llamar('anadirMaterial', { tipo, cantidad }, 'POST'),
  };
}
