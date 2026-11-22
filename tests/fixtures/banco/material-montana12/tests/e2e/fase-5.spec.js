// Recorrido de FASE-5 por la ruta del usuario: la junta busca a un socio y ve su historial sin poder cambiar nada (UC-018). Un test por criterio con
// pantalla (REQ-F-009 AC1..AC4), con su propio GIVEN, su captura y su locución (.sdd/demo/GUION-FASE-5.md), y un recorrido de la depuración
// (UC-019, demo pasos 7 y 8) en un vídeo FASE-5. Los datos y las respuestas que la pantalla no distingue (AC-018-05, AC-018-06, REQ-NF-001,
// REQ-NF-003, AC-019-01..03) van en tests/integration; los literales de la página, en tests/unit/ui.
// La junta es Elena; en la demo (node demo/sembrar.mjs fase-5) Pablo es el encargado.
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { test, expect, narrar } from './fixtures/evidence.js';
import { captura } from './fixtures/pantallas.js';
import { sembrar, semillaFase5 } from '../../demo/sembrar.mjs';
import { crearApp } from '../../src/server/app.js';
import { crearAlmacenJson } from '../../src/server/store/almacen-json.js';
import { runPurge } from '../../src/server/servicios/depurar.js';

const DATOS = path.resolve('data/e2e/datos.json');
const RELOJ = path.resolve('data/e2e/reloj.txt');
const HOY_FICHERO = path.resolve('data/e2e/hoy.txt');
const HOY = '2026-11-22';
const ELENA = ['elena@club.test', 'Junta2026!'];

/** Datos nuevos para el test: la semilla de la demo de FASE-5 (o la que pida el GIVEN) y «hoy» = 2026-11-22. */
async function reiniciar(semilla = semillaFase5(HOY)) {
  mkdirSync(path.dirname(DATOS), { recursive: true });
  rmSync(RELOJ, { force: true });
  rmSync(HOY_FICHERO, { force: true });
  await sembrar(DATOS, { ...semilla, hoy: HOY });
}
/** La semilla de la demo sin los préstamos ni multas de Lucía: Marta (sin nada) y Lucía quedan como socias sin historial. */
const sinHistorial = () => ({ ...semillaFase5(HOY), reservas: [], multas: [] });

async function entrarComoJunta(page) {
  await page.goto('/entrar');
  await page.getByLabel('Correo').fill(ELENA[0]);
  await page.getByLabel('Contraseña').fill(ELENA[1]);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Historial del socio', level: 1 })).toBeVisible();
}
async function buscar(page, texto) {
  await page.getByLabel('Buscar por nombre o correo').fill(texto);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
}
const historial = (page) => page.locator('.historial');

