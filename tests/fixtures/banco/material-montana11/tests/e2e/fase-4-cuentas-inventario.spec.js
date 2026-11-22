// FASE-4 · REQ-F-002 y REQ-F-008 se cierran en esta entrega: sus criterios de alta, validación y acceso (UC-003, UC-013)
// se enseñan otra vez desde una instalación limpia, porque la demo de FASE-4 cubre los dos requisitos enteros. Cada
// test arranca su propio servidor con almacén y reloj propios (tests/e2e/fixtures/servidor.js).
import { test as base, expect, narrar, captura } from './fixtures/evidence.js';
import { crearServidor, MARTA } from './fixtures/servidor.js';

const PABLO = { nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' };
const LUCIA = { nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' };

async function entrar(page, servidor, { correo, contrasena }) {
  await page.goto(servidor.url);
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
}
const irA = (page, enlace) => page.getByRole('link', { name: enlace, exact: true }).click();
// «{tipo}: {n} unidad(es)»: la forma que enseña la pantalla, «1 unidad» o «3 unidades»
const recuento = (tipo, n) => `${tipo}: ${n} ${n === 1 ? 'unidad(es)'.replace('(es)', '') : 'unidad(es)'.replace('(es)', 'es')}`;
const unidadEnLista = (page, texto) => page.getByRole('listitem').filter({ hasText: texto });

const test = base.extend({
  servidor: async ({}, use) => {
    const servidor = await crearServidor();
    servidor.sembrar();
    await servidor.arrancar('2026-11-21');
    await use(servidor);
    await servidor.parar();
  },
});
const filaSocios = (page) => page.getByRole('table', { name: 'Socios' }).getByRole('row');
async function crearSocio(page, { nombre, correo, contrasena }) {
  await page.getByLabel('Nombre').fill(nombre);
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Crear socio' }).click();
}

test.describe('FASE-4 Socios e Inventario completos (UC-003, UC-013)', () => {
  test('FASE-4 AC-003-01 REQ-F-002 AC1 marta crea a Pablo Ruiz en Socios y lo ve en la lista', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'Marta entra y abre Socios desde el menú');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Socios');
    await narrar(page, testInfo, 'Marta escribe el nombre, el correo y la contraseña del nuevo socio y pulsa Crear socio');
    await crearSocio(page, PABLO);
    await narrar(page, testInfo, 'Gestionar las cuentas de socios. En Socios se ve «Pablo Ruiz» en la lista de socios.', { criterio: 'AC-003-01' });
    // REQ-F-002 AC1: "GIVEN the encargado WHEN he creates the member "Pablo Ruiz", "pablo@club.test", password "Nieve2026" THEN the user sees "Pablo Ruiz" in the list of socios"
    await expect(filaSocios(page).filter({ hasText: 'Pablo Ruiz' })).toContainText('pablo@club.test');
    await captura(page, testInfo, 'AC-003-01', { ve: ['Pablo Ruiz'] });
  });

  test('FASE-4 AC-003-04 REQ-F-002 AC2 marta crea un socio con la contraseña corta1 y ve el aviso de 8 caracteres', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'Marta entra, abre Socios y rellena el alta con una contraseña de seis caracteres');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Socios');
    await crearSocio(page, { ...PABLO, contrasena: 'corta1' });
    await narrar(page, testInfo, 'Gestionar las cuentas de socios. En Socios se ve «La contraseña debe tener al menos 8 caracteres». Y no se crea ningún socio.', { criterio: 'AC-003-04' });
    // REQ-F-002 AC2: "GIVEN the encargado WHEN he creates a member with password "corta1" (6 characters) THEN the user sees "La contraseña debe tener al menos 8 caracteres" and no member is created"
    await expect(page.getByRole('alert')).toHaveText('La contraseña debe tener al menos 8 caracteres');
    // REQ-F-002 AC2 cláusula: "no member is created"
    await expect(filaSocios(page).filter({ hasText: 'pablo@club.test' })).toHaveCount(0);
    await captura(page, testInfo, 'AC-003-04', { ve: ['La contraseña debe tener al menos 8 caracteres'] });
  });

  test('FASE-4 AC-003-05 REQ-F-002 AC3 marta crea otro socio con el correo pablo@club.test y ve que ya existe', async ({ page, servidor }, testInfo) => {
    await servidor.socio(PABLO);
    await narrar(page, testInfo, 'Marta abre Socios, donde ya está Pablo, y da de alta a otro socio con el mismo correo');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Socios');
    await crearSocio(page, { nombre: 'Otro Pablo', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
    await narrar(page, testInfo, 'Gestionar las cuentas de socios. En Socios se ve «Ya existe un socio con ese correo». Y la lista sigue con un solo pablo@club.test.', { criterio: 'AC-003-05' });
    // REQ-F-002 AC3: "GIVEN "pablo@club.test" already exists WHEN the encargado creates another member with the same email THEN the user sees "Ya existe un socio con ese correo" and the list keeps a single "pablo@club.test""
    await expect(page.getByRole('alert')).toHaveText('Ya existe un socio con ese correo');
    // REQ-F-002 AC3 cláusula: "the list keeps a single "pablo@club.test""
    await expect(filaSocios(page).filter({ hasText: 'pablo@club.test' })).toHaveCount(1);
    await captura(page, testInfo, 'AC-003-05', { ve: ['Ya existe un socio con ese correo'] });
  });

  test('FASE-4 AC-003-06 REQ-F-002 AC7 lucia, socia, abre la dirección de Socios y ve Acceso no permitido', async ({ page, servidor }, testInfo) => {
    await servidor.socio(LUCIA);
    await narrar(page, testInfo, 'Lucía, que es socia, entra y escribe a mano la dirección de Socios');
    await entrar(page, servidor, LUCIA);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Material disponible');
    await page.goto(`${servidor.url}/#/socios`);
    await narrar(page, testInfo, 'Gestionar las cuentas de socios. En Socios se ve «Acceso no permitido».', { criterio: 'AC-003-06' });
    // REQ-F-002 AC7: "GIVEN a socio session WHEN the socio opens the address of "Socios" THEN the user sees "Acceso no permitido""
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acceso no permitido');
    await captura(page, testInfo, 'AC-003-06', { ve: ['Acceso no permitido'] });
  });

  test('FASE-4 AC-013-01 REQ-F-008 AC1 marta añade 2 Crampones en Inventario y ve Crampones: 2 unidades', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'Marta, la encargada, entra y abre Inventario');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Inventario');
    await expect(page.getByRole('heading', { name: recuento('Crampones', 0) })).toBeVisible();
    await narrar(page, testInfo, 'Elige Crampones, escribe la cantidad 2 y pulsa Añadir');
    await page.getByLabel('Tipo').selectOption('Crampones');
    await page.getByLabel('Cantidad').fill('2');
    await page.getByRole('button', { name: 'Añadir' }).click();
    await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «Crampones: 2 unidades», con las unidades Crampones 1 y Crampones 2.', { criterio: 'AC-013-01' });
    // REQ-F-008 AC1: "GIVEN the types are piolets, crampones, cascos, cuerdas and tiendas WHEN the encargado adds 2 units of "Crampones" THEN the user sees "Crampones: 2 unidades" in the inventory"
    await expect(page.getByRole('heading', { name: recuento('Crampones', 2) })).toBeVisible();
    await expect(unidadEnLista(page, 'Crampones 1')).toHaveText(/^Crampones 1 · Alta/);
    await expect(unidadEnLista(page, 'Crampones 2')).toHaveText(/^Crampones 2 · Alta/);
    await captura(page, testInfo, 'AC-013-01', { ve: ['Crampones: 2 unidades'] });
  });

  test('FASE-4 AC-013-03 REQ-F-008 AC6 marta añade 0 unidades de Casco y ve La cantidad debe ser al menos 1', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'Marta entra, abre Inventario e intenta añadir 0 unidades de Casco');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Inventario');
    await page.getByLabel('Tipo').selectOption('Casco');
    await page.getByLabel('Cantidad').fill('0');
    await page.getByRole('button', { name: 'Añadir' }).click();
    await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «La cantidad debe ser al menos 1», y el recuento de Casco sigue en 0 unidades.', { criterio: 'AC-013-03' });
    // REQ-F-008 AC6: "GIVEN an amount of 0 units WHEN the encargado adds material THEN the user sees "La cantidad debe ser al menos 1""
    await expect(page.getByRole('alert')).toHaveText('La cantidad debe ser al menos 1');
    await expect(page.getByRole('heading', { name: recuento('Casco', 0) })).toBeVisible();
    await captura(page, testInfo, 'AC-013-03', { ve: ['La cantidad debe ser al menos 1'] });
  });

  test('FASE-4 AC-013-06 REQ-F-008 AC7 lucia, socia, abre la dirección de Inventario y ve Acceso no permitido', async ({ page, servidor }, testInfo) => {
    await servidor.socio(LUCIA);
    await narrar(page, testInfo, 'Lucía, que es socia, entra y escribe a mano la dirección de Inventario');
    await entrar(page, servidor, LUCIA);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Material disponible');
    await page.goto(`${servidor.url}/#/inventario`);
    await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «Acceso no permitido».', { criterio: 'AC-013-06' });
    // REQ-F-008 AC7: "GIVEN a socio session WHEN the socio opens the address of "Inventario" THEN the user sees "Acceso no permitido""
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acceso no permitido');
    await captura(page, testInfo, 'AC-013-06', { ve: ['Acceso no permitido'] });
  });
});
