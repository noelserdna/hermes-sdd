// FASE-5 · V-015 y V-016, lo prestado, el historial y datos cerrados: el encargado abre Prestado y ve lo que está fuera,
// lo que vuelve un día y el retraso; la junta elige a un socio y ve su historial sin poder cambiar nada; Lucía no obtiene
// datos de Pablo y el almacén no guarda ninguna contraseña en claro. Cada test arranca su propio servidor con almacén y
// reloj propios (tests/e2e/fixtures/servidor.js); el GIVEN se prepara por la API moviendo el reloj. Los demás escenarios
// (AC-015-04..07, AC-016-02, AC-016-03, AC-016-05..07, REQ-NF-001 AC2 y AC4) los cubren unit y api y no se repiten aquí.
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, narrar, captura } from './fixtures/evidence.js';
import { crearServidor, MARTA } from './fixtures/servidor.js';
import { LUCIA, PABLO, JUNTA, sembrarJunta, lucia_y_pablo_con_material_fuera, lucia_devolvio_y_pablo_tiene_multa } from './fixtures/consultas.js';

const test = base.extend({
  servidor: async ({}, use) => {
    const servidor = await crearServidor();
    servidor.sembrar();
    sembrarJunta(servidor);
    await servidor.arrancar('2026-11-21');
    await servidor.socio(LUCIA);
    await servidor.socio(PABLO);
    await use(servidor);
    await servidor.parar();
  },
});

async function entrar(page, servidor, { correo, contrasena }) {
  await page.goto(servidor.url);
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
}
const irA = (page, enlace) => page.getByRole('link', { name: enlace, exact: true }).click();
const seccion = (page, titulo) => page.locator('section').filter({ has: page.getByRole('heading', { name: titulo, exact: true }) });
const sinFallosDeAccesibilidad = async (page) => expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);   // A11Y-T-001

