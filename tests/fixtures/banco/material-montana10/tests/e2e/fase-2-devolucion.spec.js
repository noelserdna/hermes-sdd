// Recorrido de la FASE-2 por la ruta del usuario: devolver y multar (UC-006), pagar la multa (UC-007) y consultar el historial
// (UC-010), cerrando el ciclo WF-001. Una prueba por criterio, con su locución y su captura, más el recorrido de la demo con
// vídeo WF-001. Entra siempre por la dirección de la web y la pantalla de Entrar, con la semilla de pruebas y el «hoy» del criterio.
import { test, expect, narrar, captura } from './fixtures/evidence.js';
import { sembrar, leerAlmacen, modificarAlmacen } from './fixtures/semilla.js';
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
const salir = async (page) => { await page.getByRole('button', { name: 'Salir' }).click(); await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible(); };
const abrir = async (page, enlace, titulo = enlace) => {
  await page.getByRole('link', { name: enlace, exact: true }).click();
  await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible();
};
const abrirEntregas = (page) => abrir(page, 'Entregas y devoluciones');
const abrirMultas = (page) => abrir(page, 'Multas');
const abrirHistorial = (page) => abrir(page, 'Historial');
const contenido = (page) => page.locator('#contenido');
const devolver = (page, texto) => page.locator('li', { hasText: texto }).getByRole('button', { name: 'Devolver' }).first().click();
const marcarPagada = (page, texto) => page.locator('li', { hasText: texto }).getByRole('button', { name: 'Marcar como pagada' }).click();
const verHistorial = async (page, socio) => {
  await page.getByLabel('Socio').selectOption({ label: socio });
  await page.getByRole('button', { name: 'Ver historial' }).click();
};
const prestada = (socio, tipo, unidad, hasta, desde = '2026-12-05', extra = {}) => ({ socio, tipo, desde, hasta, estado: 'Prestada', unidad, ...extra });
// Una sesión aparte (otro navegador) para ver lo que ve el socio sin perder la pantalla del encargado.
const sesionAparte = async (page, testInfo, entrarCon) => {
  const contexto = await page.context().browser().newContext({ baseURL: testInfo.project.use.baseURL, locale: 'es-ES' });
  const otra = await contexto.newPage();
  await entrarCon(otra);
  return { otra, cerrar: () => contexto.close() };
};

// ───────────── UC-006 Devolver y multar ─────────────

test('REQ-F-006 AC1 · AC-006-01 el encargado marca devuelto «Piolet 2» de Lucía el día hasta y ve «Piolet 2 · Lucía · Devuelta» sin multa', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, reservas: [prestada('lucia', 'Piolet', 'Piolet 2', '2026-12-07')] });
  fijarHoy('2026-12-07');
  await narrar(page, testInfo, 'El encargado entra, abre Entregas y devoluciones y marca devuelto el Piolet 2 de Lucía, que volvía hoy, 7 de diciembre');
  await encargado(page);
  await abrirEntregas(page);
  await devolver(page, 'Piolet 2 · Lucía');
  await narrar(page, testInfo, 'Marcar la devolución y poner la multa. En Entregas y devoluciones se ve «Piolet 2 · Lucía · Devuelta», y no se crea ninguna multa.', { criterio: 'AC-006-01' });
  // REQ-F-006 AC1: "GIVEN "Piolet 2" lent to Lucía until 2026-12-07 WHEN the encargado marks it returned on 2026-12-07 THEN the user sees "Piolet 2 · Lucía · Devuelta" and no multa exists"
  await expect(contenido(page).getByRole('status')).toHaveText('Piolet 2 · Lucía · Devuelta');
  // REQ-F-006 AC1 cláusula: "and no multa exists"
  await expect(contenido(page).getByText('Multa de')).toHaveCount(0);
  expect(leerAlmacen().multas).toEqual([]);
  expect(leerAlmacen().reservas[0]).toMatchObject({ estado: 'Devuelta', devueltaEl: '2026-12-07' });
  await captura(page, testInfo, 'AC-006-01', { ve: ['Piolet 2 · Lucía · Devuelta'] });
});

