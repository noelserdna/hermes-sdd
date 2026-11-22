// Recorrido de la FASE-1 por la ruta del usuario: ver y cancelar reservas (UC-004), entregar (UC-005) y ver entregas y
// devoluciones (UC-009). Una prueba por criterio, con su locución y su captura; entra siempre por la dirección de la web
// y la pantalla de Entrar, con la semilla de pruebas y el «hoy» que pide el criterio (fixtures/hoy.js).
import { test, expect, narrar, captura } from './fixtures/evidence.js';
import { sembrar, leerAlmacen } from './fixtures/semilla.js';
import { fijarHoy } from './fixtures/hoy.js';

const entrar = async (page, correo, contrasena) => {
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
};
const entrarComo = async (page, correo, contrasena) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await entrar(page, correo, contrasena);
};
const lucia = (page) => entrarComo(page, 'lucia@club.es', 'Cumbre2026');
const pablo = (page) => entrarComo(page, 'pablo@club.es', 'Arista2026');
const encargado = (page) => entrarComo(page, 'encargado@club.es', 'Glaciar2026');
const junta = (page) => entrarComo(page, 'junta@club.es', 'Serac20266');
const abrirEntregas = async (page) => {
  await page.getByRole('link', { name: 'Entregas y devoluciones' }).click();
  await expect(page.getByRole('heading', { name: 'Entregas y devoluciones', level: 1 })).toBeVisible();
};
const piolet = (socio, desde, hasta, extra = {}) => ({ socio, tipo: 'Piolet', desde, hasta, ...extra });
const fila = (page, texto) => page.locator('tbody tr', { has: page.locator('th', { hasText: texto }) });

// ───────────── UC-004 Ver y cancelar mis reservas ─────────────

test('REQ-F-004 AC1 · AC-004-01 Lucía abre Mis reservas y ve «Piolet · 2026-12-05 a 2026-12-07 · Reservada»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, reservas: [piolet('lucia', '2026-12-05', '2026-12-07')] });
  fijarHoy('2026-12-03');
  await narrar(page, testInfo, 'Lucía entra con su correo y su contraseña y abre Mis reservas');
  await lucia(page);
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await narrar(page, testInfo, 'Ver y cancelar mis reservas. En Mis reservas se ve «Piolet · 2026-12-05 a 2026-12-07 · Reservada».', { criterio: 'AC-004-01' });
  // REQ-F-004 AC1: "GIVEN "lucia@club.es" has a reserva of "Piolet" 2026-12-05..2026-12-07 WHEN she opens Mis reservas THEN the user sees "Piolet · 2026-12-05 a 2026-12-07 · Reservada""
  await expect(page.locator('#contenido').getByText('Piolet · 2026-12-05 a 2026-12-07 · Reservada')).toBeVisible();
  await captura(page, testInfo, 'AC-004-01', { ve: ['Piolet · 2026-12-05 a 2026-12-07 · Reservada'] });
});

test('REQ-F-004 AC2 · AC-004-02 Pablo, sin reservas, abre Mis reservas y ve «No tienes reservas» y ninguna de Lucía', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, reservas: [piolet('lucia', '2026-12-05', '2026-12-07')] });
  fijarHoy('2026-12-03');
  await narrar(page, testInfo, 'Pablo, que no tiene reservas, entra y abre Mis reservas; Lucía sí tiene una de Piolet');
  await pablo(page);
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await narrar(page, testInfo, 'Ver y cancelar mis reservas. En Mis reservas se ve «No tienes reservas», y ninguna reserva de Lucía.', { criterio: 'AC-004-02' });
  // REQ-F-004 AC2: "GIVEN "pablo@club.es" has no reservas WHEN he opens Mis reservas THEN the user sees "No tienes reservas" and none of Lucía's"
  await expect(page.locator('#contenido').getByText('No tienes reservas')).toBeVisible();
  // REQ-F-004 AC2 cláusula: "and none of Lucía's"
  await expect(page.locator('#contenido').getByText('Piolet')).toHaveCount(0);
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await captura(page, testInfo, 'AC-004-02', { ve: ['No tienes reservas'] });
});

