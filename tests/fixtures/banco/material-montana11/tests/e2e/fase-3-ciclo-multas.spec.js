// FASE-3 · WF-001, de la multa al pago: Pablo devolvió su Casco con 3 días de retraso (multa de 6,00 €), ve su multa,
// queda bloqueado para reservar, el encargado la marca pagada y Pablo vuelve a reservar. Cada test arranca su propio
// servidor con almacén y reloj propios (tests/e2e/fixtures/servidor.js): el GIVEN se prepara por la API moviendo el reloj
// del servidor (reserva 2026-11-21, entrega 2026-12-05, devolución 2026-12-10) y los tests ocurren el 2026-12-11.
// Los criterios de borde (AC-011-02, AC-011-03, AC-012-05, AC-012-06) los cubren unit y api.
import { test as base, expect, narrar, captura } from './fixtures/evidence.js';
import { crearServidor, MARTA } from './fixtures/servidor.js';
import { anadirMaterial, reservarComo, sesionDe } from './fixtures/reservas.js';
import { entregarComoMarta, devolverComoMarta } from './fixtures/prestamos.js';

const test = base.extend({
  servidor: async ({}, use) => {
    const servidor = await crearServidor();
    servidor.sembrar();
    await servidor.arrancar('2026-11-21');
    await servidor.socio(PABLO);
    await use(servidor);
    await servidor.parar();
  },
});

const PABLO = { nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' };

/**
 * GIVEN de la Demo: Pablo reservó sus materiales del 2026-12-05 al 2026-12-07, los recogió el 05 y los devolvió el 10:
 * una multa de 6,00 € Pendiente por cada uno (`devueltaEl` y `hoy` cambian el día de la devolución y el del test).
 * Deja el reloj del servidor en `hoy` (por defecto 2026-12-11). Devuelve las reservas.
 */
async function pabloDevolvioTarde(servidor, materiales = ['Casco'], { futura = false, devueltaEl = '2026-12-10', hoy = '2026-12-11' } = {}) {
  const reservas = [];
  for (const material of materiales) {
    await anadirMaterial(servidor, material, 1);
    reservas.push((await reservarComo(servidor, PABLO, { material, inicio: '2026-12-05', fin: '2026-12-07' })).id);
  }
  // otra reserva suya, de Casco del 2026-12-20 al 2026-12-21 (la misma unidad, otros días), que no se entrega
  if (futura) await reservarComo(servidor, PABLO, { material: 'Casco', inicio: '2026-12-20', fin: '2026-12-21' });
  await servidor.reiniciar('2026-12-05');
  for (const id of reservas) await entregarComoMarta(servidor, id);
  await servidor.reiniciar(devueltaEl);
  for (const id of reservas) await devolverComoMarta(servidor, id);
  await servidor.reiniciar(hoy);
  return reservas;
}

async function comoMarta(servidor, operacion, cuerpo) {
  const r = await fetch(`${servidor.url}/api/${operacion}`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: await sesionDe(servidor, MARTA) }, body: JSON.stringify(cuerpo) });
  const datos = await r.json();
  if (!datos.ok) throw new Error(`No se pudo preparar ${operacion}: ${datos.codigo}`);
}

async function entrar(page, servidor, { correo, contrasena }) {
  await page.goto(servidor.url);
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
}
const irA = (page, enlace) => page.getByRole('link', { name: enlace, exact: true }).click();
const filasMultas = (page) => page.getByRole('table', { name: 'Multas', exact: true }).locator('tbody tr');
const celda = (fila, i) => fila.getByRole('cell').nth(i);   // 0 socio · 1 importe · 2 estado · 3 pagada el · 4 acción
async function reservar(page, material, inicio, fin) {
  await page.getByLabel('Material', { exact: true }).selectOption(material);
  await page.getByLabel('Inicio', { exact: true }).fill(inicio);
  await page.getByLabel('Fin', { exact: true }).fill(fin);
  await page.getByRole('button', { name: 'Reservar', exact: true }).click();
}
async function pagarPrimera(page) {
  await page.getByRole('button', { name: /^Marcar pagada/ }).first().click();
  await page.getByRole('button', { name: 'Sí, marcar pagada' }).click();
}
async function misReservasPorApi(servidor, socio) {
  const r = await fetch(`${servidor.url}/api/listarMisReservas`, { headers: { cookie: await sesionDe(servidor, socio) } });
  return (await r.json()).datos;
}