test('REQ-F-006 AC2 · AC-006-02 «Casco 1» de Pablo vuelve el 2026-12-10, con hasta el 2026-12-07, y se ve «Multa de 6 € a Pablo (3 días de retraso)»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Casco: 2 }, reservas: [prestada('pablo', 'Casco', 'Casco 1', '2026-12-07')] });
  fijarHoy('2026-12-10');
  await narrar(page, testInfo, 'El encargado entra, abre Entregas y devoluciones y marca devuelto el Casco 1 de Pablo, que debía volver el 7 y llega el 10 de diciembre');
  await encargado(page);
  await abrirEntregas(page);
  await devolver(page, 'Casco 1 · Pablo');
  await narrar(page, testInfo, 'Marcar la devolución y poner la multa. En Entregas y devoluciones se ve «Multa de 6 € a Pablo (3 días de retraso)».', { criterio: 'AC-006-02' });
  // REQ-F-006 AC2: "GIVEN "Casco 1" lent to Pablo until 2026-12-07 WHEN it is returned on 2026-12-10 THEN the user sees "Multa de 6 € a Pablo (3 días de retraso)""
  await expect(contenido(page).getByText('Multa de 6 € a Pablo (3 días de retraso)')).toBeVisible();
  expect(leerAlmacen().multas).toMatchObject([{ importeEur: 6, dias: 3, estado: 'Pendiente' }]);
  await captura(page, testInfo, 'AC-006-02', { ve: ['Multa de 6 € a Pablo (3 días de retraso)'] });
});

test('REQ-F-006 AC3 · AC-006-03 «Cuerda 1» de Lucía vuelve con 1 día de retraso: «Multa de 2 € a Lucía (1 día de retraso)» y ella ve «Multa pendiente: 2 €»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Cuerda: 2 }, reservas: [prestada('lucia', 'Cuerda', 'Cuerda 1', '2026-12-07')] });
  fijarHoy('2026-12-08');
  await narrar(page, testInfo, 'El encargado entra, abre Entregas y devoluciones y marca devuelta la Cuerda 1 de Lucía, que debía volver el 7 y llega el 8 de diciembre');
  await encargado(page);
  await abrirEntregas(page);
  await devolver(page, 'Cuerda 1 · Lucía');
  await expect(contenido(page).getByText('Multa de 2 € a Lucía (1 día de retraso)')).toBeVisible();
  await narrar(page, testInfo, 'Después Lucía entra en otra sesión y abre Mis reservas');
  const { otra, cerrar } = await sesionAparte(page, testInfo, lucia);
  await expect(otra.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await narrar(page, testInfo, 'Marcar la devolución y poner la multa. En Entregas y devoluciones se ve «Multa de 2 € a Lucía (1 día de retraso)», y Lucía ve «Multa pendiente: 2 €» en Mis reservas.', { criterio: 'AC-006-03' });
  // REQ-F-006 AC3: "GIVEN "Cuerda 1" lent to Lucía until 2026-12-07 WHEN it is returned on 2026-12-08 THEN the user sees "Multa de 2 € a Lucía (1 días de retraso)" and Lucía sees "Multa pendiente: 2 €" in Mis reservas"
  await expect(contenido(page).getByText('Multa de 2 € a Lucía (1 día de retraso)')).toBeVisible();
  // REQ-F-006 AC3 cláusula: "and Lucía sees "Multa pendiente: 2 €" in Mis reservas"
  await expect(otra.locator('#contenido').getByText('Multa pendiente: 2 €')).toBeVisible();
  await cerrar();
  await captura(page, testInfo, 'AC-006-03', { ve: ['Multa de 2 € a Lucía (1 día de retraso)'] });
});

