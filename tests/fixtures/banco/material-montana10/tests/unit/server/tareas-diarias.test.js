import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { crearManejador } from '../../../src/server/http.js';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { crearReloj } from '../../../src/domain/reloj.js';

const servidores = [];
afterEach(async () => { while (servidores.length) await new Promise((r) => servidores.pop().close(r)); });

async function arrancar({ env, inicial }) {
  const almacen = crearAlmacenMemoria(inicial);
  const manejador = crearManejador({ almacen, reloj: crearReloj({ env: { CLOCK_FIXED: '2026-12-01' } }), env, registrar: () => {} });
  const servidor = http.createServer((req, res) => manejador(req, res, () => { res.statusCode = 404; res.end(); }));
  servidores.push(servidor);
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${servidor.address().port}`, almacen };
}
const vencida = { schemaVersion: 1, cuentas: [], unidades: [], multas: [], sesiones: [], reservas: [
  { id: 1, socioId: 1, tipo: 'Piolet', desde: '2026-12-05', hasta: '2026-12-07', estado: 'Reservada', unidadId: null, devueltaEl: null, creadaEl: '2026-11-20T10:00:00.000Z' }] };

describe('POST /api/tareas-diarias (API-003-07)', () => {
  it('API-003-07 sin la cabecera x-cron-secret correcta responde 401 y no cambia nada', async () => {
    const { base, almacen } = await arrancar({ env: { CRON_SECRET: 'secreto-de-prueba', CLOCK_FIXED: '2026-12-01' }, inicial: structuredClone({ ...vencida, relojFijo: '2026-12-08' }) });
    for (const cabeceras of [{}, { 'x-cron-secret': 'otro' }]) {
      const r = await fetch(`${base}/api/tareas-diarias`, { method: 'POST', headers: cabeceras });
      expect(r.status).toBe(401);
    }
    expect((await almacen.load()).reservas[0].estado).toBe('Reservada');
  });

  it('API-003-07 sin CRON_SECRET configurado ninguna petición vale', async () => {
    const { base } = await arrancar({ env: {}, inicial: structuredClone(vencida) });
    expect((await fetch(`${base}/api/tareas-diarias`, { method: 'POST', headers: { 'x-cron-secret': '' } })).status).toBe(401);
    expect((await fetch(`${base}/api/tareas-diarias`, { method: 'POST', headers: { 'x-cron-secret': 'undefined' } })).status).toBe(401);
  });

  it('API-003-07 con el secreto correcto persiste las No recogidas del día del reloj de pruebas y devuelve contadores', async () => {
    const { base, almacen } = await arrancar({ env: { CRON_SECRET: 'secreto-de-prueba', CLOCK_FIXED: '2026-12-01' }, inicial: structuredClone({ ...vencida, relojFijo: '2026-12-08' }) });
    const r = await fetch(`${base}/api/tareas-diarias`, { method: 'POST', headers: { 'x-cron-secret': 'secreto-de-prueba' } });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ noRecogidas: 1 });
    expect((await almacen.load()).reservas[0].estado).toBe('No recogida');
  });
});