test.describe('FASE-5 · Historial del socio para la junta (REQ-F-009)', () => {
  test('AC-018-01 REQ-F-009 AC1 Lucía devolvió 2 × Casco del 2026-12-05 al 2026-12-07 el 2026-12-09 y pagó su multa de 4 €: la junta busca «lucia» y ve su préstamo y su multa', async ({ page }, testInfo) => {
    await reiniciar();
    await narrar(page, testInfo, 'Elena, de la junta, entra y se encuentra en Historial del socio');
    await entrarComoJunta(page);
    await narrar(page, testInfo, 'Escribe «lucia» en «Buscar por nombre o correo» y pulsa Buscar');
    await buscar(page, 'lucia');
    // REQ-F-009 AC1: "GIVEN Lucía has a loan of 2 × Casco 2026-12-05..2026-12-07 returned on 2026-12-09 and a fine of 4 € paid WHEN a junta member searches "lucia" THEN the user sees "2 × Casco del 2026-12-05 al 2026-12-07 — devuelto el 2026-12-09" and "Multa de 4 € — Pagada""
    await expect(historial(page).locator('h2')).toHaveText('Lucía Gil (lucia@club.test)');
    await expect(historial(page).locator('.prestamos li')).toHaveText('2 × Casco del 2026-12-05 al 2026-12-07 — devuelto el 2026-12-09');
    await expect(historial(page).locator('.multas-historial li')).toHaveText('Multa de 4 € — Pagada');
    await narrar(page, testInfo, 'Historial de un socio para la junta. En Historial del socio (ejemplo con datos: "Multa de 4 € — Pagada") se ve «2 × Casco del 2026-12-05 al 2026-12-07 — devuelto el 2026-12-09» y «Multa de 4 € — Pagada»: el préstamo de Lucía y su multa pagada.', { criterio: 'AC-018-01' });
    await captura(page, testInfo, 'AC-018-01', { ve: ['2 × Casco del 2026-12-05 al 2026-12-07 — devuelto el 2026-12-09', 'Multa de 4 € — Pagada'] });
  });

  test('AC-018-02 REQ-F-009 AC2 Marta no tiene préstamos ni multas: la junta busca «marta» y ve «Sin préstamos ni multas»', async ({ page }, testInfo) => {
    await reiniciar(sinHistorial());
    await narrar(page, testInfo, 'Elena, de la junta, entra y se encuentra en Historial del socio');
    await entrarComoJunta(page);
    await narrar(page, testInfo, 'Escribe «marta» en «Buscar por nombre o correo» y pulsa Buscar');
    await buscar(page, 'marta');
    // REQ-F-009 AC2: "GIVEN a socio with no loans WHEN the junta opens their history THEN the user sees "Sin préstamos ni multas""
    await expect(historial(page).locator('h2')).toHaveText('Marta Ruiz (marta@club.test)');
    await expect(historial(page).locator('.vacio')).toHaveText('Sin préstamos ni multas');
    await narrar(page, testInfo, 'Historial de un socio para la junta. En Historial del socio se ve «Sin préstamos ni multas»: Marta no tiene nada.', { criterio: 'AC-018-02' });
    await captura(page, testInfo, 'AC-018-02', { ve: ['Sin préstamos ni multas'] });
  });

  test('AC-018-03 REQ-F-009 AC3 la junta busca «zzz»: ve «Ningún socio coincide»', async ({ page }, testInfo) => {
    await reiniciar();
    await narrar(page, testInfo, 'Elena, de la junta, entra y se encuentra en Historial del socio');
    await entrarComoJunta(page);
    await narrar(page, testInfo, 'Escribe «zzz» en «Buscar por nombre o correo» y pulsa Buscar');
    await buscar(page, 'zzz');
    // REQ-F-009 AC3: "GIVEN the junta WHEN looking for "zzz" THEN the user sees "Ningún socio coincide""
    await expect(page.getByRole('alert')).toHaveText('Ningún socio coincide');
    await expect(historial(page)).toHaveCount(0);
    await narrar(page, testInfo, 'Historial de un socio para la junta. En Historial del socio se ve «Ningún socio coincide»: no se muestra ningún historial.', { criterio: 'AC-018-03' });
    await captura(page, testInfo, 'AC-018-03', { ve: ['Ningún socio coincide'] });
  });

  test('AC-018-04 REQ-F-009 AC4 la junta ve el historial de Lucía y busca cualquier botón: no hay «Entregar», «Devolver», «Marcar pagada» ni «Cancelar»', async ({ page }, testInfo) => {
    await reiniciar();
    await narrar(page, testInfo, 'Elena, de la junta, entra y se encuentra en Historial del socio');
    await entrarComoJunta(page);
    await narrar(page, testInfo, 'Busca «lucia» y se muestra su historial');
    await buscar(page, 'lucia');
    await expect(historial(page).locator('h2')).toHaveText('Lucía Gil (lucia@club.test)');
    // REQ-F-009 AC4: "GIVEN the junta views a history WHEN they look for any button THEN there is no "Entregar", "Devolver", "Marcar pagada" or "Cancelar""
    for (const accion of ['Entregar', 'Devolver', 'Marcar pagada', 'Cancelar']) {
      await expect(page.getByRole('button', { name: accion })).toHaveCount(0);
    }
    await expect(page.getByRole('heading', { name: 'Historial del socio', level: 1 })).toBeVisible();
    await expect(page.locator('.solo-lectura')).toHaveText('Solo lectura: aquí no se puede Entregar, Devolver, Marcar pagada ni Cancelar');
    await narrar(page, testInfo, 'Historial de un socio para la junta. Se ve «Historial del socio», «Entregar», «Devolver», «Marcar pagada» y «Cancelar» solo como palabras de la nota de solo lectura: no hay ningún botón con esos nombres y la junta únicamente puede mirar.', { criterio: 'AC-018-04' });
    await captura(page, testInfo, 'AC-018-04', { ve: ['Historial del socio', 'Entregar', 'Devolver', 'Marcar pagada', 'Cancelar'] });
  });
});

test.describe('FASE-5 · Depuración del historial antiguo (UC-019)', () => {
  test('FASE-5 recorrido de la depuración: con hoy = 2026-11-22 la junta ve a Marta con sus dos préstamos y, tras depurar dos veces, solo el de 2025-01-10', async ({ page }, testInfo) => {
    await reiniciar();
    const prestamos = page.locator('.historial .prestamos li');
    const depurar = async () => runPurge(crearApp({ store: crearAlmacenJson(DATOS), env: { MM_HOY: HOY } }), { hoy: HOY });
    await narrar(page, testInfo, 'Elena, de la junta, entra y busca a Marta, que tiene dos préstamos devueltos');
    await entrarComoJunta(page);
    await buscar(page, 'marta');
    await expect(prestamos).toHaveText(['1 × Casco del 2023-10-28 al 2023-11-01 — devuelto el 2023-11-01', '1 × Casco del 2025-01-08 al 2025-01-10 — devuelto el 2025-01-10']);
    await narrar(page, testInfo, 'Hoy es 22 de noviembre de 2026 y el sistema lanza la depuración: borra lo cerrado hace más de tres años');
    expect(await depurar()).toMatchObject({ deletedReservations: 1, deletedFines: 0 });
    await buscar(page, 'marta');
    await expect(prestamos).toHaveText(['1 × Casco del 2025-01-08 al 2025-01-10 — devuelto el 2025-01-10']);
    await narrar(page, testInfo, 'El préstamo que terminó el 1 de noviembre de 2023 ha desaparecido y el de 2025 sigue');
    await narrar(page, testInfo, 'Se lanza la depuración otra vez: no cambia nada');
    expect(await depurar()).toEqual({ deletedReservations: 0, deletedFines: 0, erasedAccounts: 0 });
    await page.reload();
    await buscar(page, 'marta');
    await expect(prestamos).toHaveText(['1 × Casco del 2025-01-08 al 2025-01-10 — devuelto el 2025-01-10']);
    await narrar(page, testInfo, 'Sin cambios: Marta sigue con el préstamo de 2025, también tras recargar la página');
    await captura(page, testInfo, 'FASE-5-depuracion', { ve: ['1 × Casco del 2025-01-08 al 2025-01-10 — devuelto el 2025-01-10'] });
  });
});