test('REQ-F-004 AC3 · AC-004-03 el 2026-12-04 Lucía cancela su reserva y ve «Piolet · 2026-12-05 a 2026-12-07 · Cancelada»', async ({ page, request }, testInfo) => {
  sembrar({ unidades: { Piolet: 1 }, reservas: [piolet('lucia', '2026-12-05', '2026-12-07')] });
  fijarHoy('2026-12-04');
  await narrar(page, testInfo, 'Lucía entra, abre Mis reservas, y cancela su reserva de Piolet; hoy es 4 de diciembre y la reserva empieza el 5');
  await lucia(page);
  await fila(page, 'Piolet · 2026-12-05 a 2026-12-07 · Reservada').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#contenido').getByText('Piolet · 2026-12-05 a 2026-12-07 · Cancelada')).toBeVisible();
  // «la unidad queda libre»: el único piolet se puede volver a reservar esos días
  await request.post('/api/iniciar-sesion', { data: { correo: 'pablo@club.es', contrasena: 'Arista2026' } });
  const otra = await request.post('/api/reservas', { data: { tipo: 'Piolet', desde: '2026-12-06', hasta: '2026-12-06' } });
  await narrar(page, testInfo, 'Ver y cancelar mis reservas. En Mis reservas se ve «Piolet · 2026-12-05 a 2026-12-07 · Cancelada», y la unidad queda libre otra vez: Pablo puede reservar ese piolet el día 6.', { criterio: 'AC-004-03' });
  // REQ-F-004 AC3: "GIVEN today is 2026-12-04 and the reserva starts 2026-12-05 WHEN Lucía cancels it THEN the user sees "Piolet · 2026-12-05 a 2026-12-07 · Cancelada" and the unit is free again"
  await expect(page.locator('#contenido').getByText('Piolet · 2026-12-05 a 2026-12-07 · Cancelada')).toBeVisible();
  // REQ-F-004 AC3 cláusula: "and the unit is free again"
  expect(otra.status()).toBe(201);
  await captura(page, testInfo, 'AC-004-03', { ve: ['Piolet · 2026-12-05 a 2026-12-07 · Cancelada'] });
});

test('REQ-F-004 AC4 · AC-004-04 cancelar otra vez una reserva ya Cancelada deja una sola fila «Cancelada»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, reservas: [piolet('lucia', '2026-12-05', '2026-12-07')] });
  fijarHoy('2026-12-04');
  await narrar(page, testInfo, 'Lucía abre Mis reservas en dos pestañas y cancela su reserva en la primera');
  await lucia(page);
  const otra = await page.context().newPage();
  await otra.goto('/#/mis-reservas');
  await expect(otra.locator('#contenido').getByText('Piolet · 2026-12-05 a 2026-12-07 · Reservada')).toBeVisible();
  await fila(page, 'Reservada').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#contenido').getByText('Piolet · 2026-12-05 a 2026-12-07 · Cancelada')).toBeVisible();
  await narrar(otra, testInfo, 'En la segunda pestaña, que aún enseña la reserva como Reservada, Lucía pulsa Cancelar otra vez');
  const antes = leerAlmacen();
  await fila(otra, 'Reservada').getByRole('button', { name: 'Cancelar' }).click();
  await narrar(otra, testInfo, 'Ver y cancelar mis reservas. La lista sigue mostrando una sola fila cancelada, «Piolet · 2026-12-05 a 2026-12-07 · Cancelada», y no cambia nada más.', { criterio: 'AC-004-04' });
  // REQ-F-004 AC4: "GIVEN the reserva is already cancelled WHEN the cancel is sent again THEN it stays "Cancelada" once, with no other change"
  await expect(otra.locator('#contenido').getByText('Piolet · 2026-12-05 a 2026-12-07 · Cancelada')).toHaveCount(1);
  // REQ-F-004 AC4 cláusula: "it stays "Cancelada" once"
  await expect(otra.locator('tbody tr')).toHaveCount(1);
  await expect(otra.getByRole('alert')).toHaveCount(0);
  // REQ-F-004 AC4 cláusula: "with no other change"
  expect(leerAlmacen()).toEqual(antes);
  expect(leerAlmacen().reservas).toMatchObject([{ id: 1, estado: 'Cancelada', desde: '2026-12-05', hasta: '2026-12-07' }]);
  await captura(otra, testInfo, 'AC-004-04', { ve: ['Piolet · 2026-12-05 a 2026-12-07 · Cancelada'] });
});

