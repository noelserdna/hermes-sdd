// Recorrido de FASE-4 por la ruta del usuario (WF-001): las multas, el bloqueo hasta pagarlas y el ciclo completo del préstamo. Un test por
// criterio, con su propio GIVEN (actor, fechas y datos del criterio), su captura y su locución (.sdd/demo/GUION-FASE-4.md), y un recorrido
// del ciclo entero en un vídeo (WF-001). Los criterios que la pantalla no distingue (AC-012-04, AC-013-04, AC-013-05, AC-014-02) van en
// tests/integration/multas.test.js; los literales de cada pantalla, en tests/unit/ui.
//
// En los criterios de multas Pablo es un socio más («Pablo Sanz» en los escenarios) y el encargado es Jorge; en el recorrido del ciclo
// Pablo es el encargado, como en la demo (node demo/sembrar.mjs fase-4).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, narrar } from './fixtures/evidence.js';
import { captura, instantanea, pantallasJuntas } from './fixtures/pantallas.js';
import { sembrar } from '../../demo/sembrar.mjs';

test.use({ videoId: 'WF-001' });

const DATOS = path.resolve('data/e2e/datos.json');
const RELOJ = path.resolve('data/e2e/reloj.txt');
const HOY_FICHERO = path.resolve('data/e2e/hoy.txt');
const HOY = '2026-11-22';

const PABLO_SOCIO = ['pablo@club.test', 'Piolet2026!'];
const LUCIA = ['lucia@club.test', 'Cumbre2026!'];
const MARTA = ['marta@club.test', 'Marta2026!'];
const JORGE = ['jorge@club.test', 'Encargado2026!'];
const PABLO_ENCARGADO = ['pablo@club.test', 'Piolet2026!'];
const SOCIO_PABLO = { id: 'c-pablo', nombre: 'Pablo Sanz', correo: PABLO_SOCIO[0], contrasena: PABLO_SOCIO[1], rol: 'socio' };
const SOCIA_LUCIA = { id: 'c-lucia', nombre: 'Lucía Gil', correo: LUCIA[0], contrasena: LUCIA[1], rol: 'socio' };
const SOCIA_MARTA = { id: 'c-marta', nombre: 'Marta Ruiz', correo: MARTA[0], contrasena: MARTA[1], rol: 'socio' };
const ENCARGADO = { id: 'c-jorge', nombre: 'Jorge', correo: JORGE[0], contrasena: JORGE[1], rol: 'encargado' };
const CASCO = (total) => [{ nombre: 'Casco', total }];

/** Datos nuevos para el test; «hoy» es el del GIVEN (el servidor lo lee del fichero en cada petición). */
async function reiniciar({ hoy = HOY, cuentas, material = CASCO(6), reservas = [], multas = [] }) {
  mkdirSync(path.dirname(DATOS), { recursive: true });
  rmSync(RELOJ, { force: true });
  await sembrar(DATOS, { hoy: HOY, cuentas, material, reservas, multas });
  if (hoy === HOY) rmSync(HOY_FICHERO, { force: true }); else writeFileSync(HOY_FICHERO, hoy);
}
test.afterEach(() => rmSync(HOY_FICHERO, { force: true }));
const datos = () => JSON.parse(readFileSync(DATOS, 'utf8'));

