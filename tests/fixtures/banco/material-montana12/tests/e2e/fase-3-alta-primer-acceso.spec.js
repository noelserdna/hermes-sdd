// Recorrido de FASE-3 por la ruta del usuario (WF-002): el encargado da de alta, restablece y da de baja a los socios, y el socio elige su
// contraseña al entrar. Un test por criterio, con su propio GIVEN (actor, fechas y datos del criterio), su captura y su locución
// (.sdd/demo/GUION-FASE-3.md). Los criterios que la pantalla no distingue (AC-003-04, AC-004-02..06, AC-005-02..06, AC-006-02, -06, -07)
// van en tests/integration/socios.test.js; los literales de cada pantalla, en tests/unit/ui.
//
// Una sola pestaña por test, y los avisos son de quien hizo la acción: se borran al salir y no pasan a otra sesión. Por eso un criterio
// que habla de dos personas (el encargado y el socio) se enseña en dos pantallas: la captura es la de quien hace la acción y el vídeo
// sigue con la otra persona, que entra tras «Salir» y no ve nada de la primera.
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { test, expect, narrar, captura as capturarPantalla } from './fixtures/evidence.js';
import { sembrar } from '../../demo/sembrar.mjs';

test.use({ videoId: 'WF-002' });

const DATOS = path.resolve('data/e2e/datos.json');
const RELOJ = path.resolve('data/e2e/reloj.txt');
const HOY_FICHERO = path.resolve('data/e2e/hoy.txt');
const HOY = '2026-11-22';

const PABLO = ['pablo@club.test', 'Piolet2026!'];
const LUCIA = ['lucia@club.test', 'Cumbre2026!'];
const MARTA = ['marta@club.test', 'Provisional1'];
const ENCARGADO = { id: 'c-pablo', nombre: 'Pablo', correo: PABLO[0], contrasena: PABLO[1], rol: 'encargado' };
const SOCIA_LUCIA = { id: 'c-lucia', nombre: 'Lucía Gil', correo: LUCIA[0], contrasena: LUCIA[1], rol: 'socio' };
const SOCIA_MARTA = { id: 'c-marta', nombre: 'Marta Ruiz', correo: MARTA[0], contrasena: MARTA[1], rol: 'socio' };
const CASCO = (total) => [{ nombre: 'Casco', total }];

/** Datos nuevos para el test; «hoy» es el 22 de noviembre de 2026 (el servidor lo lee del entorno). */
async function reiniciar({ cuentas, material = CASCO(2), reservas = [], multas = [], ajustes = {} }) {
  mkdirSync(path.dirname(DATOS), { recursive: true });
  rmSync(RELOJ, { force: true });
  rmSync(HOY_FICHERO, { force: true });
  await sembrar(DATOS, { hoy: HOY, cuentas, material, reservas, multas, ajustes });
}
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
  if (titulo) await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible();
}
/** Pulsa «Salir» y espera al formulario «Entrar»: la sesión y sus avisos se acaban. */
async function salir(page) {
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
}
const ningunAviso = (page) => expect(page.getByRole('status')).toHaveCount(0);
async function abrirSocios(page) {
  await page.getByRole('navigation').getByRole('link', { name: 'Socios' }).click();
  await expect(page.getByRole('heading', { name: 'Socios', level: 1 })).toBeVisible();
}
const fila = (page, texto) => page.locator('ul.socios li').filter({ hasText: texto });
const aviso = (page, texto) => page.getByRole('status').filter({ hasText: texto });
const alta = page => page.locator('form.alta');
async function rellenarAlta(page, { nombre, correo, contrasena }) {
  await alta(page).getByLabel('Nombre').fill(nombre);
  await alta(page).getByLabel('Correo').fill(correo);
  await alta(page).getByLabel('Contraseña provisional').fill(contrasena);
  await alta(page).getByRole('button', { name: 'Dar de alta' }).click();
}
async function darDeBaja(page, nombre) {
  await fila(page, nombre).getByRole('button', { name: 'Dar de baja' }).click();
  await fila(page, nombre).getByRole('button', { name: 'Confirmar' }).click();
}

