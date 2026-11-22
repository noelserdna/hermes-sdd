// FASE-1 · Reservar material, ver y cancelar mis reservas: el encargado añade material y el socio reserva, ve y cancela.
// Cada test arranca su propio servidor con almacén y reloj propios (tests/e2e/fixtures/servidor.js); el GIVEN se prepara
// por la API y el WHEN se hace en la pantalla, desde Entrar (paso 1 de la Demo).
import { test as base, expect, narrar, captura } from './fixtures/evidence.js';
import { crearServidor, MARTA } from './fixtures/servidor.js';
import { anadirMaterial, reservarComo, sembrarMultaPendiente } from './fixtures/reservas.js';

const test = base.extend({
  hoy: ['2026-11-21', { option: true }],
  servidor: async ({ hoy }, use) => {
    const servidor = await crearServidor();
    servidor.sembrar();
    await servidor.arrancar(hoy);
    await servidor.socio(LUCIA);
    await servidor.socio(PABLO);
    await use(servidor);
    await servidor.parar();
  },
});
test.use({ videoId: 'FASE-1' });

const LUCIA = { nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' };
const PABLO = { nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' };

const pantalla = (page) => page.locator('main');
const filasReservas = (page) => page.getByRole('table', { name: 'Reservas' }).locator('tbody tr');
const libres = (page, material) => page.locator(`dl dt:text-is("${material}") + dd`);

async function entrar(page, servidor, { correo, contrasena }) {
  await page.goto(servidor.url);
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
}
async function rellenarReserva(page, material, inicio, fin) {
  await page.getByLabel('Material', { exact: true }).selectOption(material);
  await page.getByLabel('Inicio', { exact: true }).fill(inicio);
  await page.getByLabel('Fin', { exact: true }).fill(fin);
}
async function reservar(page, material, inicio, fin) {
  await rellenarReserva(page, material, inicio, fin);
  await page.getByRole('button', { name: 'Reservar', exact: true }).click();
}
const irA = (page, enlace) => page.getByRole('link', { name: enlace, exact: true }).click();
async function cancelarPrimera(page) {
  await page.getByRole('button', { name: /^Cancelar reserva/ }).first().click();
  await page.getByRole('button', { name: 'Sí, cancelar' }).click();
}

test.describe('FASE-1 Inventario (encargado)', () => {
  test('FASE-1 AC-013-01 marta añade 2 Crampones en Inventario y ve Crampones: 2 unidades', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'Marta, la encargada, entra y abre Inventario');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Inventario');
    await expect(pantalla(page).getByText('Crampones: 0 unidades')).toBeVisible();
    await narrar(page, testInfo, 'Elige Crampones, escribe la cantidad 2 y pulsa Añadir');
    await page.getByLabel('Tipo').selectOption('Crampones');
    await page.getByLabel('Cantidad').fill('2');
    await page.getByRole('button', { name: 'Añadir' }).click();
    await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «Crampones: 2 unidades», con las unidades Crampones 1 y Crampones 2.', { criterio: 'AC-013-01' });
    // REQ-F-008 AC1: "GIVEN the types are piolets, crampones, cascos, cuerdas and tiendas WHEN the encargado adds 2 units of "Crampones" THEN the user sees "Crampones: 2 unidades" in the inventory"
    await expect(pantalla(page).getByText('Crampones: 2 unidades')).toBeVisible();
    await expect(pantalla(page).getByText('Crampones 1')).toBeVisible();
    await expect(pantalla(page).getByText('Crampones 2', { exact: false }).first()).toBeVisible();
    await captura(page, testInfo, 'AC-013-01', { ve: ['Crampones: 2 unidades'] });
  });

  test('FASE-1 AC-013-03 marta añade 0 unidades de Casco y ve La cantidad debe ser al menos 1', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'Marta entra, abre Inventario e intenta añadir 0 unidades de Casco');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Inventario');
    await page.getByLabel('Tipo').selectOption('Casco');
    await page.getByLabel('Cantidad').fill('0');
    await page.getByRole('button', { name: 'Añadir' }).click();
    await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «La cantidad debe ser al menos 1», y el recuento de Casco sigue en 0 unidades.', { criterio: 'AC-013-03' });
    // REQ-F-008 AC6: "GIVEN an amount of 0 units WHEN the encargado adds material THEN the user sees "La cantidad debe ser al menos 1""
    await expect(page.getByRole('alert')).toHaveText('La cantidad debe ser al menos 1');
    // el recuento de Casco no cambia
    await expect(pantalla(page).getByText('Casco: 0 unidades')).toBeVisible();
    await captura(page, testInfo, 'AC-013-03', { ve: ['La cantidad debe ser al menos 1'] });
  });
});