test('REQ-F-004 AC5 · AC-004-05 el 2026-12-05 Lucía no puede cancelar la que empieza ese día: «Solo se puede cancelar hasta el día antes»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, reservas: [piolet('lucia', '2026-12-05', '2026-12-07')] });
  fijarHoy('2026-12-05');
  await narrar(page, testInfo, 'Lucía entra, abre Mis reservas y pulsa Cancelar; hoy es 5 de diciembre y la reserva empieza hoy');
  await lucia(page);
  await fila(page, 'Reservada').getByRole('button', { name: 'Cancelar' }).click();
  await narrar(page, testInfo, 'Ver y cancelar mis reservas. En Mis reservas se ve «Solo se puede cancelar hasta el día antes», y la reserva sigue Reservada.', { criterio: 'AC-004-05' });
  // REQ-F-004 AC5: "GIVEN today is 2026-12-05 and the reserva starts 2026-12-05 WHEN Lucía cancels it THEN the user sees "Solo se puede cancelar hasta el día antes" and the reserva stays "Reservada""
  await expect(page.getByRole('alert')).toHaveText('Solo se puede cancelar hasta el día antes');
  // REQ-F-004 AC5 cláusula: "and the reserva stays "Reservada""
  await expect(page.locator('#contenido').getByText('Piolet · 2026-12-05 a 2026-12-07 · Reservada')).toBeVisible();
  expect(leerAlmacen().reservas[0].estado).toBe('Reservada');
  await captura(page, testInfo, 'AC-004-05', { ve: ['Solo se puede cancelar hasta el día antes'] });
});

test('REQ-F-004 AC6 · AC-004-06 Lucía debe una multa de 4 € y en Mis reservas ve «Multa pendiente: 4 €»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, reservas: [piolet('lucia', '2026-12-05', '2026-12-07')], multas: [{ socio: 'lucia', importeEur: 4 }] });
  fijarHoy('2026-12-03');
  await narrar(page, testInfo, 'Lucía, que debe una multa de 4 euros, entra y abre Mis reservas');
  await lucia(page);
  await narrar(page, testInfo, 'Ver y cancelar mis reservas. En Mis reservas se ve «Multa pendiente: 4 €».', { criterio: 'AC-004-06' });
  // REQ-F-004 AC6: "GIVEN "lucia@club.es" owes a multa of 4 € WHEN she opens Mis reservas THEN the user sees "Multa pendiente: 4 €""
  await expect(page.locator('#contenido').getByText('Multa pendiente: 4 €')).toBeVisible();
  await captura(page, testInfo, 'AC-004-06', { ve: ['Multa pendiente: 4 €'] });
});

