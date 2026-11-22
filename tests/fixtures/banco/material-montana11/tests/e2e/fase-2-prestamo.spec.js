// FASE-2 · Entregar y recibir el material: el encargado entrega el día de inicio, registra la devolución y una
// devolución tardía deja una multa. Cada test arranca su propio servidor con almacén y reloj propios
// (tests/e2e/fixtures/servidor.js): el GIVEN se prepara por la API con el reloj en 2026-11-21 y después se reinicia
// el servidor en el día del WHEN (CLOCK_FIXED), como en la Demo de la FASE. Los criterios de borde los cubren unit y api.
import { readFileSync } from 'node:fs';
import { test as base, expect, narrar, captura } from './fixtures/evidence.js';
import { crearServidor, MARTA } from './fixtures/servidor.js';
import { anadirMaterial, reservarComo } from './fixtures/reservas.js';
import { entregarComoMarta, devolverComoMarta, libresPara } from './fixtures/prestamos.js';

const test = base.extend({
  servidor: async ({}, use) => {
    const servidor = await crearServidor();
    servidor.sembrar();
    await servidor.arrancar('2026-11-21');
    await servidor.socio(LUCIA);
    await servidor.socio(PABLO);
    await use(servidor);
    await servidor.parar();
  },
});
test.use({ videoId: 'FASE-2' });