test('REQ-F-006 AC4 · AC-006-04 repetir la devolución de «Casco 1» de Pablo desde una pantalla vieja deja una sola multa de 6 €', async ({ page }, testInfo) => {
  sembrar({ unidades: { Casco: 2 }, reservas: [prestada('pablo', 'Casco', 'Casco 1', '2026-12-07')] });
  fijarHoy('2026-12-10');
  await narrar(page, testInfo, 'El encargado abre Entregas y devoluciones en dos pestañas y marca devuelto el Casco 1 de Pablo, con 3 días de retraso, en la primera');
  await encargado(page);
  await abrirEntregas(page);
  const otra = await page.context().newPage();
  await otra.goto('/#/entregas');
  await expect(otra.locator('#contenido').getByText('Con retraso: Casco 1 · Pablo · 3 días')).toBeVisible();
  await devolver(page, 'Casco 1 · Pablo');
  await expect(contenido(page).getByText('Multa de 6 € a Pablo (3 días de retraso)')).toBeVisible();
  await narrar(otra, testInfo, 'En la segunda pestaña, que aún enseña el Casco 1 por devolver, el encargado marca la devolución otra vez y abre Multas');
  const antes = leerAlmacen();
  await devolver(otra, 'Casco 1 · Pablo');
  await expect(otra.getByRole('status').first()).toHaveText('Casco 1 · Pablo · Devuelta');
  await abrirMultas(otra);
  await narrar(otra, testInfo, 'Marcar la devolución y poner la multa. La lista de multas sigue con una sola, la de 6 € de Pablo.', { criterio: 'AC-006-04' });
  // REQ-F-006 AC4: "GIVEN "Casco 1" is already "Devuelta" WHEN the return is marked again THEN there is still one multa of 6 € for Pablo"
  await expect(otra.locator('#contenido li')).toHaveCount(1);
  await expect(otra.locator('#contenido li')).toContainText('Multa de 6 € · Pablo · Pendiente');
  // REQ-F-006 AC4 cláusula: "there is still one multa" (y la devolución no cambia nada)
  expect(leerAlmacen()).toEqual(antes);
  expect(leerAlmacen().multas).toHaveLength(1);
  await captura(otra, testInfo, 'AC-006-04', { ve: ['Multa de 6 € · Pablo · Pendiente'] });
});

test('REQ-F-006 AC5 · AC-006-05 devolver una reserva que no está prestada muestra «Esa reserva no está prestada» y no crea multa', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, reservas: [prestada('lucia', 'Piolet', 'Piolet 1', '2026-12-07')] });
  fijarHoy('2026-12-10');
  await narrar(page, testInfo, 'El encargado abre Entregas y devoluciones, donde el piolet de Lucía figura prestado; entretanto la reserva vuelve a estar solo Reservada, sin entregar');
  await encargado(page);
  await abrirEntregas(page);
  await expect(contenido(page).getByText('Con retraso: Piolet 1 · Lucía · 3 días')).toBeVisible();
  modificarAlmacen((datos) => { datos.reservas[0].estado = 'Reservada'; datos.reservas[0].unidadId = null; });
  await devolver(page, 'Piolet 1 · Lucía');
  await narrar(page, testInfo, 'Marcar la devolución y poner la multa. En Entregas y devoluciones se ve «Esa reserva no está prestada», y no se crea ninguna multa.', { criterio: 'AC-006-05' });
  // REQ-F-006 AC5: "GIVEN a loan not delivered (reserva "Reservada") WHEN the encargado marks it returned THEN the user sees "Esa reserva no está prestada""
  await expect(contenido(page).getByRole('alert')).toHaveText('Esa reserva no está prestada');
  expect(leerAlmacen().multas).toEqual([]);
  expect(leerAlmacen().reservas[0].estado).toBe('Reservada');
  await captura(page, testInfo, 'AC-006-05', { ve: ['Esa reserva no está prestada'] });
});

test('AC-006-06 devolver una reserva que ya no existe muestra «No existe esa reserva» y no cambia nada', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, reservas: [prestada('lucia', 'Piolet', 'Piolet 1', '2026-12-07')] });
  fijarHoy('2026-12-10');
  await narrar(page, testInfo, 'El encargado abre Entregas y devoluciones con el piolet de Lucía por devolver; entretanto la reserva desaparece del almacén');
  await encargado(page);
  await abrirEntregas(page);
  await expect(contenido(page).getByText('Con retraso: Piolet 1 · Lucía · 3 días')).toBeVisible();
  modificarAlmacen((datos) => { datos.reservas = []; });
  const antes = leerAlmacen();
  await devolver(page, 'Piolet 1 · Lucía');
  await narrar(page, testInfo, 'Marcar la devolución y poner la multa. En Entregas y devoluciones se ve «No existe esa reserva», y no cambia nada.', { criterio: 'AC-006-06' });
  // AC-006-06: "When the encargado returns a reserva that does not exist Then error E_RESERVA_NO_ENCONTRADA and nothing changes"
  await expect(contenido(page).getByRole('alert')).toHaveText('No existe esa reserva');
  // AC-006-06 cláusula: "and nothing changes"
  expect(leerAlmacen()).toEqual(antes);
  await captura(page, testInfo, 'AC-006-06', { ve: ['No existe esa reserva'] });
});