test('REQ-F-004 AC7 · AC-004-07 Pablo intenta cancelar la reserva de Lucía y ve «No tienes permiso para cancelar esta reserva»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2, Casco: 1 }, reservas: [piolet('lucia', '2026-12-05', '2026-12-07'), { socio: 'pablo', tipo: 'Casco', desde: '2026-12-10', hasta: '2026-12-12' }] });
  fijarHoy('2026-12-03');
  const idDeLucia = leerAlmacen().reservas[0].id;
  // Gancho de pruebas: la pantalla no ofrece cancelar la de otra persona; la petición de Pablo lleva el id de la de Lucía.
  await page.route('**/api/reservas/cancelar', (ruta) => ruta.continue({ postData: JSON.stringify({ reservaId: idDeLucia }) }));
  await narrar(page, testInfo, 'Pablo entra, abre Mis reservas y cancela su reserva, pero su petición lleva la reserva de Lucía');
  await pablo(page);
  await fila(page, 'Casco').getByRole('button', { name: 'Cancelar' }).click();
  await narrar(page, testInfo, 'Ver y cancelar mis reservas. En Mis reservas se ve «No tienes permiso para cancelar esta reserva», y la reserva de Lucía sigue Reservada.', { criterio: 'AC-004-07' });
  // REQ-F-004 AC7: "GIVEN a reserva of Lucía WHEN "pablo@club.es" tries to cancel it THEN the user sees "No tienes permiso para cancelar esta reserva" and it stays "Reservada""
  await expect(page.getByRole('alert')).toHaveText('No tienes permiso para cancelar esta reserva');
  // REQ-F-004 AC7 cláusula: "and it stays "Reservada""
  expect(leerAlmacen().reservas.find((r) => r.id === idDeLucia).estado).toBe('Reservada');
  await expect(page.locator('#contenido').getByText('Casco · 2026-12-10 a 2026-12-12 · Reservada')).toBeVisible();
  await captura(page, testInfo, 'AC-004-07', { ve: ['No tienes permiso para cancelar esta reserva'] });
});

// ───────────── UC-005 Entregar reserva ─────────────

test('REQ-F-005 AC1 · AC-005-01 el 2026-12-05 el encargado entrega a Lucía con «Piolet 2» y ve «Piolet 2 · Lucía · Prestada»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 3 }, reservas: [piolet('lucia', '2026-12-05', '2026-12-07')] });
  fijarHoy('2026-12-05');
  await narrar(page, testInfo, 'El encargado entra y abre Entregas y devoluciones; hoy es 5 de diciembre y Lucía tiene una reserva de Piolet desde hoy');
  await encargado(page);
  await abrirEntregas(page);
  await expect(page.locator('#contenido').getByText('Entregar hoy: Piolet · Lucía')).toBeVisible();
  await narrar(page, testInfo, 'El encargado elige la unidad «Piolet 2» y pulsa Entregar');
  await page.getByLabel('Unidad').selectOption({ label: 'Piolet 2' });
  await page.getByRole('button', { name: 'Entregar' }).click();
  await narrar(page, testInfo, 'Entregar lo reservado. En Entregas y devoluciones se ve «Piolet 2 · Lucía · Prestada».', { criterio: 'AC-005-01' });
  // REQ-F-005 AC1: "GIVEN today is 2026-12-05 and Lucía has a reserva of "Piolet" from 2026-12-05 WHEN the encargado marks it delivered with unit "Piolet 2" THEN the user sees "Piolet 2 · Lucía · Prestada" in Entregas y devoluciones"
  await expect(page.getByRole('status')).toHaveText('Piolet 2 · Lucía · Prestada');
  await captura(page, testInfo, 'AC-005-01', { ve: ['Piolet 2 · Lucía · Prestada'] });
});

test('REQ-F-005 AC2 · AC-005-02 entregar otra vez la reserva ya Prestada deja una sola «Piolet 2 · Lucía · Prestada»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 3 }, reservas: [piolet('lucia', '2026-12-05', '2026-12-07')] });
  fijarHoy('2026-12-05');
  await narrar(page, testInfo, 'El encargado abre Entregas y devoluciones en dos pestañas; hoy es 5 de diciembre');
  await encargado(page);
  await abrirEntregas(page);
  const otra = await page.context().newPage();
  await otra.goto('/#/entregas');
  await expect(otra.locator('#contenido').getByText('Entregar hoy: Piolet · Lucía')).toBeVisible();
  await page.getByLabel('Unidad').selectOption({ label: 'Piolet 2' });
  await page.getByRole('button', { name: 'Entregar' }).click();
  await expect(page.getByRole('status')).toHaveText('Piolet 2 · Lucía · Prestada');
  await narrar(otra, testInfo, 'En la segunda pestaña, que aún enseña la reserva por entregar, el encargado elige «Piolet 3» y pulsa Entregar otra vez');
  await otra.getByLabel('Unidad').selectOption({ label: 'Piolet 3' });
  await otra.getByRole('button', { name: 'Entregar' }).click();
  await narrar(otra, testInfo, 'Entregar lo reservado. La lista sigue con una sola fila prestada, «Piolet 2 · Lucía · Prestada», y no se asigna una segunda unidad.', { criterio: 'AC-005-02' });
  // REQ-F-005 AC2: "GIVEN the same reserva is already "Prestada" WHEN delivered again THEN there is still one "Piolet 2 · Lucía · Prestada" and no second unit is assigned"
  await expect(otra.locator('#contenido').getByText('Piolet 2 · Lucía · Prestada', { exact: true })).toHaveCount(1);
  await expect(otra.locator('#contenido').getByText('Prestado: Piolet 2 · Lucía · hasta 2026-12-07')).toHaveCount(1);
  // REQ-F-005 AC2 cláusula: "and no second unit is assigned"
  expect(leerAlmacen().reservas).toMatchObject([{ id: 1, estado: 'Prestada', unidadId: 2 }]);
  await captura(otra, testInfo, 'AC-005-02', { ve: ['Piolet 2 · Lucía · Prestada'] });
});