async function entrar(page, [correo, contrasena], titulo) {
  await page.goto('/entrar');
  await entrarSinRecargar(page, [correo, contrasena], titulo);
}
/** Escribe el correo y la contraseña en el formulario «Entrar» que ya está en pantalla. */
async function entrarSinRecargar(page, [correo, contrasena], titulo) {
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible();
}
/** Pulsa «Salir» y espera al formulario «Entrar»: la sesión y sus avisos se acaban. */
async function salir(page) {
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
}
const irA = async (page, enlace, titulo = enlace) => {
  await page.getByRole('navigation').getByRole('link', { name: enlace, exact: true }).click();
  await expect(page.getByRole('heading', { name: titulo, level: 1, exact: true })).toBeVisible();
};
const aviso = (page, texto) => page.getByRole('status').filter({ hasText: texto });
const fila = (page, texto) => page.locator('ul.multas-todas li').filter({ hasText: texto });
const marcarPagada = (page, texto) => fila(page, texto).getByRole('button', { name: 'Marcar pagada' }).click();
async function reservarCasco(page, { cantidad = 1, inicio, fin }) {
  await irA(page, 'Reservar');
  await page.getByRole('combobox', { name: 'Material' }).selectOption({ label: 'Casco' });
  await page.getByRole('spinbutton', { name: 'Cantidad' }).fill(String(cantidad));
  await page.getByLabel('Fecha de inicio').fill(inicio);
  await page.getByLabel('Fecha de fin').fill(fin);
  await page.getByRole('button', { name: 'Reservar', exact: true }).click();
}

