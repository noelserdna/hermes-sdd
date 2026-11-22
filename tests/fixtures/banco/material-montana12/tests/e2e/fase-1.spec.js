// Recorrido de FASE-1 por la ruta del usuario: reservar, ver y cancelar. Un test por criterio, con su propio GIVEN
// (actor, fechas y datos del criterio), su captura y su locución (.sdd/demo/GUION-FASE-1.md).
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { request as pwRequest } from '@playwright/test';
import { test, expect, narrar, captura as capturarPantalla } from './fixtures/evidence.js';
import { sembrar } from '../../demo/sembrar.mjs';

const DATOS = path.resolve('data/e2e/datos.json');
const RELOJ = path.resolve('data/e2e/reloj.txt');
const HOY_FICHERO = path.resolve('data/e2e/hoy.txt');
const HOY = '2026-11-22';
const URL_BASE = `http://127.0.0.1:${process.env.PORT ?? '5173'}`;

const LUCIA = ['lucia@club.test', 'Cumbre2026!'];
const PABLO = ['pablo@club.test', 'Piolet2026!'];
// En los criterios de reservar, Pablo es un socio más (Pablo Sanz en los escenarios); el encargado no reserva (AC-007-11)
const SOCIOS = [
  { id: 'c-lucia', nombre: 'Lucía', correo: LUCIA[0], contrasena: LUCIA[1], rol: 'socio' },
  { id: 'c-pablo', nombre: 'Pablo', correo: PABLO[0], contrasena: PABLO[1], rol: 'socio' },
];
const CASCO_6 = [{ nombre: 'Casco', total: 6 }];
const LUCIA_CASCO = { socio: LUCIA[0], material: 'Casco', cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' };

/** Datos nuevos para el test, el reloj real y «hoy» = el del GIVEN del criterio (por defecto 2026-11-22). */
async function reiniciar({ hoy = HOY, material = CASCO_6, reservas = [], multas = [] } = {}) {
  mkdirSync(path.dirname(DATOS), { recursive: true });
  rmSync(RELOJ, { force: true });
  await sembrar(DATOS, { hoy: HOY, cuentas: SOCIOS, material, reservas, multas });
  if (hoy === HOY) rmSync(HOY_FICHERO, { force: true }); else writeFileSync(HOY_FICHERO, hoy);
}
test.afterEach(() => rmSync(HOY_FICHERO, { force: true }));

async function entrar(page, [correo, contrasena]) {
  await page.goto('/mis-reservas');
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Mis reservas', level: 1 })).toBeVisible();
}
const irA = (page, enlace) => page.getByRole('navigation').getByRole('link', { name: enlace }).click();
async function abrirReservar(page) {
  await irA(page, 'Reservar');
  await expect(page.getByRole('heading', { name: 'Reservar', level: 1 })).toBeVisible();
}
async function rellenar(page, { material = 'Casco', cantidad, inicio, fin }) {
  await page.getByRole('combobox', { name: 'Material' }).selectOption({ label: material });
  await page.getByRole('spinbutton', { name: 'Cantidad' }).fill(String(cantidad));
  await page.getByLabel('Fecha de inicio').fill(inicio);
  await page.getByLabel('Fecha de fin').fill(fin);
}
const enviar = (page) => page.getByRole('button', { name: 'Reservar', exact: true }).click();
const reservarCon = async (page, datos) => { await rellenar(page, datos); await enviar(page); };
const fila = (page, texto) => page.getByRole('listitem').filter({ hasText: texto });
const aviso = (page, texto) => page.getByRole('status').filter({ hasText: texto });

/**
 * La captura prueba lo que se ve: cada texto de «ve» tiene que estar dentro de la pantalla capturada, no solo en la página
 * (el fixture comprueba que existe y es visible, aunque quede bajo el pliegue). Con `pantalla: 'entera'` la ventana crece
 * hasta la altura de la página para que el aviso y la lista de debajo salgan juntos.
 */
async function captura(page, testInfo, criterio, { ve = [], pantalla } = {}) {
  if (pantalla === 'entera') {
    const alto = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 1280, height: Math.max(720, alto + 110) });   // + la locución, que tapa el pie
  }
  for (const texto of ve) await expect(page.getByText(texto, { exact: false }).first()).toBeInViewport({ ratio: 1 });
  await capturarPantalla(page, testInfo, criterio, { ve });
}

