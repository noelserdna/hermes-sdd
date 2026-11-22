// Plantilla del arnés: NO la cambies (el arnés comprueba que sigue igual). Es el contrato entre los tests y la
// aceptación: cada criterio se enseña de dos maneras a la vez, lo que se DICE (narrar: rótulo en pantalla y voz en off)
// y lo que se VE (captura: sus textos «Se ve:» comprobados en la app, sin contar el rótulo).
//
//   import { test, expect, narrar, captura } from './fixtures/evidence.js';
//   test('AC-002-01 lucia reserva el casco y ve «Reserva creada…»', async ({ page }, testInfo) => {
//     await narrar(page, testInfo, 'Lucía entra en Material y reserva el casco del 11 al 13 de diciembre');
//     ...acciones y expect sobre la página...
//     await narrar(page, testInfo, 'Criterio: la app confirma la reserva con el material y las fechas', { criterio: 'AC-002-01' });
//     await captura(page, testInfo, 'AC-002-01', { ve: ['Reserva creada: Casco del 2026-12-11 al 2026-12-13'] });
//   });
import { test as base, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { evidenceDir } from '../../../playwright.config.js';

const ROTULO = '__sdd_rotulo';
const estado = new Map();   // testId → { t0, narraciones: [{t, texto, criterio}] }
const de = (testInfo) => estado.get(testInfo.testId) ?? estado.set(testInfo.testId, { t0: Date.now(), narraciones: [] }).get(testInfo.testId);

async function rotulo(page, texto) {
  await page.evaluate(([id, tx]) => {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id; el.setAttribute('role', 'note'); el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, { position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: '2147483647',
        padding: '12px 20px', background: 'rgba(15,23,42,.86)', color: '#fff', textAlign: 'center',
        font: '600 20px/1.35 system-ui, -apple-system, Segoe UI, sans-serif', pointerEvents: 'none' });
      document.body.appendChild(el);
    }
    el.textContent = tx;
    el.style.display = tx ? 'block' : 'none';
  }, [ROTULO, texto]);
}

/** El criterio que demuestra un test, en el guion de la demo (.sdd/demo/GUION-FASE-N.json, que escribe el arnés): por su
 *  id de escenario (AC-NNN-NN) o por «REQ-… ACn» en el título; primero el guion de la FASE en curso. */
function criterioDelGuion(titulo) {
  const ac = titulo.match(/AC-\d{3}-\d{2}/)?.[0];
  const ra = titulo.match(/(REQ-[A-Z]+-\d+)[\s-]+AC(\d+)/);
  if (!ac && !ra) return null;
  let ficheros = [];
  try { ficheros = readdirSync(path.join('.sdd', 'demo')).filter((f) => /^GUION-FASE-.+\.json$/.test(f)); } catch { return null; }
  const actual = `GUION-FASE-${process.env.SDD_FASE}.json`;
  for (const f of ficheros.sort((a, b) => (b === actual) - (a === actual))) {
    try {
      const c = JSON.parse(readFileSync(path.join('.sdd', 'demo', f), 'utf8')).criterios
        ?.find((x) => x.presentacion && ((ac && x.id === ac) || (ra && x.req === ra[1] && String(x.ac) === ra[2])));
      if (c) return c;
    } catch { /* guion ilegible: sin presentación */ }
  }
  return null;
}

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/**
 * Cómo abre el vídeo de un criterio: una cartela a pantalla completa con el requisito, lo que pide, sus criterios de
 * aceptación (marcado el que se demuestra) y ese criterio en Dado / Cuando / Entonces; la voz lo lee y después viene la
 * demostración en vivo. Lo pone el arnés antes de que empiece el test, con el texto del guion: el test no lo escribe.
 */
async function presentar(page, testInfo) {
  const c = criterioDelGuion(testInfo.title);
  if (!c) return;
  const p = c.presentacion;
  await page.setContent(`<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
    body{margin:0;min-height:100vh;box-sizing:border-box;padding:28px 44px;background:#0f172a;color:#f8fafc;font:400 17px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
    .id{font:600 14px/1 ui-monospace,Menlo,monospace;letter-spacing:.1em;color:#fbbf24}
    h1{font-size:28px;line-height:1.15;margin:8px 0 6px} .pide{color:#cbd5e1;margin:0 0 14px;max-width:70ch}
    h2{font:600 13px/1 ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin:14px 0 8px}
    ol{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 24px}
    li{color:#94a3b8;font-size:15px} li.actual{color:#fff;font-weight:700} li.actual::after{content:"  ◀ este vídeo";color:#fbbf24;font-weight:600}
    dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 14px;background:#1e293b;border-left:4px solid #fbbf24;border-radius:6px;padding:12px 16px}
    dt{font-weight:700;color:#fbbf24} dd{margin:0} .nv{color:#93c5fd}
  </style></head><body data-sdd-presentacion="${esc(c.id)}">
    <div class="id">REQUISITO ${esc(p.requisito)}</div><h1>${esc(p.titulo)}</h1>
    ${p.para_el_cliente ? `<p class="pide">${esc(p.para_el_cliente)}</p>` : ''}
    <h2>Criterios de aceptación (${p.total})</h2>
    <ol>${p.criterios.map((x) => `<li class="${x.actual ? 'actual' : ''}">${x.n}. ${esc(x.titulo)}</li>`).join('')}</ol>
    <h2>Criterio ${p.n} de ${p.total} · ${esc(c.id)}</h2>
    <dl>${p.pasos.length ? p.pasos.map((x) => `<dt>${esc(x.k)}</dt><dd>${esc(x.texto)}</dd>`).join('') : `<dt>Se demuestra</dt><dd>${esc(c.frase)}</dd>`}
    ${p.no_visible ? `<dt class="nv">No se ve</dt><dd class="nv">${esc(p.no_visible)}</dd>` : ''}</dl>
  </body></html>`);
  const s = de(testInfo);
  s.narraciones.push({ t: (Date.now() - s.t0) / 1000, texto: `Requisito ${p.requisito}: ${p.titulo}. Criterio ${p.n} de ${p.total}.`, voz: p.voz, presentacion: c.id });
  await page.waitForTimeout(400);
}

