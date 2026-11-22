import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearApp } from '../../src/server/app.js';
import { crearAlmacenJson } from '../../src/server/store/almacen-json.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';
import { crearManejador } from '../../src/server/http/rutas.js';
import { sembrar, semillaFase2 } from '../../demo/sembrar.mjs';

// Medidas de REQ-NF-002 (datos compartidos, SPEC-PERF-001..003) sobre el almacén JSON real, en un fichero temporal.
const SYNC_VISIBILITY_SECONDS = 5;   // spec/VALUE-REGISTRY.md
const HOY = '2026-12-05';
let carpeta, ruta;
const idCookie = (r) => `mm_sesion=${/mm_sesion=([^;]+)/.exec(r.cabeceras['Set-Cookie'])[1]}`;

/** Un servidor nuevo sobre el mismo fichero: sin sesiones, como tras reiniciarlo. */
function arrancar() {
  const app = crearApp({ store: crearAlmacenJson(ruta), reloj: crearRelojManual(`${HOY}T10:00:00Z`) });
  const http = crearManejador(app);
  const entrar = async (correo, contrasena) => idCookie(await http({ metodo: 'POST', ruta: '/api/entrar', cuerpo: { correo, contrasena } }));
  return { app, http, entrar };
}
const LUCIA = ['lucia@club.test', 'Cumbre2026!'];
const PABLO = ['pablo@club.test', 'Piolet2026!'];

beforeEach(async () => {
  carpeta = mkdtempSync(path.join(tmpdir(), 'mm-rend-'));
  ruta = path.join(carpeta, 'datos.json');
  await sembrar(ruta, { hoy: HOY, reservas: [], material: [{ nombre: 'Casco', total: 6 }] });
});
afterEach(() => rmSync(carpeta, { recursive: true, force: true }));

describe('REQ-NF-002 datos compartidos entre dispositivos y reinicios', () => {
  // REQ-NF-002 AC1: "GIVEN Lucía reserves 2 × Casco in one browser WHEN the encargado opens the panel from a different browser THEN he sees her reservation"
  it('REQ-NF-002 AC1 la reserva que hace Lucía desde una sesión sale en el panel de Pablo, en otra, en menos de SYNC_VISIBILITY_SECONDS', async () => {
    const { http, entrar, app } = arrancar();
    const [lucia, pablo] = [await entrar(...LUCIA), await entrar(...PABLO)];
    const material = (await app.store.leer()).material[0];
    const t0 = Date.now();
    const reserva = await http({ metodo: 'POST', ruta: '/api/reservas', cookie: lucia, cuerpo: { materialId: material.id, cantidad: 2, inicio: HOY, fin: '2026-12-07' } });
    expect(reserva.estado).toBe(200);
    const panel = await http({ metodo: 'GET', ruta: '/api/panel', cookie: pablo });
    expect((Date.now() - t0) / 1000).toBeLessThan(SYNC_VISIBILITY_SECONDS);
    expect(panel.cuerpo.porEntregar).toHaveLength(1);
    expect(panel.cuerpo.porEntregar[0]).toMatchObject({ cantidad: 2, material: 'Casco', socio: 'Lucía', inicio: HOY, fin: '2026-12-07' });
  });

  // REQ-NF-002 AC2: "GIVEN the server restarts WHEN a user logs in THEN the reservations made before are still there"
  it('REQ-NF-002 AC2 tras cerrar y volver a abrir el almacén siguen las reservas y los préstamos', async () => {
    const antes = arrancar();
    const [lucia, pablo] = [await antes.entrar(...LUCIA), await antes.entrar(...PABLO)];
    const material = (await antes.app.store.leer()).material[0];
    const { cuerpo: { id } } = await antes.http({ metodo: 'POST', ruta: '/api/reservas', cookie: lucia, cuerpo: { materialId: material.id, cantidad: 2, inicio: HOY, fin: '2026-12-07' } });
    await antes.http({ metodo: 'POST', ruta: `/api/reservas/${id}/entregar`, cookie: pablo, cuerpo: {} });

    const despues = arrancar();   // servidor reiniciado: sesiones nuevas, mismo fichero
    expect(await despues.http({ metodo: 'GET', ruta: '/api/mis-reservas', cookie: lucia })).toMatchObject({ estado: 401 });
    const lucia2 = await despues.entrar(...LUCIA);
    const mias = await despues.http({ metodo: 'GET', ruta: '/api/mis-reservas', cookie: lucia2 });
    expect(mias.cuerpo.reservas).toMatchObject([{ id, cantidad: 2, material: 'Casco', estado: 'Prestada' }]);
    const panel = await despues.http({ metodo: 'GET', ruta: '/api/panel', cookie: await despues.entrar(...PABLO) });
    expect(panel.cuerpo.prestados.map((f) => f.id)).toEqual([id]);
  });
});

describe('demo/sembrar.mjs fase-2', () => {
  it('siembra las reservas de Lucía Gil para hoy y un préstamo vencido hace 3 días', async () => {
    await sembrar(ruta, semillaFase2(HOY));
    const { http, entrar } = arrancar();
    const panel = await http({ metodo: 'GET', ruta: '/api/panel', cookie: await entrar(...PABLO) });
    expect(panel.cuerpo.porEntregar.map((f) => [f.cantidad, f.material, f.socio, f.inicio])).toEqual([[2, 'Casco', 'Lucía Gil', HOY]]);
    expect(panel.cuerpo.prestados.map((f) => [f.socio, f.fin, f.retraso])).toEqual([['Lucía Gil', '2026-12-02', 3]]);
    expect(panel.cuerpo.vuelven.map((f) => [f.socio, f.fin, f.retraso])).toEqual([['Lucía Gil', HOY, 0]]);
  });
});
