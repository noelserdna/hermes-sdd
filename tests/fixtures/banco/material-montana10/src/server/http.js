import { timingSafeEqual } from 'node:crypto';
import { ErrorDominio, error } from '../domain/errores.js';
import { crearReloj } from '../domain/reloj.js';
import { ejecutarTareasDiarias } from './tareas-diarias.js';
import { anadirUnidades, darDeBajaUnidad, listarInventario } from '../domain/inventario.js';
import { reservarMaterial, listarMisReservas, cancelarReserva } from '../domain/reservas.js';
import { entregarReserva, devolverPrestamo, pagarMulta, listarMultas, consultarHistorial, consultarEntregasYDevoluciones } from '../domain/prestamos.js';
import { listarSocios, crearSocio, darDeBajaSocio, restablecerContrasena } from '../domain/socios.js';
import { autenticar as autenticarSesion, rutasAcceso } from './sesiones.js';

// Adaptador HTTP (ADR-DRAFT-002): la API JSON es solo transporte; los casos de uso viven en src/domain.
// Rutas y verbos salen de design/OPERATION-MAPPING.md. Cada ruta: { metodo, ruta, publica?, ejecutar(contexto) }.
// `ejecutar` devuelve { estado, cuerpo?, cookie? } (cookie: { valor } o 'borrar'); un error de dominio lo lanza.
const ESTADO_POR_CLASE = { AuthError: 401, PermissionError: 403, ConflictError: 409, ValidationError: 422, NotFoundError: 404, SystemError: 503 };
const ESTADO_POR_CODIGO = { E_CUENTA_BLOQUEADA: 423 };
const MAX_CUERPO = 100 * 1024;
const NOMBRE_COOKIE = 'sid';

export const estadoDe = (e) => ESTADO_POR_CODIGO[e.codigo] ?? ESTADO_POR_CLASE[e.clase] ?? 500;