test.describe('FASE-4 · Multas y bloqueo hasta pagarlas (REQ-F-006)', () => {
  test('AC-012-01 REQ-F-006 AC1 Pablo con una multa pendiente de 6 € abre «Mis multas»: ve «Multa de 6 € — Pendiente»', async ({ page }, testInfo) => {
    await reiniciar({ cuentas: [SOCIO_PABLO], multas: [{ socio: PABLO_SOCIO[0], importe: 6 }] });
    await entrar(page, PABLO_SOCIO, 'Mis reservas');
    await narrar(page, testInfo, 'Pablo debe una multa de 6 euros. Abre Mis multas desde el menú');
    await irA(page, 'Mis multas');
    // REQ-F-006 AC1: "GIVEN Pablo has a pending fine of 6 € WHEN he opens "Mis multas" THEN the user sees "Multa de 6 € — Pendiente""
    await expect(page.locator('ul.multas-socio li .texto')).toHaveText('Multa de 6 € — Pendiente');
    await narrar(page, testInfo, 'Multas y bloqueo hasta pagarlas. En Mis multas se ve «Multa de 6 € — Pendiente».', { criterio: 'AC-012-01' });
    await captura(page, testInfo, 'AC-012-01', { ve: ['Multa de 6 € — Pendiente'] });
  });

  test('AC-013-01 REQ-F-006 AC2 Pablo con una multa pendiente de 6 €, el encargado pulsa «Marcar pagada»: ve «Multa pagada» y Pablo reserva 1 × Casco del 2026-12-10 al 2026-12-11', async ({ page }, testInfo) => {
    await reiniciar({ cuentas: [ENCARGADO, SOCIO_PABLO], multas: [{ socio: PABLO_SOCIO[0], importe: 6 }] });
    await entrar(page, JORGE, 'Panel del encargado');
    await narrar(page, testInfo, 'Pablo Sanz debe una multa de 6 euros. Jorge, el encargado, abre Multas y pulsa «Marcar pagada» en su fila');
    await irA(page, 'Multas');
    await expect(fila(page, 'Pablo Sanz — Multa de 6 € — Pendiente')).toHaveCount(1);
    await marcarPagada(page, 'Pablo Sanz — Multa de 6 € — Pendiente');
    // REQ-F-006 AC2: "GIVEN Pablo has a pending fine of 6 € WHEN the encargado presses "Marcar pagada" THEN the user sees "Multa pagada" and Pablo can reserve again"
    await expect(aviso(page, 'Multa pagada')).toBeVisible();
    await expect(fila(page, 'Pablo Sanz — Multa de 6 € — Pagada')).toHaveCount(1);
    const pantallaJorge = await instantanea(page, 'Jorge, el encargado, en Multas');
    await narrar(page, testInfo, 'Jorge sale y Pablo entra: con la multa pagada ya puede reservar un casco del 10 al 11 de diciembre');
    await salir(page);
    await entrarSinRecargar(page, PABLO_SOCIO, 'Mis reservas');
    await reservarCasco(page, { cantidad: 1, inicio: '10/12/2026', fin: '11/12/2026' });
    await expect(page.getByRole('heading', { name: 'Mis reservas', level: 1 })).toBeVisible();
    await expect(aviso(page, 'Multa pagada')).toHaveCount(0);   // el aviso es de Jorge: Pablo no lo ve
    await expect(aviso(page, 'Reserva creada: 1 × Casco del 2026-12-10 al 2026-12-11')).toBeVisible();
    const pantallaPablo = await instantanea(page, 'Pablo reserva de nuevo');
    await pantallasJuntas(page, [pantallaJorge, pantallaPablo]);
    await narrar(page, testInfo, 'Multas y bloqueo hasta pagarlas. En Multas se ve «Multa pagada» y Pablo, ya sin multa pendiente, ve «Reserva creada: 1 × Casco del 2026-12-10 al 2026-12-11».', { criterio: 'AC-013-01' });
    await captura(page, testInfo, 'AC-013-01', { ve: ['Multa pagada', 'Reserva creada: 1 × Casco del 2026-12-10 al 2026-12-11'] });
  });

  test('AC-013-02 REQ-F-006 AC3 la multa de 6 € de Pablo Sanz acaba de pagarse y se pulsa «Marcar pagada» otra vez: ve «La multa ya estaba pagada» y una sola «Pablo Sanz — Multa de 6 € — Pagada»', async ({ page }, testInfo) => {
    await reiniciar({ cuentas: [ENCARGADO, SOCIO_PABLO], multas: [{ socio: PABLO_SOCIO[0], importe: 6 }] });
    await entrar(page, JORGE, 'Panel del encargado');
    await narrar(page, testInfo, 'Jorge tiene abierta la lista de Multas, con la multa de 6 euros de Pablo Sanz todavía pendiente');
    await irA(page, 'Multas');
    await expect(fila(page, 'Pablo Sanz — Multa de 6 € — Pendiente')).toHaveCount(1);
    // Otra pestaña del mismo encargado cobra la multa mientras esta lista sigue con la fila Pendiente
    const otra = await page.context().newPage();
    await otra.goto('/multas');
    await expect(otra.getByRole('heading', { name: 'Multas', level: 1, exact: true })).toBeVisible();
    await marcarPagada(otra, 'Pablo Sanz — Multa de 6 € — Pendiente');
    await expect(aviso(otra, 'Multa pagada')).toBeVisible();
    await otra.close();
    await narrar(page, testInfo, 'La multa se acaba de cobrar desde otra pestaña. Jorge pulsa «Marcar pagada» otra vez en la suya, que no se había enterado');
    await marcarPagada(page, 'Pablo Sanz — Multa de 6 € — Pendiente');
    // REQ-F-006 AC3: "GIVEN the fine was just paid WHEN "Marcar pagada" is submitted again THEN the user sees "La multa ya estaba pagada" and the fine stays "Pagada", still one fine of 6 €"
    await expect(aviso(page, 'La multa ya estaba pagada')).toBeVisible();
    await expect(fila(page, 'Pablo Sanz — Multa de 6 € — Pagada')).toHaveCount(1);
    // REQ-F-006 AC3 cláusula: "the fine stays" Pagada, still one fine of 6 € (lo que había tras el primer pago no cambia con el segundo)
    await expect(page.locator('ul.multas-todas li')).toHaveText('Pablo Sanz — Multa de 6 € — Pagada');
    expect(datos().multas).toMatchObject([{ amountEur: 6, status: 'Pagada', paidOn: HOY }]);
    await narrar(page, testInfo, 'Multas y bloqueo hasta pagarlas. En Multas se ve «La multa ya estaba pagada» y «Pablo Sanz — Multa de 6 € — Pagada»: sigue siendo una sola multa de 6 euros y sigue Pagada.', { criterio: 'AC-013-02' });
    await captura(page, testInfo, 'AC-013-02', { ve: ['La multa ya estaba pagada', 'Pablo Sanz — Multa de 6 € — Pagada'] });
  });

  test('AC-013-03 REQ-F-006 AC4 Pablo con 2 multas pendientes de 2 € y 4 € y el encargado paga la de 4 €: ve «Multa pagada» y Pablo sigue viendo «No puedes reservar hasta pagar tu multa de 2 €»', async ({ page }, testInfo) => {
    await reiniciar({ cuentas: [ENCARGADO, SOCIO_PABLO], multas: [{ socio: PABLO_SOCIO[0], importe: 2 }, { socio: PABLO_SOCIO[0], importe: 4 }] });
    await entrar(page, JORGE, 'Panel del encargado');
    await narrar(page, testInfo, 'Pablo Sanz debe dos multas, una de 2 euros y otra de 4. Jorge abre Multas y cobra la de 4 euros');
    await irA(page, 'Multas');
    await marcarPagada(page, 'Pablo Sanz — Multa de 4 € — Pendiente');
    // REQ-F-006 AC4: "GIVEN Pablo has 2 pending fines of 2 € and 4 € WHEN the encargado pays the one of 4 € THEN the user sees "Multa pagada" and Pablo still sees "No puedes reservar hasta pagar tu multa de 2 €""
    await expect(aviso(page, 'Multa pagada')).toBeVisible();
    await expect(fila(page, 'Pablo Sanz — Multa de 4 € — Pagada')).toHaveCount(1);
    await expect(fila(page, 'Pablo Sanz — Multa de 2 € — Pendiente')).toHaveCount(1);
    const pantallaJorge = await instantanea(page, 'Jorge, el encargado, en Multas');
    await narrar(page, testInfo, 'Jorge sale y Pablo entra: todavía le queda la multa de 2 euros, y al intentar reservar un casco del 10 al 11 de diciembre no le dejan');
    await salir(page);
    await entrarSinRecargar(page, PABLO_SOCIO, 'Mis reservas');
    await reservarCasco(page, { cantidad: 1, inicio: '10/12/2026', fin: '11/12/2026' });
    await expect(page.getByRole('alert')).toHaveText('No puedes reservar hasta pagar tu multa de 2 €');
    const pantallaPablo = await instantanea(page, 'Pablo intenta reservar');
    await pantallasJuntas(page, [pantallaJorge, pantallaPablo]);
    await narrar(page, testInfo, 'Multas y bloqueo hasta pagarlas. En Multas se ve «Multa pagada» y Pablo sigue viendo «No puedes reservar hasta pagar tu multa de 2 €».', { criterio: 'AC-013-03' });
    await captura(page, testInfo, 'AC-013-03', { ve: ['Multa pagada', 'No puedes reservar hasta pagar tu multa de 2 €'] });
  });

  test('AC-012-02 REQ-F-006 AC5 Lucía sin multas abre «Mis multas»: ve «No tienes multas»', async ({ page }, testInfo) => {
    await reiniciar({ cuentas: [SOCIA_LUCIA] });
    await entrar(page, LUCIA, 'Mis reservas');
    await narrar(page, testInfo, 'Lucía no tiene ninguna multa. Abre Mis multas desde el menú');
    await irA(page, 'Mis multas');
    // REQ-F-006 AC5: "GIVEN Lucía has no fines WHEN she opens "Mis multas" THEN the user sees "No tienes multas""
    await expect(page.locator('.lista-multas .vacio')).toHaveText('No tienes multas');
    await narrar(page, testInfo, 'Multas y bloqueo hasta pagarlas. En Mis multas se ve «No tienes multas».', { criterio: 'AC-012-02' });
    await captura(page, testInfo, 'AC-012-02', { ve: ['No tienes multas'] });
  });

  test('AC-012-03 REQ-F-006 AC6 Marta sin multas mientras Pablo tiene una abre «Mis multas»: ve «No tienes multas» y nada de Pablo', async ({ page }, testInfo) => {
    await reiniciar({ cuentas: [SOCIO_PABLO, SOCIA_MARTA], multas: [{ socio: PABLO_SOCIO[0], importe: 6 }] });
    await entrar(page, MARTA, 'Mis reservas');
    await narrar(page, testInfo, 'Pablo Sanz debe una multa de 6 euros, pero Marta no debe nada. Marta abre Mis multas');
    await irA(page, 'Mis multas');
    // REQ-F-006 AC6: "GIVEN Marta has no fines while Pablo has one WHEN she opens "Mis multas" THEN the user sees "No tienes multas""
    await expect(page.locator('.lista-multas .vacio')).toHaveText('No tienes multas');
    await expect(page.locator('ul.multas-socio')).toHaveCount(0);
    await expect(page.getByText('Multa de 6 €')).toHaveCount(0);
    await narrar(page, testInfo, 'Multas y bloqueo hasta pagarlas. En Mis multas se ve «No tienes multas»: la multa de 6 euros de Pablo no aparece en la lista de Marta.', { criterio: 'AC-012-03' });
    await captura(page, testInfo, 'AC-012-03', { ve: ['No tienes multas'] });
  });

  test('AC-014-01 REQ-F-006 AC7 Pablo Sanz con una multa pendiente de 6 € y Lucía Gil con una pagada de 2 €, el encargado abre «Multas»: ve las dos filas con su estado', async ({ page }, testInfo) => {
    await reiniciar({ cuentas: [ENCARGADO, SOCIO_PABLO, SOCIA_LUCIA], multas: [{ socio: PABLO_SOCIO[0], importe: 6 }, { socio: LUCIA[0], importe: 2, estado: 'Pagada' }] });
    await entrar(page, JORGE, 'Panel del encargado');
    await narrar(page, testInfo, 'Pablo Sanz debe una multa de 6 euros y Lucía Gil ya pagó la suya de 2. Jorge, el encargado, abre Multas');
    await irA(page, 'Multas');
    // REQ-F-006 AC7: "GIVEN Pablo has a pending fine of 6 € and Lucía has a paid fine of 2 € WHEN the encargado opens the list "Multas" THEN the user sees "Pablo Sanz — Multa de 6 € — Pendiente" and "Lucía Gil — Multa de 2 € — Pagada""
    await expect(page.locator('ul.multas-todas li .texto')).toHaveText(['Pablo Sanz — Multa de 6 € — Pendiente', 'Lucía Gil — Multa de 2 € — Pagada']);
    await narrar(page, testInfo, 'Multas y bloqueo hasta pagarlas. En Multas se ve «Pablo Sanz — Multa de 6 € — Pendiente» y «Lucía Gil — Multa de 2 € — Pagada».', { criterio: 'AC-014-01' });
    await captura(page, testInfo, 'AC-014-01', { ve: ['Pablo Sanz — Multa de 6 € — Pendiente', 'Lucía Gil — Multa de 2 € — Pagada'] });
  });
});