test.describe('WF-001 FASE-3 Multas, bloqueo y pago (UC-011, UC-012)', () => {
  // UC-010 se ve ahora en Multas (SCR-008): el encargado abre Multas el día de la devolución
  test('WF-001 AC-010-01 REQ-F-006 AC1 el Casco de Pablo con fin 2026-12-07 devuelto el 2026-12-10 deja en Multas la multa 6,00 € de Pablo Ruiz Pendiente', async ({ page, servidor }, testInfo) => {
    await pabloDevolvioTarde(servidor, ['Casco'], { devueltaEl: '2026-12-10', hoy: '2026-12-10' });
    await narrar(page, testInfo, 'Es el 10 de diciembre. Pablo devolvió su Casco, que debía volver el 7. Marta entra y abre Multas');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Multas');
    await narrar(page, testInfo, 'Multa por devolución tardía y bloqueo. En Multas se ve «6,00 €», la multa de Pablo Ruiz con el estado «Pendiente».', { criterio: 'AC-010-01' });
    // REQ-F-006 AC1: "GIVEN "pablo" has a "Casco" loan ending 2026-12-07 WHEN the encargado marks it returned on 2026-12-10 THEN the user sees the fine "6,00 €" for "Pablo Ruiz" with state "Pendiente""
    await expect(filasMultas(page)).toHaveCount(1);
    await expect(celda(filasMultas(page).first(), 0)).toHaveText('Pablo Ruiz');
    await expect(celda(filasMultas(page).first(), 1)).toHaveText('6,00 €');
    await expect(celda(filasMultas(page).first(), 2)).toHaveText('Pendiente');
    await captura(page, testInfo, 'AC-010-01', { ve: ['6,00 €'] });
  });

  test('WF-001 AC-010-02 REQ-F-006 AC2 el Casco de Pablo con fin 2026-12-07 devuelto el 2026-12-07 deja Multas en Sin multas', async ({ page, servidor }, testInfo) => {
    await pabloDevolvioTarde(servidor, ['Casco'], { devueltaEl: '2026-12-07', hoy: '2026-12-07' });
    await narrar(page, testInfo, 'Es el 7 de diciembre. Pablo devolvió su Casco justo el día de su fin. Marta entra y abre Multas');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Multas');
    await narrar(page, testInfo, 'Multa por devolución tardía y bloqueo. En Multas se ve «Sin multas»: no se creó ninguna multa por el Casco de Pablo.', { criterio: 'AC-010-02' });
    // REQ-F-006 AC2: "GIVEN a loan ending 2026-12-07 WHEN it is returned on 2026-12-07 or earlier THEN no fine is created"
    await expect(page.getByRole('main').getByText('Sin multas', { exact: true })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByText('Pablo Ruiz')).toHaveCount(0);
    await captura(page, testInfo, 'AC-010-02', { ve: ['Sin multas'] });
  });

  test('WF-001 AC-010-03 REQ-F-006 AC3 el Casco de Pablo con fin 2026-12-07 devuelto el 2026-12-08 deja en Multas la multa 2,00 €', async ({ page, servidor }, testInfo) => {
    await pabloDevolvioTarde(servidor, ['Casco'], { devueltaEl: '2026-12-08', hoy: '2026-12-08' });
    await narrar(page, testInfo, 'Es el 8 de diciembre. Pablo devolvió su Casco con un solo día de retraso. Marta entra y abre Multas');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Multas');
    await narrar(page, testInfo, 'Multa por devolución tardía y bloqueo. En Multas se ve «2,00 €»: un solo día de retraso, 2 euros.', { criterio: 'AC-010-03' });
    // REQ-F-006 AC3: "GIVEN a loan ending 2026-12-07 WHEN it is returned on 2026-12-08 THEN the fine is "2,00 €""
    await expect(filasMultas(page)).toHaveCount(1);
    await expect(celda(filasMultas(page).first(), 1)).toHaveText('2,00 €');
    await captura(page, testInfo, 'AC-010-03', { ve: ['2,00 €'] });
  });

  test('WF-001 AC-011-01 REQ-F-006 AC6 pablo con una multa Pendiente de 6,00 € abre Mis multas y ve 6,00 € y Pendiente', async ({ page, servidor }, testInfo) => {
    await pabloDevolvioTarde(servidor);
    await narrar(page, testInfo, 'Es el 11 de diciembre. Pablo devolvió su Casco con 3 días de retraso. Entra y abre Mis multas');
    await entrar(page, servidor, PABLO);
    await irA(page, 'Mis multas');
    await narrar(page, testInfo, 'Multa por devolución tardía y bloqueo. En Mis multas se ve «6,00 €» y el estado «Pendiente» de su Casco.', { criterio: 'AC-011-01' });
    // REQ-F-006 AC6: "GIVEN "pablo" has a pending fine WHEN he opens "Mis multas" THEN the user sees "6,00 €" and "Pendiente""
    const fila = page.getByRole('table', { name: 'Mis multas' }).locator('tbody tr');
    await expect(fila).toHaveCount(1);
    await expect(celda(fila, 2)).toHaveText('6,00 €');
    await expect(celda(fila, 3)).toHaveText('Pendiente');
    await captura(page, testInfo, 'AC-011-01', { ve: ['6,00 €'] });
  });

  test('WF-001 AC-010-04 REQ-F-006 AC4 pablo con multa Pendiente de 6,00 € y una reserva del 2026-12-20 pide Casco del 2026-12-15 al 2026-12-16 y ve Tienes una multa pendiente', async ({ page, servidor }, testInfo) => {
    await pabloDevolvioTarde(servidor, ['Casco'], { futura: true });
    await narrar(page, testInfo, 'Pablo tiene una multa pendiente de 6 euros y una reserva de Casco del 20 de diciembre. Entra y pide otro Casco del 15 al 16');
    await entrar(page, servidor, PABLO);
    await reservar(page, 'Casco', '2026-12-15', '2026-12-16');
    await narrar(page, testInfo, 'Multa por devolución tardía y bloqueo. En Reservar se ve «Tienes una multa pendiente: no puedes reservar hasta pagarla», se rechaza la reserva y su reserva del 20 de diciembre sigue ahí.', { criterio: 'AC-010-04' });
    // REQ-F-006 AC4: "GIVEN "pablo" has a pending fine of 6,00 € WHEN he tries to reserve THEN the reservation is rejected (see REQ-F-003) and his other existing reservations stay"
    await expect(page.getByRole('alert')).toHaveText('Tienes una multa pendiente: no puedes reservar hasta pagarla');
    // REQ-F-006 AC4 cláusula: "his other existing reservations stay" (y la rechazada no se crea)
    const reservas = await misReservasPorApi(servidor, PABLO);
    expect(reservas.filter((r) => r.estado === 'Reservada').map((r) => [r.material, r.inicio, r.fin])).toEqual([['Casco', '2026-12-20', '2026-12-21']]);
    expect(reservas.some((r) => r.inicio === '2026-12-15')).toBe(false);
    await expect(page.getByRole('alert')).toHaveText('Tienes una multa pendiente: no puedes reservar hasta pagarla');
    await captura(page, testInfo, 'AC-010-04', { ve: ['Tienes una multa pendiente: no puedes reservar hasta pagarla'] });
  });

  test('WF-001 AC-012-01 REQ-F-007 AC1 marta marca Pagada la multa de 6,00 € de Pablo Ruiz y pablo puede reservar Casco', async ({ page, servidor }, testInfo) => {
    await pabloDevolvioTarde(servidor);
    await narrar(page, testInfo, 'Pablo ya pagó su multa en el club. Marta, la encargada, entra y abre Multas, donde ve la de Pablo Ruiz');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Multas');
    await expect(celda(filasMultas(page).first(), 1)).toHaveText('6,00 €');
    await expect(celda(filasMultas(page).first(), 2)).toHaveText('Pendiente');
    await narrar(page, testInfo, 'Marta pulsa Marcar pagada y confirma');
    await pagarPrimera(page);
    await expect(celda(filasMultas(page).first(), 2)).toHaveText('Pagada');
    await narrar(page, testInfo, 'Marcar la multa como pagada. En Multas se ve «Pagada» para Pablo Ruiz, y después Pablo ya puede reservar Casco.', { criterio: 'AC-012-01' });
    // REQ-F-007 AC1: "GIVEN "pablo" has one pending fine of 6,00 € WHEN the encargado marks it "Pagada" THEN the user sees the fine with state "Pagada" and "pablo" can reserve "Casco""
    await expect(celda(filasMultas(page).first(), 0)).toHaveText('Pablo Ruiz');
    await expect(celda(filasMultas(page).first(), 1)).toHaveText('6,00 €');
    await expect(celda(filasMultas(page).first(), 2)).toHaveText('Pagada');
    await expect(filasMultas(page).first().getByRole('button')).toHaveCount(0);
    await captura(page, testInfo, 'AC-012-01', { ve: ['Pagada'] });
    // "pablo" can reserve "Casco": con la multa pagada, la reserva de Casco ya no se rechaza (paso 5 de la Demo)
    await page.getByRole('button', { name: 'Salir' }).click();
    await entrar(page, servidor, PABLO);
    await reservar(page, 'Casco', '2026-12-15', '2026-12-16');
    await expect(page.getByRole('status')).toHaveText('Reserva creada: Casco, 2026-12-15 a 2026-12-16');
  });

  test('WF-001 AC-012-02 REQ-F-006 AC5 pablo con 2 multas Pendiente de 6,00 €, solo una pagada, pide Casco del 2026-12-15 al 2026-12-16 y sigue bloqueado', async ({ page, servidor }, testInfo) => {
    await pabloDevolvioTarde(servidor, ['Casco', 'Piolet']);
    await narrar(page, testInfo, 'Pablo devolvió tarde un Casco y un Piolet y tiene dos multas de 6 euros. Marta entra, abre Multas y marca pagada solo una');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Multas');
    await pagarPrimera(page);
    await expect(page.getByRole('cell', { name: 'Pagada', exact: true })).toHaveCount(1);
    await expect(page.getByRole('cell', { name: 'Pendiente', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Salir' }).click();
    await narrar(page, testInfo, 'Pablo entra y pide un Casco del 15 al 16 de diciembre');
    await entrar(page, servidor, PABLO);
    await reservar(page, 'Casco', '2026-12-15', '2026-12-16');
    await narrar(page, testInfo, 'Multa por devolución tardía y bloqueo. En Reservar se ve «Tienes una multa pendiente: no puedes reservar hasta pagarla»: Pablo sigue bloqueado porque solo se pagó una de sus dos multas.', { criterio: 'AC-012-02' });
    // REQ-F-006 AC5: "GIVEN "pablo" has 2 pending fines WHEN only one is marked paid THEN he is still blocked"
    await expect(page.getByRole('alert')).toHaveText('Tienes una multa pendiente: no puedes reservar hasta pagarla');
    await captura(page, testInfo, 'AC-012-02', { ve: ['Tienes una multa pendiente: no puedes reservar hasta pagarla'] });
  });

  test('WF-001 AC-012-03 REQ-F-007 AC2 la multa de 6,00 € pagada el 2026-12-11 se vuelve a marcar el 2026-12-12 y sigue Pagada con la fecha 2026-12-11', async ({ page, servidor }, testInfo) => {
    await pabloDevolvioTarde(servidor);
    await comoMarta(servidor, 'marcarMultaPagada', { multaId: 1 });   // pagada el 2026-12-11
    await servidor.reiniciar('2026-12-12');
    await narrar(page, testInfo, 'La multa de Pablo se pagó ayer, 11 de diciembre. Hoy, 12, Marta entra y vuelve a enviar el pago');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Multas');
    await expect(celda(filasMultas(page).first(), 2)).toHaveText('Pagada');
    const fechaAntes = await celda(filasMultas(page).first(), 3).innerText();
    expect(fechaAntes).toBe('2026-12-11');
    const repetido = await page.request.post(`${servidor.url}/api/marcarMultaPagada`, { data: { multaId: 1 } });
    expect(await repetido.json()).toMatchObject({ ok: true, datos: { estado: 'Pagada', pagadaEl: '2026-12-11' } });
    await page.reload();
    await narrar(page, testInfo, 'Marcar la multa como pagada. En Multas se ve «Pagada»: sigue Pagada con la primera fecha de pago, 2026-12-11.', { criterio: 'AC-012-03' });
    // REQ-F-007 AC2: "GIVEN a fine already "Pagada" WHEN "Pagada" is sent again THEN it stays "Pagada" with the first payment date"
    await expect(filasMultas(page)).toHaveCount(1);
    // REQ-F-007 AC2 cláusula: "it stays "Pagada" with the first payment date"
    await expect(celda(filasMultas(page).first(), 2)).toHaveText('Pagada');
    await expect(celda(filasMultas(page).first(), 3)).toHaveText(fechaAntes);
    await captura(page, testInfo, 'AC-012-03', { ve: ['Pagada'] });
  });

  test('WF-001 AC-012-04 REQ-F-007 AC3 pablo, socio, abre la dirección de Multas y ve Acceso no permitido', async ({ page, servidor }, testInfo) => {
    await pabloDevolvioTarde(servidor);
    await narrar(page, testInfo, 'Pablo, que es socio, entra y escribe en el navegador la dirección de Multas');
    await entrar(page, servidor, PABLO);
    await expect(page.getByRole('heading', { name: 'Material disponible' })).toBeVisible();
    await page.goto(`${servidor.url}/#/multas`);
    await narrar(page, testInfo, 'Marcar la multa como pagada. En Multas se ve «Acceso no permitido», sin ninguna lista de multas.', { criterio: 'AC-012-04' });
    // REQ-F-007 AC3: "GIVEN a socio session WHEN the socio opens the address of "Multas" of the encargado THEN the user sees "Acceso no permitido""
    await expect(page.getByRole('heading', { name: 'Acceso no permitido' })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    await captura(page, testInfo, 'AC-012-04', { ve: ['Acceso no permitido'] });
  });
});