test('REQ-F-005 AC3 · AC-005-03 el 2026-12-04 entregar la reserva que empieza el 2026-12-05 muestra «Aún no es la fecha de entrega»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 3 }, reservas: [piolet('lucia', '2026-12-05', '2026-12-07')] });
  fijarHoy('2026-12-05');
  await narrar(page, testInfo, 'El encargado tiene abierta Entregas y devoluciones con la reserva de Lucía, que empieza el 5 de diciembre');
  await encargado(page);
  await abrirEntregas(page);
  await expect(page.locator('#contenido').getByText('Entregar hoy: Piolet · Lucía')).toBeVisible();
  // La pantalla solo ofrece entregar lo de hoy: el día del servidor vuelve al 4 con la pantalla ya abierta.
  fijarHoy('2026-12-04');
  await narrar(page, testInfo, 'Es 4 de diciembre y el encargado pulsa Entregar');
  await page.getByRole('button', { name: 'Entregar' }).click();
  await narrar(page, testInfo, 'Entregar lo reservado. En Entregas y devoluciones se ve «Aún no es la fecha de entrega», y la reserva sigue Reservada.', { criterio: 'AC-005-03' });
  // REQ-F-005 AC3: "GIVEN today is 2026-12-04 and the reserva starts 2026-12-05 WHEN the encargado marks it delivered THEN the user sees "Aún no es la fecha de entrega" and it stays "Reservada""
  await expect(page.getByRole('alert')).toHaveText('Aún no es la fecha de entrega');
  // REQ-F-005 AC3 cláusula: "and it stays "Reservada""
  await expect(page.locator('#contenido').getByText('Entregar hoy: Piolet · Lucía')).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(leerAlmacen().reservas).toMatchObject([{ estado: 'Reservada', unidadId: null }]);
  await captura(page, testInfo, 'AC-005-03', { ve: ['Aún no es la fecha de entrega'] });
});

