// Recorrido de FASE-2 por la ruta del usuario: el encargado entrega, recibe devoluciones y mira el panel del día. Un test por
// criterio, con su propio GIVEN (actor, fechas y datos del criterio), su captura y su locución (.sdd/demo/GUION-FASE-2.md).
// Las reservas que no se ven (AC-010-04..07, AC-011-05..07), REQ-NF-002 y los errores del contrato van en tests/integration.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { request as pwRequest } from '@playwright/test';
import { test, expect, narrar, captura as capturarPantalla } from './fixtures/evidence.js';
import { captura as capturaJuntas, instantanea, pantallasJuntas } from './fixtures/pantallas.js';
import { sembrar } from '../../demo/sembrar.mjs';

const DATOS = path.resolve('data/e2e/datos.json');
const RELOJ = path.resolve('data/e2e/reloj.txt');
const HOY_FICHERO = path.resolve('data/e2e/hoy.txt');
const URL_BASE = `http://127.0.0.1:${process.env.PORT ?? '5173'}`;

const LUCIA = ['lucia@club.test', 'Cumbre2026!'];
const PABLO = ['pablo@club.test', 'Piolet2026!'];
const ELENA = ['elena@club.test', 'Junta2026!'];
// «Lucía Gil» es como el panel nombra a la socia en los criterios; Pablo es el encargado y Elena la junta
const CUENTAS = [
  { id: 'c-lucia', nombre: 'Lucía Gil', correo: LUCIA[0], contrasena: LUCIA[1], rol: 'socio' },
  { id: 'c-pablo', nombre: 'Pablo', correo: PABLO[0], contrasena: PABLO[1], rol: 'encargado' },
  { id: 'c-elena', nombre: 'Elena', correo: ELENA[0], contrasena: ELENA[1], rol: 'junta' },
];
const CASCO_6 = [{ nombre: 'Casco', total: 6 }];
const CASCO = { socio: LUCIA[0], material: 'Casco', cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' };   // «2 × Casco del 2026-12-05 al 2026-12-07»

/** Datos nuevos para el test y «hoy» = el del GIVEN del criterio (el servidor lo lee del fichero en cada petición). */
async function reiniciar({ hoy, reservas = [] }) {
  mkdirSync(path.dirname(DATOS), { recursive: true });
  rmSync(RELOJ, { force: true });
  await sembrar(DATOS, { hoy, cuentas: CUENTAS, material: CASCO_6, reservas });
  writeFileSync(HOY_FICHERO, hoy);
}
test.afterEach(() => rmSync(HOY_FICHERO, { force: true }));

async function entrar(page, [correo, contrasena], titulo = 'Panel del encargado') {
  await page.goto('/entrar');
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible();
}
const entrarComoPablo = (page) => entrar(page, PABLO);
const fila = (page, texto) => page.getByRole('listitem').filter({ hasText: texto });
const aviso = (page, texto) => page.getByRole('status').filter({ hasText: texto });
const boton = (page, filaTexto, nombre) => fila(page, filaTexto).getByRole('button', { name: nombre, exact: true });

/**
 * Pablo cierra su sesión y Lucía, la socia del préstamo, abre «Mis multas» (FASE-4, observación Q1): se ve lo que ella ve
 * y la pantalla de Pablo tal como estaba, juntas, para una sola captura.
 */
async function luciaAbreMisMultas(page, testInfo) {
  const pantallaPablo = await instantanea(page, 'Pablo, el encargado, en el Panel');
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
  await narrar(page, testInfo, 'Lucía entra con su cuenta y abre Mis multas desde el menú');
  await entrar(page, LUCIA, 'Mis reservas');
  await page.getByRole('navigation').getByRole('link', { name: 'Mis multas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mis multas', level: 1, exact: true })).toBeVisible();
  await expect(page.locator('.lista-multas .vacio')).toHaveText('No tienes multas');
  await pantallasJuntas(page, [pantallaPablo, await instantanea(page, 'Lucía en Mis multas')]);
}

