import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../../src/server/http.js';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { crearReloj } from '../../../src/domain/reloj.js';
import { error } from '../../../src/domain/errores.js';

const servidores = [];
afterEach(async () => { while (servidores.length) await new Promise((r) => servidores.pop().close(r)); });

async function arrancar(rutasExtra = [], registro = []) {
  const manejador = crearManejador({
    almacen: crearAlmacenMemoria(), reloj: crearReloj({ env: { CLOCK_FIXED: '2026-12-01' } }), env: {},
    rutasExtra, registrar: (linea) => registro.push(linea),
  });
  const servidor = http.createServer((req, res) => manejador(req, res, () => { res.statusCode = 404; res.end('fuera de la API'); }));
  servidores.push(servidor);
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${servidor.address().port}`;
}

describe('servidor HTTP', () => {
  it('GET /api/salud devuelve 200 { ok: true }', async () => {
    const base = await arrancar();
    const respuesta = await fetch(`${base}/api/salud`);
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ ok: true });
  });

  it('lo que no es /api/ pasa al siguiente middleware (la SPA) y una ruta de API desconocida es 404', async () => {
    const base = await arrancar();
    expect(await (await fetch(`${base}/entrar`)).text()).toBe('fuera de la API');
    expect((await fetch(`${base}/api/no-existe`)).status).toBe(404);
  });

  it('una petición POST con Origin de otro sitio se rechaza', async () => {
    let llamadas = 0;
    const base = await arrancar([{ metodo: 'POST', ruta: '/api/prueba', publica: true, ejecutar: async () => { llamadas += 1; return { estado: 200, cuerpo: { hecho: true } }; } }]);
    const ajeno = await fetch(`${base}/api/prueba`, { method: 'POST', headers: { Origin: 'https://malo.example', 'content-type': 'application/json' }, body: '{}' });
    expect(ajeno.status).toBe(403);
    expect((await ajeno.json()).error).toBe('E_SIN_PERMISO');
    expect(llamadas).toBe(0);
    const propio = await fetch(`${base}/api/prueba`, { method: 'POST', headers: { Origin: base, 'content-type': 'application/json' }, body: '{}' });
    expect(propio.status).toBe(200);
    expect(llamadas).toBe(1);
  });

  it('un error de dominio sale como { error, mensaje } con el HTTP de su familia; E_ALMACEN_NO_DISPONIBLE sale como 503', async () => {
    const lanza = (codigo, params) => ({ metodo: 'GET', ruta: `/api/${codigo}`, publica: true, ejecutar: async () => { throw error(codigo, params); } });
    const codigos = [['E_CREDENCIALES_INVALIDAS', 401], ['E_CUENTA_BLOQUEADA', 423], ['E_SIN_PERMISO', 403], ['E_FECHA_PASADA', 422],
      ['E_SIN_UNIDADES_LIBRES', 409], ['E_UNIDAD_NO_ENCONTRADA', 404], ['E_ALMACEN_NO_DISPONIBLE', 503]];
    const base = await arrancar(codigos.map(([c]) => lanza(c, { material: 'Tienda' })));
    for (const [codigo, estado] of codigos) {
      const respuesta = await fetch(`${base}/api/${codigo}`);
      expect(respuesta.status).toBe(estado);
      const cuerpo = await respuesta.json();
      expect(cuerpo.error).toBe(codigo);
      expect(typeof cuerpo.mensaje).toBe('string');
    }
    const bloqueada = await (await fetch(`${base}/api/E_SIN_UNIDADES_LIBRES`)).json();
    expect(bloqueada.mensaje).toBe('No quedan unidades libres de Tienda esas fechas');
  });

  it('una línea JSON por petición en el log, sin cuerpo ni credenciales', async () => {
    const registro = [];
    const base = await arrancar([{ metodo: 'POST', ruta: '/api/prueba', publica: true, ejecutar: async () => ({ estado: 200, cuerpo: { ok: true } }) }], registro);
    await fetch(`${base}/api/prueba?clave=secreta`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'sid=abc123' }, body: JSON.stringify({ contrasena: 'Cumbre2026' }) });
    expect(registro).toHaveLength(1);
    const linea = JSON.parse(registro[0]);
    expect(linea).toMatchObject({ metodo: 'POST', ruta: '/api/prueba', estado: 200 });
    for (const secreto of ['Cumbre2026', 'abc123', 'secreta']) expect(registro[0]).not.toContain(secreto);
  });

  it('un cuerpo que no es JSON se rechaza con 400', async () => {
    const base = await arrancar([{ metodo: 'POST', ruta: '/api/prueba', publica: true, ejecutar: async () => ({ estado: 200, cuerpo: {} }) }]);
    const respuesta = await fetch(`${base}/api/prueba`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{ roto' });
    expect(respuesta.status).toBe(400);
  });

  it('el mismo plugin se registra en server y en preview', async () => {
    const { plugin } = await import('../../../src/server/vite-plugin.js');
    const registrados = [];
    const servidor = { middlewares: { use: (fn) => registrados.push(fn) } };
    const complemento = plugin({ env: {} });
    complemento.configureServer(servidor);
    complemento.configurePreviewServer(servidor);
    expect(registrados).toHaveLength(2);
    expect(typeof registrados[0]).toBe('function');
  });
});
