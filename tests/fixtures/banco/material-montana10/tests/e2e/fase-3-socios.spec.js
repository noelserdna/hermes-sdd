// Recorrido de la FASE-3 por la ruta del usuario: gestionar socios (UC-002) y los datos personales (REQ-NF-001). Una prueba por
// criterio con Se ve, con su locución y su captura, más el recorrido de la demo (E2E-ADM-01). Entra siempre por la dirección de la
// web y la pantalla de Entrar, con la semilla de pruebas y el «hoy» de la demo (2026-11-21). Los criterios sin pantalla propia
// (AC-002-08..12, REQ-NF-001) se prueban en tests/unit; la demo los recorre de punta a punta.
import { test, expect, narrar, captura } from './fixtures/evidence.js';
import { sembrar, leerAlmacen, modificarAlmacen, CUENTAS } from './fixtures/semilla.js';
import { fijarHoy } from './fixtures/hoy.js';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { storeFile } from '../../playwright.config.js';

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
const contenido = (page) => page.locator('#contenido');
const abrirSocios = async (page) => {
  await page.getByRole('link', { name: 'Socios', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Socios', level: 1 })).toBeVisible();
};
const fila = (page, texto) => page.locator('tbody tr', { hasText: texto });
const anadir = async (page, nombre, correo, contrasena) => {
  await page.getByLabel('Nombre').fill(nombre);
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña inicial').fill(contrasena);
  await page.getByRole('button', { name: 'Añadir socio' }).click();
};
const darDeBaja = async (page, texto) => {
  await fila(page, texto).getByRole('button', { name: 'Dar de baja' }).click();
  await expect(fila(page, texto)).toContainText('¿Dar de baja a');
  await fila(page, texto).getByRole('button', { name: 'Confirmar' }).click();
};
const restablecer = async (page, texto, contrasena) => {
  await fila(page, texto).getByRole('button', { name: 'Restablecer contraseña' }).click();
  await fila(page, texto).getByRole('textbox').fill(contrasena);
  await fila(page, texto).getByRole('button', { name: 'Guardar' }).click();
};
// Otro navegador aparte: la sesión de otra persona sin perder la pantalla del encargado.
const sesionAparte = async (page, testInfo, entrarCon) => {
  const contexto = await page.context().browser().newContext({ baseURL: testInfo.project.use.baseURL, locale: 'es-ES' });
  const otra = await contexto.newPage();
  await entrarCon(otra);
  return { otra, cerrar: () => contexto.close() };
};
const verHistorial = async (page, socio) => {
  await expect(page.getByRole('heading', { name: 'Historial', level: 1 })).toBeVisible();
  await page.locator('select#socio').selectOption({ label: socio });
  await page.getByRole('button', { name: 'Ver historial' }).click();
};
// Estado inicial de la demo: sin la Marta de la semilla de FASE-0 (el recorrido la da de alta), hoy 2026-11-21.
const sembrarDemo = (opciones = {}) => {
  sembrar(opciones);
  modificarAlmacen((datos) => { datos.cuentas = datos.cuentas.filter((c) => c.correo !== 'marta@club.es'); });
  fijarHoy('2026-11-21');
};
const prestada = (socio, tipo, unidad) => ({ socio, tipo, desde: '2026-11-18', hasta: '2026-11-25', estado: 'Prestada', unidad });

// ───────────── UC-002 Gestionar socios ─────────────

test('REQ-F-002 AC1 · AC-002-01 el encargado da de alta a «Marta Ruiz» («marta@club.es», «Glaciar2026») y la ve en Socios, y Marta puede entrar', async ({ page }, testInfo) => {
  sembrarDemo();
  await narrar(page, testInfo, 'El encargado entra, abre Socios y envía el nombre, el correo y la contraseña inicial de un socio nuevo');
  await encargado(page);
  await abrirSocios(page);
  await anadir(page, 'Marta Ruiz', 'marta@club.es', 'Glaciar2026');
  await narrar(page, testInfo, 'Dar de alta, dar de baja y restablecer contraseña de socios. En Socios se ve «Marta Ruiz», y Marta puede entrar con su contraseña.', { criterio: 'AC-002-01' });
  // REQ-F-002 AC1: "GIVEN the encargado in Socios WHEN he creates "Marta Ruiz", "marta@club.es", contraseña "Glaciar2026" THEN the user sees "Marta Ruiz" in the list of Socios and Marta can enter"
  await expect(fila(page, 'Marta Ruiz')).toContainText('marta@club.es');
  await expect(fila(page, 'Marta Ruiz')).toContainText('Activa');
  // REQ-F-002 AC1 cláusula: "and Marta can enter"
  const { otra, cerrar } = await sesionAparte(page, testInfo, (p) => entrarComo(p, 'marta@club.es', 'Glaciar2026'));
  await expect(otra.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await expect(otra.locator('#contenido')).toContainText('Hola, Marta Ruiz');
  await cerrar();
  await expect(fila(page, 'Marta Ruiz')).toBeVisible();
  await captura(page, testInfo, 'AC-002-01', { ve: ['Marta Ruiz'] });
});

test('REQ-F-002 AC2 · AC-002-02 con «marta@club.es» ya dada de alta, otra alta con ese correo muestra «Ya existe un socio con ese correo» y la lista sigue con una sola «Marta Ruiz»', async ({ page }, testInfo) => {
  sembrarDemo();
  await narrar(page, testInfo, 'El encargado entra, abre Socios y da de alta a Marta Ruiz con marta@club.es; después intenta dar de alta otra vez ese mismo correo');
  await encargado(page);
  await abrirSocios(page);
  await anadir(page, 'Marta Ruiz', 'marta@club.es', 'Glaciar2026');
  await expect(fila(page, 'Marta Ruiz')).toBeVisible();
  await anadir(page, 'Marta Ruiz', 'marta@club.es', 'Glaciar2026');
  await narrar(page, testInfo, 'Dar de alta, dar de baja y restablecer contraseña de socios. En Socios se ve «Ya existe un socio con ese correo», y la lista sigue con una sola «Marta Ruiz».', { criterio: 'AC-002-02' });
  // REQ-F-002 AC2: "GIVEN "marta@club.es" already exists WHEN the encargado creates another with that correo THEN the user sees "Ya existe un socio con ese correo" and the list keeps one "Marta Ruiz""
  await expect(contenido(page).getByRole('alert')).toHaveText('Ya existe un socio con ese correo');
  // REQ-F-002 AC2 cláusula: "the list keeps one "Marta Ruiz""
  await expect(fila(page, 'Marta Ruiz')).toHaveCount(1);
  expect(leerAlmacen().cuentas.filter((c) => c.correo === 'marta@club.es')).toHaveLength(1);
  await captura(page, testInfo, 'AC-002-02', { ve: ['Ya existe un socio con ese correo'] });
});

test('REQ-F-002 AC3 · AC-002-03 el encargado da de alta a un socio con la contraseña «corta» (5 caracteres) y ve «La contraseña debe tener al menos 8 caracteres»', async ({ page }, testInfo) => {
  sembrarDemo();
  await narrar(page, testInfo, 'El encargado entra, abre Socios y envía los datos de Marta Ruiz con una contraseña inicial de solo 5 caracteres, «corta»');
  await encargado(page);
  await abrirSocios(page);
  await anadir(page, 'Marta Ruiz', 'marta@club.es', 'corta');
  await narrar(page, testInfo, 'Dar de alta, dar de baja y restablecer contraseña de socios. En Socios se ve «La contraseña debe tener al menos 8 caracteres», y no se crea ninguna cuenta.', { criterio: 'AC-002-03' });
  // REQ-F-002 AC3: "GIVEN the encargado in Socios WHEN he creates a socio with contraseña "corta" (5 characters) THEN the user sees "La contraseña debe tener al menos 8 caracteres" and no account is created"
  await expect(contenido(page).getByRole('alert')).toHaveText('La contraseña debe tener al menos 8 caracteres');
  // REQ-F-002 AC3 cláusula: "and no account is created"
  await expect(fila(page, 'Marta Ruiz')).toHaveCount(0);
  expect(leerAlmacen().cuentas.some((c) => c.correo === 'marta@club.es')).toBe(false);
  await captura(page, testInfo, 'AC-002-03', { ve: ['La contraseña debe tener al menos 8 caracteres'] });
});

test('REQ-F-002 AC4 · AC-002-04 el encargado da de baja a «Pablo» (sin reserva en curso ni multa pendiente) y lo ve con «Baja» en Socios; Pablo ya no puede entrar', async ({ page }, testInfo) => {
  sembrarDemo();
  await narrar(page, testInfo, 'El encargado entra, abre Socios y da de baja a Pablo, que no tiene ninguna reserva en curso ni multa pendiente, confirmando la baja en su fila');
  await encargado(page);
  await abrirSocios(page);
  await darDeBaja(page, 'Pablo');
  await narrar(page, testInfo, 'Dar de alta, dar de baja y restablecer contraseña de socios. En Socios se ve «Pablo» y «Baja», y Pablo ya no puede entrar.', { criterio: 'AC-002-04' });
  // REQ-F-002 AC4: "GIVEN "pablo@club.es" has no reserva en curso ni multa pendiente WHEN the encargado deactivates him THEN the user sees "Pablo" with "Baja" in Socios and Pablo cannot enter"
  await expect(fila(page, 'Pablo')).toContainText('Baja');
  await expect(fila(page, 'Pablo').getByRole('button')).toHaveCount(0);
  // REQ-F-002 AC4 cláusula: "and Pablo cannot enter"
  const { otra, cerrar } = await sesionAparte(page, testInfo, async (p) => { await p.goto('/'); await entrar(p, 'pablo@club.es', 'Arista2026'); });
  await expect(otra.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
  await expect(otra.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await cerrar();
  await expect(fila(page, 'Pablo')).toContainText('Baja');
  await captura(page, testInfo, 'AC-002-04', { ve: ['Pablo', 'Baja'] });
});

test('REQ-F-002 AC5 · AC-002-05 el encargado intenta dar de baja a «Lucía», que tiene «Casco 2» prestado, y ve «No se puede dar de baja: tiene material prestado o multas pendientes»', async ({ page }, testInfo) => {
  sembrarDemo({ unidades: { Casco: 2 }, reservas: [prestada('lucia', 'Casco', 'Casco 2')] });
  await narrar(page, testInfo, 'El encargado entra, abre Socios y pide la baja de Lucía, que tiene el Casco 2 prestado, y la confirma');
  await encargado(page);
  await abrirSocios(page);
  await darDeBaja(page, 'Lucía');
  await narrar(page, testInfo, 'Dar de alta, dar de baja y restablecer contraseña de socios. En Socios se ve «No se puede dar de baja: tiene material prestado o multas pendientes», y su cuenta sigue activa.', { criterio: 'AC-002-05' });
  // REQ-F-002 AC5: "GIVEN "lucia@club.es" has the material "Casco 2" lent out WHEN the encargado deactivates her THEN the user sees "No se puede dar de baja: tiene material prestado o multas pendientes" and her account stays active"
  await expect(contenido(page).getByRole('alert')).toHaveText('No se puede dar de baja: tiene material prestado o multas pendientes');
  // REQ-F-002 AC5 cláusula: "and her account stays active"
  await expect(fila(page, 'Lucía')).toContainText('Activa');
  await expect(fila(page, 'Lucía').getByRole('button', { name: 'Dar de baja' })).toBeVisible();
  expect(leerAlmacen().cuentas.find((c) => c.correo === 'lucia@club.es').estado).toBe('Activa');
  await captura(page, testInfo, 'AC-002-05', { ve: ['No se puede dar de baja: tiene material prestado o multas pendientes'] });
});

test('REQ-F-002 AC6 · AC-002-06 el encargado fija «Nieve2026» a «marta@club.es», que olvidó su contraseña, y ve «Contraseña restablecida»; Marta entra con ella y la antigua ya no vale', async ({ page }, testInfo) => {
  sembrarDemo();
  await narrar(page, testInfo, 'El encargado entra, abre Socios, da de alta a Marta con «Hielo20266» y, como Marta la olvidó, le restablece la contraseña a «Nieve2026»');
  await encargado(page);
  await abrirSocios(page);
  await anadir(page, 'Marta', 'marta@club.es', 'Hielo20266');
  await expect(fila(page, 'Marta')).toBeVisible();
  // Marta olvidó la contraseña y se equivocó cinco veces: su cuenta está bloqueada.
  const fallos = await sesionAparte(page, testInfo, async (p) => {
    await p.goto('/');
    for (let i = 0; i < 5; i += 1) { await entrar(p, 'marta@club.es', 'Olvidada1'); await expect(p.getByRole('alert')).toHaveText('Correo o contraseña incorrectos'); }
    await entrar(p, 'marta@club.es', 'Hielo20266');
    await expect(p.getByRole('alert')).toContainText('Cuenta bloqueada');
  });
  await fallos.cerrar();
  await restablecer(page, 'Marta', 'Nieve2026');
  await narrar(page, testInfo, 'Dar de alta, dar de baja y restablecer contraseña de socios. Marta tenía la cuenta bloqueada por equivocarse varias veces; en Socios se ve «Contraseña restablecida», Marta entra en ese momento con «Nieve2026» y la antigua ya no le vale.', { criterio: 'AC-002-06' });
  // REQ-F-002 AC6: "GIVEN "marta@club.es" forgot her contraseña WHEN the encargado sets "Nieve2026" THEN Marta enters with it and the old one no longer works"
  await expect(contenido(page).getByRole('status')).toHaveText('Contraseña restablecida');
  const nueva = await sesionAparte(page, testInfo, (p) => entrarComo(p, 'marta@club.es', 'Nieve2026'));
  await expect(nueva.otra.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await nueva.cerrar();
  // REQ-F-002 AC6 cláusula: "and the old one no longer works"
  const vieja = await sesionAparte(page, testInfo, async (p) => { await p.goto('/'); await entrar(p, 'marta@club.es', 'Hielo20266'); });
  await expect(vieja.otra.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
  await vieja.cerrar();
  await expect(contenido(page).getByRole('status')).toHaveText('Contraseña restablecida');
  await captura(page, testInfo, 'AC-002-06', { ve: ['Contraseña restablecida'] });
});

test('REQ-F-002 AC7 · AC-002-07 Lucía abre Socios por su dirección y ve «No tienes permiso para ver esta pantalla»', async ({ page }, testInfo) => {
  sembrarDemo();
  await narrar(page, testInfo, 'Lucía entra con su correo y su contraseña y escribe la dirección de Socios en el navegador');
  await lucia(page);
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await page.goto('/#/socios');
  await narrar(page, testInfo, 'Dar de alta, dar de baja y restablecer contraseña de socios. En Socios se ve «No tienes permiso para ver esta pantalla».', { criterio: 'AC-002-07' });
  // REQ-F-002 AC7: "GIVEN the socio "lucia@club.es" WHEN she opens Socios by address THEN the user sees "No tienes permiso para ver esta pantalla""
  await expect(contenido(page).getByRole('alert')).toHaveText('No tienes permiso para ver esta pantalla');
  await expect(contenido(page).getByText('pablo@club.es')).toHaveCount(0);
  await captura(page, testInfo, 'AC-002-07', { ve: ['No tienes permiso para ver esta pantalla'] });
});

// ───────────── Demo E2E-ADM-01 ─────────────

// Un segundo servidor con CRON_SECRET sobre el mismo fichero de datos: es la «limpieza diaria» que lanza el sistema cada noche
// (POST /api/tareas-diarias con x-cron-secret). El servidor del recorrido no lleva secreto y no se toca su configuración.
async function limpiezaDiaria() {
  const puerto = '5183';
  const base = `http://127.0.0.1:${puerto}`;
  const servidor = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', puerto, '--strictPort'], {
    env: { ...process.env, CRON_SECRET: 'secreto-e2e', CLOCK_FIXED: '2026-11-21', STORE_FILE: storeFile }, stdio: 'ignore',
  });
  try {
    await expect.poll(async () => (await fetch(`${base}/api/salud`).catch(() => ({ ok: false }))).ok, { timeout: 60_000 }).toBe(true);
    const respuesta = await fetch(`${base}/api/tareas-diarias`, { method: 'POST', headers: { 'x-cron-secret': 'secreto-e2e' } });
    expect(respuesta.status).toBe(200);
  } finally { servidor.kill(); }
}

test('E2E-ADM-01 FASE-3 Demo: el encargado da de alta a Marta, bloquea una baja con multa, da de baja a Pablo con su sesión abierta, restablece la contraseña y la limpieza diaria borra lo caducado', async ({ page }, testInfo) => {
  test.setTimeout(120_000); // arranca un segundo servidor para la limpieza diaria
  sembrarDemo({
    unidades: { Piolet: 2 },
    reservas: [
      { socio: 'lucia', tipo: 'Piolet', desde: '2025-01-07', hasta: '2025-01-09', estado: 'Devuelta', unidad: 'Piolet 1' },
      { socio: 'lucia', tipo: 'Piolet', desde: '2024-10-30', hasta: '2024-10-31', estado: 'Devuelta', unidad: 'Piolet 2' },
    ],
    multas: [{ socio: 'lucia', importeEur: 2 }],
  });
  modificarAlmacen((datos) => { datos.reservas[0].devueltaEl = '2025-01-10'; datos.reservas[1].devueltaEl = '2024-11-01'; });
  const sesionPablo = await sesionAparte(page, testInfo, pablo);
  await expect(sesionPablo.otra.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();

  await narrar(page, testInfo, 'Paso 1: el 21 de noviembre el encargado entra, abre Socios y da de alta a Marta Ruiz');
  await encargado(page);
  await abrirSocios(page);
  await anadir(page, 'Marta Ruiz', 'marta@club.es', 'Glaciar2026');
  await expect(fila(page, 'Marta Ruiz')).toContainText('marta@club.es');

  await narrar(page, testInfo, 'Paso 2: repite el alta con el mismo correo y la web avisa de que ya existe');
  await anadir(page, 'Marta Ruiz', 'marta@club.es', 'Glaciar2026');
  await expect(contenido(page).getByRole('alert')).toHaveText('Ya existe un socio con ese correo');
  await expect(fila(page, 'Marta Ruiz')).toHaveCount(1);

  await narrar(page, testInfo, 'Paso 3: intenta dar de baja a Lucía, que tiene una multa pendiente, y la web lo bloquea');
  await darDeBaja(page, 'Lucía');
  await expect(contenido(page).getByRole('alert')).toHaveText('No se puede dar de baja: tiene material prestado o multas pendientes');
  await expect(fila(page, 'Lucía')).toContainText('Activa');

  await narrar(page, testInfo, 'Paso 4: da de baja a Pablo mientras tiene la sesión abierta; en su siguiente acción Pablo se queda sin sesión y ve Entrar');
  await darDeBaja(page, 'Pablo');
  await expect(fila(page, 'Pablo')).toContainText('Baja');
  await sesionPablo.otra.getByRole('link', { name: 'Reservar', exact: true }).click();
  await expect(sesionPablo.otra.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await sesionPablo.cerrar();

  await narrar(page, testInfo, 'Paso 5: restablece la contraseña de Marta a «Nieve2026» y Marta entra con la nueva');
  await restablecer(page, 'Marta Ruiz', 'Nieve2026');
  await expect(contenido(page).getByRole('status')).toHaveText('Contraseña restablecida');
  const marta = await sesionAparte(page, testInfo, (p) => entrarComo(p, 'marta@club.es', 'Nieve2026'));
  await expect(marta.otra.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await marta.cerrar();

  await narrar(page, testInfo, 'Paso 6: con las dos devoluciones de Lucía a la vista en Historial, se ejecuta la limpieza diaria: la de 2024 desaparece y la de 2025 queda');
  await page.getByRole('link', { name: 'Historial', exact: true }).click();
  await verHistorial(page, 'Lucía');
  await expect(contenido(page).getByText('Piolet 2 · 2024-10-30 a 2024-10-31 · Devuelta')).toBeVisible();
  await expect(contenido(page).getByText('Piolet 1 · 2025-01-07 a 2025-01-09 · Devuelta')).toBeVisible();
  await limpiezaDiaria();
  await verHistorial(page, 'Lucía');
  await expect(contenido(page).getByText('Piolet 1 · 2025-01-07 a 2025-01-09 · Devuelta')).toBeVisible();
  await expect(contenido(page).getByText('Piolet 2 · 2024-10-30 a 2024-10-31 · Devuelta')).toHaveCount(0);
  // la multa Pendiente de Lucía no se borra nunca
  await expect(contenido(page).getByText('Multa de 2 € · Pendiente')).toBeVisible();

  await narrar(page, testInfo, 'Paso 7: mira el fichero de datos: solo hay hashes con sal, ninguna contraseña en claro, y la cuenta de Pablo, dada de baja sin registros, ya no está');
  const fichero = readFileSync(storeFile, 'utf8');
  for (const { contrasena } of Object.values(CUENTAS)) expect(fichero).not.toContain(contrasena);
  expect(fichero).not.toContain('Nieve2026');
  expect(fichero).toMatch(/scrypt\$/);
  expect(leerAlmacen().cuentas.some((c) => c.correo === 'pablo@club.es')).toBe(false);
  expect(leerAlmacen().cuentas.some((c) => c.correo === 'marta@club.es')).toBe(true);
});