/** Una sesión de API aparte (otra pestaña u otro socio) para preparar el GIVEN sin tocar la pantalla del test. */
async function apiComo([correo, contrasena]) {
  const api = await pwRequest.newContext({ baseURL: URL_BASE });
  expect((await api.post('/api/entrar', { data: { correo, contrasena } })).ok()).toBe(true);
  return api;
}

test.describe('FASE-1 · Reservar material (REQ-F-003)', () => {
  test('AC-007-01 REQ-F-003 AC1 Lucía reserva 2 × Casco del 2026-12-05 al 2026-12-07 y ve «Reserva creada» en Mis reservas', async ({ page }, testInfo) => {
    await reiniciar();   // «Casco» con 6 unidades y ninguna reservada
    await entrar(page, LUCIA);
    await narrar(page, testInfo, 'Lucía, socia del club, abre Reservar y elige el casco');
    await abrirReservar(page);
    await narrar(page, testInfo, 'Pide 2 cascos del 5 al 7 de diciembre y pulsa Reservar');
    await reservarCon(page, { cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' });
    // REQ-F-003 AC1: "GIVEN "Casco" has 6 units and none reserved on 2026-12-05..2026-12-07 WHEN Lucía reserves 2 cascos for those dates THEN the user sees "Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07" in "Mis reservas""
    await expect(page.getByRole('heading', { name: 'Mis reservas', level: 1 })).toBeVisible();
    await expect(aviso(page, 'Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07')).toBeVisible();
    await narrar(page, testInfo, 'Reservar material. En Mis reservas se ve «Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07».', { criterio: 'AC-007-01' });
    await captura(page, testInfo, 'AC-007-01', { ve: ['Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07'] });
  });

  test('AC-007-02 REQ-F-003 AC2 con «Tienda» a 2 y 1 reservada por Lucía, Pablo pide 2 y ve «solo queda 1 de Tienda el 2026-12-06»', async ({ page }, testInfo) => {
    await reiniciar({ material: [{ nombre: 'Tienda', total: 2 }], reservas: [{ socio: LUCIA[0], material: 'Tienda', cantidad: 1, inicio: '2026-12-05', fin: '2026-12-07' }] });
    await entrar(page, PABLO);
    await narrar(page, testInfo, 'Pablo, socio del club, abre Reservar y elige la tienda');
    await abrirReservar(page);
    await narrar(page, testInfo, 'Pide 2 tiendas del 6 al 8 de diciembre, pero Lucía ya tiene una esos días');
    await reservarCon(page, { material: 'Tienda', cantidad: 2, inicio: '2026-12-06', fin: '2026-12-08' });
    // REQ-F-003 AC2: "GIVEN "Tienda" has 2 units and Lucía reserved 1 for 2026-12-05..2026-12-07 WHEN Pablo reserves 2 tiendas for 2026-12-06..2026-12-08 THEN the user sees "No hay unidades libres: solo queda 1 de Tienda el 2026-12-06" and no reservation is created"
    await expect(page.getByRole('alert')).toHaveText('No hay unidades libres: solo queda 1 de Tienda el 2026-12-06');
    await expect(page.locator('.vacio')).toHaveText('Aún no tienes reservas');
    await narrar(page, testInfo, 'Reservar material. En Reservar se ve «No hay unidades libres: solo queda 1 de Tienda el 2026-12-06» y «Aún no tienes reservas»: no se crea ninguna reserva.', { criterio: 'AC-007-02' });
    await captura(page, testInfo, 'AC-007-02', { ve: ['No hay unidades libres: solo queda 1 de Tienda el 2026-12-06', 'Aún no tienes reservas'], pantalla: 'entera' });
  });

  test('AC-007-03 REQ-F-003 AC3 Lucía repite el formulario de 2 × Linterna y ve «solo queda 1 de Linterna el 2026-12-05» con una sola reserva', async ({ page }, testInfo) => {
    await reiniciar({ material: [{ nombre: 'Linterna', total: 3 }] });
    await entrar(page, LUCIA);
    await narrar(page, testInfo, 'Lucía abre Reservar y reserva 2 linternas del 5 al 7 de diciembre');
    await abrirReservar(page);
    const datos = { material: 'Linterna', cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' };
    await reservarCon(page, datos);
    await expect(aviso(page, 'Reserva creada: 2 × Linterna del 2026-12-05 al 2026-12-07')).toBeVisible();
    await narrar(page, testInfo, 'Vuelve a Reservar y envía exactamente el mismo formulario otra vez');
    await abrirReservar(page);
    await reservarCon(page, datos);
    // REQ-F-003 AC3: "GIVEN "Linterna" has 3 units and Lucía just reserved 2 for 2026-12-05..2026-12-07 WHEN the same form is submitted again THEN the user sees "No hay unidades libres: solo queda 1 de Linterna el 2026-12-05" and Lucía still has one reservation of 2"
    await expect(page.getByRole('alert')).toHaveText('No hay unidades libres: solo queda 1 de Linterna el 2026-12-05');
    await expect(fila(page, 'Linterna del')).toHaveCount(1);
    await expect(fila(page, '2 × Linterna del 2026-12-05 al 2026-12-07 — Reservada')).toBeVisible();
    await narrar(page, testInfo, 'Reservar material. En Reservar se ve «No hay unidades libres: solo queda 1 de Linterna el 2026-12-05» y «2 × Linterna del 2026-12-05 al 2026-12-07 — Reservada»: Lucía sigue con una sola reserva de 2.', { criterio: 'AC-007-03' });
    await captura(page, testInfo, 'AC-007-03', { ve: ['No hay unidades libres: solo queda 1 de Linterna el 2026-12-05', '2 × Linterna del 2026-12-05 al 2026-12-07 — Reservada'], pantalla: 'entera' });
  });

  test('AC-007-04 REQ-F-003 AC4 hoy es 2026-11-22 y Lucía elige inicio 2026-11-21: ve «La fecha de inicio no puede ser pasada»', async ({ page }, testInfo) => {
    await reiniciar();   // hoy 2026-11-22
    await entrar(page, LUCIA);
    await narrar(page, testInfo, 'Es 22 de noviembre. Lucía abre Reservar y pide un casco que empieza el 21, un día pasado');
    await abrirReservar(page);
    await reservarCon(page, { cantidad: 1, inicio: '2026-11-21', fin: '2026-11-23' });
    // REQ-F-003 AC4: "GIVEN today is 2026-11-22 WHEN a socio picks the start date 2026-11-21 THEN the user sees "La fecha de inicio no puede ser pasada""
    await expect(page.getByRole('alert')).toHaveText('La fecha de inicio no puede ser pasada');
    await narrar(page, testInfo, 'Reservar material. En Reservar se ve «La fecha de inicio no puede ser pasada».', { criterio: 'AC-007-04' });
    await captura(page, testInfo, 'AC-007-04', { ve: ['La fecha de inicio no puede ser pasada'] });
  });

  test('AC-007-05 REQ-F-003 AC5 Lucía pone fin 2026-12-01 antes del inicio 2026-12-05 y ve «La fecha de fin no puede ser anterior a la de inicio»', async ({ page }, testInfo) => {
    await reiniciar();
    await entrar(page, LUCIA);
    await narrar(page, testInfo, 'Lucía abre Reservar y escribe un fin, el 1 de diciembre, anterior al inicio, el 5');
    await abrirReservar(page);
    await reservarCon(page, { cantidad: 1, inicio: '2026-12-05', fin: '2026-12-01' });
    // REQ-F-003 AC5: "GIVEN the form WHEN the end date 2026-12-01 is before the start 2026-12-05 THEN the user sees "La fecha de fin no puede ser anterior a la de inicio""
    await expect(page.getByRole('alert')).toHaveText('La fecha de fin no puede ser anterior a la de inicio');
    await narrar(page, testInfo, 'Reservar material. En Reservar se ve «La fecha de fin no puede ser anterior a la de inicio».', { criterio: 'AC-007-05' });
    await captura(page, testInfo, 'AC-007-05', { ve: ['La fecha de fin no puede ser anterior a la de inicio'] });
  });

  test('AC-007-06 REQ-F-003 AC6 Lucía pide 15 días (2026-12-01..2026-12-15) y ve «Máximo 14 días por reserva»', async ({ page }, testInfo) => {
    await reiniciar();
    await entrar(page, LUCIA);
    await narrar(page, testInfo, 'Lucía abre Reservar y pide un casco quince días, del 1 al 15 de diciembre');
    await abrirReservar(page);
    await reservarCon(page, { cantidad: 1, inicio: '2026-12-01', fin: '2026-12-15' });
    // REQ-F-003 AC6: "GIVEN the form WHEN a socio asks for 15 days (2026-12-01..2026-12-15) THEN the user sees "Máximo 14 días por reserva""
    await expect(page.getByRole('alert')).toHaveText('Máximo 14 días por reserva');
    await narrar(page, testInfo, 'Reservar material. En Reservar se ve «Máximo 14 días por reserva».', { criterio: 'AC-007-06' });
    await captura(page, testInfo, 'AC-007-06', { ve: ['Máximo 14 días por reserva'] });
  });

  test('AC-007-07 REQ-F-003 AC7 Lucía pide 6 unidades de un tipo y ve «Máximo 5 unidades por reserva»', async ({ page }, testInfo) => {
    await reiniciar();
    await entrar(page, LUCIA);
    await narrar(page, testInfo, 'Lucía abre Reservar y pide 6 cascos de golpe');
    await abrirReservar(page);
    await reservarCon(page, { cantidad: 6, inicio: '2026-12-05', fin: '2026-12-07' });
    // REQ-F-003 AC7: "GIVEN the form WHEN a socio asks for 6 units of one type THEN the user sees "Máximo 5 unidades por reserva""
    await expect(page.getByRole('alert')).toHaveText('Máximo 5 unidades por reserva');
    await narrar(page, testInfo, 'Reservar material. En Reservar se ve «Máximo 5 unidades por reserva».', { criterio: 'AC-007-07' });
    await captura(page, testInfo, 'AC-007-07', { ve: ['Máximo 5 unidades por reserva'] });
  });

  test('AC-007-08 REQ-F-003 AC8 Pablo con una multa pendiente de 6 € intenta reservar y ve «No puedes reservar hasta pagar tu multa de 6 €»', async ({ page }, testInfo) => {
    await reiniciar({ multas: [{ socio: PABLO[0], importe: 6 }] });
    await entrar(page, PABLO);
    await narrar(page, testInfo, 'Pablo debe una multa de 6 euros. Abre Reservar y pide un casco igualmente');
    await abrirReservar(page);
    await reservarCon(page, { cantidad: 1, inicio: '2026-12-05', fin: '2026-12-07' });
    // REQ-F-003 AC8: "GIVEN Pablo has a pending fine of 6 € WHEN he tries to reserve THEN the user sees "No puedes reservar hasta pagar tu multa de 6 €" and no reservation is created"
    await expect(page.getByRole('alert')).toHaveText('No puedes reservar hasta pagar tu multa de 6 €');
    await expect(page.locator('.vacio')).toHaveText('Aún no tienes reservas');
    await narrar(page, testInfo, 'Reservar material. En Reservar se ve «No puedes reservar hasta pagar tu multa de 6 €» y «Aún no tienes reservas»: no se crea ninguna reserva.', { criterio: 'AC-007-08' });
    await captura(page, testInfo, 'AC-007-08', { ve: ['No puedes reservar hasta pagar tu multa de 6 €', 'Aún no tienes reservas'], pantalla: 'entera' });
  });

  test('AC-007-09 REQ-F-003 AC9 Lucía con una multa pendiente de 2 € intenta reservar y ve «No puedes reservar hasta pagar tu multa de 2 €»', async ({ page }, testInfo) => {
    await reiniciar({ multas: [{ socio: LUCIA[0], importe: 2 }] });
    await entrar(page, LUCIA);
    await narrar(page, testInfo, 'Lucía debe una multa de 2 euros. Abre Reservar y pide un casco');
    await abrirReservar(page);
    await reservarCon(page, { cantidad: 1, inicio: '2026-12-05', fin: '2026-12-07' });
    // REQ-F-003 AC9: "GIVEN Lucía has a pending fine of 2 € WHEN she tries to reserve THEN the user sees "No puedes reservar hasta pagar tu multa de 2 €""
    await expect(page.getByRole('alert')).toHaveText('No puedes reservar hasta pagar tu multa de 2 €');
    await narrar(page, testInfo, 'Reservar material. En Reservar se ve «No puedes reservar hasta pagar tu multa de 2 €».', { criterio: 'AC-007-09' });
    await captura(page, testInfo, 'AC-007-09', { ve: ['No puedes reservar hasta pagar tu multa de 2 €'] });
  });
});

test.describe('FASE-1 · Mis reservas y cancelar (REQ-F-004)', () => {
  test('AC-008-01 REQ-F-004 AC1 Lucía abre Mis reservas y ve «2 × Casco del 2026-12-05 al 2026-12-07 — Reservada» sin las reservas de otros', async ({ page }, testInfo) => {
    await reiniciar({ material: [{ nombre: 'Casco', total: 6 }, { nombre: 'Tienda', total: 2 }],
      reservas: [LUCIA_CASCO, { socio: PABLO[0], material: 'Tienda', cantidad: 1, inicio: '2026-12-06', fin: '2026-12-08' }] });
    await narrar(page, testInfo, 'Lucía tiene una reserva y Pablo, otro socio, tiene una de tienda. Lucía entra y abre Mis reservas');
    await entrar(page, LUCIA);
    // REQ-F-004 AC1: "GIVEN Lucía has 2 × Casco 2026-12-05..2026-12-07 and no one else has reservations WHEN she opens "Mis reservas" THEN the user sees "2 × Casco del 2026-12-05 al 2026-12-07 — Reservada" and no reservation of other members"
    await expect(fila(page, '2 × Casco del 2026-12-05 al 2026-12-07 — Reservada')).toHaveCount(1);
    await expect(page.getByText('Tienda')).toHaveCount(0);
    await expect(page.getByRole('listitem')).toHaveCount(1);
    await narrar(page, testInfo, 'Mis reservas y cancelar. En Mis reservas se ve «2 × Casco del 2026-12-05 al 2026-12-07 — Reservada» y ninguna reserva de otros socios.', { criterio: 'AC-008-01' });
    await captura(page, testInfo, 'AC-008-01', { ve: ['2 × Casco del 2026-12-05 al 2026-12-07 — Reservada'] });
  });

  test('AC-008-02 REQ-F-004 AC4 hoy es 2026-12-05 y la reserva de Lucía empieza hoy: ve «No se puede cancelar: empieza hoy» sin botón «Cancelar»', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-05', reservas: [LUCIA_CASCO] });
    await narrar(page, testInfo, 'Hoy es 5 de diciembre y la reserva de Lucía empieza hoy. Lucía entra y abre Mis reservas');
    await entrar(page, LUCIA);
    // REQ-F-004 AC4: "GIVEN today is 2026-12-05 and her reservation starts 2026-12-05 WHEN she looks at it THEN the user sees "No se puede cancelar: empieza hoy" and no "Cancelar" button"
    const reserva = fila(page, '2 × Casco del 2026-12-05 al 2026-12-07');
    await expect(reserva).toContainText('No se puede cancelar: empieza hoy');
    await expect(reserva.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);
    await narrar(page, testInfo, 'Mis reservas y cancelar. En Mis reservas, en la fila de esa reserva y sin botón «Cancelar», se ve «No se puede cancelar: empieza hoy».', { criterio: 'AC-008-02' });
    await captura(page, testInfo, 'AC-008-02', { ve: ['No se puede cancelar: empieza hoy'] });
  });

  test('AC-008-03 REQ-F-004 AC5 una socia nueva sin reservas abre Mis reservas y ve «Aún no tienes reservas»', async ({ page }, testInfo) => {
    await reiniciar();
    await narrar(page, testInfo, 'Lucía, socia nueva, entra al club y abre Mis reservas');
    await entrar(page, LUCIA);
    // REQ-F-004 AC5: "GIVEN a new socio without reservations WHEN she opens "Mis reservas" THEN the user sees "Aún no tienes reservas""
    await expect(page.locator('.vacio')).toHaveText('Aún no tienes reservas');
    await narrar(page, testInfo, 'Mis reservas y cancelar. En Mis reservas se ve «Aún no tienes reservas».', { criterio: 'AC-008-03' });
    await captura(page, testInfo, 'AC-008-03', { ve: ['Aún no tienes reservas'] });
  });

  test('AC-008-04 REQ-F-004 AC6 Pablo, sin reservas mientras Lucía tiene una, abre Mis reservas y ve «Aún no tienes reservas»', async ({ page }, testInfo) => {
    await reiniciar({ reservas: [LUCIA_CASCO] });
    await narrar(page, testInfo, 'Lucía tiene una reserva de casco; Pablo no tiene ninguna. Pablo entra y abre Mis reservas');
    await entrar(page, PABLO);
    // REQ-F-004 AC6: "GIVEN Pablo is a socio with no reservations while Lucía has one WHEN he opens "Mis reservas" THEN the user sees "Aún no tienes reservas""
    await expect(page.locator('.vacio')).toHaveText('Aún no tienes reservas');
    await expect(page.getByText('Casco')).toHaveCount(0);
    await narrar(page, testInfo, 'Mis reservas y cancelar. En Mis reservas se ve «Aún no tienes reservas», sin la reserva de Lucía.', { criterio: 'AC-008-04' });
    await captura(page, testInfo, 'AC-008-04', { ve: ['Aún no tienes reservas'] });
  });

  test('AC-009-01 REQ-F-004 AC2 hoy es 2026-12-04 y Lucía cancela su reserva del 2026-12-05: ve «Reserva cancelada», su estado «Cancelada» y sus unidades libres', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-04', reservas: [LUCIA_CASCO] });   // «Casco» a 6 y 2 reservadas por Lucía
    await narrar(page, testInfo, 'Hoy es 4 de diciembre. Lucía abre Mis reservas y pulsa Cancelar en su reserva del 5 al 7');
    await entrar(page, LUCIA);
    await page.getByRole('button', { name: 'Cancelar' }).click();
    // REQ-F-004 AC2: "GIVEN today is 2026-12-04 and her reservation starts 2026-12-05 WHEN Lucía presses "Cancelar" THEN the user sees "Reserva cancelada", its state "Cancelada" and its units become free"
    await expect(aviso(page, 'Reserva cancelada')).toBeVisible();
    await expect(fila(page, '2 × Casco del 2026-12-05 al 2026-12-07 — Cancelada')).toBeVisible();
    await narrar(page, testInfo, 'Las 2 unidades han quedado libres: Lucía reserva ahora 5 cascos esos mismos días, algo que antes no cabía');
    await abrirReservar(page);
    await reservarCon(page, { cantidad: 5, inicio: '2026-12-05', fin: '2026-12-07' });
    await expect(aviso(page, 'Reserva creada: 5 × Casco del 2026-12-05 al 2026-12-07')).toBeVisible();
    await narrar(page, testInfo, 'Mis reservas y cancelar. En Mis reservas se ve «Reserva cancelada», «2 × Casco del 2026-12-05 al 2026-12-07 — Cancelada» y «Reserva creada: 5 × Casco del 2026-12-05 al 2026-12-07»: la reserva queda Cancelada y sus unidades, libres.', { criterio: 'AC-009-01' });
    await captura(page, testInfo, 'AC-009-01', { ve: ['Reserva cancelada', '2 × Casco del 2026-12-05 al 2026-12-07 — Cancelada', 'Reserva creada: 5 × Casco del 2026-12-05 al 2026-12-07'] });
  });

  test('AC-009-02 REQ-F-004 AC3 Lucía repite «Cancelar» desde una pestaña vieja y ve «La reserva ya estaba cancelada»; las unidades no se liberan dos veces', async ({ page }, testInfo) => {
    await reiniciar({ hoy: '2026-12-04', reservas: [LUCIA_CASCO] });
    await narrar(page, testInfo, 'Lucía tiene abierta Mis reservas con su reserva del 5 al 7 de diciembre');
    await entrar(page, LUCIA);
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    // La misma reserva se cancela desde otra pestaña y Pablo reserva 5 cascos esos días: la pantalla de Lucía se ha quedado vieja
    const otraLucia = await apiComo(LUCIA);
    const { reservas } = await (await otraLucia.get('/api/mis-reservas')).json();
    expect((await otraLucia.post(`/api/reservas/${reservas[0].id}/cancelar`, { data: {} })).ok()).toBe(true);
    const otroPablo = await apiComo(PABLO);
    expect((await otroPablo.post('/api/reservas', { data: { materialId: 'm-casco', cantidad: 5, inicio: '2026-12-05', fin: '2026-12-07' } })).ok()).toBe(true);
    await narrar(page, testInfo, 'La reserva ya está cancelada desde otra pestaña y Pablo ha reservado 5 cascos esos días. Lucía pulsa Cancelar en su pestaña vieja');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(aviso(page, 'La reserva ya estaba cancelada')).toBeVisible();
    await narrar(page, testInfo, 'Lucía pide ahora 2 cascos esos días');
    await abrirReservar(page);
    await reservarCon(page, { cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' });
    // REQ-F-004 AC3: "GIVEN the reservation was just cancelled WHEN "Cancelar" is submitted again THEN the user sees "La reserva ya estaba cancelada" and the units are not freed twice"
    await expect(page.getByRole('alert')).toHaveText('No hay unidades libres: solo queda 1 de Casco el 2026-12-05');
    await expect(aviso(page, 'La reserva ya estaba cancelada')).toBeVisible();
    await narrar(page, testInfo, 'Mis reservas y cancelar. Se ve «La reserva ya estaba cancelada» y «No hay unidades libres: solo queda 1 de Casco el 2026-12-05»: las unidades no se liberan dos veces.', { criterio: 'AC-009-02' });
    await captura(page, testInfo, 'AC-009-02', { ve: ['La reserva ya estaba cancelada', 'No hay unidades libres: solo queda 1 de Casco el 2026-12-05'] });
    await otraLucia.dispose();
    await otroPablo.dispose();
  });
});

test.describe('FASE-1 · Datos en el servidor (SPEC-PERF-002)', () => {
  const PUERTO = 5176;
  const BASE = `http://127.0.0.1:${PUERTO}`;
  let servidor = null;

  const parar = () => {
    if (!servidor) return;
    try { process.kill(-servidor.pid); } catch { /* ya parado */ }
    servidor = null;
  };
  async function arrancar(fichero) {
    servidor = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PUERTO), '--strictPort'], {
      detached: true, stdio: 'ignore', env: { ...process.env, MM_DATOS: fichero, MM_HOY: HOY },
    });
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`${BASE}/api/sesion`)).status === 401) return; } catch { /* aún no escucha */ }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('El servidor no arrancó');
  }
  const esperarParado = async () => {
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${BASE}/api/sesion`); } catch { return; }
      await new Promise((r) => setTimeout(r, 100));
    }
  };
  test.afterEach(() => parar());

  test('FASE-1 la reserva de Lucía sigue en Mis reservas tras pararlo y arrancarlo el servidor', async ({ page }, testInfo) => {
    const fichero = path.resolve('data/e2e/reinicio-fase-1.json');
    await sembrar(fichero, { hoy: HOY, cuentas: SOCIOS, material: CASCO_6, reservas: [] });
    await arrancar(fichero);
    const entrarAqui = async () => {
      await page.goto(`${BASE}/mis-reservas`);
      await page.getByLabel('Correo').fill(LUCIA[0]);
      await page.getByLabel('Contraseña').fill(LUCIA[1]);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByRole('heading', { name: 'Mis reservas', level: 1 })).toBeVisible();
    };
    await narrar(page, testInfo, 'Lucía entra y reserva 2 cascos del 5 al 7 de diciembre');
    await entrarAqui();
    await irA(page, 'Reservar');
    await reservarCon(page, { cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' });
    await expect(fila(page, '2 × Casco del 2026-12-05 al 2026-12-07 — Reservada')).toBeVisible();
    await narrar(page, testInfo, 'Se para el servidor y se vuelve a arrancar');
    parar();
    await esperarParado();
    await arrancar(fichero);
    await narrar(page, testInfo, 'Las sesiones se cierran al reiniciar: Lucía vuelve a entrar y abre Mis reservas');
    await entrarAqui();
    await expect(fila(page, '2 × Casco del 2026-12-05 al 2026-12-07 — Reservada')).toBeVisible();
    await narrar(page, testInfo, 'Su reserva sigue ahí: los datos viven en el servidor, no en el navegador');
  });
});
