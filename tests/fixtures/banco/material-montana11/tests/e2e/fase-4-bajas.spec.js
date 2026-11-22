// FASE-4 · Restablecer contraseñas y dar de baja (UC-004, UC-014): el encargado restablece la clave de Lucía, intenta
// dar de baja a Pablo con un Casco sin devolver y después lo da de baja, y retira unidades de Inventario. Cada test
// arranca su propio servidor con almacén y reloj propios (tests/e2e/fixtures/servidor.js) y prepara su GIVEN por la
// API, moviendo el reloj del servidor. La FASE no tiene workflow: el vídeo lleva FASE-4 en el nombre.
// Los criterios de borde (AC-004-03, 004-04, 004-06..09, AC-014-04..06, 014-08) los cubren unit y api.
import fs from 'node:fs';
import { test as base, expect, narrar, captura } from './fixtures/evidence.js';
import { crearServidor, MARTA } from './fixtures/servidor.js';
import { anadirMaterial, reservarComo, sesionDe } from './fixtures/reservas.js';
import { entregarComoMarta, devolverComoMarta, libresPara } from './fixtures/prestamos.js';

const PABLO = { nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' };
const LUCIA = { nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' };

const test = base.extend({
  servidor: async ({}, use) => {
    const servidor = await crearServidor();
    servidor.sembrar();
    await servidor.arrancar('2026-11-21');
    await servidor.socio(PABLO);
    await servidor.socio(LUCIA);
    await use(servidor);
    await servidor.parar();
  },
});

async function comoMarta(servidor, operacion, cuerpo) {
  const r = await fetch(`${servidor.url}/api/${operacion}`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: await sesionDe(servidor, MARTA) }, body: JSON.stringify(cuerpo) });
  const datos = await r.json();
  if (!datos.ok) throw new Error(`No se pudo preparar ${operacion}: ${datos.codigo}`);
  return datos.datos;
}
const iniciarPorApi = async (servidor, correo, contrasena) => (await fetch(`${servidor.url}/api/iniciarSesion`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo, contrasena }) })).json();
const misReservas = async (servidor, socio) => (await (await fetch(`${servidor.url}/api/listarMisReservas`, { headers: { cookie: await sesionDe(servidor, socio) } })).json()).datos;
const unidadId = (servidor, tipo, numero) => JSON.parse(fs.readFileSync(servidor.archivo, 'utf8')).unidades.find((u) => u.tipo === tipo && u.numero === numero).id;

async function entrar(page, servidor, { correo, contrasena }) {
  await page.goto(servidor.url);
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
}
const irA = (page, enlace) => page.getByRole('link', { name: enlace, exact: true }).click();
const filaSocio = (page, nombre) => page.getByRole('table', { name: 'Socios', exact: true }).locator('tbody tr', { hasText: nombre });
/** Botón de acción de un socio: está en su elemento de la lista de acciones bajo la tabla. */
const accionDe = (page, socio, boton) => page.getByRole('listitem').filter({ hasText: socio }).getByRole('button', { name: boton, exact: true });
// «{tipo}: {n} unidad(es)»: la forma que enseña la pantalla, «1 unidad» o «3 unidades»
const recuento = (tipo, n) => `${tipo}: ${n} ${n === 1 ? 'unidad(es)'.replace('(es)', '') : 'unidad(es)'.replace('(es)', 'es')}`;
const unidadEnLista = (page, texto) => page.getByRole('listitem').filter({ hasText: texto });