test('REQ-F-005 AC4 · AC-005-04 la reserva del 2026-12-05 al 2026-12-07 sin recoger se ve «No recogida» el 2026-12-08', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, reservas: [piolet('lucia', '2026-12-05', '2026-12-07')] });
  fijarHoy('2026-12-07');
  await narrar(page, testInfo, 'El encargado abre Entregas y devoluciones el 7 de diciembre: la reserva de Lucía, hasta hoy, sigue sin entregar');
  await encargado(page);
  await abrirEntregas(page);
  await expect(page.locator('#contenido').getByText('Entregar hoy: Piolet · Lucía')).toBeVisible();
  await narrar(page, testInfo, 'Pasa un día: es 8 de diciembre, su sesión ha caducado, y el encargado entra de nuevo y abre Entregas y devoluciones');
  fijarHoy('2026-12-08');
  await encargado(page);
  await abrirEntregas(page);
  // «sus unidades quedan libres»: ningún piolet figura como prestado
  const inventario = await (await page.request.get('/api/inventario')).json();
  expect(inventario[0].unidades.map((u) => u.prestada)).toEqual([false, false]);
  await narrar(page, testInfo, 'Entregar lo reservado. En Entregas y devoluciones se ve «Piolet · Lucía · No recogida», sus unidades quedan libres y ya no figura en Entregar hoy.', { criterio: 'AC-005-04' });
  // REQ-F-005 AC4: "GIVEN a reserva 2026-12-05..2026-12-07 never delivered WHEN the date becomes 2026-12-08 THEN the user sees "No recogida" for it in Entregas y devoluciones and its units are free"
  await expect(page.locator('#contenido').getByText('Piolet · Lucía · No recogida')).toBeVisible();
  // REQ-F-005 AC4 cláusula: "and its units are free"
  await expect(page.locator('#contenido').getByText('Entregar hoy: Piolet · Lucía')).toHaveCount(0);
  await expect(page.locator('#contenido').getByText('Prestado:')).toHaveCount(0);
  await captura(page, testInfo, 'AC-005-04', { ve: ['Piolet · Lucía · No recogida'] });
});

// ───────────── UC-009 Ver entregas y devoluciones ─────────────

test('REQ-F-009 AC1 · AC-009-01 el 2026-12-07 el encargado ve «Vuelve hoy: Piolet 2 · Lucía» y «Prestado: Casco 1 · Pablo · hasta 2026-12-09»', async ({ page }, testInfo) => {
  sembrar({
    unidades: { Piolet: 3, Casco: 2 },
    reservas: [piolet('lucia', '2026-12-05', '2026-12-07', { estado: 'Prestada', unidad: 'Piolet 2' }), { socio: 'pablo', tipo: 'Casco', desde: '2026-12-06', hasta: '2026-12-09', estado: 'Prestada', unidad: 'Casco 1' }],
  });
  fijarHoy('2026-12-07');
  await narrar(page, testInfo, 'El encargado entra y abre Entregas y devoluciones el 7 de diciembre; Piolet 2 está prestado a Lucía hasta hoy y Casco 1 a Pablo hasta el 9');
  await encargado(page);
  await abrirEntregas(page);
  await narrar(page, testInfo, 'Ver lo prestado y lo que vuelve cada día. En Entregas y devoluciones se ve «Vuelve hoy: Piolet 2 · Lucía» y «Prestado: Casco 1 · Pablo · hasta 2026-12-09».', { criterio: 'AC-009-01' });
  // REQ-F-009 AC1: "GIVEN today is 2026-12-07, "Piolet 2" lent to Lucía until 2026-12-07 and "Casco 1" lent to Pablo until 2026-12-09 WHEN the encargado opens Entregas y devoluciones THEN the user sees "Vuelve hoy: Piolet 2 · Lucía" and "Prestado: Casco 1 · Pablo · hasta 2026-12-09""
  await expect(page.locator('#contenido').getByText('Vuelve hoy: Piolet 2 · Lucía')).toBeVisible();
  await expect(page.locator('#contenido').getByText('Prestado: Casco 1 · Pablo · hasta 2026-12-09')).toBeVisible();
  await captura(page, testInfo, 'AC-009-01', { ve: ['Vuelve hoy: Piolet 2 · Lucía', 'Prestado: Casco 1 · Pablo · hasta 2026-12-09'] });
});