/** La captura prueba lo que se ve: cada texto de «ve» tiene que estar dentro de la pantalla capturada, no solo en la página. */
async function captura(page, testInfo, criterio, { ve = [] } = {}) {
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: 1280, height: Math.max(720, alto + 110) });   // + la locución, que tapa el pie
  for (const texto of ve) await expect(page.getByText(texto, { exact: false }).first()).toBeInViewport({ ratio: 1 });
  await capturarPantalla(page, testInfo, criterio, { ve });
}

/** Lo que una persona tiene en pantalla ahora: su DOM (sin el rótulo de la locución) y los estilos de la web, tal cual. */
async function instantanea(page, quien) {
  return page.evaluate((q) => {
    const copia = document.body.cloneNode(true);
    copia.querySelector('#__sdd_rotulo')?.remove();
    const css = [...document.styleSheets].map((h) => { try { return [...h.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
    return { quien: q, html: copia.innerHTML, css };
  }, quien);
}
/** Un criterio que habla de dos personas (el encargado y el socio) no cabe en una sola sesión, porque los avisos no pasan de una a otra:
 *  se enseñan juntas las pantallas que cada una vio, una al lado de la otra, para hacer una sola captura con todo su «Se ve». */
async function pantallasJuntas(page, fotos) {
  const columnas = `<div class="personas" style="display:grid;grid-template-columns:repeat(${fotos.length},1fr);gap:16px;padding:12px">${
    fotos.map((f) => `<section class="persona" style="border:2px solid #94a3b8;min-width:0"><h2 style="margin:0;padding:6px 12px;background:#e2e8f0">${f.quien}</h2>${f.html}</section>`).join('')}</div>`;
  await page.setContent(`<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${fotos[0].css}</style></head><body>${columnas}</body></html>`);
}

test.describe('FASE-3 · Alta, baja y contraseña de los socios (REQ-F-002)', () => {
  test('AC-003-01 REQ-F-002 AC1 Pablo registra a «Marta Ruiz» con «marta@club.test» y la contraseña «Provisional1»: ve «Socio creado: Marta Ruiz» y «Marta Ruiz — Activo»', async ({ page }, testInfo) => {
    await reiniciar({ cuentas: [ENCARGADO] });
    await entrar(page, PABLO, 'Panel del encargado');
    await narrar(page, testInfo, 'Pablo, el encargado, abre Socios para dar de alta a una socia nueva');
    await abrirSocios(page);
    await narrar(page, testInfo, 'Escribe el nombre Marta Ruiz, su correo marta@club.test y la contraseña provisional Provisional1, y pulsa «Dar de alta»');
    await rellenarAlta(page, { nombre: 'Marta Ruiz', correo: 'marta@club.test', contrasena: 'Provisional1' });
    // REQ-F-002 AC1: "GIVEN the encargado in "Socios" WHEN he registers "Marta Ruiz", "marta@club.test", password "Provisional1" THEN the user sees "Socio creado: Marta Ruiz" and "Marta Ruiz" in the list"
    await expect(aviso(page, 'Socio creado: Marta Ruiz')).toBeVisible();
    await expect(fila(page, 'Marta Ruiz — Activo')).toHaveCount(1);
    await narrar(page, testInfo, 'Alta, baja y contraseña de los socios. En Socios se ve «Socio creado: Marta Ruiz» y «Marta Ruiz — Activo»: Marta ya está en la lista.', { criterio: 'AC-003-01' });
    await captura(page, testInfo, 'AC-003-01', { ve: ['Socio creado: Marta Ruiz', 'Marta Ruiz — Activo'] });
  });

  test('AC-003-02 REQ-F-002 AC2 «Marta Ruiz» ya existe y Pablo registra otra vez «marta@club.test»: ve «Ya existe un socio con ese correo» y una sola «Marta Ruiz — Activo»', async ({ page }, testInfo) => {
    await reiniciar({ cuentas: [ENCARGADO, SOCIA_MARTA] });
    await entrar(page, PABLO, 'Panel del encargado');
    await narrar(page, testInfo, 'Marta Ruiz ya es socia. Pablo abre Socios y vuelve a darla de alta con el mismo correo');
    await abrirSocios(page);
    await rellenarAlta(page, { nombre: 'Marta Ruiz', correo: 'marta@club.test', contrasena: 'Provisional1' });
    // REQ-F-002 AC2: "GIVEN "Marta Ruiz" exists WHEN the encargado registers "marta@club.test" again THEN the user sees "Ya existe un socio con ese correo" and the list has one "Marta Ruiz""
    await expect(page.getByRole('alert').filter({ hasText: 'Ya existe un socio con ese correo' })).toBeVisible();
    await expect(fila(page, 'Marta Ruiz — Activo')).toHaveCount(1);
    await narrar(page, testInfo, 'Alta, baja y contraseña de los socios. En Socios se ve «Ya existe un socio con ese correo» y «Marta Ruiz — Activo»: la lista sigue con una sola Marta Ruiz.', { criterio: 'AC-003-02' });
    await captura(page, testInfo, 'AC-003-02', { ve: ['Ya existe un socio con ese correo', 'Marta Ruiz — Activo'] });
  });

  test('AC-003-03 REQ-F-002 AC3 Pablo escribe la contraseña provisional «corta»: ve «La contraseña debe tener al menos 8 caracteres»', async ({ page }, testInfo) => {
    await reiniciar({ cuentas: [ENCARGADO] });
    await entrar(page, PABLO, 'Panel del encargado');
    await narrar(page, testInfo, 'Pablo abre Socios e intenta dar de alta a Marta Ruiz con una contraseña provisional demasiado corta');
    await abrirSocios(page);
    await rellenarAlta(page, { nombre: 'Marta Ruiz', correo: 'marta@club.test', contrasena: 'corta' });
    // REQ-F-002 AC3: "GIVEN the form WHEN the temporary password is "corta" THEN the user sees "La contraseña debe tener al menos 8 caracteres""
    await expect(page.getByRole('alert').filter({ hasText: 'La contraseña debe tener al menos 8 caracteres' })).toBeVisible();
    await expect(page.locator('ul.socios li')).toHaveCount(0);
    await narrar(page, testInfo, 'Alta, baja y contraseña de los socios. En Socios se ve «La contraseña debe tener al menos 8 caracteres», y Marta no se añade a la lista.', { criterio: 'AC-003-03' });
    await captura(page, testInfo, 'AC-003-03', { ve: ['La contraseña debe tener al menos 8 caracteres'] });
  });

  test('AC-004-01 REQ-F-002 AC4 Marta entra con su contraseña provisional: ve «Elige una contraseña nueva» y no sigue hasta elegir una de 8 caracteres o más', async ({ page }, testInfo) => {
    await reiniciar({ cuentas: [SOCIA_MARTA], ajustes: { [MARTA[0]]: { mustChangePassword: true } } });
    await narrar(page, testInfo, 'Marta, la socia nueva, abre la web y entra con el correo marta@club.test y la contraseña provisional que le dio Pablo');
    await entrar(page, MARTA, 'Elige una contraseña nueva');
    await narrar(page, testInfo, 'La web no la deja seguir: solo le pide elegir su contraseña. Escribe una demasiado corta y pulsa «Guardar»');
    await page.getByLabel('Contraseña nueva').fill('corta');
    await page.getByRole('button', { name: 'Guardar' }).click();
    // REQ-F-002 AC4: "GIVEN Marta enters with her temporary password WHEN she logs in THEN the user sees "Elige una contraseña nueva" and she cannot continue until she sets one of at least 8 characters"
    await expect(page.getByRole('heading', { name: 'Elige una contraseña nueva', level: 1 })).toBeVisible();
    await expect(aviso(page, 'Elige una contraseña nueva')).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'La contraseña debe tener al menos 8 caracteres' })).toBeVisible();
    await expect(page).toHaveURL(/\/cambiar-contrasena$/);
    await narrar(page, testInfo, 'Alta, baja y contraseña de los socios. En Cambiar contraseña se ve «Elige una contraseña nueva», «Elige una contraseña nueva» y «La contraseña debe tener al menos 8 caracteres»: Marta no puede seguir hasta elegir una de 8 caracteres o más.', { criterio: 'AC-004-01' });
    await captura(page, testInfo, 'AC-004-01', { ve: ['Elige una contraseña nueva', 'Elige una contraseña nueva', 'La contraseña debe tener al menos 8 caracteres'] });
    await narrar(page, testInfo, 'Ahora Marta elige «MiClave2026» y la web la lleva a Mis reservas');
    await page.getByLabel('Contraseña nueva').fill('MiClave2026');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { name: 'Mis reservas', level: 1 })).toBeVisible();
  });

  test('AC-005-01 REQ-F-002 AC5 Marta olvidó su contraseña y Pablo fija «Otra12345» para ella: ve «Contraseña provisional guardada para Marta Ruiz»; Marta entra con «Otra12345» y ya no con la antigua', async ({ page }, testInfo) => {
    await reiniciar({ cuentas: [ENCARGADO, SOCIA_MARTA] });
    await narrar(page, testInfo, 'Marta ha olvidado su contraseña y, probando, falla cinco veces: su cuenta se bloquea');
    await page.goto('/entrar');
    await page.getByLabel('Correo').fill(MARTA[0]);
    for (let i = 0; i < 6; i += 1) {   // a los 5 fallos se bloquea; el sexto intento ya lo dice
      await page.getByLabel('Contraseña').fill('equivocada1');
      await Promise.all([page.waitForResponse((r) => r.url().endsWith('/api/entrar')), page.getByRole('button', { name: 'Entrar' }).click()]);
    }
    await expect(page.getByRole('alert').filter({ hasText: 'Cuenta bloqueada' })).toBeVisible();
    await entrarSinRecargar(page, PABLO, 'Panel del encargado');
    await narrar(page, testInfo, 'Pablo abre Socios y pulsa «Restablecer» en su fila');
    await abrirSocios(page);
    await fila(page, 'Marta Ruiz').getByRole('button', { name: 'Restablecer' }).click();
    await fila(page, 'Marta Ruiz').getByLabel('Contraseña provisional').fill('Otra12345');
    await fila(page, 'Marta Ruiz').getByRole('button', { name: 'Guardar' }).click();
    await expect(aviso(page, 'Contraseña provisional guardada para Marta Ruiz')).toBeVisible();
    // REQ-F-002 AC5: "GIVEN Marta forgot her password WHEN the encargado sets "Otra12345" for her THEN the user sees "Contraseña provisional guardada para Marta Ruiz" and Marta can enter with "Otra12345" and no longer with her old password"
    const pantallaPablo = await instantanea(page, 'Pablo, el encargado, en Socios');
    await narrar(page, testInfo, 'Pablo sale. Marta entra con la contraseña provisional Otra12345, aunque su cuenta estuviera bloqueada, y la web le pide elegir otra');
    await salir(page);
    await ningunAviso(page);
    await entrarSinRecargar(page, [MARTA[0], 'Otra12345'], 'Elige una contraseña nueva');
    await expect(aviso(page, 'Elige una contraseña nueva')).toBeVisible();
    await expect(aviso(page, 'Contraseña provisional guardada para Marta Ruiz')).toHaveCount(0);
    const pantallaMarta = await instantanea(page, 'Marta entra con «Otra12345»');
    await narrar(page, testInfo, 'Con su contraseña antigua, en cambio, ya no puede entrar');
    await salir(page);
    await entrarSinRecargar(page, MARTA);
    await expect(page.getByRole('alert').filter({ hasText: 'Correo o contraseña incorrectos' })).toBeVisible();
    await ningunAviso(page);
    const pantallaAntigua = await instantanea(page, 'Marta entra con su contraseña antigua');
    await pantallasJuntas(page, [pantallaPablo, pantallaMarta, pantallaAntigua]);
    await narrar(page, testInfo, 'Alta, baja y contraseña de los socios. En Socios se ve «Contraseña provisional guardada para Marta Ruiz»; Marta entra con «Otra12345» y ve «Elige una contraseña nueva», y con su contraseña antigua ve «Correo o contraseña incorrectos».', { criterio: 'AC-005-01' });
    await captura(page, testInfo, 'AC-005-01', { ve: ['Contraseña provisional guardada para Marta Ruiz', 'Elige una contraseña nueva', 'Correo o contraseña incorrectos'] });
  });

  test('AC-006-01 REQ-F-002 AC6 Marta no tiene préstamos abiertos ni multas pendientes y Pablo la da de baja: ve «Socio dado de baja: Marta Ruiz» y Marta ya no entra', async ({ page }, testInfo) => {
    await reiniciar({ cuentas: [ENCARGADO, SOCIA_MARTA] });
    await entrar(page, PABLO, 'Panel del encargado');
    await narrar(page, testInfo, 'Marta no tiene material sin devolver ni multas. Pablo abre Socios y pulsa «Dar de baja» en su fila, y confirma');
    await abrirSocios(page);
    await darDeBaja(page, 'Marta Ruiz');
    // REQ-F-002 AC6: "GIVEN Marta has no open loans and no pending fines WHEN the encargado removes her THEN the user sees "Socio dado de baja: Marta Ruiz" and she can no longer log in"
    await expect(aviso(page, 'Socio dado de baja: Marta Ruiz')).toBeVisible();
    const pantallaPablo = await instantanea(page, 'Pablo, el encargado, en Socios');
    await narrar(page, testInfo, 'Pablo sale. Marta intenta entrar con su correo y su contraseña de siempre y no puede');
    await salir(page);
    await entrarSinRecargar(page, [MARTA[0], MARTA[1]]);
    await expect(page.getByRole('alert').filter({ hasText: 'Correo o contraseña incorrectos' })).toBeVisible();
    // Un socio no ve nada de otro: el aviso del encargado no la sigue a «Entrar»
    await expect(aviso(page, 'Socio dado de baja: Marta Ruiz')).toHaveCount(0);
    const pantallaMarta = await instantanea(page, 'Marta intenta entrar');
    await pantallasJuntas(page, [pantallaPablo, pantallaMarta]);
    await narrar(page, testInfo, 'Alta, baja y contraseña de los socios. En Socios se ve «Socio dado de baja: Marta Ruiz» y Marta ya no puede entrar: ve «Correo o contraseña incorrectos».', { criterio: 'AC-006-01' });
    await captura(page, testInfo, 'AC-006-01', { ve: ['Socio dado de baja: Marta Ruiz', 'Correo o contraseña incorrectos'] });
  });

  test('AC-006-04 REQ-F-002 AC7 Lucía tiene 1 préstamo sin devolver y Pablo la da de baja: ve «No se puede dar de baja: tiene material sin devolver» y «Lucía Gil — Activo»; Lucía sigue entrando', async ({ page }, testInfo) => {
    const prestamo = { socio: LUCIA[0], material: 'Casco', cantidad: 1, inicio: '2026-11-20', fin: '2026-11-25', estado: 'Prestada' };
    await reiniciar({ cuentas: [ENCARGADO, SOCIA_LUCIA], reservas: [prestamo] });
    await entrar(page, PABLO, 'Panel del encargado');
    await narrar(page, testInfo, 'Lucía Gil tiene un casco prestado sin devolver. Pablo abre Socios e intenta darla de baja');
    await abrirSocios(page);
    await darDeBaja(page, 'Lucía Gil');
    // REQ-F-002 AC7: "GIVEN Lucía has 1 loan not yet returned WHEN the encargado removes her THEN the user sees "No se puede dar de baja: tiene material sin devolver" and her account stays active"
    await expect(page.getByRole('alert').filter({ hasText: 'No se puede dar de baja: tiene material sin devolver' })).toBeVisible();
    // REQ-F-002 AC7 cláusula: "her account stays active"
    await expect(fila(page, 'Lucía Gil — Activo')).toHaveCount(1);
    await expect(page.locator('.saludo')).toHaveText('Hola, Pablo');
    await narrar(page, testInfo, 'Alta, baja y contraseña de los socios. En Socios se ve «No se puede dar de baja: tiene material sin devolver», «Lucía Gil — Activo» y «Hola, Pablo»: su cuenta sigue activa y Pablo sigue dentro.', { criterio: 'AC-006-04' });
    await captura(page, testInfo, 'AC-006-04', { ve: ['No se puede dar de baja: tiene material sin devolver', 'Lucía Gil — Activo', 'Hola, Pablo'] });
    await narrar(page, testInfo, 'Y Lucía sigue pudiendo entrar: ve «Hola, Lucía» en Mis reservas');
    await salir(page);
    await entrarSinRecargar(page, LUCIA, 'Mis reservas');
    await expect(page.locator('.saludo')).toHaveText('Hola, Lucía Gil');
    await ningunAviso(page);
  });

  test('AC-006-05 REQ-F-002 AC8 Pablo, socio, tiene una multa pendiente de 4 € y la encargada Nuria lo da de baja: ve «No se puede dar de baja: tiene multas sin pagar»', async ({ page }, testInfo) => {
    const nuria = { id: 'c-nuria', nombre: 'Nuria', correo: 'nuria@club.test', contrasena: 'Nuria2026!', rol: 'encargado' };
    const pablo = { id: 'c-pablo-socio', nombre: 'Pablo', correo: 'pablo.socio@club.test', contrasena: 'Pablo2026!', rol: 'socio' };
    await reiniciar({ cuentas: [nuria, pablo], reservas: [], multas: [{ socio: pablo.correo, importe: 4 }] });
    await entrar(page, [nuria.correo, nuria.contrasena], 'Panel del encargado');
    await narrar(page, testInfo, 'Pablo, un socio, debe una multa de 4 euros. Nuria, la encargada, abre Socios e intenta darlo de baja');
    await abrirSocios(page);
    await darDeBaja(page, 'Pablo');
    // REQ-F-002 AC8: "GIVEN Pablo has a pending fine of 4 € WHEN the encargado removes him THEN the user sees "No se puede dar de baja: tiene multas sin pagar""
    await expect(page.getByRole('alert').filter({ hasText: 'No se puede dar de baja: tiene multas sin pagar' })).toBeVisible();
    await expect(fila(page, 'Pablo — Activo')).toHaveCount(1);
    await narrar(page, testInfo, 'Alta, baja y contraseña de los socios. En Socios se ve «No se puede dar de baja: tiene multas sin pagar»: Pablo sigue activo.', { criterio: 'AC-006-05' });
    await captura(page, testInfo, 'AC-006-05', { ve: ['No se puede dar de baja: tiene multas sin pagar'] });
  });

  test('AC-006-03 REQ-F-002 AC9 Marta tiene 2 × Casco del 2026-12-05 al 2026-12-07 y Pablo la da de baja: ve «Socio dado de baja: Marta Ruiz» y Lucía reserva lo mismo: «Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07»', async ({ page }, testInfo) => {
    const reservaMarta = { socio: MARTA[0], material: 'Casco', cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' };
    await reiniciar({ cuentas: [ENCARGADO, SOCIA_LUCIA, SOCIA_MARTA], material: CASCO(2), reservas: [reservaMarta] });
    await entrar(page, PABLO, 'Panel del encargado');
    await narrar(page, testInfo, 'Marta tiene reservados los dos cascos del 5 al 7 de diciembre. Pablo abre Socios y la da de baja');
    await abrirSocios(page);
    await darDeBaja(page, 'Marta Ruiz');
    await expect(aviso(page, 'Socio dado de baja: Marta Ruiz')).toBeVisible();
    // La reserva de Marta queda «Cancelada»: solo se guarda en el fichero de datos, porque ninguna pantalla muestra reservas de un socio de baja
    expect(datos().reservas.find((r) => r.accountId === 'c-marta').status).toBe('Cancelada');
    // REQ-F-002 AC9: "GIVEN Marta has 1 future reservation WHEN the encargado removes her THEN the user sees "Socio dado de baja: Marta Ruiz", her reservation is cancelled and its units become free"
    const pantallaPablo = await instantanea(page, 'Pablo, el encargado, en Socios');
    await narrar(page, testInfo, 'Sus unidades quedan libres: Pablo sale, Lucía entra y reserva los mismos dos cascos para las mismas fechas');
    await salir(page);
    await entrarSinRecargar(page, LUCIA, 'Mis reservas');
    await page.getByRole('navigation').getByRole('link', { name: 'Reservar' }).click();
    await page.getByRole('combobox', { name: 'Material' }).selectOption({ label: 'Casco' });
    await page.getByLabel('Cantidad').fill('2');
    await page.getByLabel('Fecha de inicio').fill('05/12/2026');
    await page.getByLabel('Fecha de fin').fill('07/12/2026');
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mis reservas', level: 1 })).toBeVisible();
    await expect(aviso(page, 'Socio dado de baja: Marta Ruiz')).toHaveCount(0);   // el aviso es de Pablo: Lucía no lo ve
    await expect(aviso(page, 'Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07')).toBeVisible();
    const pantallaLucia = await instantanea(page, 'Lucía reserva los mismos dos cascos');
    await pantallasJuntas(page, [pantallaPablo, pantallaLucia]);
    await narrar(page, testInfo, 'Alta, baja y contraseña de los socios. En Socios se ve «Socio dado de baja: Marta Ruiz» y Lucía, con los mismos dos cascos y las mismas fechas, ve «Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07»: las unidades de Marta quedaron libres.', { criterio: 'AC-006-03' });
    await captura(page, testInfo, 'AC-006-03', { ve: ['Socio dado de baja: Marta Ruiz', 'Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07'] });
  });
});
