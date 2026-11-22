// Rutas /api: cada una autoriza (API-001-08) y llama a su servicio (design/OPERATION-MAPPING.md).
// `crearManejador(app)` no sabe de Connect: recibe y devuelve datos simples, así los tests lo llaman sin red.
import { ErrorDominio } from '../mensajes.js';
import { authorize, cookieSesion, leerCookieSesion } from './autorizar.js';
import { changePassword, listMembers, login, logout, registerMember, removeMember, resetMemberPassword } from '../servicios/cuentas.js';
import { addUnits, listMaterial, withdrawUnits } from '../servicios/material.js';
import { listFines, listMyFines, payFine } from '../servicios/multas.js';
import { getMemberHistory } from '../servicios/historial.js';
import { getPanel } from '../servicios/panel.js';
import { cancelReservation, deliverReservation, listMyReservations, reserve, returnLoan } from '../servicios/prestamos.js';

const ESTADO = {
  E_CREDENCIALES: 401,
  E_CUENTA_BLOQUEADA: 423,
  E_ACCESO_DENEGADO: 403,
  E_SOCIO_DUPLICADO: 409,
  E_SOCIO_DATOS_INVALIDOS: 400,
  E_CONTRASENA_CORTA: 400,
  E_SOCIO_NO_ENCONTRADO: 404,
  E_BUSQUEDA_VACIA: 404,
  E_BAJA_PRESTAMOS: 409,
  E_BAJA_MULTAS: 409,
  E_PAGINA_PROHIBIDA: 403,
  E_CANTIDAD_INVALIDA: 400,
  E_NOMBRE_VACIO: 400,
  E_BAJA_UNIDADES_INSUFICIENTES: 400,
  E_BAJA_UNIDADES_NECESARIAS: 409,
  E_MATERIAL_NO_ENCONTRADO: 404,
  E_ALMACEN_NO_DISPONIBLE: 503,
  E_MULTA_PENDIENTE: 409,
  E_MULTA_NO_ENCONTRADA: 404,
  E_SIN_UNIDADES: 409,
  E_FECHA_PASADA: 400,
  E_FECHA_FIN_ANTERIOR: 400,
  E_FECHA_INVALIDA: 400,
  E_MAX_DIAS: 400,
  E_MAX_UNIDADES: 400,
  E_RESERVA_NO_ENCONTRADA: 404,
  E_ANTES_DE_INICIO: 409,
  E_NO_RECOGIDA: 409,
  E_RESERVA_NO_ENTREGABLE: 409,
  E_NO_PRESTADA: 409,
  E_EMPIEZA_HOY: 409,
  E_YA_EMPEZADA: 409,
};

const NO_STORE = { 'Cache-Control': 'no-store' };
const responder = (estado, cuerpo, extra = {}) => ({ estado, cuerpo, cabeceras: { ...NO_STORE, ...extra } });
const errorDe = (e) => ({ error: { codigo: e.codigo, mensaje: e.message } });

/** Operaciones con sesión: el id de la tabla de permisos, la función de servicio y cómo se lee la petición. */
const OPERACIONES = [];
// `pagina`: la operación es una página (el panel): su rechazo es E_PAGINA_PROHIBIDA, como pide el contrato, y no E_ACCESO_DENEGADO
const registrar = (metodo, patron, operacion, ejecutar, { pagina } = {}) => OPERACIONES.push({ metodo, patron, operacion, ejecutar, pagina });

registrar('PUT', /^\/api\/cuenta\/contrasena$/, 'API-001-03', (app, { sesion, cuerpo }) => changePassword({ ...app, sesion }, { nueva: cuerpo.contrasena }));
registrar('PUT', /^\/api\/socios\/([^/]+)\/contrasena$/, 'API-001-05', (app, { sesion, cuerpo, parametros }) =>
  resetMemberPassword({ ...app, sesion }, { id: decodeURIComponent(parametros[0]), contrasena: cuerpo.contrasena }));
registrar('POST', /^\/api\/socios\/([^/]+)\/baja$/, 'API-001-06', (app, { sesion, parametros }) =>
  removeMember({ ...app, sesion }, { id: decodeURIComponent(parametros[0]) }));
registrar('GET', /^\/api\/socios$/, 'API-001-04', (app, { sesion }) => listMembers({ ...app, sesion }), { pagina: '/socios' });
registrar('POST', /^\/api\/socios$/, 'API-001-04', (app, { sesion, cuerpo }) => registerMember({ ...app, sesion }, cuerpo));
registrar('GET', /^\/api\/material$/, 'API-003-03', (app, { sesion }) => listMaterial({ ...app, sesion }));
registrar('POST', /^\/api\/material$/, 'API-003-01', (app, { sesion, cuerpo }) => addUnits({ ...app, sesion }, cuerpo));
registrar('POST', /^\/api\/material\/([^/]+)\/retirar$/, 'API-003-02', (app, { sesion, cuerpo, parametros }) =>
  withdrawUnits({ ...app, sesion }, { id: decodeURIComponent(parametros[0]), cantidad: cuerpo.cantidad }));