test('REQ-F-009 AC2 · AC-009-02 «Cuerda 1» prestada a Marta hasta el 2026-12-05 se ve «Con retraso: Cuerda 1 · Marta · 2 días» el 2026-12-07', async ({ page }, testInfo) => {
  sembrar({ unidades: { Cuerda: 2 }, reservas: [{ socio: 'marta', tipo: 'Cuerda', desde: '2026-12-01', hasta: '2026-12-05', estado: 'Prestada', unidad: 'Cuerda 1' }] });
  fijarHoy('2026-12-07');
  await narrar(page, testInfo, 'El encargado entra y abre Entregas y devoluciones el 7 de diciembre; la Cuerda 1 de Marta debía volver el 5');
  await encargado(page);
  await abrirEntregas(page);
  await narrar(page, testInfo, 'Ver lo prestado y lo que vuelve cada día. En Entregas y devoluciones se ve «Con retraso: Cuerda 1 · Marta · 2 días».', { criterio: 'AC-009-02' });
  // REQ-F-009 AC2: "GIVEN "Cuerda 1" lent to Marta until 2026-12-05 and today is 2026-12-07 THEN the user sees "Con retraso: Cuerda 1 · Marta · 2 días""
  await expect(page.locator('#contenido').getByText('Con retraso: Cuerda 1 · Marta · 2 días')).toBeVisible();
  await captura(page, testInfo, 'AC-009-02', { ve: ['Con retraso: Cuerda 1 · Marta · 2 días'] });
});

test('REQ-F-009 AC3 · AC-009-03 Lucía tiene una reserva de Piolet que empieza hoy y el encargado ve «Entregar hoy: Piolet · Lucía»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 3 }, reservas: [piolet('lucia', '2026-12-07', '2026-12-09')] });
  fijarHoy('2026-12-07');
  await narrar(page, testInfo, 'El encargado entra y abre Entregas y devoluciones el 7 de diciembre; Lucía tiene una reserva de Piolet que empieza hoy');
  await encargado(page);
  await abrirEntregas(page);
  await narrar(page, testInfo, 'Ver lo prestado y lo que vuelve cada día. En Entregas y devoluciones se ve «Entregar hoy: Piolet · Lucía».', { criterio: 'AC-009-03' });
  // REQ-F-009 AC3: "GIVEN a reserva of Lucía starts today WHEN the encargado opens the screen THEN the user sees "Entregar hoy: Piolet · Lucía""
  await expect(page.locator('#contenido').getByText('Entregar hoy: Piolet · Lucía')).toBeVisible();
  await captura(page, testInfo, 'AC-009-03', { ve: ['Entregar hoy: Piolet · Lucía'] });
});

test('REQ-F-009 AC4 · AC-009-04 con nada prestado el encargado ve «No hay material prestado»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 3 } });
  fijarHoy('2026-12-07');
  await narrar(page, testInfo, 'El encargado entra y abre Entregas y devoluciones; no hay nada prestado');
  await encargado(page);
  await abrirEntregas(page);
  await narrar(page, testInfo, 'Ver lo prestado y lo que vuelve cada día. En Entregas y devoluciones se ve «No hay material prestado».', { criterio: 'AC-009-04' });
  // REQ-F-009 AC4: "GIVEN nothing is lent WHEN the encargado opens the screen THEN the user sees "No hay material prestado""
  await expect(page.locator('#contenido').getByText('No hay material prestado')).toBeVisible();
  await captura(page, testInfo, 'AC-009-04', { ve: ['No hay material prestado'] });
});

test('REQ-F-009 AC5 · AC-009-05 la junta abre Entregas y devoluciones y ve «Prestado: Casco 1 · Pablo · hasta 2026-12-09» sin botones', async ({ page }, testInfo) => {
  sembrar({
    unidades: { Piolet: 3, Casco: 2 },
    reservas: [{ socio: 'pablo', tipo: 'Casco', desde: '2026-12-06', hasta: '2026-12-09', estado: 'Prestada', unidad: 'Casco 1' }, piolet('lucia', '2026-12-07', '2026-12-09')],
  });
  fijarHoy('2026-12-07');
  await narrar(page, testInfo, 'La junta entra y abre Entregas y devoluciones; Casco 1 está prestado a Pablo hasta el 9 y Lucía tiene algo por entregar hoy');
  await junta(page);
  await abrirEntregas(page);
  await narrar(page, testInfo, 'Ver lo prestado y lo que vuelve cada día. En Entregas y devoluciones se ve «Prestado: Casco 1 · Pablo · hasta 2026-12-09», y la lista no tiene botones de entregar ni de devolver.', { criterio: 'AC-009-05' });
  // REQ-F-009 AC5: "GIVEN the junta member "ana@club.es" WHEN she opens Entregas y devoluciones THEN the user sees the list without delivery or return buttons"
  await expect(page.locator('#contenido').getByText('Prestado: Casco 1 · Pablo · hasta 2026-12-09')).toBeVisible();
  // REQ-F-009 AC5 cláusula: "the list without delivery or return buttons"
  await expect(page.locator('#contenido').getByText('Entregar hoy: Piolet · Lucía')).toBeVisible();
  await expect(page.locator('#contenido').getByRole('button')).toHaveCount(0);
  await expect(page.locator('#contenido').getByRole('combobox')).toHaveCount(0);
  await captura(page, testInfo, 'AC-009-05', { ve: ['Prestado: Casco 1 · Pablo · hasta 2026-12-09'] });
});

