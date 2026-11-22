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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    await use(page);
    const video = page.video();
    const s = estado.get(testInfo.testId);
    estado.delete(testInfo.testId);
    if (!video) return;
    await page.close();
    const wf = videoId ?? testInfo.title.match(/WF-\d{3}/)?.[0] ?? `FASE-${process.env.SDD_FASE ?? '0'}`;
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