/**
 * Lo que se dice: un rótulo en pantalla y una entrada de la locución del vídeo (la voz se pone después, con
 * `sdd demo narrate`). `criterio`: el id del criterio que esta frase anuncia (AC-NNN-NN o REQ-F-NNN-ACn); su
 * captura va después. No espera a que se lea: el test sigue a su velocidad y es `sdd demo narrate` quien congela la
 * imagen en el vídeo lo que haga falta para que quepa la voz (material-montana3: las esperas eran más de la mitad de
 * cada suite e2e, y la suite se pasa muchas veces por FASE). Solo deja que el rótulo llegue a pintarse.
 */
export async function narrar(page, testInfo, texto, { criterio = null } = {}) {
  const s = de(testInfo);
  await rotulo(page, texto);
  s.narraciones.push({ t: (Date.now() - s.t0) / 1000, texto, ...(criterio ? { criterio } : {}) });
  await page.waitForTimeout(200);
}

/**
 * Lo que se ve: comprueba en la app (con el rótulo oculto: el rótulo no cuenta) cada texto «Se ve:» del criterio,
 * vuelve a mostrar el rótulo y hace la captura, con su ficha: evidencias/FASE-N/<id>.png y <id>.json.
 */
export async function captura(page, testInfo, criterion, { ve = [] } = {}) {
  await page.evaluate((id) => { const el = document.getElementById(id); if (el) el.dataset.oculto = el.style.display, el.style.display = 'none'; }, ROTULO);
  for (const texto of ve) await expect(page.getByText(texto, { exact: false }).first()).toBeVisible();
  await page.evaluate((id) => { const el = document.getElementById(id); if (el) el.style.display = el.dataset.oculto || 'block'; }, ROTULO);
  mkdirSync(evidenceDir, { recursive: true });
  const id = criterion.replace(/\s+/g, '-');
  const file = path.join(evidenceDir, `${id}.png`);
  await page.screenshot({ path: file });
  const sha256 = 'sha256:' + createHash('sha256').update(readFileSync(file)).digest('hex');
  const narrado = de(testInfo).narraciones.filter((n) => n.criterio === criterion).at(-1)?.texto ?? null;
  writeFileSync(path.join(evidenceDir, `${id}.json`), JSON.stringify({
    criterio: criterion, test: testInfo.titlePath.slice(1).join(' › '), titulo: testInfo.title,
    ve, narrado, url: page.url(), imagen: `${id}.png`, sha256, at: new Date().toISOString(),
  }, null, 1));
  await testInfo.attach(criterion, { path: file, contentType: 'image/png' });
}
export const captureCriterion = captura;

/** Un vídeo por test, con el nombre de su workflow (WF-NNN del título, o test.use({ videoId })) y su locución. */
export const test = base.extend({
  videoId: [undefined, { option: true }],
  page: async ({ page, videoId }, use, testInfo) => {
    de(testInfo).t0 = Date.now();
    await presentar(page, testInfo);
    await use(page);
    const video = page.video();
    const s = estado.get(testInfo.testId);
    estado.delete(testInfo.testId);
    if (!video) return;
    await page.close();
    const wf = videoId ?? testInfo.title.match(/WF-\d{3}/)?.[0] ?? (process.env.SDD_FASE ? `FASE-${process.env.SDD_FASE}` : 'SIN-FASE');
    const id = `${wf}-${testInfo.title.slice(0, 40).replace(/[^A-Za-z0-9-]+/g, '-')}`;
    mkdirSync(evidenceDir, { recursive: true });
    const file = path.join(evidenceDir, `${id}.webm`);
    await video.saveAs(file);
    if (s?.narraciones.length)
      writeFileSync(path.join(evidenceDir, `${id}.narracion.json`), JSON.stringify({
        video: `${id}.webm`, test: testInfo.titlePath.slice(1).join(' › '), titulo: testInfo.title, narraciones: s.narraciones,
      }, null, 1));
    await testInfo.attach(id, { path: file, contentType: 'video/webm' });
  },
});
export { expect };