const LUCIA = { nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' };
const PABLO = { nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' };

/** GIVEN de la Demo: Lucía tiene un Piolet y Pablo un Casco, del 2026-12-05 al 2026-12-07. Devuelve sus identificadores. */
async function reservasDeLaDemo(servidor) {
  await anadirMaterial(servidor, 'Piolet', 1);
  await anadirMaterial(servidor, 'Casco', 1);
  const piolet = await reservarComo(servidor, LUCIA, { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' });
  const casco = await reservarComo(servidor, PABLO, { material: 'Casco', inicio: '2026-12-05', fin: '2026-12-07' });
  return { piolet: piolet.id, casco: casco.id };
}

async function entrar(page, servidor, { correo, contrasena }) {
  await page.goto(servidor.url);
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
}
const abrirPrestamos = async (page) => {
  await page.getByRole('link', { name: 'Préstamos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Préstamos' })).toBeVisible();
};
const filaDe = (page, material) => page.getByRole('table', { name: 'Préstamos' }).locator('tbody tr').filter({ hasText: material });
const celda = (fila, i) => fila.getByRole('cell').nth(i);   // 0 material · 1 socio · 2 inicio · 3 fin · 4 estado · 5 devuelta el · 6 multa · 7 acción

test.describe('FASE-2 Entregar material (UC-008)', () => {
  test('FASE-2 AC-008-03 REQ-F-005 AC3 con hoy 2026-12-04 marta intenta entregar el Piolet de Lucía y ve No se puede entregar antes de la fecha de inicio', async ({ page, servidor }, testInfo) => {
    await reservasDeLaDemo(servidor);
    await servidor.reiniciar('2026-12-04');
    await narrar(page, testInfo, 'Es el 4 de diciembre. Marta, la encargada, entra, abre Préstamos e intenta entregar el Piolet de Lucía, que empieza el 5');
    await entrar(page, servidor, MARTA);
    await abrirPrestamos(page);
    await filaDe(page, 'Piolet').getByRole('button', { name: 'Entregar' }).click();
    await narrar(page, testInfo, 'Entregar y marcar la devolución. En Préstamos se ve «No se puede entregar antes de la fecha de inicio», y el Piolet de Lucía sigue Reservada.', { criterio: 'AC-008-03' });
    // REQ-F-005 AC3: "GIVEN a reservation starting 2026-12-05 WHEN the encargado tries to deliver it on 2026-12-04 THEN the user sees "No se puede entregar antes de la fecha de inicio""
    await expect(page.getByRole('alert')).toHaveText('No se puede entregar antes de la fecha de inicio');
    await expect(celda(filaDe(page, 'Piolet'), 4)).toHaveText('Reservada');
    await captura(page, testInfo, 'AC-008-03', { ve: ['No se puede entregar antes de la fecha de inicio'] });
  });

  test('FASE-2 AC-008-01 REQ-F-005 AC1 con hoy 2026-12-05 marta entrega el Piolet de Lucía y ve Entregado', async ({ page, servidor }, testInfo) => {
    await reservasDeLaDemo(servidor);
    await servidor.reiniciar('2026-12-05');
    await narrar(page, testInfo, 'Es el 5 de diciembre. Marta entra y abre Préstamos, donde ve el Piolet de Lucía reservado para hoy');
    await entrar(page, servidor, MARTA);
    await abrirPrestamos(page);
    await expect(celda(filaDe(page, 'Piolet'), 4)).toHaveText('Reservada');
    await narrar(page, testInfo, 'Marta pulsa Entregar sobre el Piolet de Lucía');
    await filaDe(page, 'Piolet').getByRole('button', { name: 'Entregar' }).click();
    await narrar(page, testInfo, 'Entregar y marcar la devolución. En Préstamos se ve «Entregado»: la reserva Piolet de Lucía queda con el estado Entregado.', { criterio: 'AC-008-01' });
    // REQ-F-005 AC1: "GIVEN today is 2026-12-05 and "lucia" has a "Piolet" reservation starting 2026-12-05 WHEN the encargado marks "Entregar" THEN the user sees the reservation "Piolet" with state "Entregado""
    await expect(celda(filaDe(page, 'Piolet'), 0)).toHaveText('Piolet 1');
    await expect(celda(filaDe(page, 'Piolet'), 1)).toHaveText('Lucía Gil');
    await expect(celda(filaDe(page, 'Piolet'), 4)).toHaveText('Entregado');
    await captura(page, testInfo, 'AC-008-01', { ve: ['Entregado'] });
  });

  test('FASE-2 AC-008-02 REQ-F-005 AC4 con hoy 2026-12-06 el Piolet de Lucía sin entregar sale No recogida y su unidad queda libre', async ({ page, servidor }, testInfo) => {
    await reservasDeLaDemo(servidor);
    await servidor.reiniciar('2026-12-06');
    await narrar(page, testInfo, 'Es el 6 de diciembre y nadie recogió el Piolet de Lucía. Marta entra y abre Préstamos');
    await entrar(page, servidor, MARTA);
    await abrirPrestamos(page);
    await narrar(page, testInfo, 'Entregar y marcar la devolución. En Préstamos se ve «No recogida»: el Piolet de Lucía ya no se puede entregar y su unidad queda libre para nuevas reservas.', { criterio: 'AC-008-02' });
    // REQ-F-005 AC4: "GIVEN a reservation never delivered, start 2026-12-05 WHEN 2026-12-06 arrives THEN the user sees its state "No recogida" and the unit is free for new reservations"
    await expect(celda(filaDe(page, 'Piolet'), 4)).toHaveText('No recogida');
    await expect(filaDe(page, 'Piolet').getByRole('button')).toHaveCount(0);
    // la unidad queda libre: Pablo ve 1 Piolet libre para el 2026-12-06 al 2026-12-07
    expect(await libresPara(servidor, PABLO, 'Piolet', '2026-12-06', '2026-12-07')).toBe(1);
    await captura(page, testInfo, 'AC-008-02', { ve: ['No recogida'] });
  });

  test('FASE-2 AC-008-04 REQ-F-005 AC6 lucia, socia, abre la dirección de Préstamos y ve Acceso no permitido', async ({ page, servidor }, testInfo) => {
    await reservasDeLaDemo(servidor);
    await servidor.reiniciar('2026-12-05');
    await narrar(page, testInfo, 'Lucía, que es socia, entra y escribe en el navegador la dirección de Préstamos');
    await entrar(page, servidor, LUCIA);
    await expect(page.getByRole('heading', { name: 'Material disponible' })).toBeVisible();
    await page.goto(`${servidor.url}/#/prestamos`);
    await narrar(page, testInfo, 'Entregar y marcar la devolución. En Préstamos se ve «Acceso no permitido», sin ninguna lista de préstamos.', { criterio: 'AC-008-04' });
    // REQ-F-005 AC6: "GIVEN a socio session WHEN the socio opens the address of "Préstamos" THEN the user sees "Acceso no permitido""
    await expect(page.getByRole('heading', { name: 'Acceso no permitido' })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByText('Pablo Ruiz')).toHaveCount(0);
    await captura(page, testInfo, 'AC-008-04', { ve: ['Acceso no permitido'] });
  });
});

test.describe('FASE-2 Devolver material y multa por retraso (UC-009, UC-010)', () => {
  test('FASE-2 AC-009-01 REQ-F-005 AC2 el Piolet entregado con fin 2026-12-07 se devuelve el 2026-12-07 y marta ve Devuelto', async ({ page, servidor }, testInfo) => {
    const { piolet } = await reservasDeLaDemo(servidor);
    await servidor.reiniciar('2026-12-05');
    await entregarComoMarta(servidor, piolet);
    await servidor.reiniciar('2026-12-07');
    await narrar(page, testInfo, 'Es el 7 de diciembre. Marta entra, abre Préstamos y ve el Piolet de Lucía entregado');
    await entrar(page, servidor, MARTA);
    await abrirPrestamos(page);
    await expect(celda(filaDe(page, 'Piolet'), 4)).toHaveText('Entregado');
    await narrar(page, testInfo, 'Marta pulsa Registrar devolución sobre el Piolet');
    await filaDe(page, 'Piolet').getByRole('button', { name: 'Registrar devolución' }).click();
    await narrar(page, testInfo, 'Entregar y marcar la devolución. En Préstamos se ve «Devuelto», y la unidad del Piolet queda libre otra vez.', { criterio: 'AC-009-01' });
    // REQ-F-005 AC2: "GIVEN a delivered "Piolet" due 2026-12-07 WHEN the encargado marks "Devolver" on 2026-12-07 THEN the user sees state "Devuelto" and the unit is free again"
    await expect(celda(filaDe(page, 'Piolet'), 4)).toHaveText('Devuelto');
    await expect(filaDe(page, 'Piolet').getByRole('button')).toHaveCount(0);
    expect(await libresPara(servidor, LUCIA, 'Piolet', '2026-12-07', '2026-12-07')).toBe(1);
    await captura(page, testInfo, 'AC-009-01', { ve: ['Devuelto'] });
  });

  test('FASE-2 AC-009-03 REQ-F-005 AC5 repetir la devolución del Casco el 2026-12-11 deja Devuelto con la fecha 2026-12-10 y una sola multa de 6,00 € Pendiente', async ({ page, servidor }, testInfo) => {
    const { casco } = await reservasDeLaDemo(servidor);
    await servidor.reiniciar('2026-12-05');
    await entregarComoMarta(servidor, casco);
    await servidor.reiniciar('2026-12-10');
    await devolverComoMarta(servidor, casco);
    await servidor.reiniciar('2026-12-11');
    await narrar(page, testInfo, 'El Casco de Pablo se devolvió el 10 de diciembre con retraso y ya tiene su multa. Hoy es el 11: Marta entra y vuelve a enviar la devolución');
    await entrar(page, servidor, MARTA);
    await expect(page.getByRole('heading', { name: 'Panel del encargado' })).toBeVisible();   // ya hay sesión
    const repetida = await page.request.post(`${servidor.url}/api/registrarDevolucion`, { data: { reservaId: casco } });
    expect(await repetida.json()).toMatchObject({ ok: true, datos: { estado: 'Devuelto', devueltaEl: '2026-12-10' } });
    await abrirPrestamos(page);
    await narrar(page, testInfo, 'Entregar y marcar la devolución. En Préstamos se ve «Devuelto», con la primera fecha de devolución 2026-12-10 y una sola multa «6,00 €» Pendiente: no hay segunda multa.', { criterio: 'AC-009-03' });
    // REQ-F-005 AC5: "GIVEN a delivered unit already marked "Devuelto" WHEN "Devolver" is sent again THEN the state stays "Devuelto" with the first return date and no second fine is created"
    // REQ-F-005 AC5 cláusula: "the state stays "Devuelto" with the first return date"
    await expect(celda(filaDe(page, 'Casco'), 4)).toHaveText('Devuelto');
    await expect(celda(filaDe(page, 'Casco'), 5)).toHaveText('2026-12-10');
    // REQ-F-005 AC5 cláusula: "no second fine is created"
    await expect(celda(filaDe(page, 'Casco'), 6)).toHaveText('6,00 € Pendiente');
    const multas = JSON.parse(readFileSync(servidor.archivo, 'utf8')).multas;
    expect(multas).toHaveLength(1);
    expect(multas[0]).toMatchObject({ reservaId: casco, importeEur: 6, estado: 'Pendiente' });
    await captura(page, testInfo, 'AC-009-03', { ve: ['Devuelto', '6,00 €', 'Pendiente'] });
  });

  test('FASE-2 AC-009-02 AC-010-01 REQ-F-006 AC1 el Casco de Pablo con fin 2026-12-07 se devuelve el 2026-12-10 y marta ve Devuelto con la multa 6,00 € Pendiente', async ({ page, servidor }, testInfo) => {
    const { casco } = await reservasDeLaDemo(servidor);
    await servidor.reiniciar('2026-12-05');
    await entregarComoMarta(servidor, casco);
    await servidor.reiniciar('2026-12-10');
    await narrar(page, testInfo, 'Es el 10 de diciembre. Marta entra, abre Préstamos y ve el Casco de Pablo, que debía volver el 7');
    await entrar(page, servidor, MARTA);
    await abrirPrestamos(page);
    await narrar(page, testInfo, 'Marta pulsa Registrar devolución sobre el Casco de Pablo');
    await filaDe(page, 'Casco').getByRole('button', { name: 'Registrar devolución' }).click();
    await narrar(page, testInfo, 'Devolución tardía. En Préstamos se ve «Devuelto» y la multa «6,00 €» Pendiente, creada en la misma operación: 2 euros por cada uno de los 3 días de retraso.', { criterio: 'AC-009-02' });
    // REQ-F-006 AC1: "GIVEN "pablo" has a "Casco" loan ending 2026-12-07 WHEN the encargado marks it returned on 2026-12-10 THEN the user sees the fine "6,00 €" for "Pablo Ruiz" with state "Pendiente""
    const fila = filaDe(page, 'Casco');
    await expect(celda(fila, 1)).toHaveText('Pablo Ruiz');
    await expect(celda(fila, 4)).toHaveText('Devuelto');
    await expect(celda(fila, 6)).toHaveText('6,00 € Pendiente');
    await expect(page.getByRole('status')).toHaveText('Multa creada: 6,00 €');
    await captura(page, testInfo, 'AC-009-02', { ve: ['Devuelto', 'Pendiente'] });
    await narrar(page, testInfo, 'Aplicar multa por retraso. En Préstamos se ve la multa «6,00 €» de Pablo Ruiz con el estado «Pendiente».', { criterio: 'AC-010-01' });
    await captura(page, testInfo, 'AC-010-01', { ve: ['6,00 €', 'Pendiente'] });
  });
});
