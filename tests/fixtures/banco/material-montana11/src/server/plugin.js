// Plugin de Vite: sirve la API del club en /api/* (ADR-DRAFT-001). Se registra en el servidor de desarrollo y en
// el de `vite preview`, que es el que usa `npm start` (la API nunca se sirve solo con el servidor de desarrollo).
// Transporte según design/OPERATION-MAPPING.md: RPC JSON, `GET` para lecturas y `POST` con JSON para escrituras.
import path from 'node:path';
import { crearStore } from './store.js';
import { crearReloj } from '../domain/reloj.js';
import { ErrorDominio } from '../domain/errores.js';
import { iniciarSesion, cerrarSesion, comprobarSesion, crearSocio, listarSocios, restablecerContrasena, darDeBajaSocio } from '../domain/cuentas.js';
import { listarInventario, anadirMaterial, darDeBajaUnidad } from '../domain/inventario.js';
import { consultarDisponibilidad, reservarMaterial, listarMisReservas, cancelarReserva } from '../domain/reservas.js';
import { listarPrestamosYReservas, entregarReserva, registrarDevolucion, consultarPrestado, consultarHistorialSocio, listarSociosHistorial } from '../domain/prestamos.js';
import { listarMisMultas, listarMultas, marcarMultaPagada } from '../domain/multas.js';
import { purgar } from './purga.js';
import { leerSid, cookieSesion, cookieBorrada } from './sesiones.js';

const MAX_CUERPO = 16 * 1024;

const OPERACIONES = {
  iniciarSesion: { metodo: 'POST', ejecutar: iniciarSesion, alExito: (datos, res) => { res.setHeader('Set-Cookie', cookieSesion(datos.sid)); return { nombre: datos.nombre, rol: datos.rol }; } },
  cerrarSesion: { metodo: 'POST', ejecutar: cerrarSesion, alExito: (datos, res) => { res.setHeader('Set-Cookie', cookieBorrada()); return datos; } },
  comprobarSesion: { metodo: 'GET', ejecutar: comprobarSesion },
  crearSocio: { metodo: 'POST', ejecutar: crearSocio },
  listarSocios: { metodo: 'GET', ejecutar: listarSocios },
  listarInventario: { metodo: 'GET', ejecutar: listarInventario },
  anadirMaterial: { metodo: 'POST', ejecutar: anadirMaterial },
  consultarDisponibilidad: { metodo: 'GET', ejecutar: consultarDisponibilidad },
  reservarMaterial: { metodo: 'POST', ejecutar: reservarMaterial },
  listarMisReservas: { metodo: 'GET', ejecutar: listarMisReservas },
  cancelarReserva: { metodo: 'POST', ejecutar: cancelarReserva },
  listarPrestamosYReservas: { metodo: 'GET', ejecutar: listarPrestamosYReservas },
  entregarReserva: { metodo: 'POST', ejecutar: entregarReserva },
  registrarDevolucion: { metodo: 'POST', ejecutar: registrarDevolucion },
  listarMisMultas: { metodo: 'GET', ejecutar: listarMisMultas },
  listarMultas: { metodo: 'GET', ejecutar: listarMultas },
  marcarMultaPagada: { metodo: 'POST', ejecutar: marcarMultaPagada },
  restablecerContrasena: { metodo: 'POST', ejecutar: restablecerContrasena },
  darDeBajaSocio: { metodo: 'POST', ejecutar: darDeBajaSocio },
  darDeBajaUnidad: { metodo: 'POST', ejecutar: darDeBajaUnidad },
  consultarPrestado: { metodo: 'GET', ejecutar: consultarPrestado },
  consultarHistorialSocio: { metodo: 'GET', ejecutar: (ctx, datos) => consultarHistorialSocio(ctx, { socioId: Number(datos.socioId ?? NaN) }) },
  listarSociosHistorial: { metodo: 'GET', ejecutar: listarSociosHistorial },
};