test.describe('FASE-4 Restablecer contraseñas y dar de baja (UC-004, UC-014)', () => {
  test('FASE-4 AC-004-01 REQ-F-002 AC4 marta fija "Hielo2026x" a Lucía Gil: Socios muestra Contraseña restablecida, Lucía entra con ella y no con Cumbre2026', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'Lucía Gil olvidó su contraseña. Marta, la encargada, entra y abre Socios');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Socios');
    await narrar(page, testInfo, 'Marta pulsa Restablecer contraseña en la fila de Lucía, escribe la nueva contraseña Hielo2026x y la guarda');
    await accionDe(page, 'Lucía Gil', 'Restablecer contraseña').click();
    await page.getByLabel('Nueva contraseña').fill('Hielo2026x');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByRole('status')).toHaveText('Contraseña restablecida');
    // REQ-F-002 AC4: "GIVEN the member "Lucía Gil" forgot her password WHEN the encargado sets the new password "Hielo2026x" THEN she can sign in with it and no longer with the old one"
    const nueva = await iniciarPorApi(servidor, LUCIA.correo, 'Hielo2026x');
    expect(nueva).toMatchObject({ ok: true, datos: { nombre: 'Lucía Gil', rol: 'socio' } });
    // REQ-F-002 AC4 cláusula: "no longer with the old one"
    const antigua = await iniciarPorApi(servidor, LUCIA.correo, 'Cumbre2026');
    expect(antigua).toMatchObject({ ok: false, codigo: 'E_CREDENCIALES_INVALIDAS' });
    await narrar(page, testInfo, 'Gestionar las cuentas de socios. En Socios se ve «Contraseña restablecida»: Lucía entra con «Hielo2026x» y con su contraseña antigua «Cumbre2026» ya no puede entrar.', { criterio: 'AC-004-01' });
    await expect(page.getByRole('status')).toHaveText('Contraseña restablecida');
    await expect(page.getByRole('main').getByText('Hielo2026x')).toHaveCount(0);   // la contraseña no se pinta tras guardar
    await captura(page, testInfo, 'AC-004-01', { ve: ['Contraseña restablecida'] });
  });

  test('FASE-4 AC-004-05 REQ-F-002 AC6 marta intenta dar de baja a Pablo Ruiz con un Casco sin devolver y ve No se puede dar de baja: tiene material sin devolver', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Casco', 1);
    const { id } = await reservarComo(servidor, PABLO, { material: 'Casco', inicio: '2026-12-05', fin: '2026-12-07' });
    await servidor.reiniciar('2026-12-05');
    await entregarComoMarta(servidor, id);
    await narrar(page, testInfo, 'Es el 5 de diciembre. Pablo Ruiz se llevó un Casco y todavía no lo ha devuelto. Marta entra, abre Socios y le da de baja');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Socios');
    await accionDe(page, 'Pablo Ruiz', 'Dar de baja').click();
    await page.getByRole('button', { name: 'Sí, dar de baja' }).click();
    await narrar(page, testInfo, 'Gestionar las cuentas de socios. En Socios se ve «No se puede dar de baja: tiene material sin devolver» y Pablo Ruiz sigue activo.', { criterio: 'AC-004-05' });
    // REQ-F-002 AC6: "GIVEN "Pablo Ruiz" has a lent unit not yet returned WHEN the encargado tries to deactivate him THEN the user sees "No se puede dar de baja: tiene material sin devolver" and he stays active"
    await expect(page.getByRole('alert')).toHaveText('No se puede dar de baja: tiene material sin devolver');
    // REQ-F-002 AC6 cláusula: "he stays active"
    await expect(filaSocio(page, 'Pablo Ruiz').getByRole('cell').nth(2)).toHaveText('Activa');
    await expect(accionDe(page, 'Pablo Ruiz', 'Dar de baja')).toBeVisible();
    await captura(page, testInfo, 'AC-004-05', { ve: ['No se puede dar de baja: tiene material sin devolver'] });
  });

  test('FASE-4 AC-004-02 REQ-F-002 AC5 marta da de baja a Pablo Ruiz, que devolvió su Casco y tiene 1 reserva futura de Casco 2, y Socios lo muestra Baja', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Casco', 2);
    const { id: prestamo } = await reservarComo(servidor, PABLO, { material: 'Casco', inicio: '2026-12-05', fin: '2026-12-07' });
    await reservarComo(servidor, LUCIA, { material: 'Casco', inicio: '2026-12-20', fin: '2026-12-21' });
    const futura = await reservarComo(servidor, PABLO, { material: 'Casco', inicio: '2026-12-20', fin: '2026-12-21' });
    expect(futura).toMatchObject({ unidad: 2, estado: 'Reservada' });   // "Casco 2"
    await servidor.reiniciar('2026-12-05');
    await entregarComoMarta(servidor, prestamo);
    await servidor.reiniciar('2026-12-06');
    await devolverComoMarta(servidor, prestamo);
    expect(await libresPara(servidor, LUCIA, 'Casco', '2026-12-20', '2026-12-21')).toBe(0);
    await narrar(page, testInfo, 'Es el 6 de diciembre. Pablo Ruiz ya devolvió su Casco y tiene una reserva de Casco 2 para el 20 de diciembre. Marta entra y abre Socios');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Socios');
    await narrar(page, testInfo, 'Marta pulsa Dar de baja en Pablo Ruiz y confirma');
    await accionDe(page, 'Pablo Ruiz', 'Dar de baja').click();
    await page.getByRole('button', { name: 'Sí, dar de baja' }).click();
    await expect(filaSocio(page, 'Pablo Ruiz').getByRole('cell').nth(2)).toHaveText('Baja');
    // REQ-F-002 AC5: "GIVEN "Pablo Ruiz" has 1 future reservation of "Casco 2" WHEN the encargado deactivates him THEN the user sees "Pablo Ruiz" marked "Baja" and the reservation is cancelled, freeing the unit"
    const reservas = await misReservas(servidor, PABLO).catch(() => null);
    expect(reservas).toBeNull();   // sus sesiones se cerraron: ya no entra
    expect((await iniciarPorApi(servidor, PABLO.correo, PABLO.contrasena)).codigo).toBe('E_CREDENCIALES_INVALIDAS');
    // REQ-F-002 AC5 cláusula: "the reservation is cancelled, freeing the unit"
    expect(await libresPara(servidor, LUCIA, 'Casco', '2026-12-20', '2026-12-21')).toBe(1);
    await narrar(page, testInfo, 'Gestionar las cuentas de socios. En Socios se ve «Baja» en la fila de Pablo Ruiz, su reserva de Casco 2 queda cancelada y la unidad libre.', { criterio: 'AC-004-02' });
    await expect(filaSocio(page, 'Pablo Ruiz').getByRole('cell').nth(2)).toHaveText('Baja');
    await expect(accionDe(page, 'Pablo Ruiz', 'Dar de baja')).toHaveCount(0);
    await captura(page, testInfo, 'AC-004-02', { ve: ['Baja'] });
  });

  test('FASE-4 AC-014-01 REQ-F-008 AC2 marta da de baja Casco 3 de 4 y Inventario muestra Casco: 3 unidades y Casco 3 De baja', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Casco', 4);
    await narrar(page, testInfo, 'El Casco 3 del club está roto. Marta entra y abre Inventario, donde Casco tiene 4 unidades');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Inventario');
    await expect(page.getByRole('heading', { name: recuento('Casco', 4) })).toBeVisible();
    await narrar(page, testInfo, 'Marta pulsa Dar de baja en Casco 3 y confirma');
    await page.getByRole('button', { name: 'Dar de baja Casco 3' }).click();
    await page.getByRole('button', { name: 'Sí, dar de baja' }).click();
    await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «Casco: 3 unidades» y Casco 3 aparece como «De baja».', { criterio: 'AC-014-01' });
    // REQ-F-008 AC2: "GIVEN "Casco" has 4 units and "Casco 3" is broken WHEN the encargado removes "Casco 3" THEN the user sees "Casco: 3 unidades" and "Casco 3" as "De baja""
    await expect(page.getByRole('heading', { name: recuento('Casco', 3) })).toBeVisible();
    await expect(unidadEnLista(page, 'Casco 3')).toHaveText('Casco 3 · De baja');
    await expect(unidadEnLista(page, 'Casco 3').getByRole('button')).toHaveCount(0);
    await captura(page, testInfo, 'AC-014-01', { ve: ['Casco: 3 unidades', 'De baja'] });
  });

  test('FASE-4 AC-014-03 REQ-F-008 AC3 marta intenta dar de baja Casco 2, prestada ahora, y ve No se puede dar de baja: está prestada', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Casco', 2);
    await reservarComo(servidor, LUCIA, { material: 'Casco', inicio: '2026-12-05', fin: '2026-12-07' });
    const { id } = await reservarComo(servidor, PABLO, { material: 'Casco', inicio: '2026-12-05', fin: '2026-12-07' });
    await servidor.reiniciar('2026-12-05');
    await entregarComoMarta(servidor, id);
    await narrar(page, testInfo, 'Es el 5 de diciembre. Pablo tiene prestado el Casco 2. Marta entra, abre Inventario y le da de baja');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Inventario');
    await page.getByRole('button', { name: 'Dar de baja Casco 2' }).click();
    await page.getByRole('button', { name: 'Sí, dar de baja' }).click();
    await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «No se puede dar de baja: está prestada» y la unidad Casco 2 se queda.', { criterio: 'AC-014-03' });
    // REQ-F-008 AC3: "GIVEN "Casco 2" is lent now WHEN the encargado tries to remove it THEN the user sees "No se puede dar de baja: está prestada" and the unit stays"
    await expect(page.getByRole('alert')).toHaveText('No se puede dar de baja: está prestada');
    // REQ-F-008 AC3 cláusula: "the unit stays"
    await expect(unidadEnLista(page, 'Casco 2')).toHaveText(/^Casco 2 · Alta/);
    await expect(page.getByRole('heading', { name: recuento('Casco', 2) })).toBeVisible();
    await captura(page, testInfo, 'AC-014-03', { ve: ['No se puede dar de baja: está prestada'] });
  });

  test('FASE-4 AC-014-02 REQ-F-008 AC4 marta da de baja la única Tienda con una reserva desde 2026-12-20 y ve 1 reserva cancelada por la baja', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Tienda', 1);
    await reservarComo(servidor, LUCIA, { material: 'Tienda', inicio: '2026-12-20', fin: '2026-12-22' });
    await narrar(page, testInfo, 'La única Tienda del club tiene una reserva de Lucía desde el 20 de diciembre. Marta entra, abre Inventario y le da de baja');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Inventario');
    await page.getByRole('button', { name: 'Dar de baja Tienda 1' }).click();
    await page.getByRole('button', { name: 'Sí, dar de baja' }).click();
    await expect(page.getByRole('status')).toHaveText('1 reserva cancelada por la baja');
    // REQ-F-008 AC4: "GIVEN "Tienda" has 1 unit with a future reservation from 2026-12-20 WHEN the encargado removes it THEN that reservation is cancelled and the user sees "1 reserva cancelada por la baja""
    const reservas = await misReservas(servidor, LUCIA);
    expect(reservas.map((r) => [r.material, r.inicio, r.estado])).toEqual([['Tienda', '2026-12-20', 'Cancelada']]);
    await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «1 reserva cancelada por la baja»: la reserva de Lucía desde el 20 de diciembre queda cancelada.', { criterio: 'AC-014-02' });
    await expect(page.getByRole('status')).toHaveText('1 reserva cancelada por la baja');
    await captura(page, testInfo, 'AC-014-02', { ve: ['1 reserva cancelada por la baja'] });
  });

  test('FASE-4 AC-014-07 REQ-F-008 AC5 con Casco 3 ya De baja, repetir la baja deja Inventario en Casco: 3 unidades', async ({ page, servidor }, testInfo) => {
    await anadirMaterial(servidor, 'Casco', 4);
    await comoMarta(servidor, 'darDeBajaUnidad', { unidadId: unidadId(servidor, 'Casco', 3) });
    await narrar(page, testInfo, 'Casco 3 ya está de baja. Marta entra y abre Inventario, donde Casco tiene 3 unidades');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Inventario');
    await expect(page.getByRole('heading', { name: recuento('Casco', 3) })).toBeVisible();
    // REQ-F-008 AC5: "GIVEN a unit already "De baja" WHEN the same removal is sent again THEN the count stays the same"
    const repetida = await comoMarta(servidor, 'darDeBajaUnidad', { unidadId: unidadId(servidor, 'Casco', 3) });
    expect(repetida.inventario.tipos.find((t) => t.tipo === 'Casco').total).toBe(3);
    await page.reload();
    await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «Casco: 3 unidades»: se envió otra vez la baja de Casco 3 y el recuento sigue en 3 unidades.', { criterio: 'AC-014-07' });
    // REQ-F-008 AC5 cláusula: "the count stays the same"
    await expect(page.getByRole('heading', { name: recuento('Casco', 3) })).toBeVisible();
    await expect(unidadEnLista(page, 'Casco 3')).toHaveText('Casco 3 · De baja');
    await captura(page, testInfo, 'AC-014-07', { ve: ['Casco: 3 unidades'] });
  });
});