test.describe('FASE-1 Reservar material (socio)', () => {
  test('FASE-1 AC-005-01 lucia reserva Piolet del 2026-12-05 al 2026-12-07 con 3 libres y ve la reserva creada y 2 libres', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Piolet', 3);
    await narrar(page, testInfo, 'Lucía entra, elige Piolet y escribe el 5 y el 7 de diciembre');
    await entrar(page, servidor, LUCIA);
    await rellenarReserva(page, 'Piolet', '2026-12-05', '2026-12-07');
    await expect(libres(page, 'Piolet')).toHaveText('3 libres');
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «Reserva creada: Piolet, 2026-12-05 a 2026-12-07», y Piolet muestra 2 libres para esas fechas.', { criterio: 'AC-005-01' });
    // REQ-F-003 AC1: "GIVEN there are 3 "Piolet" units, all free, and today is 2026-11-21 WHEN "lucia" reserves "Piolet" from 2026-12-05 to 2026-12-07 THEN the user sees "Reserva creada: Piolet, 2026-12-05 a 2026-12-07" and "Piolet" shows "2 libres" for those dates"
    await expect(page.getByRole('status')).toHaveText('Reserva creada: Piolet, 2026-12-05 a 2026-12-07');
    await expect(libres(page, 'Piolet')).toHaveText('2 libres');
    await captura(page, testInfo, 'AC-005-01', { ve: ['Reserva creada: Piolet, 2026-12-05 a 2026-12-07', '2 libres'] });
  });

  test('FASE-1 AC-005-02 pablo reserva Tienda del 2026-12-09 al 2026-12-10 tras una reserva hasta el 2026-12-08 y se crea', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Tienda', 1);
    await reservarComo(servidor, LUCIA, { material: 'Tienda', inicio: '2026-12-06', fin: '2026-12-08' });
    await narrar(page, testInfo, 'La única Tienda está reservada hasta el 8 de diciembre. Pablo entra y pide la Tienda del 9 al 10 de diciembre');
    await entrar(page, servidor, PABLO);
    await reservar(page, 'Tienda', '2026-12-09', '2026-12-10');
    await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «Reserva creada: Tienda, 2026-12-09 a 2026-12-10»: los días no se solapan y la reserva se crea.', { criterio: 'AC-005-02' });
    // REQ-F-003 AC3: "GIVEN the same "Tienda" reservation ends 2026-12-08 WHEN "pablo" reserves it from 2026-12-09 to 2026-12-10 THEN the reservation is created (the days do not overlap)"
    await expect(page.getByRole('status')).toHaveText('Reserva creada: Tienda, 2026-12-09 a 2026-12-10');
    await captura(page, testInfo, 'AC-005-02', { ve: ['Reserva creada: Tienda, 2026-12-09 a 2026-12-10'] });
  });

  test('FASE-1 AC-005-03 lucia sin multas reserva Casco del 2026-12-05 al 2026-12-06 y se crea', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Casco', 1);
    await narrar(page, testInfo, 'Lucía, que no tiene multas, entra y pide un Casco del 5 al 6 de diciembre');
    await entrar(page, servidor, LUCIA);
    await reservar(page, 'Casco', '2026-12-05', '2026-12-06');
    await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «Reserva creada: Casco, 2026-12-05 a 2026-12-06»: una socia sin multas no queda bloqueada y la reserva se crea.', { criterio: 'AC-005-03' });
    // REQ-F-003 AC8: "GIVEN "lucia" without fines WHEN she reserves "Casco" for 2026-12-05 to 2026-12-06 THEN the reservation is created (a socio without fines is not blocked)"
    await expect(page.getByRole('status')).toHaveText('Reserva creada: Casco, 2026-12-05 a 2026-12-06');
    await captura(page, testInfo, 'AC-005-03', { ve: ['Reserva creada: Casco, 2026-12-05 a 2026-12-06'] });
  });

  test('FASE-1 AC-005-04 pablo pide Tienda del 2026-12-07 al 2026-12-09 con la única Tienda reservada del 2026-12-06 al 2026-12-08 y ve No hay unidades libres esas fechas', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Tienda', 1);
    await reservarComo(servidor, LUCIA, { material: 'Tienda', inicio: '2026-12-06', fin: '2026-12-08' });
    await narrar(page, testInfo, 'La única Tienda está reservada del 6 al 8 de diciembre. Pablo entra y pide la Tienda del 7 al 9');
    await entrar(page, servidor, PABLO);
    await reservar(page, 'Tienda', '2026-12-07', '2026-12-09');
    await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «No hay unidades libres esas fechas», y no se crea ninguna reserva para Pablo.', { criterio: 'AC-005-04' });
    // REQ-F-003 AC2: "GIVEN "Tienda" has 1 unit already reserved 2026-12-06 to 2026-12-08 WHEN "pablo" reserves "Tienda" from 2026-12-07 to 2026-12-09 THEN the user sees "No hay unidades libres esas fechas" and no reservation is created"
    await expect(page.getByRole('alert')).toHaveText('No hay unidades libres esas fechas');
    await captura(page, testInfo, 'AC-005-04', { ve: ['No hay unidades libres esas fechas'] });
    // no reservation is created: Mis reservas de Pablo sigue vacía
    await irA(page, 'Mis reservas');
    await expect(pantalla(page).getByText('No tienes reservas')).toBeVisible();
  });

  test('FASE-1 AC-005-05 lucia pide Casco del 2026-11-20 al 2026-11-22 con hoy 2026-11-21 y ve No se puede reservar en fechas pasadas', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Casco', 1);
    await narrar(page, testInfo, 'Hoy es 21 de noviembre. Lucía entra y pide un Casco desde el 20 de noviembre');
    await entrar(page, servidor, LUCIA);
    await reservar(page, 'Casco', '2026-11-20', '2026-11-22');
    await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «No se puede reservar en fechas pasadas».', { criterio: 'AC-005-05' });
    // REQ-F-003 AC4: "GIVEN today is 2026-11-21 WHEN "lucia" reserves "Casco" from 2026-11-20 to 2026-11-22 THEN the user sees "No se puede reservar en fechas pasadas""
    await expect(page.getByRole('alert')).toHaveText('No se puede reservar en fechas pasadas');
    await expect(page.getByLabel('Inicio', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await captura(page, testInfo, 'AC-005-05', { ve: ['No se puede reservar en fechas pasadas'] });
  });

  test('FASE-1 AC-005-06 lucia pone inicio 2026-12-10 y fin 2026-12-08 y ve La fecha de fin no puede ser anterior a la de inicio', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Casco', 1);
    await narrar(page, testInfo, 'Lucía entra y escribe como inicio el 10 de diciembre y como fin el 8 de diciembre');
    await entrar(page, servidor, LUCIA);
    await reservar(page, 'Casco', '2026-12-10', '2026-12-08');
    await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «La fecha de fin no puede ser anterior a la de inicio».', { criterio: 'AC-005-06' });
    // REQ-F-003 AC5: "GIVEN an end date before the start date, 2026-12-10 and 2026-12-08, WHEN "lucia" submits THEN the user sees "La fecha de fin no puede ser anterior a la de inicio""
    await expect(page.getByRole('alert')).toHaveText('La fecha de fin no puede ser anterior a la de inicio');
    await expect(page.getByLabel('Fin', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await captura(page, testInfo, 'AC-005-06', { ve: ['La fecha de fin no puede ser anterior a la de inicio'] });
  });

  test('FASE-1 AC-005-07 lucia pide Cuerda del 2026-12-01 al 2026-12-15 (15 días) y ve La reserva no puede superar 14 días', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Cuerda', 1);
    await narrar(page, testInfo, 'Lucía entra y pide una Cuerda del 1 al 15 de diciembre, quince días');
    await entrar(page, servidor, LUCIA);
    await reservar(page, 'Cuerda', '2026-12-01', '2026-12-15');
    await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «La reserva no puede superar 14 días».', { criterio: 'AC-005-07' });
    // REQ-F-003 AC6: "GIVEN a range of 15 days WHEN "lucia" reserves "Cuerda" from 2026-12-01 to 2026-12-15 THEN the user sees "La reserva no puede superar 14 días""
    await expect(page.getByRole('alert')).toHaveText('La reserva no puede superar 14 días');
    await captura(page, testInfo, 'AC-005-07', { ve: ['La reserva no puede superar 14 días'] });
  });

  test('FASE-1 AC-005-08 pablo con una multa pendiente de 4 € pide Casco del 2026-12-05 al 2026-12-06 y ve Tienes una multa pendiente', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Casco', 1);
    sembrarMultaPendiente(servidor, PABLO.correo, 4);
    await narrar(page, testInfo, 'Pablo tiene una multa pendiente de 4 euros. Entra y pide un Casco del 5 al 6 de diciembre');
    await entrar(page, servidor, PABLO);
    await reservar(page, 'Casco', '2026-12-05', '2026-12-06');
    await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «Tienes una multa pendiente: no puedes reservar hasta pagarla», y no se crea ninguna reserva.', { criterio: 'AC-005-08' });
    // REQ-F-003 AC7: "GIVEN "pablo" has an unpaid fine of 4 € WHEN he reserves "Casco" for 2026-12-05 to 2026-12-06 THEN the user sees "Tienes una multa pendiente: no puedes reservar hasta pagarla" and no reservation is created"
    await expect(page.getByRole('alert')).toHaveText('Tienes una multa pendiente: no puedes reservar hasta pagarla');
    await captura(page, testInfo, 'AC-005-08', { ve: ['Tienes una multa pendiente: no puedes reservar hasta pagarla'] });
    // no reservation is created
    await irA(page, 'Mis reservas');
    await expect(pantalla(page).getByText('No tienes reservas')).toBeVisible();
  });

  test('FASE-1 AC-005-14 lucia envía dos veces Piolet del 2026-12-05 al 2026-12-07 y Mis reservas muestra un solo Piolet', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Piolet', 3);
    await narrar(page, testInfo, 'Lucía entra, reserva un Piolet del 5 al 7 de diciembre y, sin tocar nada, vuelve a pulsar Reservar');
    await entrar(page, servidor, LUCIA);
    await reservar(page, 'Piolet', '2026-12-05', '2026-12-07');
    await expect(page.getByRole('status')).toHaveText('Reserva creada: Piolet, 2026-12-05 a 2026-12-07');
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(libres(page, 'Piolet')).toHaveText('2 libres');
    await irA(page, 'Mis reservas');
    await narrar(page, testInfo, 'Reservar material para unas fechas. En Mis reservas se ve «Piolet», una sola vez para el 2026-12-05 al 2026-12-07, sin repetirse.', { criterio: 'AC-005-14' });
    // REQ-F-003 AC9: "GIVEN "lucia" just reserved "Piolet" from 2026-12-05 to 2026-12-07 WHEN the same form is submitted again THEN "Mis reservas" still shows a single "Piolet" for those dates or the message "No hay unidades libres esas fechas" when no unit is left, and never two reservations of one unit for the same days"
    await expect(filasReservas(page)).toHaveCount(1);
    await expect(filasReservas(page).first()).toHaveText(/Piolet\s*2026-12-05\s*2026-12-07\s*Reservada/);
    await captura(page, testInfo, 'AC-005-14', { ve: ['Piolet'] });
  });
});