/**
 * La captura prueba lo que se ve: cada texto de «ve» tiene que estar dentro de la pantalla capturada, no solo en la página.
 * Con `pantalla: 'entera'` la ventana crece hasta la altura de la página para que el aviso y las listas salgan juntos.
 */
async function captura(page, testInfo, criterio, { ve = [], pantalla } = {}) {
  if (pantalla === 'entera') {
    const alto = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 1280, height: Math.max(720, alto + 110) });   // + la locución, que tapa el pie
  }
  for (const texto of ve) await expect(page.getByText(texto, { exact: false }).first()).toBeInViewport({ ratio: 1 });
  await capturarPantalla(page, testInfo, criterio, { ve });
}

/** Una sesión de API aparte (otra pestaña del encargado) para preparar el GIVEN sin tocar la pantalla del test. */
async function apiComo([correo, contrasena]) {
  const api = await pwRequest.newContext({ baseURL: URL_BASE });
  expect((await api.post('/api/entrar', { data: { correo, contrasena } })).ok()).toBe(true);
  return api;
}

test.describe('FASE-2 · Entregar y recibir el material, y el panel del día (REQ-F-005, REQ-F-008)', () => {
  test('AC-010-01 REQ-F-005 AC1 hoy es 2026-12-05 y Lucía tiene 2 × Casco reservados: Pablo pulsa «Entregar» y ve «Entregado: 2 × Casco a Lucía Gil»', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-05', reservas: [CASCO] });
    await entrarComoPablo(page);
    await narrar(page, testInfo, 'Es 5 de diciembre. Pablo, el encargado, abre el Panel y encuentra la reserva de dos cascos de Lucía por entregar');
    await expect(fila(page, 'Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05')).toBeVisible();
    await narrar(page, testInfo, 'Pulsa Entregar al darle el material a Lucía');
    await boton(page, 'Por entregar', 'Entregar').click();
    // REQ-F-005 AC1: "GIVEN today is 2026-12-05 and Lucía has 2 × Casco reserved from 2026-12-05 WHEN the encargado presses "Entregar" THEN the user sees "Entregado: 2 × Casco a Lucía Gil" and its state "Prestada""
    await expect(aviso(page, 'Entregado: 2 × Casco a Lucía Gil')).toBeVisible();
    await expect(fila(page, '2 × Casco del 2026-12-05 al 2026-12-07 — Prestada')).toBeVisible();
    await narrar(page, testInfo, 'Entregar y recibir el material. En Panel del encargado se ve «Entregado: 2 × Casco a Lucía Gil» y «2 × Casco del 2026-12-05 al 2026-12-07 — Prestada».', { criterio: 'AC-010-01' });
    await captura(page, testInfo, 'AC-010-01', { ve: ['Entregado: 2 × Casco a Lucía Gil', '2 × Casco del 2026-12-05 al 2026-12-07 — Prestada'], pantalla: 'entera' });
  });

  test('AC-010-02 REQ-F-005 AC2 la reserva de Lucía acaba de entregarse y «Entregar» se envía otra vez: Pablo ve «Ya estaba entregada» y un solo préstamo', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-05', reservas: [CASCO] });
    await entrarComoPablo(page);
    await narrar(page, testInfo, 'Pablo tiene el Panel abierto en esta pestaña con la reserva de Lucía por entregar');
    await expect(boton(page, 'Por entregar', 'Entregar')).toBeVisible();
    const otraPestana = await apiComo(PABLO);
    expect((await otraPestana.post('/api/reservas/r-1/entregar', { data: {} })).ok()).toBe(true);   // la entrega ya hecha desde otra pestaña
    await narrar(page, testInfo, 'La reserva ya se entregó desde otra pestaña, pero aquí el botón sigue ahí; Pablo pulsa Entregar otra vez');
    await boton(page, 'Por entregar', 'Entregar').click();
    // REQ-F-005 AC2: "GIVEN the reservation was just delivered WHEN "Entregar" is submitted again THEN the user sees "Ya estaba entregada" and the loan is still one"
    await expect(aviso(page, 'Ya estaba entregada')).toBeVisible();
    await expect(fila(page, 'Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07')).toHaveCount(1);
    await expect(page.getByRole('listitem').filter({ hasText: 'Lucía Gil' })).toHaveCount(1);
    await narrar(page, testInfo, 'Entregar y recibir el material. En Panel del encargado se ve «Ya estaba entregada» y «Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07»: el préstamo sigue siendo uno solo.', { criterio: 'AC-010-02' });
    await captura(page, testInfo, 'AC-010-02', { ve: ['Ya estaba entregada', 'Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07'], pantalla: 'entera' });
  });

  test('AC-010-03 REQ-F-005 AC8 una reserva que empieza el 2026-12-10 y Pablo pulsa «Entregar» el 2026-12-05: ve «No se puede entregar antes de la fecha de inicio»', async ({ page }, testInfo) => {
    const reserva = { ...CASCO, inicio: '2026-12-10', fin: '2026-12-12' };
    await reiniciar({ hoy: '2026-12-10', reservas: [reserva] });
    await entrarComoPablo(page);
    await narrar(page, testInfo, 'Pablo tiene abierto el Panel con la reserva de Lucía, que empieza el 10 de diciembre');
    await expect(boton(page, 'Por entregar', 'Entregar')).toBeVisible();
    writeFileSync(HOY_FICHERO, '2026-12-05');   // el servidor ya está en el 5 de diciembre: la pestaña de Pablo era antigua
    await narrar(page, testInfo, 'Pero hoy es 5 de diciembre, antes del inicio: Pablo pulsa Entregar');
    await boton(page, 'Por entregar', 'Entregar').click();
    // REQ-F-005 AC8: "GIVEN a reservation from 2026-12-10 WHEN the encargado presses "Entregar" on 2026-12-05 THEN the user sees "No se puede entregar antes de la fecha de inicio""
    await expect(page.getByRole('alert')).toHaveText('No se puede entregar antes de la fecha de inicio');
    await narrar(page, testInfo, 'Entregar y recibir el material. En Panel del encargado se ve «No se puede entregar antes de la fecha de inicio».', { criterio: 'AC-010-03' });
    await captura(page, testInfo, 'AC-010-03', { ve: ['No se puede entregar antes de la fecha de inicio'] });
  });

  test('AC-010-04 REQ-F-005 AC7 la reserva acabó el 2026-12-07 sin entregarse y Pablo abre el Panel el 2026-12-08: ve «No recogida» y no se entrega', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-08', reservas: [CASCO] });
    await narrar(page, testInfo, 'Es 8 de diciembre. La reserva de Lucía acabó el 7 sin que viniera a recogerla. Pablo abre el Panel');
    await entrarComoPablo(page);
    // REQ-F-005 AC7: "GIVEN the reservation ended 2026-12-07 and was never delivered WHEN the encargado opens it on 2026-12-08 THEN the user sees "No recogida" and its units are free"
    await expect(page.getByRole('heading', { name: 'No recogida', level: 2 })).toBeVisible();
    await expect(fila(page, 'No recogida: 2 × Casco — Lucía Gil — hasta el 2026-12-07')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entregar' })).toHaveCount(0);   // y no se ofrece entregarla
    await expect(page.getByRole('heading', { name: 'Por entregar' })).toHaveCount(0);
    await expect(page.locator('.multas .vacio')).toHaveText('No hay multas');   // sin multa
    // «its units are free»: el Panel no tiene pantalla de disponibilidad; lo prueba tests/integration/panel.test.js (ADR-002)
    await narrar(page, testInfo, 'Entregar y recibir el material. En Panel del encargado se ve «No recogida»: la reserva ya no se puede entregar, sus unidades quedan libres y no hay multa.', { criterio: 'AC-010-04' });
    await captura(page, testInfo, 'AC-010-04', { ve: ['No recogida: 2 × Casco — Lucía Gil — hasta el 2026-12-07'] });
  });

  test('AC-011-01 REQ-F-005 AC3 el préstamo de Lucía acaba el 2026-12-07 y Pablo lo devuelve ese día: ve «Devuelto a tiempo» y «No hay multas»', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-07', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    await entrarComoPablo(page);
    await narrar(page, testInfo, 'Es 7 de diciembre. Lucía trae los dos cascos y Pablo los encuentra en «Vuelven hoy»');
    await expect(page.getByRole('heading', { name: 'Vuelven hoy' })).toBeVisible();
    await narrar(page, testInfo, 'Pulsa Devolver');
    await boton(page, 'Prestado: 2 × Casco — Lucía Gil', 'Devolver').click();
    // REQ-F-005 AC3: "GIVEN the loan ends 2026-12-07 WHEN the encargado marks the return on 2026-12-07 THEN the user sees "Devuelto a tiempo" and no fine exists"
    await expect(aviso(page, 'Devuelto a tiempo')).toBeVisible();
    await expect(page.locator('.multas .vacio')).toHaveText('No hay multas');
    await luciaAbreMisMultas(page, testInfo);   // y Lucía, en su pantalla de multas: no existe ninguna
    await narrar(page, testInfo, 'Entregar y recibir el material. En Panel del encargado se ve «Devuelto a tiempo» y «No hay multas», y Lucía ve «No tienes multas» en Mis multas: no existe ninguna multa.', { criterio: 'AC-011-01' });
    await capturaJuntas(page, testInfo, 'AC-011-01', { ve: ['Devuelto a tiempo', 'No hay multas', 'No tienes multas'] });
  });

  test('AC-011-02 REQ-F-005 AC4 el préstamo acaba el 2026-12-07 y Pablo lo devuelve el 2026-12-10: ve «Devuelto con 3 días de retraso: multa de 6 €»', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-10', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    await entrarComoPablo(page);
    await narrar(page, testInfo, 'Es 10 de diciembre. Lucía devuelve los dos cascos que debía traer el 7, y el Panel los marca con retraso');
    await expect(fila(page, 'Prestado: 2 × Casco — Lucía Gil')).toContainText('Retraso: 3 días');
    await narrar(page, testInfo, 'Pablo pulsa Devolver');
    await boton(page, 'Prestado: 2 × Casco — Lucía Gil', 'Devolver').click();
    // REQ-F-005 AC4: "GIVEN the loan ends 2026-12-07 WHEN the encargado marks the return on 2026-12-10 THEN the user sees "Devuelto con 3 días de retraso: multa de 6 €""
    await expect(aviso(page, 'Devuelto con 3 días de retraso: multa de 6 €')).toBeVisible();
    await narrar(page, testInfo, 'Entregar y recibir el material. En Panel del encargado se ve «Devuelto con 3 días de retraso: multa de 6 €».', { criterio: 'AC-011-02' });
    await captura(page, testInfo, 'AC-011-02', { ve: ['Devuelto con 3 días de retraso: multa de 6 €'] });
  });

  test('AC-011-03 REQ-F-005 AC5 el préstamo acaba el 2026-12-07 y se devuelve el 2026-12-08: Pablo ve «Devuelto con 1 día de retraso: multa de 2 €»', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-08', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    await entrarComoPablo(page);
    await narrar(page, testInfo, 'Es 8 de diciembre. Lucía devuelve los cascos con un día de retraso y Pablo pulsa Devolver');
    await boton(page, 'Prestado: 2 × Casco — Lucía Gil', 'Devolver').click();
    // REQ-F-005 AC5: "GIVEN the loan ends 2026-12-07 WHEN it is returned on 2026-12-08 THEN the user sees "Devuelto con 1 día de retraso: multa de 2 €""
    await expect(aviso(page, 'Devuelto con 1 día de retraso: multa de 2 €')).toBeVisible();
    await narrar(page, testInfo, 'Entregar y recibir el material. En Panel del encargado se ve «Devuelto con 1 día de retraso: multa de 2 €», en singular.', { criterio: 'AC-011-03' });
    await captura(page, testInfo, 'AC-011-03', { ve: ['Devuelto con 1 día de retraso: multa de 2 €'] });
  });

  test('AC-011-04 REQ-F-005 AC6 la devolución acaba de marcarse con multa de 6 € y «Devolver» se envía otra vez: Pablo ve «Ya estaba devuelta» y una sola multa de Lucía Gil', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-10', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    await entrarComoPablo(page);
    await narrar(page, testInfo, 'Es 10 de diciembre. Pablo tiene abierto el Panel con el préstamo de Lucía, vencido hace tres días');
    await expect(boton(page, 'Prestado: 2 × Casco — Lucía Gil', 'Devolver')).toBeVisible();
    const otraPestana = await apiComo(PABLO);
    expect((await otraPestana.post('/api/reservas/r-1/devolver', { data: {} })).ok()).toBe(true);   // devolución ya marcada desde otra pestaña: multa de 6 €
    await narrar(page, testInfo, 'La devolución ya se marcó desde otra pestaña con una multa de 6 euros; aquí Pablo pulsa Devolver otra vez');
    await boton(page, 'Prestado: 2 × Casco — Lucía Gil', 'Devolver').click();
    // REQ-F-005 AC6: "GIVEN the return was just marked with a fine of 6 € WHEN "Devolver" is submitted again THEN the user sees "Ya estaba devuelta" and the fine is still 1 of 6 €"
    await expect(aviso(page, 'Ya estaba devuelta')).toBeVisible();
    await expect(page.locator('.multas li')).toHaveText(['Lucía Gil — Multa de 6 € — Pendiente']);
    await narrar(page, testInfo, 'Entregar y recibir el material. En Panel del encargado se ve «Ya estaba devuelta» y «Lucía Gil — Multa de 6 € — Pendiente»: sigue habiendo una sola multa, de 6 euros.', { criterio: 'AC-011-04' });
    await captura(page, testInfo, 'AC-011-04', { ve: ['Ya estaba devuelta', 'Lucía Gil — Multa de 6 € — Pendiente'] });
  });

  test('AC-017-08 REQ-F-005 AC9 un préstamo de 2 × Casco acabó el 2026-12-07 sin devolver: Pablo abre el Panel el 2026-12-10 y ve «Retraso: 3 días» y «No hay multas»', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-10', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    await narrar(page, testInfo, 'Es 10 de diciembre y Lucía aún no ha devuelto los dos cascos que acabaron el 7. Pablo abre el Panel del encargado');
    await entrarComoPablo(page);
    // REQ-F-005 AC9: "GIVEN a loan of 2 × Casco that ended 2026-12-07 and was not returned WHEN the encargado opens "Panel del encargado" on 2026-12-10 THEN the user sees "Retraso: 3 días" next to the loan and the fine is not created until the return is marked"
    await expect(fila(page, 'Prestado: 2 × Casco — Lucía Gil')).toContainText('Retraso: 3 días');
    await expect(page.locator('.multas .vacio')).toHaveText('No hay multas');
    await luciaAbreMisMultas(page, testInfo);   // y Lucía, en su pantalla de multas: aún no hay multa
    await narrar(page, testInfo, 'Entregar y recibir el material. En Panel del encargado se ve «Retraso: 3 días» junto al préstamo y «No hay multas», y Lucía ve «No tienes multas» en Mis multas: la multa no se crea hasta marcar la devolución.', { criterio: 'AC-017-08' });
    await capturaJuntas(page, testInfo, 'AC-017-08', { ve: ['Retraso: 3 días', 'No hay multas', 'No tienes multas'] });
  });

  test('AC-017-09 REQ-F-005 AC10 un préstamo acabó el 2026-12-07 sin devolver: Pablo abre el Panel el 2026-12-08 y ve «Retraso: 1 día»', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-08', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    await narrar(page, testInfo, 'Es 8 de diciembre y los cascos de Lucía, que acabaron el 7, siguen sin devolver. Pablo abre el Panel del encargado');
    await entrarComoPablo(page);
    // REQ-F-005 AC10: "GIVEN a loan that ended 2026-12-07 and was not returned WHEN the encargado opens "Panel del encargado" on 2026-12-08 THEN the user sees "Retraso: 1 día""
    await expect(fila(page, 'Prestado: 2 × Casco — Lucía Gil')).toContainText('Retraso: 1 día');
    await narrar(page, testInfo, 'Entregar y recibir el material. En Panel del encargado se ve «Retraso: 1 día», en singular.', { criterio: 'AC-017-09' });
    await captura(page, testInfo, 'AC-017-09', { ve: ['Retraso: 1 día'] });
  });

  test('AC-017-01 REQ-F-008 AC1 Lucía tiene 2 × Casco prestados hasta el 2026-12-07 y Pablo abre el Panel el 2026-12-05: ve «Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07»', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-05', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    await narrar(page, testInfo, 'Es 5 de diciembre. Pablo, el encargado, entra y abre el Panel del encargado');
    await entrarComoPablo(page);
    // REQ-F-008 AC1: "GIVEN Lucía has 2 × Casco lent until 2026-12-07 WHEN the encargado opens the panel on 2026-12-05 THEN the user sees "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07""
    await expect(fila(page, 'Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07')).toBeVisible();
    await narrar(page, testInfo, 'Qué hay prestado y qué vuelve cada día. En Panel del encargado se ve «Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07».', { criterio: 'AC-017-01' });
    await captura(page, testInfo, 'AC-017-01', { ve: ['Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07'] });
  });

  test('AC-017-02 REQ-F-008 AC2 el mismo préstamo y Pablo abre el Panel el 2026-12-07: lo ve bajo «Vuelven hoy»', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-07', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    await narrar(page, testInfo, 'Es 7 de diciembre, el día que acaba el préstamo. Pablo abre el Panel del encargado');
    await entrarComoPablo(page);
    // REQ-F-008 AC2: "GIVEN the same loan WHEN the encargado opens the panel on 2026-12-07 THEN the user sees it under "Vuelven hoy""
    await expect(page.getByRole('heading', { name: 'Vuelven hoy' })).toBeVisible();
    await expect(fila(page, 'Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prestado', exact: true })).toHaveCount(0);   // sale solo bajo «Vuelven hoy»
    await narrar(page, testInfo, 'Qué hay prestado y qué vuelve cada día. En Panel del encargado se ve «Vuelven hoy» y debajo «Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07».', { criterio: 'AC-017-02' });
    await captura(page, testInfo, 'AC-017-02', { ve: ['Vuelven hoy', 'Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07'] });
  });

  test('AC-017-03 REQ-F-008 AC3 el mismo préstamo y Pablo elige la fecha 2026-12-07 el 2026-12-05: ve «Vuelven el 2026-12-07» con ese préstamo', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-05', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    await entrarComoPablo(page);
    await narrar(page, testInfo, 'Es 5 de diciembre. Pablo quiere saber qué vuelve el 7 y elige esa fecha en el Panel');
    await page.getByLabel('Fecha').fill('2026-12-07');
    await page.getByRole('button', { name: 'Ver', exact: true }).click();
    // REQ-F-008 AC3: "GIVEN the same loan WHEN the encargado picks the date 2026-12-07 on 2026-12-05 THEN the user sees "Vuelven el 2026-12-07" with that loan"
    await expect(page.getByRole('heading', { name: 'Vuelven el 2026-12-07' })).toBeVisible();
    await expect(fila(page, 'Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07')).toBeVisible();
    await narrar(page, testInfo, 'Qué hay prestado y qué vuelve cada día. En Panel del encargado se ve «Vuelven el 2026-12-07» y debajo «Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07».', { criterio: 'AC-017-03' });
    await captura(page, testInfo, 'AC-017-03', { ve: ['Vuelven el 2026-12-07', 'Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07'] });
  });

  test('AC-017-04 REQ-F-008 AC4 no hay préstamos y Pablo abre el Panel: ve «No hay material prestado»', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-05', reservas: [] });
    await narrar(page, testInfo, 'Es 5 de diciembre y no hay nada prestado. Pablo abre el Panel del encargado');
    await entrarComoPablo(page);
    // REQ-F-008 AC4: "GIVEN no loans WHEN the encargado opens the panel THEN the user sees "No hay material prestado""
    await expect(page.locator('.vacio').first()).toHaveText('No hay material prestado');
    await narrar(page, testInfo, 'Qué hay prestado y qué vuelve cada día. En Panel del encargado se ve «No hay material prestado».', { criterio: 'AC-017-04' });
    await captura(page, testInfo, 'AC-017-04', { ve: ['No hay material prestado'] });
  });

  test('AC-017-05 REQ-F-008 AC5 Lucía tiene 2 × Casco reservados desde el 2026-12-05 y Pablo abre el Panel ese día: ve «Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05» y el botón «Entregar»', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-05', reservas: [CASCO] });
    await narrar(page, testInfo, 'Es 5 de diciembre. Pablo abre el Panel del encargado y mira qué hay que entregar hoy');
    await entrarComoPablo(page);
    // REQ-F-008 AC5: "GIVEN Lucía has 2 × Casco reserved from 2026-12-05 WHEN the encargado opens the panel on 2026-12-05 THEN the user sees "Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05" and the button "Entregar""
    await expect(fila(page, 'Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05')).toBeVisible();
    await expect(boton(page, 'Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05', 'Entregar')).toBeVisible();
    await narrar(page, testInfo, 'Qué hay prestado y qué vuelve cada día. En Panel del encargado se ve «Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05» y el botón «Entregar».', { criterio: 'AC-017-05' });
    await captura(page, testInfo, 'AC-017-05', { ve: ['Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05', 'Entregar'] });
  });

  test('AC-017-06 REQ-F-008 AC6 Lucía, socia, abre «/panel»: ve «No tienes permiso para ver esta página»', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-05', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    await narrar(page, testInfo, 'Lucía, socia del club, entra y escribe la dirección del Panel del encargado');
    await entrar(page, LUCIA, 'Mis reservas');
    await page.goto('/panel');
    // REQ-F-008 AC6: "GIVEN a socio WHEN he opens "/panel" THEN the user sees "No tienes permiso para ver esta página""
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByRole('heading', { name: 'Sin permiso', level: 1 })).toBeVisible();
    await expect(page.locator('main.sin-permiso p').filter({ hasText: 'No tienes permiso para ver esta página' })).toBeVisible();
    await expect(page.getByText('Prestado:', { exact: false })).toHaveCount(0);   // ningún dato del panel
    await narrar(page, testInfo, 'Qué hay prestado y qué vuelve cada día. Al abrir /panel se ve la pantalla «Sin permiso» con «No tienes permiso para ver esta página», sin ningún dato del panel.', { criterio: 'AC-017-06' });
    await captura(page, testInfo, 'AC-017-06', { ve: ['Sin permiso', 'No tienes permiso para ver esta página'] });
  });

  test('AC-017-07 REQ-F-008 AC7 Elena, de la junta, abre «/panel»: ve «No tienes permiso para ver esta página»', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-05', reservas: [{ ...CASCO, estado: 'Prestada' }] });
    await narrar(page, testInfo, 'Elena, de la junta, entra y escribe la dirección del Panel del encargado');
    await page.goto('/entrar');
    await page.getByLabel('Correo').fill(ELENA[0]);
    await page.getByLabel('Contraseña').fill(ELENA[1]);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Hola, Elena')).toBeVisible();
    await page.goto('/panel');
    // REQ-F-008 AC7: "GIVEN a junta member WHEN she opens "/panel" THEN the user sees "No tienes permiso para ver esta página""
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByRole('heading', { name: 'Sin permiso', level: 1 })).toBeVisible();
    await expect(page.locator('main.sin-permiso p').filter({ hasText: 'No tienes permiso para ver esta página' })).toBeVisible();
    await expect(page.getByText('Prestado:', { exact: false })).toHaveCount(0);   // ningún dato del panel
    await narrar(page, testInfo, 'Qué hay prestado y qué vuelve cada día. Al abrir /panel se ve la pantalla «Sin permiso» con «No tienes permiso para ver esta página», sin ningún dato del panel.', { criterio: 'AC-017-07' });
    await captura(page, testInfo, 'AC-017-07', { ve: ['Sin permiso', 'No tienes permiso para ver esta página'] });
  });
});