// ───────────── UC-007 Pagar multa ─────────────

test('REQ-F-007 AC1 · AC-007-01 el encargado marca pagada la multa de 6 € de Pablo y ve «Multa de 6 € · Pablo · Pagada»; Pablo ya puede reservar', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, multas: [{ socio: 'pablo', importeEur: 6 }] });
  fijarHoy('2026-12-10');
  await narrar(page, testInfo, 'El encargado entra, abre Multas y marca como pagada la multa de 6 euros de Pablo');
  await encargado(page);
  await abrirMultas(page);
  await expect(contenido(page).getByText('Multa de 6 € · Pablo · Pendiente')).toBeVisible();
  await marcarPagada(page, 'Pablo');
  await expect(contenido(page).getByRole('status')).toHaveText('Multa de 6 € · Pablo · Pagada');
  await narrar(page, testInfo, 'Después Pablo entra en otra sesión y reserva un piolet para el 12 de diciembre');
  const { otra, cerrar } = await sesionAparte(page, testInfo, pablo);
  await abrir(otra, 'Reservar', 'Reservar material');
  await otra.getByLabel('Material').selectOption('Piolet');
  await otra.getByLabel('Desde').fill('2026-12-12');
  await otra.getByLabel('Hasta').fill('2026-12-12');
  await otra.getByRole('button', { name: 'Reservar' }).click();
  await narrar(page, testInfo, 'Marcar la multa como pagada. En Multas se ve «Multa de 6 € · Pablo · Pagada», con su fecha, y Pablo puede reservar de nuevo.', { criterio: 'AC-007-01' });
  // REQ-F-007 AC1: "GIVEN Pablo has a multa of 6 € pendiente WHEN the encargado marks it paid THEN the user sees "Multa de 6 € · Pablo · Pagada" in Multas and Pablo can reserve"
  await expect(contenido(page).getByText('Multa de 6 € · Pablo · Pagada').first()).toBeVisible();
  await expect(contenido(page).locator('li', { hasText: 'Pablo' })).toContainText('pagada el 2026-12-10');
  await expect(contenido(page).getByRole('button', { name: 'Marcar como pagada' })).toHaveCount(0);
  // REQ-F-007 AC1 cláusula: "and Pablo can reserve"
  await expect(otra.locator('#contenido').getByRole('status')).toHaveText('Reserva creada: Piolet del 2026-12-12 al 2026-12-12');
  await cerrar();
  await captura(page, testInfo, 'AC-007-01', { ve: ['Multa de 6 € · Pablo · Pagada'] });
});

test('REQ-F-007 AC2 · AC-007-02 Lucía, con multas de 2 € y 4 €, tras pagar la de 2 € sigue viendo «Multa pendiente: 4 €» y no puede reservar', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, multas: [{ socio: 'lucia', importeEur: 2 }, { socio: 'lucia', importeEur: 4 }] });
  fijarHoy('2026-12-10');
  await narrar(page, testInfo, 'El encargado entra, abre Multas y marca como pagada la multa de 2 euros de Lucía, que tiene otra de 4 euros');
  await encargado(page);
  await abrirMultas(page);
  await marcarPagada(page, 'Multa de 2 € · Lucía');
  await expect(contenido(page).getByRole('status')).toHaveText('Multa de 2 € · Lucía · Pagada');
  await expect(contenido(page).getByText('Multa de 4 € · Lucía · Pendiente')).toBeVisible();
  await salir(page);
  await narrar(page, testInfo, 'Lucía entra e intenta reservar un piolet para el 12 de diciembre, y la web se lo rechaza');
  await lucia(page);
  await abrir(page, 'Reservar', 'Reservar material');
  await page.getByLabel('Material').selectOption('Piolet');
  await page.getByLabel('Desde').fill('2026-12-12');
  await page.getByLabel('Hasta').fill('2026-12-12');
  await page.getByRole('button', { name: 'Reservar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar');
  await abrir(page, 'Mis reservas');
  await narrar(page, testInfo, 'Marcar la multa como pagada. En Mis reservas se ve «Multa pendiente: 4 €», y Lucía no puede reservar.', { criterio: 'AC-007-02' });
  // REQ-F-007 AC2: "GIVEN Lucía has two multas pendientes (2 € and 4 €) WHEN the encargado marks the 2 € one paid THEN Lucía still sees "Multa pendiente: 4 €" and cannot reserve"
  await expect(contenido(page).getByText('Multa pendiente: 4 €')).toBeVisible();
  await expect(contenido(page).getByText('Multa pendiente: 2 €')).toHaveCount(0);
  // REQ-F-007 AC2 cláusula: "and cannot reserve"
  expect(leerAlmacen().reservas).toEqual([]);
  await captura(page, testInfo, 'AC-007-02', { ve: ['Multa pendiente: 4 €'] });
});