// ───────────── Demo de la FASE-1: del socio que cancela al encargado que entrega ─────────────

test('FASE-1 Demo: Pablo cancela, Lucía no puede, el encargado entrega y la junta lo ve sin botones', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, reservas: [piolet('lucia', '2026-12-03', '2026-12-05'), piolet('pablo', '2026-12-10', '2026-12-12')] });
  fijarHoy('2026-12-03');
  const salir = async () => { await page.getByRole('button', { name: 'Salir' }).click(); await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible(); };

  await narrar(page, testInfo, 'Paso 1: hoy es 3 de diciembre; Pablo abre Mis reservas y ve solo la suya');
  await pablo(page);
  await expect(page.locator('#contenido').getByText('Piolet · 2026-12-10 a 2026-12-12 · Reservada')).toBeVisible();
  await expect(page.locator('#contenido').getByText('Piolet · 2026-12-03 a 2026-12-05')).toHaveCount(0);

  await narrar(page, testInfo, 'Paso 2: Pablo cancela su reserva del 10 de diciembre y pasa a Cancelada');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#contenido').getByText('Piolet · 2026-12-10 a 2026-12-12 · Cancelada')).toBeVisible();
  await salir();

  await narrar(page, testInfo, 'Paso 3: Lucía intenta cancelar la suya, que empezó hoy, y la web la rechaza');
  await lucia(page);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Solo se puede cancelar hasta el día antes');
  await salir();

  await narrar(page, testInfo, 'Paso 4: el encargado abre Entregas y devoluciones y ve a Lucía por entregar hoy');
  await encargado(page);
  await abrirEntregas(page);
  await expect(page.locator('#contenido').getByText('Entregar hoy: Piolet · Lucía')).toBeVisible();
  const otra = await page.context().newPage();
  await otra.goto('/#/entregas');
  await expect(otra.locator('#contenido').getByText('Entregar hoy: Piolet · Lucía')).toBeVisible();

  await narrar(page, testInfo, 'Paso 5: el encargado entrega a Lucía y la reserva pasa a Prestada con una unidad');
  await page.getByLabel('Unidad').selectOption({ label: 'Piolet 1' });
  await page.getByRole('button', { name: 'Entregar' }).click();
  await expect(page.getByRole('status')).toHaveText('Piolet 1 · Lucía · Prestada');

  await narrar(otra, testInfo, 'Paso 6: el encargado repite la entrega desde la otra pestaña, y no se asigna otra unidad');
  await otra.getByLabel('Unidad').selectOption({ label: 'Piolet 2' });
  await otra.getByRole('button', { name: 'Entregar' }).click();
  await expect(otra.getByRole('status')).toHaveText('Piolet 1 · Lucía · Prestada');
  expect(leerAlmacen().reservas.filter((r) => r.estado === 'Prestada')).toHaveLength(1);
  await otra.close();
  await salir();

  await narrar(page, testInfo, 'Paso 7: la junta abre Entregas y devoluciones y lo ve todo sin botones');
  await junta(page);
  await abrirEntregas(page);
  await expect(page.locator('#contenido').getByText('Prestado: Piolet 1 · Lucía · hasta 2026-12-05')).toBeVisible();
  await expect(page.locator('#contenido').getByRole('button')).toHaveCount(0);
});