registrar('POST', /^\/api\/reservas$/, 'API-002-01', (app, { sesion, cuerpo }) => reserve({ ...app, sesion }, cuerpo));
registrar('GET', /^\/api\/mis-reservas$/, 'API-002-02', (app, { sesion }) => listMyReservations({ ...app, sesion }));
registrar('POST', /^\/api\/reservas\/([^/]+)\/cancelar$/, 'API-002-03', (app, { sesion, parametros }) =>
  cancelReservation({ ...app, sesion }, { id: decodeURIComponent(parametros[0]) }));
registrar('POST', /^\/api\/reservas\/([^/]+)\/entregar$/, 'API-002-04', (app, { sesion, parametros }) =>
  deliverReservation({ ...app, sesion }, { id: decodeURIComponent(parametros[0]) }));
registrar('POST', /^\/api\/reservas\/([^/]+)\/devolver$/, 'API-002-05', (app, { sesion, parametros }) =>
  returnLoan({ ...app, sesion }, { id: decodeURIComponent(parametros[0]) }));
registrar('GET', /^\/api\/mis-multas$/, 'API-004-01', (app, { sesion }) => listMyFines({ ...app, sesion }), { pagina: '/mis-multas' });
registrar('GET', /^\/api\/multas$/, 'API-004-03', (app, { sesion }) => listFines({ ...app, sesion }), { pagina: '/multas' });
registrar('POST', /^\/api\/multas\/([^/]+)\/pagar$/, 'API-004-02', (app, { sesion, parametros }) =>
  payFine({ ...app, sesion }, { id: decodeURIComponent(parametros[0]) }));
registrar('GET', /^\/api\/historial$/, 'API-001-07', (app, { sesion, consulta }) => getMemberHistory({ ...app, sesion }, { q: consulta.q, id: consulta.id }));
registrar('GET', /^\/api\/panel$/, 'API-002-06', (app, { sesion, consulta }) =>
  getPanel({ ...app, sesion }, { fecha: 'fecha' in consulta ? consulta.fecha : undefined }), { pagina: '/panel' });

export function crearManejador(app) {
  return async function manejar({ metodo, ruta, consulta = {}, cuerpo = {}, cookie }) {
    try {
      const sesionId = leerCookieSesion(cookie);
      const sesion = app.sesiones.obtener(sesionId);

      if (metodo === 'POST' && ruta === '/api/entrar') {
        const r = await login(app, cuerpo);
        return responder(200, { nombre: r.nombre, rol: r.rol, destino: r.destino }, { 'Set-Cookie': cookieSesion(r.sesionId, { secure: app.cookieSegura }) });
      }

      if (metodo === 'POST' && ruta === '/api/salir') {
        const r = await logout(app, sesionId);
        return responder(200, r, { 'Set-Cookie': cookieSesion('', { secure: app.cookieSegura, borrar: true }) });
      }

      // API-001-08: la guardia del router pregunta aquí si la sesión puede abrir una página
      if (metodo === 'GET' && ruta === '/api/sesion') {
        const decision = consulta.pagina ? authorize(sesion, { pagina: consulta.pagina }) : authorize(sesion, { operacion: 'API-001-02' });
        if (decision.entrar) return responder(401, { entrar: true });
        const datos = { nombre: sesion.nombre, rol: sesion.rol, ...(sesion.debeCambiar ? { debeCambiar: true } : {}) };
        if (decision.cambiar) return responder(403, { cambiar: true, sesion: datos });
        if (!decision.ok) return responder(ESTADO[decision.codigo], { ...errorDe(new ErrorDominio(decision.codigo)), sesion: datos });
        return responder(200, datos);
      }

      for (const op of OPERACIONES) {
        const m = op.metodo === metodo && op.patron.exec(ruta);
        if (!m) continue;
        const decision = authorize(sesion, op.pagina ? { pagina: op.pagina } : { operacion: op.operacion });
        if (decision.entrar) return responder(401, { entrar: true });
        if (decision.cambiar) return responder(403, { cambiar: true });
        if (!decision.ok) return responder(ESTADO[decision.codigo], errorDe(new ErrorDominio(decision.codigo)));
        return responder(200, await op.ejecutar(app, { sesion, cuerpo, consulta, parametros: m.slice(1) }));
      }

      return responder(404, { error: { codigo: 'E_NO_ENCONTRADO', mensaje: 'No encontrado' } });
    } catch (e) {
      if (e instanceof ErrorDominio) return responder(ESTADO[e.codigo] ?? 400, errorDe(e));
      console.error('error interno', e?.message);
      return responder(500, { error: { codigo: 'E_INTERNO', mensaje: 'Ha ocurrido un error. Inténtalo de nuevo' } });
    }
  };
}