test('REQ-F-007 AC3 · AC-007-03 marcar pagada otra vez la multa de 6 € de Pablo deja una sola «Pagada» con la misma fecha de pago', async ({ page }, testInfo) => {
  sembrar({ unidades: { Casco: 2 }, multas: [{ socio: 'pablo', importeEur: 6 }] });
  fijarHoy('2026-12-09');
  await narrar(page, testInfo, 'El encargado abre Multas, donde la multa de 6 euros de Pablo figura Pendiente; entretanto ya quedó pagada el 1 de diciembre');
  await encargado(page);
  await abrirMultas(page);
  await expect(contenido(page).getByText('Multa de 6 € · Pablo · Pendiente')).toBeVisible();
  modificarAlmacen((datos) => { datos.multas[0].estado = 'Pagada'; datos.multas[0].pagadaEl = '2026-12-01'; });
  await narrar(page, testInfo, 'El 9 de diciembre el encargado pulsa Marcar como pagada sobre esa multa, que su pantalla aún enseñaba como Pendiente');
  const antes = leerAlmacen();
  await marcarPagada(page, 'Pablo');
  await expect(contenido(page).getByRole('status')).toHaveText('Multa de 6 € · Pablo · Pagada');
  await narrar(page, testInfo, 'Marcar la multa como pagada. La lista de multas no cambia: sigue una sola, «Multa de 6 € · Pablo · Pagada», con la misma fecha de pago, el 1 de diciembre.', { criterio: 'AC-007-03' });
  // REQ-F-007 AC3: "GIVEN the multa is already paid WHEN marked paid again THEN it stays "Pagada" once, with the same paid date"
  await expect(contenido(page).locator('li')).toHaveCount(1);
  // REQ-F-007 AC3 cláusula: "it stays "Pagada" once"
  await expect(contenido(page).locator('li')).toContainText('Multa de 6 € · Pablo · Pagada');
  // REQ-F-007 AC3 cláusula: "with the same paid date"
  await expect(contenido(page).locator('li')).toContainText('pagada el 2026-12-01');
  expect(leerAlmacen()).toEqual(antes);
  await captura(page, testInfo, 'AC-007-03', { ve: ['Multa de 6 € · Pablo · Pagada'] });
});

test('REQ-F-007 AC4 · AC-007-04 Lucía abre Multas por su dirección y ve «No tienes permiso para ver esta pantalla»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, multas: [{ socio: 'pablo', importeEur: 6 }] });
  fijarHoy('2026-12-10');
  await narrar(page, testInfo, 'Lucía entra con su correo y su contraseña y escribe la dirección de Multas en el navegador');
  await lucia(page);
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await page.goto('/#/multas');
  await narrar(page, testInfo, 'Marcar la multa como pagada. En Multas se ve «No tienes permiso para ver esta pantalla», y ninguna multa de Pablo.', { criterio: 'AC-007-04' });
  // REQ-F-007 AC4: "GIVEN the socio "lucia@club.es" WHEN she opens Multas by address THEN the user sees "No tienes permiso para ver esta pantalla""
  await expect(contenido(page).getByRole('alert')).toHaveText('No tienes permiso para ver esta pantalla');
  await expect(contenido(page).getByText('Pablo')).toHaveCount(0);
  await expect(contenido(page).getByRole('button', { name: 'Marcar como pagada' })).toHaveCount(0);
  await captura(page, testInfo, 'AC-007-04', { ve: ['No tienes permiso para ver esta pantalla'] });
});