const ESTADOS = {
  E_DATOS_INVALIDOS: 422, E_CONTRASENA_CORTA: 422, E_CANTIDAD_INVALIDA: 422, E_MATERIAL_INVALIDO: 422,
  E_FECHA_PASADA: 422, E_FECHAS_INVERTIDAS: 422, E_RESERVA_MUY_LARGA: 422,
  E_SIN_UNIDADES: 409, E_MULTA_PENDIENTE: 409, E_CANCELACION_TARDIA: 409, E_ESTADO_INVALIDO: 409, E_ENTREGA_ANTICIPADA: 409,
  E_RESERVA_NO_ENCONTRADA: 404, E_MULTA_NO_ENCONTRADA: 404,
  E_NO_AUTENTICADO: 401, E_SESION_CADUCADA: 401, E_CREDENCIALES_INVALIDAS: 401,
  E_CUENTA_BLOQUEADA: 429,
  E_ACCESO_NO_PERMITIDO: 403,
  E_SOCIO_NO_ENCONTRADO: 404, E_SOCIO_CON_MATERIAL: 409, E_UNIDAD_NO_ENCONTRADA: 404, E_UNIDAD_PRESTADA: 409,
  E_CORREO_DUPLICADO: 409,
  E_ALMACEN_NO_DISPONIBLE: 503,
};

function responder(res, estado, cuerpo) {
  res.statusCode = estado;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(cuerpo));
}

const error = (codigo, mensaje) => ({ ok: false, codigo, mensaje });

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    const trozos = []; let total = 0; let grande = false;
    req.on('data', (t) => {
      total += t.length;
      if (total > MAX_CUERPO) { grande = true; return; }   // se sigue leyendo para poder responder 413
      trozos.push(t);
    });
    req.on('end', () => {
      if (grande) return reject(Object.assign(new Error('grande'), { estado: 413 }));
      try { resolve(trozos.length ? JSON.parse(Buffer.concat(trozos).toString('utf8')) : {}); } catch { reject(Object.assign(new Error('json'), { estado: 422 })); }
    });
    req.on('error', reject);
  });
}

/**
 * REQ-NF-001 AC2: el servidor de ficheros de Vite serviría `data/almacen.json` a cualquiera. Toda dirección que
 * resuelva dentro del directorio del fichero de datos (por la raíz, por `/@fs/`, codificada o con `..`) se rechaza.
 */