test.describe('WF-001 · Ciclo completo de un préstamo', () => {
  test('WF-001 Lucía reserva dos cascos, Pablo los entrega y los recibe con retraso, ella ve su multa y no puede reservar hasta que Pablo la cobra', async ({ page }, testInfo) => {
    const lucia = { ...SOCIA_LUCIA };
    const pablo = { id: 'c-pablo', nombre: 'Pablo', correo: PABLO_ENCARGADO[0], contrasena: PABLO_ENCARGADO[1], rol: 'encargado' };
    await reiniciar({ hoy: '2026-11-22', cuentas: [lucia, pablo], material: CASCO(6) });

    await narrar(page, testInfo, 'Reservar. Lucía entra, abre Reservar y pide dos cascos desde hoy, 22 de noviembre, hasta el 23');
    await entrar(page, LUCIA, 'Mis reservas');
    await reservarCasco(page, { cantidad: 2, inicio: '22/11/2026', fin: '23/11/2026' });
    await expect(aviso(page, 'Reserva creada: 2 × Casco del 2026-11-22 al 2026-11-23')).toBeVisible();
    await salir(page);

    await narrar(page, testInfo, 'Entregar. Pablo, el encargado, abre el Panel y entrega los cascos a Lucía');
    await entrarSinRecargar(page, PABLO_ENCARGADO, 'Panel del encargado');
    await page.getByRole('listitem').filter({ hasText: 'Por entregar: 2 × Casco — Lucía Gil' }).getByRole('button', { name: 'Entregar', exact: true }).click();
    await expect(aviso(page, 'Entregado: 2 × Casco a Lucía Gil')).toBeVisible();
    await salir(page);

    await narrar(page, testInfo, 'Devolver. Lucía trae los cascos el 27 de noviembre, cuatro días después de lo debido, y Pablo los recibe');
    writeFileSync(HOY_FICHERO, '2026-11-27');
    await entrarSinRecargar(page, PABLO_ENCARGADO, 'Panel del encargado');
    await page.getByRole('listitem').filter({ hasText: 'Prestado: 2 × Casco — Lucía Gil' }).getByRole('button', { name: 'Devolver', exact: true }).click();
    await expect(aviso(page, 'Devuelto con 4 días de retraso: multa de 8 €')).toBeVisible();
    await salir(page);

    await narrar(page, testInfo, 'Multa por retraso. Lucía abre Mis multas y ve su multa pendiente; al intentar reservar de nuevo no puede');
    await entrarSinRecargar(page, LUCIA, 'Mis reservas');
    await irA(page, 'Mis multas');
    await expect(page.locator('ul.multas-socio li .texto')).toHaveText('Multa de 8 € — Pendiente');
    await expect(page.locator('ul.multas-socio li .retraso')).toHaveText('Retraso: 4 días');
    await reservarCasco(page, { cantidad: 1, inicio: '10/12/2026', fin: '11/12/2026' });
    await expect(page.getByRole('alert')).toHaveText('No puedes reservar hasta pagar tu multa de 8 €');
    await salir(page);

    await narrar(page, testInfo, 'Pagar la multa. Pablo abre Multas y pulsa «Marcar pagada»; si lo repite desde otra pestaña, solo le avisan de que ya estaba pagada');
    await entrarSinRecargar(page, PABLO_ENCARGADO, 'Panel del encargado');
    await irA(page, 'Multas');
    const otra = await page.context().newPage();
    await otra.goto('/multas');
    await expect(fila(otra, 'Lucía Gil — Multa de 8 € — Pendiente')).toHaveCount(1);
    await marcarPagada(page, 'Lucía Gil — Multa de 8 € — Pendiente');
    await expect(aviso(page, 'Multa pagada')).toBeVisible();
    await expect(fila(page, 'Lucía Gil — Multa de 8 € — Pagada')).toHaveCount(1);
    await marcarPagada(otra, 'Lucía Gil — Multa de 8 € — Pendiente');
    await expect(aviso(otra, 'La multa ya estaba pagada')).toBeVisible();
    await otra.close();
    await salir(page);

    await narrar(page, testInfo, 'Se levanta el bloqueo. Lucía reserva otra vez y en Mis multas su multa figura ya como pagada');
    await entrarSinRecargar(page, LUCIA, 'Mis reservas');
    await reservarCasco(page, { cantidad: 1, inicio: '10/12/2026', fin: '11/12/2026' });
    await expect(aviso(page, 'Reserva creada: 1 × Casco del 2026-12-10 al 2026-12-11')).toBeVisible();
    await irA(page, 'Mis multas');
    await expect(page.locator('ul.multas-socio li .texto')).toHaveText('Multa de 8 € — Pagada');
  });
});