test.describe('FASE-1 Mis reservas (socio)', () => {
  test('FASE-1 AC-006-01 lucia con Piolet y pablo con Casco: lucia abre Mis reservas y ve Piolet sin Casco', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Piolet', 1);
    await anadirMaterial(servidor, 'Casco', 1);
    await reservarComo(servidor, LUCIA, { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' });
    await reservarComo(servidor, PABLO, { material: 'Casco', inicio: '2026-12-06', fin: '2026-12-07' });
    await narrar(page, testInfo, 'Lucía tiene un Piolet y Pablo un Casco. Lucía entra y abre Mis reservas');
    await entrar(page, servidor, LUCIA);
    await irA(page, 'Mis reservas');
    await narrar(page, testInfo, 'Ver y cancelar mis reservas. En Mis reservas se ve «Piolet», y el Casco de Pablo no aparece.', { criterio: 'AC-006-01' });
    // REQ-F-004 AC1: "GIVEN "lucia" has "Piolet" 2026-12-05 to 2026-12-07 and "pablo" has "Casco" 2026-12-06 to 2026-12-07 WHEN "lucia" opens "Mis reservas" THEN the user sees "Piolet" and does not see "Casco""
    await expect(filasReservas(page)).toHaveText([/Piolet\s*2026-12-05\s*2026-12-07/]);
    await expect(pantalla(page).getByText('Casco')).toBeHidden();
    await captura(page, testInfo, 'AC-006-01', { ve: ['Piolet'] });
  });

  test('FASE-1 AC-006-02 lucia sin reservas abre Mis reservas y ve No tienes reservas', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'Lucía no tiene ninguna reserva. Entra y abre Mis reservas');
    await entrar(page, servidor, LUCIA);
    await irA(page, 'Mis reservas');
    await narrar(page, testInfo, 'Ver y cancelar mis reservas. En Mis reservas se ve «No tienes reservas».', { criterio: 'AC-006-02' });
    // REQ-F-004 AC4: "GIVEN "lucia" has no reservations WHEN she opens "Mis reservas" THEN the user sees "No tienes reservas""
    await expect(pantalla(page).getByText('No tienes reservas')).toBeVisible();
    await captura(page, testInfo, 'AC-006-02', { ve: ['No tienes reservas'] });
  });

});