test('AC-007-05 marcar pagada una multa que ya no existe muestra «No se encontró esa multa» y no cambia ninguna', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, multas: [{ socio: 'pablo', importeEur: 6 }, { socio: 'lucia', importeEur: 2 }] });
  fijarHoy('2026-12-10');
  await narrar(page, testInfo, 'El encargado abre Multas con las multas de Pablo y de Lucía; entretanto la de Pablo desaparece del almacén');
  await encargado(page);
  await abrirMultas(page);
  await expect(contenido(page).getByText('Multa de 6 € · Pablo · Pendiente')).toBeVisible();
  modificarAlmacen((datos) => { datos.multas = datos.multas.filter((m) => m.importeEur !== 6); });
  const antes = leerAlmacen();
  await marcarPagada(page, 'Pablo');
  await narrar(page, testInfo, 'Marcar la multa como pagada. En Multas se ve «No se encontró esa multa», y ninguna multa cambia.', { criterio: 'AC-007-05' });
  // AC-007-05: "When the encargado pays a multa that does not exist Then error E_MULTA_NO_ENCONTRADA and no multa changes"
  await expect(contenido(page).getByRole('alert')).toHaveText('No se encontró esa multa');
  // AC-007-05 cláusula: "and no multa changes"
  expect(leerAlmacen()).toEqual(antes);
  await expect(contenido(page).getByText('Multa de 2 € · Lucía · Pendiente')).toBeVisible();
  await captura(page, testInfo, 'AC-007-05', { ve: ['No se encontró esa multa'] });
});

// ───────────── UC-010 Consultar historial ─────────────

const historialDeLucia = () => {
  sembrar({
    unidades: { Piolet: 2 },
    reservas: [{ socio: 'lucia', tipo: 'Piolet', desde: '2026-12-05', hasta: '2026-12-07', estado: 'Devuelta', unidad: 'Piolet 2' }],
    multas: [{ socio: 'lucia', importeEur: 2, estado: 'Pagada' }],
  });
  modificarAlmacen((datos) => { datos.multas[0].pagadaEl = '2026-12-09'; datos.reservas[0].devueltaEl = '2026-12-08'; });
  fijarHoy('2026-12-10');
};

test('REQ-F-010 AC1 · AC-010-01 la junta elige a Lucía en Historial y ve «Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta» y «Multa de 2 € · Pagada»', async ({ page }, testInfo) => {
  historialDeLucia();
  await narrar(page, testInfo, 'La junta entra, abre Historial y elige a Lucía, que tomó el Piolet 2 del 5 al 7 de diciembre y tiene una multa de 2 euros pagada');
  await junta(page);
  await abrirHistorial(page);
  await verHistorial(page, 'Lucía');
  await narrar(page, testInfo, 'Consultar el historial de un socio. En Historial se ve «Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta» y «Multa de 2 € · Pagada».', { criterio: 'AC-010-01' });
  // REQ-F-010 AC1: "GIVEN Lucía borrowed "Piolet 2" 2026-12-05..2026-12-07 and has a paid multa of 2 € WHEN "ana@club.es" (junta) chooses Lucía in Historial THEN the user sees "Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta" and "Multa de 2 € · Pagada""
  await expect(contenido(page).getByText('Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta')).toBeVisible();
  await expect(contenido(page).getByText('Multa de 2 € · Pagada')).toBeVisible();
  await captura(page, testInfo, 'AC-010-01', { ve: ['Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta', 'Multa de 2 € · Pagada'] });
});

test('REQ-F-010 AC2 · AC-010-02 la junta elige a Pablo, sin préstamos, y ve «Sin préstamos ni multas»', async ({ page }, testInfo) => {
  historialDeLucia();
  await narrar(page, testInfo, 'La junta entra, abre Historial y elige a Pablo, que no tiene préstamos ni multas, mientras Lucía sí tiene los suyos');
  await junta(page);
  await abrirHistorial(page);
  await verHistorial(page, 'Pablo');
  await narrar(page, testInfo, 'Consultar el historial de un socio. En Historial se ve «Sin préstamos ni multas».', { criterio: 'AC-010-02' });
  // REQ-F-010 AC2: "GIVEN Pablo has no loans WHEN the junta chooses Pablo THEN the user sees "Sin préstamos ni multas""
  await expect(contenido(page).getByText('Sin préstamos ni multas')).toBeVisible();
  await expect(contenido(page).locator('li')).toHaveCount(0);
  await captura(page, testInfo, 'AC-010-02', { ve: ['Sin préstamos ni multas'] });
});

