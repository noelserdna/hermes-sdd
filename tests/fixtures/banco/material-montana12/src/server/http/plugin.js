// Plugin de Vite: monta /api en `vite` y en `vite preview` con el mismo manejador que usan los tests (D-PA-008).
import { crearApp } from '../app.js';
import { crearManejador } from './rutas.js';
import { runPurge } from '../servicios/depurar.js';

const CADA_24_H = 24 * 3600 * 1000;

/**
 * RN-021: la depuración corre al arrancar y cada 24 horas, con el día del reloj de la app. Un fallo se anota (sin datos) y no tumba el servidor:
 * se reintenta en la siguiente vuelta (UC-019, postcondición de fallo).
 */
export function programarDepuracion(app, { depurar = runPurge, cada = CADA_24_H } = {}) {
  const ejecutar = async () => {
    try { await depurar(app, { hoy: app.reloj.hoy() }); } catch (e) { console.error('depuración fallida', e?.codigo ?? e?.message); }
  };
  ejecutar();
  const temporizador = setInterval(ejecutar, cada);
  temporizador.unref?.();
  return temporizador;
}

function leerCuerpo(req) {
  return new Promise((resolver) => {
    const trozos = [];
    req.on('data', (t) => trozos.push(t));
    req.on('end', () => {
      try { resolver(trozos.length ? JSON.parse(Buffer.concat(trozos).toString('utf8')) : {}); } catch { resolver({}); }
    });
  });
}

export function montarApi(middlewares, { env = process.env } = {}) {
  const app = crearApp({ env });
  const manejar = crearManejador(app);
  programarDepuracion(app);
  middlewares.use('/api', async (req, res) => {
    const t0 = Date.now();
    const url = new URL(req.url, 'http://local');
    const ruta = `/api${url.pathname === '/' ? '' : url.pathname}`;
    const r = await manejar({
      metodo: req.method,
      ruta,
      consulta: Object.fromEntries(url.searchParams),
      cuerpo: ['POST', 'PUT'].includes(req.method) ? await leerCuerpo(req) : {},
      cookie: req.headers.cookie,
    });
    res.statusCode = r.estado;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    for (const [k, v] of Object.entries(r.cabeceras)) res.setHeader(k, v);
    res.end(JSON.stringify(r.cuerpo));
    // Una línea por petición, sin contraseñas ni correos (observabilidad del diseño técnico §11)
    console.warn(JSON.stringify({ metodo: req.method, ruta, estado: r.estado, ms: Date.now() - t0 }));
  });
}