test.describe('FASE-1 Cancelar reserva (hoy 2026-12-04)', () => {
  test.use({ hoy: '2026-12-04' });

  test('FASE-1 AC-007-01 hoy 2026-12-04 lucia cancela su Piolet que empieza el 2026-12-05 y ve Reserva cancelada y Cancelada', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Piolet', 3);
    await reservarComo(servidor, LUCIA, { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' });
    await narrar(page, testInfo, 'Hoy es 4 de diciembre. Lucía abre Mis reservas y pulsa Cancelar reserva en su Piolet, que empieza mañana');
    await entrar(page, servidor, LUCIA);
    await irA(page, 'Mis reservas');
    await page.getByRole('button', { name: 'Cancelar reserva de Piolet 2026-12-05' }).click();
    await expect(page.getByRole('button', { name: 'Sí, cancelar' })).toBeFocused();
    await narrar(page, testInfo, 'Confirma con Sí, cancelar');
    await page.getByRole('button', { name: 'Sí, cancelar' }).click();
    await narrar(page, testInfo, 'Ver y cancelar mis reservas. En Mis reservas se ve «Reserva cancelada», y la reserva del Piolet pasa a estado Cancelada.', { criterio: 'AC-007-01' });
    // REQ-F-004 AC2: "GIVEN today is 2026-12-04 and "lucia" has "Piolet" starting 2026-12-05 WHEN she cancels it THEN the user sees "Reserva cancelada" and the reservation shows state "Cancelada""
    await expect(page.getByRole('status')).toHaveText('Reserva cancelada');
    await expect(filasReservas(page)).toHaveText([/Piolet\s*2026-12-05\s*2026-12-07\s*Cancelada/]);
    await captura(page, testInfo, 'AC-007-01', { ve: ['Reserva cancelada', 'Cancelada'] });
    // la unidad vuelve a quedar libre
    await irA(page, 'Inicio');
    await rellenarReserva(page, 'Piolet', '2026-12-05', '2026-12-07');
    await expect(libres(page, 'Piolet')).toHaveText('3 libres');
  });

  test('FASE-1 AC-007-03 lucia repite la cancelación de su Piolet ya cancelado y la reserva sigue Cancelada', async ({ page, context, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Piolet', 3);
    await reservarComo(servidor, LUCIA, { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' });
    await narrar(page, testInfo, 'Lucía tiene Mis reservas abierta y, en otra pestaña, cancela su Piolet');
    await entrar(page, servidor, LUCIA);
    await irA(page, 'Mis reservas');
    await expect(filasReservas(page)).toHaveCount(1);
    const otra = await context.newPage();
    await otra.goto(`${servidor.url}/#/reservas`);
    await otra.getByRole('button', { name: /^Cancelar reserva/ }).click();
    await otra.getByRole('button', { name: 'Sí, cancelar' }).click();
    await expect(otra.getByRole('status')).toHaveText('Reserva cancelada');
    const antes = await filasReservas(otra).allTextContents();
    await otra.close();
    await narrar(page, testInfo, 'En la primera pestaña, que aún enseña el botón, Lucía envía la misma cancelación otra vez');
    await cancelarPrimera(page);
    await narrar(page, testInfo, 'Ver y cancelar mis reservas. En Mis reservas se ve «Cancelada»: la reserva sigue Cancelada y no cambia nada más, sigue habiendo una sola reserva.', { criterio: 'AC-007-03' });
    // REQ-F-004 AC5: "GIVEN "lucia" already cancelled a reservation WHEN the same cancel is sent again THEN the reservation stays "Cancelada" and nothing else changes"
    await expect(page.getByRole('status')).toHaveText('Reserva cancelada');
    // REQ-F-004 AC5 cláusula: "the reservation stays"
    await expect(filasReservas(page)).toHaveText([/Piolet\s*2026-12-05\s*2026-12-07\s*Cancelada/]);
    // REQ-F-004 AC5 cláusula: "nothing else changes"
    expect(await filasReservas(page).allTextContents()).toEqual(antes);
    await expect(filasReservas(page)).toHaveCount(1);
    await captura(page, testInfo, 'AC-007-03', { ve: ['Cancelada'] });
  });
});

test.describe('FASE-1 Cancelar reserva (hoy 2026-12-05)', () => {
  test.use({ hoy: '2026-12-05' });

  test('FASE-1 AC-007-02 hoy 2026-12-05 lucia intenta cancelar su Piolet que empieza hoy y ve Solo se puede cancelar hasta el día antes', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Piolet', 1);
    await reservarComo(servidor, LUCIA, { material: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07' });
    await narrar(page, testInfo, 'Hoy es 5 de diciembre. Lucía abre Mis reservas y intenta cancelar su Piolet, que empieza hoy');
    await entrar(page, servidor, LUCIA);
    await irA(page, 'Mis reservas');
    await expect(filasReservas(page)).toHaveCount(1);
    const antes = await filasReservas(page).allTextContents();
    await cancelarPrimera(page);
    await narrar(page, testInfo, 'Ver y cancelar mis reservas. En Mis reservas se ve «Solo se puede cancelar hasta el día antes», y la reserva se queda como estaba, Reservada.', { criterio: 'AC-007-02' });
    // REQ-F-004 AC3: "GIVEN today is 2026-12-05 and "lucia" has "Piolet" starting 2026-12-05 WHEN she tries to cancel it THEN the user sees "Solo se puede cancelar hasta el día antes" and the reservation stays"
    await expect(page.getByRole('alert')).toHaveText('Solo se puede cancelar hasta el día antes');
    // REQ-F-004 AC3 cláusula: "the reservation stays"
    await expect(filasReservas(page)).toHaveText([/Piolet\s*2026-12-05\s*2026-12-07\s*Reservada/]);
    expect(await filasReservas(page).allTextContents()).toEqual(antes);
    await captura(page, testInfo, 'AC-007-02', { ve: ['Solo se puede cancelar hasta el día antes'] });
  });
});