export const RUTAS = [
  { metodo: 'GET', ruta: '/api/salud', publica: true, ejecutar: async () => ({ estado: 200, cuerpo: { ok: true } }) },
  ...rutasAcceso,
  // UC-008 Gestionar inventario (API-004-01..03)
  { metodo: 'GET', ruta: '/api/inventario', ejecutar: async ({ almacen, actor }) => ({ estado: 200, cuerpo: await listarInventario({ almacen }, actor) }) },
  { metodo: 'POST', ruta: '/api/inventario/unidades', ejecutar: async ({ almacen, actor, cuerpo }) => ({ estado: 201, cuerpo: await anadirUnidades({ almacen }, actor, cuerpo) }) },
  { metodo: 'POST', ruta: '/api/inventario/unidades/baja', ejecutar: async ({ almacen, actor, cuerpo }) => ({ estado: 200, cuerpo: await darDeBajaUnidad({ almacen }, actor, cuerpo) }) },
  // UC-003 Reservar material (API-002-01, API-002-02)
  {
    metodo: 'POST', ruta: '/api/reservas',
    async ejecutar({ almacen, reloj, actor, cuerpo }) {
      const { reserva, creada } = await reservarMaterial({ almacen, reloj }, actor, cuerpo);
      return { estado: creada ? 201 : 200, cuerpo: reserva };
    },
  },
  { metodo: 'POST', ruta: '/api/reservas/cancelar', ejecutar: async ({ almacen, reloj, actor, cuerpo }) => ({ estado: 200, cuerpo: await cancelarReserva({ almacen, reloj }, actor, cuerpo) }) },
  // UC-005 Entregar reserva (API-003-01)
  { metodo: 'GET', ruta: '/api/entregas-y-devoluciones', ejecutar: async ({ almacen, reloj, actor }) => ({ estado: 200, cuerpo: await consultarEntregasYDevoluciones({ almacen, reloj }, actor) }) },
  { metodo: 'POST', ruta: '/api/prestamos/entregar', ejecutar: async ({ almacen, reloj, actor, cuerpo }) => ({ estado: 200, cuerpo: await entregarReserva({ almacen, reloj }, actor, cuerpo) }) },
  // UC-006 Devolver y multar (API-003-02)
  { metodo: 'POST', ruta: '/api/prestamos/devolver', ejecutar: async ({ almacen, reloj, actor, cuerpo }) => ({ estado: 200, cuerpo: await devolverPrestamo({ almacen, reloj }, actor, cuerpo) }) },
  // UC-007 Pagar multa (API-003-03, API-003-04)
  { metodo: 'GET', ruta: '/api/multas', ejecutar: async ({ almacen, actor }) => ({ estado: 200, cuerpo: await listarMultas({ almacen }, actor) }) },
  { metodo: 'POST', ruta: '/api/multas/pagar', ejecutar: async ({ almacen, reloj, actor, cuerpo }) => ({ estado: 200, cuerpo: await pagarMulta({ almacen, reloj }, actor, cuerpo) }) },
  // UC-010 Consultar historial (API-003-06) y, para su selector, listarSocios (API-001-06)
  { metodo: 'GET', ruta: '/api/historial', ejecutar: async ({ almacen, reloj, actor, consulta }) => ({ estado: 200, cuerpo: await consultarHistorial({ almacen, reloj }, actor, { socioId: Number(consulta.socioId) }) }) },
  { metodo: 'GET', ruta: '/api/socios', ejecutar: async ({ almacen, actor, consulta }) => ({ estado: 200, cuerpo: await listarSocios({ almacen }, actor, { detalle: consulta.detalle === '1' }) }) },
  // UC-002 Gestionar socios (API-001-03)
  { metodo: 'POST', ruta: '/api/socios', ejecutar: async ({ almacen, actor, cuerpo }) => ({ estado: 201, cuerpo: await crearSocio({ almacen }, actor, cuerpo) }) },
  { metodo: 'POST', ruta: '/api/socios/baja', ejecutar: async ({ almacen, actor, cuerpo }) => ({ estado: 200, cuerpo: await darDeBajaSocio({ almacen }, actor, cuerpo) }) },
  { metodo: 'POST', ruta: '/api/socios/restablecer', ejecutar: async ({ almacen, actor, cuerpo }) => { await restablecerContrasena({ almacen }, actor, cuerpo); return { estado: 204 }; } },
  // API-003-07 resolverNoRecogidas: tarea del sistema, solo con la cabecera x-cron-secret (CRON_SECRET)
  {
    metodo: 'POST', ruta: '/api/tareas-diarias', publica: true,
    async ejecutar({ almacen, reloj, env, req }) {
      const esperado = Buffer.from(env.CRON_SECRET ?? '');
      const recibido = Buffer.from(String(req.headers['x-cron-secret'] ?? ''));
      if (!esperado.length || esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) throw error('E_NO_AUTENTICADO');
      return { estado: 200, cuerpo: await ejecutarTareasDiarias({ almacen, reloj }) };
    },
  },
  { metodo: 'GET', ruta: '/api/mis-reservas', ejecutar: async ({ almacen, reloj, actor }) => ({ estado: 200, cuerpo: await listarMisReservas({ almacen, reloj }, actor) }) },
];

function leerCookies(cabecera = '') {
  const cookies = {};
  for (const parte of cabecera.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0) cookies[parte.slice(0, i).trim()] = parte.slice(i + 1).trim();
  }
  return cookies;
}

async function leerCuerpo(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  const trozos = [];
  let total = 0;
  for await (const trozo of req) {
    total += trozo.length;
    if (total > MAX_CUERPO) throw new SyntaxError('cuerpo demasiado grande');
    trozos.push(trozo);
  }
  const texto = Buffer.concat(trozos).toString('utf8');
  if (!texto.trim()) return {};
  const cuerpo = JSON.parse(texto);
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) throw new SyntaxError('el cuerpo debe ser un objeto');
  return cuerpo;
}