test('REQ-F-010 AC3 · AC-010-03 con Lucía elegida en Historial la junta no ve botón para editar, cancelar ni marcar nada', async ({ page }, testInfo) => {
  historialDeLucia();
  await narrar(page, testInfo, 'La junta entra, abre Historial y elige a Lucía, que tiene un préstamo devuelto y una multa pagada');
  await junta(page);
  await abrirHistorial(page);
  await verHistorial(page, 'Lucía');
  await narrar(page, testInfo, 'Consultar el historial de un socio. En Historial se ve «Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta» sin ningún botón para editar, cancelar ni marcar nada; solo el de Ver historial.', { criterio: 'AC-010-03' });
  // REQ-F-010 AC3: "GIVEN the junta WHEN she looks at Historial THEN there is no button to edit, cancel or mark anything"
  await expect(contenido(page).getByText('Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta')).toBeVisible();
  for (const nombre of ['Editar', 'Cancelar', 'Marcar', 'Devolver', 'Entregar']) await expect(contenido(page).getByRole('button', { name: nombre })).toHaveCount(0);
  await expect(contenido(page).getByRole('button')).toHaveText(['Ver historial']);
  await captura(page, testInfo, 'AC-010-03', { ve: ['Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta'] });
});

test('REQ-F-010 AC4 · AC-010-04 Lucía abre Historial por su dirección y ve «No tienes permiso para ver esta pantalla»', async ({ page }, testInfo) => {
  historialDeLucia();
  await narrar(page, testInfo, 'Lucía entra con su correo y su contraseña y escribe la dirección de Historial en el navegador');
  await lucia(page);
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await page.goto('/#/historial');
  await narrar(page, testInfo, 'Consultar el historial de un socio. En Historial se ve «No tienes permiso para ver esta pantalla».', { criterio: 'AC-010-04' });
  // REQ-F-010 AC4: "GIVEN the socio "lucia@club.es" WHEN she opens Historial by address THEN the user sees "No tienes permiso para ver esta pantalla""
  await expect(contenido(page).getByRole('alert')).toHaveText('No tienes permiso para ver esta pantalla');
  await expect(contenido(page).getByText('Piolet 2')).toHaveCount(0);
  await captura(page, testInfo, 'AC-010-04', { ve: ['No tienes permiso para ver esta pantalla'] });
});

test('AC-010-05 el encargado elige a Lucía en Historial y ve su préstamo «Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta», sin cambios', async ({ page }, testInfo) => {
  historialDeLucia();
  await narrar(page, testInfo, 'El encargado entra, abre Historial y elige a Lucía, que tiene un préstamo devuelto');
  await encargado(page);
  await abrirHistorial(page);
  const antes = leerAlmacen();
  await verHistorial(page, 'Lucía');
  await narrar(page, testInfo, 'Consultar el historial de un socio. En Historial se ve «Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta», y no cambia nada.', { criterio: 'AC-010-05' });
  // AC-010-05: "Given Lucía con un préstamo Devuelto When el encargado elige a Lucía en Historial Then ve su préstamo, sin cambios"
  await expect(contenido(page).getByText('Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta')).toBeVisible();
  // AC-010-05 cláusula: "sin cambios"
  expect(leerAlmacen()).toEqual(antes);
  await captura(page, testInfo, 'AC-010-05', { ve: ['Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta'] });
});

test('AC-010-06 la junta elige un socio que ya no existe y ve «El socio elegido no existe» sin historial', async ({ page }, testInfo) => {
  historialDeLucia();
  await narrar(page, testInfo, 'La junta abre Historial y elige a Lucía; entretanto su cuenta desaparece del almacén');
  await junta(page);
  await abrirHistorial(page);
  await page.getByLabel('Socio').selectOption({ label: 'Lucía' });
  modificarAlmacen((datos) => { datos.cuentas = datos.cuentas.filter((c) => c.correo !== 'lucia@club.es'); });
  await page.getByRole('button', { name: 'Ver historial' }).click();
  await narrar(page, testInfo, 'Consultar el historial de un socio. En Historial se ve «El socio elegido no existe», y no se muestra ningún historial.', { criterio: 'AC-010-06' });
  // AC-010-06: "When la junta elige un socio que no existe Then error E_SOCIO_NO_ENCONTRADO y no se muestra historial"
  await expect(contenido(page).getByRole('alert')).toHaveText('El socio elegido no existe');
  // AC-010-06 cláusula: "no se muestra historial"
  await expect(contenido(page).locator('li')).toHaveCount(0);
  await captura(page, testInfo, 'AC-010-06', { ve: ['El socio elegido no existe'] });
});