test.describe('FASE-5 Lo prestado, el historial y datos cerrados (UC-015, UC-016)', () => {
  test('FASE-5 AC-015-01 REQ-F-009 AC1 con el Piolet 1 de Lucía Gil hasta 2026-12-07 y el Casco 2 de Pablo Ruiz hasta 2026-12-08 Prestado los lista', async ({ page, servidor }, testInfo) => {
    await lucia_y_pablo_con_material_fuera(servidor);
    await narrar(page, testInfo, 'Es el 6 de diciembre. Lucía tiene un Piolet y Pablo un Casco fuera del almacén. Marta, la encargada, entra y abre Prestado');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Prestado');
    await narrar(page, testInfo, 'Ver lo prestado y lo que vuelve cada día. En Prestado se ve «Piolet 1 — Lucía Gil — hasta 2026-12-07» y «Casco 2 — Pablo Ruiz — hasta 2026-12-08».', { criterio: 'AC-015-01' });
    // REQ-F-009 AC1: "GIVEN "Piolet 1" lent to "Lucía Gil" until 2026-12-07 and "Casco 2" lent to "Pablo Ruiz" until 2026-12-08 WHEN the encargado opens "Prestado" THEN the user sees "Piolet 1 — Lucía Gil — hasta 2026-12-07" and "Casco 2 — Pablo Ruiz — hasta 2026-12-08""
    await expect(page.getByRole('heading', { name: 'Prestado', level: 1 })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Piolet 1 — Lucía Gil — hasta 2026-12-07' })).toHaveCount(1);
    await expect(page.getByRole('listitem').filter({ hasText: 'Casco 2 — Pablo Ruiz — hasta 2026-12-08' })).toHaveCount(1);
    await sinFallosDeAccesibilidad(page);
    await captura(page, testInfo, 'AC-015-01', { ve: ['Piolet 1 — Lucía Gil — hasta 2026-12-07', 'Casco 2 — Pablo Ruiz — hasta 2026-12-08'] });
  });

  test('FASE-5 AC-015-02 REQ-F-009 AC2 el día 2026-12-07 el Piolet 1 aparece bajo Vuelven hoy y el Casco 2 no aparece bajo Vuelven hoy sino bajo Prestado ahora', async ({ page, servidor }, testInfo) => {
    await lucia_y_pablo_con_material_fuera(servidor);
    await narrar(page, testInfo, 'Marta entra, abre Prestado y elige el día 7 de diciembre');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Prestado');
    await page.getByLabel('Día', { exact: true }).fill('2026-12-07');
    await page.getByRole('button', { name: 'Ver', exact: true }).click();
    await narrar(page, testInfo, 'Ver lo prestado y lo que vuelve cada día. En Prestado se ve «Vuelven hoy» con el «Piolet 1» de Lucía Gil, y el Casco 2 de Pablo Ruiz no está entre los que vuelven ese día: sigue prestado y se ve en «Prestado ahora».', { criterio: 'AC-015-02' });
    // REQ-F-009 AC2: "GIVEN the same loans WHEN the encargado picks the day 2026-12-07 THEN the user sees "Piolet 1" under "Vuelven hoy" and does not see "Casco 2""
    const vuelven = seccion(page, 'Vuelven hoy');
    await expect(vuelven.getByRole('listitem')).toHaveText(['Piolet 1 — Lucía Gil — hasta 2026-12-07']);
    await expect(vuelven).toHaveText('Vuelven hoyPiolet 1 — Lucía Gil — hasta 2026-12-07');
    // «does not see "Casco 2"»: bajo "Vuelven hoy" ese día (decisión de la persona); el Casco 2 sigue prestado y se ve en "Prestado ahora"
    await expect(vuelven.getByText('Casco 2')).toHaveCount(0);
    await expect(vuelven.getByText('Pablo Ruiz')).toHaveCount(0);
    await expect(seccion(page, 'Prestado ahora').getByRole('listitem')).toHaveText(['Casco 2 — Pablo Ruiz — hasta 2026-12-08']);
    await captura(page, testInfo, 'AC-015-02', { ve: ['Vuelven hoy', 'Piolet 1'] });
  });

  test('FASE-5 AC-015-03 REQ-F-009 AC3 con hoy 2026-12-09 el Casco 2 de Pablo Ruiz con fin 2026-12-08 sin devolver muestra Retrasado 1 día', async ({ page, servidor }, testInfo) => {
    await lucia_y_pablo_con_material_fuera(servidor, { hoy: '2026-12-09', piolet: 'devuelto' });
    await narrar(page, testInfo, 'Es el 9 de diciembre. Lucía ya devolvió su Piolet, pero Pablo no ha devuelto el Casco que debía volver el 8. Marta entra y abre Prestado');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Prestado');
    await narrar(page, testInfo, 'Ver lo prestado y lo que vuelve cada día. En Prestado se ve el «Casco 2» de Pablo Ruiz marcado «Retrasado 1 día».', { criterio: 'AC-015-03' });
    // REQ-F-009 AC3: "GIVEN "Casco 2" ended 2026-12-08 and today is 2026-12-09 and not returned WHEN the encargado opens "Prestado" THEN the user sees "Casco 2" marked "Retrasado 1 día""
    const casco = page.getByRole('listitem').filter({ hasText: 'Casco 2 — Pablo Ruiz — hasta 2026-12-08' });
    await expect(casco).toHaveCount(1);
    await expect(casco).toContainText('Retrasado 1 día');
    await expect(page.getByText('Piolet 1')).toHaveCount(0);
    await captura(page, testInfo, 'AC-015-03', { ve: ['Casco 2', 'Retrasado 1 día'] });
  });

  test('FASE-5 AC-016-01 REQ-F-010 AC1 la junta elige a Pablo Ruiz y ve Multa 6,00 € Pendiente y nada de Lucía Gil', async ({ page, servidor }, testInfo) => {
    await lucia_devolvio_y_pablo_tiene_multa(servidor);
    await narrar(page, testInfo, 'Es el 11 de diciembre. Lucía devolvió su Piolet a tiempo y Pablo devolvió tarde su Casco. La junta entra y abre Historial');
    await entrar(page, servidor, JUNTA);
    await irA(page, 'Historial');
    await page.getByLabel('Socio', { exact: true }).selectOption({ label: 'Pablo Ruiz' });
    await page.getByRole('button', { name: 'Ver historial', exact: true }).click();
    await narrar(page, testInfo, 'La junta consulta el historial de un socio. En Historial del socio se ve «Multa 6,00 € Pendiente» de Pablo Ruiz, y no aparece nada de Lucía Gil.', { criterio: 'AC-016-01' });
    // REQ-F-010 AC1: "GIVEN "Lucía Gil" returned "Piolet 1" on 2026-12-07 and "Pablo Ruiz" has a 6,00 € fine WHEN the junta opens the history of "Pablo Ruiz" THEN the user sees "Multa 6,00 € Pendiente" and not the loans of "Lucía Gil""
    await expect(page.getByRole('heading', { name: 'Historial de Pablo Ruiz' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Multa 6,00 € Pendiente' })).toHaveCount(1);
    // el historial de Pablo (la lista) no lleva ni a Lucía Gil ni su Piolet 1
    await expect(page.locator('ul')).not.toContainText('Lucía');
    await expect(page.locator('ul')).not.toContainText('Piolet');
    await sinFallosDeAccesibilidad(page);
    await captura(page, testInfo, 'AC-016-01', { ve: ['Multa 6,00 € Pendiente'] });
  });

  test('FASE-5 AC-015-04 REQ-F-009 AC4 sin préstamos abiertos Prestado muestra No hay material prestado', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'Nadie tiene material fuera. Marta entra y abre Prestado');
    await entrar(page, servidor, MARTA);
    await irA(page, 'Prestado');
    await narrar(page, testInfo, 'Ver lo prestado y lo que vuelve cada día. En Prestado se ve «No hay material prestado», y la lista queda sin ninguna fila.', { criterio: 'AC-015-04' });
    // REQ-F-009 AC4: "GIVEN nothing is lent WHEN the encargado opens "Prestado" THEN the user sees "No hay material prestado""
    await expect(page.getByRole('main').getByText('No hay material prestado', { exact: true })).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(0);
    await captura(page, testInfo, 'AC-015-04', { ve: ['No hay material prestado'] });
  });

  test('FASE-5 AC-016-02 REQ-F-010 AC2 la junta elige a Lucía Gil y ve el Piolet 1 con Devuelto', async ({ page, servidor }, testInfo) => {
    await lucia_devolvio_y_pablo_tiene_multa(servidor);
    await narrar(page, testInfo, 'Lucía devolvió su Piolet el 7 de diciembre. La junta entra, abre Historial y elige a Lucía Gil');
    await entrar(page, servidor, JUNTA);
    await irA(page, 'Historial');
    await page.getByLabel('Socio', { exact: true }).selectOption({ label: 'Lucía Gil' });
    await page.getByRole('button', { name: 'Ver historial', exact: true }).click();
    await narrar(page, testInfo, 'La junta consulta el historial de un socio. En Historial del socio se ve el «Piolet 1» de Lucía Gil con el estado «Devuelto».', { criterio: 'AC-016-02' });
    // REQ-F-010 AC2: "GIVEN the junta opens the history of "Lucía Gil" THEN the user sees "Piolet 1" with "Devuelto""
    await expect(page.getByRole('heading', { name: 'Historial de Lucía Gil' })).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveText(['Piolet 1 — 2026-12-05 a 2026-12-07 — Devuelto']);
    await captura(page, testInfo, 'AC-016-02', { ve: ['Piolet 1', 'Devuelto'] });
  });

  test('FASE-5 AC-016-03 REQ-F-010 AC3 la junta elige a Ana Mir, sin préstamos ni multas, y ve Sin préstamos ni multas', async ({ page, servidor }, testInfo) => {
    await servidor.socio({ nombre: 'Ana Mir', correo: 'ana@club.test', contrasena: 'Cumbre2026' });
    await narrar(page, testInfo, 'Ana Mir se hizo socia hace poco y nunca ha pedido material. La junta entra, abre Historial y la elige');
    await entrar(page, servidor, JUNTA);
    await irA(page, 'Historial');
    await page.getByLabel('Socio', { exact: true }).selectOption({ label: 'Ana Mir' });
    await page.getByRole('button', { name: 'Ver historial', exact: true }).click();
    await narrar(page, testInfo, 'La junta consulta el historial de un socio. En Historial del socio se ve «Sin préstamos ni multas» para Ana Mir.', { criterio: 'AC-016-03' });
    // REQ-F-010 AC3: "GIVEN a socio without history WHEN the junta opens it THEN the user sees "Sin préstamos ni multas""
    await expect(page.getByRole('heading', { name: 'Historial de Ana Mir' })).toBeVisible();
    await expect(page.getByRole('main').getByText('Sin préstamos ni multas', { exact: true })).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(0);
    await captura(page, testInfo, 'AC-016-03', { ve: ['Sin préstamos ni multas'] });
  });

  test('FASE-5 AC-016-04 REQ-F-010 AC4 la junta abre Entregar, Inventario y Reservar y ve Acceso no permitido, sin botones que cambien datos', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'La junta entra y abre Historial, su única pantalla de trabajo');
    await entrar(page, servidor, JUNTA);
    await irA(page, 'Historial');
    // REQ-F-010 AC4 cláusula: "the junta screens have no button to change data"
    await expect(page.getByRole('main').getByRole('button')).toHaveText(['Ver historial']);
    await expect(page.getByRole('link', { name: 'Historial' }).first()).toBeVisible();
    for (const enlace of ['Préstamos', 'Inventario', 'Multas', 'Socios']) {
      await expect(page.getByRole('link', { name: enlace }), enlace).toBeHidden();
    }
    await narrar(page, testInfo, 'Después intenta abrir por su dirección Entregar, Reservar e Inventario');
    for (const [hash, titulo] of [['#/prestamos', 'Entregar'], ['#/reservar', 'Reservar']]) {
      await page.evaluate((h) => { window.location.hash = h; }, hash);
      await expect(page.getByRole('heading', { name: 'Acceso no permitido', level: 1 }), titulo).toBeVisible();
    }
    await page.evaluate(() => { window.location.hash = '#/inventario'; });
    await narrar(page, testInfo, 'La junta consulta el historial de un socio. En Inventario se ve «Acceso no permitido», igual que en Entregar y en Reservar, y las pantallas de la junta no tienen ningún botón que cambie datos.', { criterio: 'AC-016-04' });
    // REQ-F-010 AC4: "GIVEN a junta session WHEN the junta opens the address of "Entregar", "Inventario" or "Reservar" THEN the user sees "Acceso no permitido" and the junta screens have no button to change data"
    await expect(page.getByRole('heading', { name: 'Acceso no permitido', level: 1 })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
    await captura(page, testInfo, 'AC-016-04', { ve: ['Acceso no permitido'] });
  });

  test('FASE-5 REQ-NF-001 AC1 SEC-T-001 Lucía pide por dirección las multas y el historial de Pablo y recibe rechazo sin datos de Pablo', async ({ page, servidor }, testInfo) => {
    await lucia_devolvio_y_pablo_tiene_multa(servidor);
    const pablo = JSON.parse(readFileSync(servidor.archivo, 'utf8')).cuentas.find((c) => c.correo === PABLO.correo).id;
    await narrar(page, testInfo, 'Lucía entra con su cuenta e intenta, escribiendo la dirección, ver las multas y el historial de Pablo');
    await entrar(page, servidor, LUCIA);
    // REQ-NF-001 AC1: "GIVEN session of "lucia" WHEN she requests the reservations, fines or profile of "pablo" by address THEN the response is refused (no data of "pablo")"
    for (const ruta of ['listarMultas', `consultarHistorialSocio?socioId=${pablo}`]) {
      const r = await page.request.get(`${servidor.url}/api/${ruta}`);
      expect(r.status(), ruta).toBe(403);
      const texto = await r.text();
      expect(texto).toContain('E_ACCESO_NO_PERMITIDO');
      expect(texto).not.toMatch(/Pablo|pablo@|6,00|"importeEur"/);
    }
  });

  test('FASE-5 REQ-NF-001 AC3 SEC-T-003 tras crear a Pablo con la contraseña Nieve2026 el almacén no contiene Nieve2026 y sí un hash', async ({ servidor }) => {
    // REQ-NF-001 AC3: "GIVEN the stored data after creating "pablo" with password "Nieve2026" THEN the text "Nieve2026" appears nowhere and the stored value is a hash"
    const almacen = readFileSync(servidor.archivo, 'utf8');
    expect(almacen).not.toContain('Nieve2026');
    expect(JSON.parse(almacen).cuentas.find((c) => c.correo === PABLO.correo).hashContrasena).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);
  });
});