function apuntaAlDirectorioDeDatos(pathname, archivoDatos, raiz) {
  const dir = path.dirname(path.resolve(archivoDatos));
  const dentro = (ruta) => ruta === dir || ruta.startsWith(dir + path.sep);
  let ruta = pathname;
  for (let i = 0; i < 3; i++) {   // decodifica varias veces: %252e también cuenta
    try { ruta = decodeURIComponent(ruta); } catch { return true; }   // dirección ilegible: no se sirve nada
  }
  if (ruta.includes('\0')) return true;
  const limpia = ruta.replaceAll('\\', '/').replace(/\/{2,}/g, '/');   // `//data/x` y `/data//x` son la misma dirección
  // `/@id/` (los módulos de Vite) sirve el fichero con `?import`: se mira también la dirección sin ese prefijo
  const sinPrefijo = limpia.replace(/^\/@id\//, '/').replace(/^\/__x00__/, '/');
  const candidatas = [];
  for (const l of [limpia, sinPrefijo]) {
    candidatas.push(path.resolve(raiz, '.' + path.posix.normalize('/' + l)));
    candidatas.push(path.resolve(l));   // `/@id/ruta/absoluta`
    if (l.startsWith('/@fs/')) candidatas.push(path.resolve('/', '.' + path.posix.normalize(l.slice('/@fs'.length))));
  }
  return candidatas.some((c) => dentro(c));
}

function rechazarDirDatos(req, res, { store, reloj }, log) {
  let autenticado = true;
  try { comprobarSesion({ store, reloj, sid: leerSid(req.headers.cookie) }, {}); } catch { autenticado = false; }
  const c = autenticado ? 'E_ACCESO_NO_PERMITIDO' : 'E_NO_AUTENTICADO';
  const estado = autenticado ? 403 : 401;
  log(JSON.stringify({ t: new Date(reloj.ahora()).toISOString(), op: 'datos', estado, codigo: c }));
  return responder(res, estado, error(c, new ErrorDominio(c).message));
}

/** Manejador de peticiones /api/*. `log` recibe una línea JSON por petición, sin datos personales ni contraseñas. */
export function crearManejador({ store, reloj, archivoDatos, raiz = process.cwd(), log = (l) => process.stdout.write(`${l}\n`) }) {
  return async function manejador(req, res, next) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    // la ruta se lee del texto de la petición, no de `URL`: `//data/x` se interpretaría como un servidor `data`
    const rutaCruda = (req.url ?? '/').replace(/^[a-z]+:\/\/[^/]*/i, '').split(/[?#]/)[0] || '/';
    if (archivoDatos && apuntaAlDirectorioDeDatos(rutaCruda, archivoDatos, raiz)) return rechazarDirDatos(req, res, { store, reloj }, log);
    if (!url.pathname.startsWith('/api/')) return next();
    const nombre = url.pathname.slice('/api/'.length);
    const op = Object.hasOwn(OPERACIONES, nombre) ? OPERACIONES[nombre] : undefined;
    let estado = 200; let codigo;
    try {
      if (!op) { estado = 404; codigo = 'E_NO_ENCONTRADO'; return responder(res, 404, error(codigo, 'No existe esa operación')); }
      if (req.method !== op.metodo) { estado = 405; codigo = 'E_METODO'; res.setHeader('Allow', op.metodo); return responder(res, 405, error(codigo, 'Método no permitido')); }
      let datos = op.metodo === 'GET' ? Object.fromEntries(url.searchParams) : {};
      if (op.metodo === 'POST') {
        if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
          estado = 415; codigo = 'E_DATOS_INVALIDOS';
          return responder(res, 415, error(codigo, 'Revisa los datos del formulario'));
        }
        try { datos = await leerCuerpo(req); } catch (e) {
          estado = e.estado ?? 422; codigo = 'E_DATOS_INVALIDOS';
          return responder(res, estado, error(codigo, 'Revisa los datos del formulario'));
        }
      }
      const resultado = op.ejecutar({ store, reloj, sid: leerSid(req.headers.cookie) }, datos);
      return responder(res, 200, { ok: true, datos: op.alExito ? op.alExito(resultado, res) : resultado });
    } catch (e) {
      const c = e instanceof ErrorDominio ? e.codigo : 'E_ALMACEN_NO_DISPONIBLE';
      codigo = c; estado = ESTADOS[c] ?? 500;
      return responder(res, estado, error(c, new ErrorDominio(c).message));
    } finally {
      log(JSON.stringify({ t: new Date(reloj.ahora()).toISOString(), op: nombre, estado, ...(codigo ? { codigo } : {}) }));
    }
  };
}

/** SPEC-LIM-003: al arrancar se purga lo que supera la retención. Si el almacén falla no se arranca a medias: se avisa y se sigue. */
export function purgarAlArrancar({ store, reloj, log = (l) => process.stdout.write(`${l}\n`) }) {
  try {
    const resumen = purgar(store, reloj.hoy());
    log(JSON.stringify({ t: new Date(reloj.ahora()).toISOString(), op: 'purga', ...resumen }));
    return resumen;
  } catch {
    log(JSON.stringify({ t: new Date(reloj.ahora()).toISOString(), op: 'purga', codigo: 'E_ALMACEN_NO_DISPONIBLE' }));
    return null;
  }
}

function manejadorDeEntorno() {
  const archivo = path.resolve(process.env.DATA_FILE ?? 'data/almacen.json');
  const store = crearStore({ archivo });
  const reloj = crearReloj({ fijo: process.env.CLOCK_FIXED });
  purgarAlArrancar({ store, reloj });
  return crearManejador({ store, reloj, archivoDatos: archivo });
}

export function materialMontana() {
  return {
    name: 'material-montana',
    configureServer(servidor) { servidor.middlewares.use(manejadorDeEntorno()); },
    configurePreviewServer(servidor) { servidor.middlewares.use(manejadorDeEntorno()); },
  };
}