// ───────────── Demo de la FASE-2 (WF-001): del piolet que vuelve tarde a la multa pagada ─────────────

test('WF-001 FASE-2 Demo: el encargado devuelve el piolet de Lucía con 3 días de retraso, ella no reserva hasta pagar y la junta lo ve en el historial', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 2 }, reservas: [prestada('lucia', 'Piolet', 'Piolet 1', '2026-12-05', '2026-12-03')] });
  fijarHoy('2026-12-08');
  const reservarPiolet = async () => {
    await abrir(page, 'Reservar', 'Reservar material');
    await page.getByLabel('Material').selectOption('Piolet');
    await page.getByLabel('Desde').fill('2026-12-10');
    await page.getByLabel('Hasta').fill('2026-12-10');
    await page.getByRole('button', { name: 'Reservar' }).click();
  };

  await narrar(page, testInfo, 'Paso 1: hoy es 8 de diciembre; el encargado abre Entregas y devoluciones y marca devuelto el piolet de Lucía, que debía volver el 5');
  await encargado(page);
  await abrirEntregas(page);
  await expect(contenido(page).getByText('Con retraso: Piolet 1 · Lucía · 3 días')).toBeVisible();
  const otra = await page.context().newPage();
  await otra.goto('/#/entregas');
  await expect(otra.locator('#contenido').getByText('Con retraso: Piolet 1 · Lucía · 3 días')).toBeVisible();
  await devolver(page, 'Piolet 1 · Lucía');
  await expect(contenido(page).getByRole('status').first()).toHaveText('Piolet 1 · Lucía · Devuelta');
  await expect(contenido(page).getByText('Multa de 6 € a Lucía (3 días de retraso)')).toBeVisible();

  await narrar(otra, testInfo, 'Paso 2: el encargado repite la devolución desde la otra pestaña y no se crea una segunda multa');
  await devolver(otra, 'Piolet 1 · Lucía');
  await expect(otra.locator('#contenido').getByRole('status').first()).toHaveText('Piolet 1 · Lucía · Devuelta');
  expect(leerAlmacen().multas).toHaveLength(1);
  await otra.close();
  await salir(page);

  await narrar(page, testInfo, 'Paso 3: Lucía intenta reservar un piolet y la web se lo rechaza por la multa pendiente');
  await lucia(page);
  await expect(contenido(page).getByText('Multa pendiente: 6 €')).toBeVisible();
  await reservarPiolet();
  await expect(page.getByRole('alert')).toHaveText('Tienes una multa pendiente de 6 €. Págala al encargado para poder reservar');
  await salir(page);

  await narrar(page, testInfo, 'Paso 4: el encargado abre Multas y marca la multa de Lucía como pagada');
  await encargado(page);
  await abrirMultas(page);
  await marcarPagada(page, 'Lucía');
  await expect(contenido(page).getByRole('status')).toHaveText('Multa de 6 € · Lucía · Pagada');
  await expect(contenido(page).locator('li', { hasText: 'Lucía' })).toContainText('pagada el 2026-12-08');
  await salir(page);

  await narrar(page, testInfo, 'Paso 5: Lucía vuelve a reservar un piolet y esta vez se crea');
  await lucia(page);
  await reservarPiolet();
  await expect(contenido(page).getByRole('status')).toHaveText('Reserva creada: Piolet del 2026-12-10 al 2026-12-10');
  await salir(page);

  await narrar(page, testInfo, 'Paso 6: la junta abre Historial, elige a Lucía y ve su préstamo y su multa, sin botones de acción');
  await junta(page);
  await abrirHistorial(page);
  await verHistorial(page, 'Lucía');
  await expect(contenido(page).getByText('Piolet 1 · 2026-12-03 a 2026-12-05 · Devuelta')).toBeVisible();
  await expect(contenido(page).getByText('Multa de 6 € · Pagada')).toBeVisible();
  await expect(contenido(page).getByRole('button')).toHaveText(['Ver historial']);
  await salir(page);

  await narrar(page, testInfo, 'Paso 7: un socio abre Historial por su dirección y la web le dice que no tiene permiso');
  await pablo(page);
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await page.goto('/#/historial');
  await expect(contenido(page).getByRole('alert')).toHaveText('No tienes permiso para ver esta pantalla');
});