function cabeceraCookie(cookie, env) {
  const atributos = ['HttpOnly', 'SameSite=Strict', 'Path=/'];
  if (env.COOKIE_SECURE === '1') atributos.push('Secure');
  if (cookie === 'borrar') return [`${NOMBRE_COOKIE}=`, ...atributos, 'Max-Age=0'].join('; ');
  return [`${NOMBRE_COOKIE}=${cookie.valor}`, ...atributos].join('; ');
}

// Solo pruebas: con CLOCK_FIXED puesto, el almacén puede llevar `relojFijo` («AAAA-MM-DD») para mover el «hoy» del
// servidor entre un caso y otro sin reiniciarlo (la semilla de los e2e lo escribe). Sin CLOCK_FIXED no se consulta.
async function relojDe({ almacen, reloj, env }) {
  if (!env.CLOCK_FIXED) return reloj;
  const { relojFijo } = await almacen.load();
  return relojFijo ? crearReloj({ env: { CLOCK_FIXED: relojFijo } }) : reloj;
}

function origenAjeno(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return false;
  const origen = req.headers.origin;
  if (!origen) return false;
  try { return new URL(origen).host !== req.headers.host; } catch { return true; }
}

export function crearManejador({
  almacen, reloj, env = process.env, rutasExtra = [], registrar = (linea) => process.stdout.write(`${linea}\n`),
  autenticar = autenticarSesion,
}) {
  const rutas = [...RUTAS, ...rutasExtra];

  return async function manejador(req, res, siguiente) {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return siguiente();

    const inicio = Date.now();
    let estado = 500;
    const responder = (codigo, cuerpo, cookie) => {
      estado = codigo;
      const cabeceras = { 'cache-control': 'no-store' };
      if (cookie) cabeceras['set-cookie'] = cabeceraCookie(cookie, env);
      if (codigo === 204) { res.writeHead(codigo, cabeceras); res.end(); return; }
      res.writeHead(codigo, { ...cabeceras, 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(cuerpo));
    };
    const responderError = (e) => responder(estadoDe(e), { error: e.codigo, mensaje: e.mensaje });

    try {
      const ruta = rutas.find((r) => r.metodo === req.method && r.ruta === url.pathname);
      if (!ruta) return responder(404, { error: 'E_NO_ENCONTRADO', mensaje: 'No existe esa dirección' });
      if (origenAjeno(req)) return responderError(error('E_SIN_PERMISO'));
      let cuerpo;
      try { cuerpo = await leerCuerpo(req); } catch { return responder(400, { error: 'E_PETICION_INVALIDA', mensaje: 'La petición no se entiende' }); }
      const sid = leerCookies(req.headers.cookie)[NOMBRE_COOKIE] ?? null;
      const contexto = { almacen, reloj: await relojDe({ almacen, reloj, env }), env, cuerpo, consulta: Object.fromEntries(url.searchParams), sid, actor: null, req };
      if (!ruta.publica) contexto.actor = await autenticar(contexto);
      const resultado = await ruta.ejecutar(contexto);
      return responder(resultado.estado, resultado.cuerpo, resultado.cookie);
    } catch (e) {
      if (e instanceof ErrorDominio) {
        // La cookie de una sesión caducada o inexistente se borra al avisar.
        const borrar = e.codigo === 'E_SESION_CADUCADA' || e.codigo === 'E_NO_AUTENTICADO';
        return responder(estadoDe(e), { error: e.codigo, mensaje: e.mensaje }, borrar ? 'borrar' : undefined);
      }
      return responder(500, { error: 'E_INTERNO', mensaje: error('E_ALMACEN_NO_DISPONIBLE').mensaje });
    } finally {
      registrar(JSON.stringify({ t: new Date().toISOString(), metodo: req.method, ruta: url.pathname, estado, ms: Date.now() - inicio }));
    }
  };
}
