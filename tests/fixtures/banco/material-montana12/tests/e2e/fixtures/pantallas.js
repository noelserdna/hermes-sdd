// Ayudas de los recorridos que enseñan la pantalla de dos personas (FASE-4 en adelante). Los avisos son de quien hizo la acción: se
// borran al salir y no pasan a otra sesión. Un criterio que habla de dos personas (el encargado y el socio) se enseña, pues, con las
// pantallas que cada una vio, una al lado de la otra, en una sola captura con todo su «Se ve».
import { expect, captura as capturarPantalla } from './evidence.js';

/** La captura prueba lo que se ve: cada texto de `ve` tiene que estar dentro de la pantalla capturada, no solo en la página. */
export async function captura(page, testInfo, criterio, { ve = [] } = {}) {
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: 1280, height: Math.max(720, alto + 110) });   // + la locución, que tapa el pie
  for (const texto of ve) await expect(page.getByText(texto, { exact: false }).first()).toBeInViewport({ ratio: 1 });
  await capturarPantalla(page, testInfo, criterio, { ve });
}

/** Lo que una persona tiene en pantalla ahora: su DOM (sin el rótulo de la locución) y los estilos de la web, tal cual. */
export async function instantanea(page, quien) {
  return page.evaluate((q) => {
    const copia = document.body.cloneNode(true);
    copia.querySelector('#__sdd_rotulo')?.remove();
    const css = [...document.styleSheets].map((h) => { try { return [...h.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
    return { quien: q, html: copia.innerHTML, css };
  }, quien);
}

/** Las pantallas de varias personas juntas, cada una con su nombre, para una sola captura. */
export async function pantallasJuntas(page, fotos) {
  const columnas = `<div class="personas" style="display:grid;grid-template-columns:repeat(${fotos.length},1fr);gap:16px;padding:12px">${
    fotos.map((f) => `<section class="persona" style="border:2px solid #94a3b8;min-width:0"><h2 style="margin:0;padding:6px 12px;background:#e2e8f0">${f.quien}</h2>${f.html}</section>`).join('')}</div>`;
  await page.setContent(`<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${fotos[0].css}</style></head><body>${columnas}</body></html>`);
}
