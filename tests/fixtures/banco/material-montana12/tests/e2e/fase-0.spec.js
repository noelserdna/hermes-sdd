// Recorrido de FASE-0 por la ruta del usuario: entrar, salir, bloqueo, caducidad y material. Un test por criterio,
// con su propio GIVEN (actor, fechas y datos del criterio), su captura y su locución (.sdd/demo/GUION-FASE-0.md).
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, narrar, captura } from './fixtures/evidence.js';
import { sembrar } from '../../demo/sembrar.mjs';

const DATOS = path.resolve('data/e2e/datos.json');
const RELOJ = path.resolve('data/e2e/reloj.txt');
const HOY = '2026-11-22';

/** Datos nuevos para el test y reloj real: cada criterio parte de su propio GIVEN. */
async function reiniciar(opciones = {}) {
  mkdirSync(path.dirname(DATOS), { recursive: true });
  rmSync(RELOJ, { force: true });
  await sembrar(DATOS, { hoy: HOY, ...opciones });
}
const adelantar = (minutos) => writeFileSync(RELOJ, new Date(Date.now() + minutos * 60000).toISOString());

async function escribirCredenciales(page, correo, contrasena) {
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
}
// Pulsa «Entrar» y espera a que el servidor responda al login antes del paso siguiente.
async function entrarYEsperar(page, correo, contrasena) {
  const respuesta = page.waitForResponse((r) => r.url().endsWith('/api/entrar') && r.request().method() === 'POST');
  await escribirCredenciales(page, correo, contrasena);
  await respuesta;
}
const LUCIA = ['lucia@club.test', 'Cumbre2026!'];
const PABLO = ['pablo@club.test', 'Piolet2026!'];

async function irAMaterial(page) {
  await page.getByRole('navigation').getByRole('link', { name: 'Material' }).click();
  await expect(page.getByRole('heading', { name: 'Material', level: 1 })).toBeVisible();
}
const filaDe = (page, texto) => page.getByRole('listitem').filter({ hasText: texto });

test.describe('FASE-0 · Entrar y salir (REQ-F-001)', () => {
  test('AC-001-07 REQ-F-001 AC8 un visitante sin sesión abre /mis-reservas y ve el formulario «Entrar»', async ({ page }, testInfo) => {
    await reiniciar();
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Un visitante que no ha entrado abre la página Mis reservas');
    // REQ-F-001 AC8: "GIVEN an unauthenticated visitor WHEN they open "/mis-reservas" THEN the user sees the form "Entrar""
    await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    await expect(page).toHaveURL(/\/mis-reservas$/);
    await narrar(page, testInfo, 'Entrar y salir. En Entrar se ve «Entrar».', { criterio: 'AC-001-07' });
    await captura(page, testInfo, 'AC-001-07', { ve: ['Entrar'] });
  });

  test('AC-001-01 REQ-F-001 AC1 Lucía entra y ve «Hola, Lucía» en Mis reservas', async ({ page }, testInfo) => {
    await reiniciar();
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Lucía, socia del club, escribe su correo y su contraseña en el formulario y pulsa Entrar');
    await escribirCredenciales(page, ...LUCIA);
    // REQ-F-001 AC1: "…THEN the user sees "Hola, Lucía" in the page "Mis reservas""
    await expect(page.getByRole('heading', { name: 'Mis reservas', level: 1 })).toBeVisible();
    await expect(page.getByRole('banner')).toContainText('Hola, Lucía');
    await narrar(page, testInfo, 'Entrar y salir. En Mis reservas se ve «Hola, Lucía».', { criterio: 'AC-001-01' });
    await captura(page, testInfo, 'AC-001-01', { ve: ['Hola, Lucía'] });
  });

  test('AC-001-02 REQ-F-001 AC2 Pablo, el encargado, entra y ve «Hola, Pablo» en el Panel del encargado', async ({ page }, testInfo) => {
    await reiniciar();
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Pablo, el encargado, escribe su correo y su contraseña en Entrar');
    await escribirCredenciales(page, ...PABLO);
    // REQ-F-001 AC2: "…THEN the user sees "Hola, Pablo" in the page "Panel del encargado""
    await expect(page.getByRole('heading', { name: 'Panel del encargado', level: 1 })).toBeVisible();
    await expect(page.getByRole('banner')).toContainText('Hola, Pablo');
    await narrar(page, testInfo, 'Entrar y salir. En Panel del encargado se ve «Hola, Pablo».', { criterio: 'AC-001-02' });
    await captura(page, testInfo, 'AC-001-02', { ve: ['Hola, Pablo'] });
  });

  test('AC-001-03 REQ-F-001 AC3 Lucía escribe una contraseña errónea y ve «Correo o contraseña incorrectos»', async ({ page }, testInfo) => {
    await reiniciar();
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Lucía escribe su correo y una contraseña que no es la suya');
    await escribirCredenciales(page, LUCIA[0], 'Mala-contrasena1');
    // REQ-F-001 AC3: "…THEN the user sees "Correo o contraseña incorrectos""
    await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
    await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
    await narrar(page, testInfo, 'Entrar y salir. En Entrar se ve «Correo o contraseña incorrectos».', { criterio: 'AC-001-03' });
    await captura(page, testInfo, 'AC-001-03', { ve: ['Correo o contraseña incorrectos'] });
  });

  test('AC-001-04 REQ-F-001 AC4 tras 5 fallos Lucía entra con la contraseña buena y ve «Cuenta bloqueada. Vuelve a intentarlo en 15 minutos»', async ({ page }, testInfo) => {
    await reiniciar();
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Lucía se equivoca de contraseña cinco veces seguidas');
    for (let i = 0; i < 5; i++) {
      await entrarYEsperar(page, LUCIA[0], 'Mala-contrasena1');
      await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
    }
    adelantar(1);
    await narrar(page, testInfo, 'Un minuto después escribe la contraseña correcta');
    await escribirCredenciales(page, ...LUCIA);
    // REQ-F-001 AC4: "…THEN the user sees "Cuenta bloqueada. Vuelve a intentarlo en 15 minutos""
    await expect(page.getByRole('alert')).toHaveText('Cuenta bloqueada. Vuelve a intentarlo en 15 minutos');
    await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
    await narrar(page, testInfo, 'Entrar y salir. En Entrar se ve «Cuenta bloqueada. Vuelve a intentarlo en 15 minutos».', { criterio: 'AC-001-04' });
    await captura(page, testInfo, 'AC-001-04', { ve: ['Cuenta bloqueada. Vuelve a intentarlo en 15 minutos'] });
  });

  test('AC-001-05 REQ-F-001 AC5 pasados 15 minutos del bloqueo Lucía entra y ve «Hola, Lucía»', async ({ page }, testInfo) => {
    await reiniciar();
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Lucía se equivoca de contraseña cinco veces y su cuenta se bloquea');
    for (let i = 0; i < 5; i++) {
      await entrarYEsperar(page, LUCIA[0], 'Mala-contrasena1');
      await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
    }
    adelantar(15);
    await narrar(page, testInfo, 'Pasan quince minutos y Lucía escribe la contraseña correcta');
    await escribirCredenciales(page, ...LUCIA);
    // REQ-F-001 AC5: "…THEN the user sees "Hola, Lucía""
    await expect(page.getByRole('banner')).toContainText('Hola, Lucía');
    await expect(page.getByRole('heading', { name: 'Mis reservas', level: 1 })).toBeVisible();
    await narrar(page, testInfo, 'Entrar y salir. En Mis reservas se ve «Hola, Lucía», porque el bloqueo de quince minutos ya terminó.', { criterio: 'AC-001-05' });
    await captura(page, testInfo, 'AC-001-05', { ve: ['Hola, Lucía'] });
  });

  test('AC-001-06 REQ-F-001 AC6 con la sesión de Lucía caducada por inactividad, cualquier página muestra «Entrar»', async ({ page }, testInfo) => {
    await reiniciar();
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Lucía entra y deja el navegador sin tocar nada');
    await escribirCredenciales(page, ...LUCIA);
    await expect(page.getByRole('banner')).toContainText('Hola, Lucía');
    // Q-spec-auditor-001: con exactamente 30 minutos sigue abierta; se cierra al pasar de 30 (aquí, 31 minutos)
    adelantar(31);
    await narrar(page, testInfo, 'Han pasado más de treinta minutos sin actividad y Lucía abre una página');
    // REQ-F-001 AC6 cláusula: "WHEN the user opens any page"
    for (const pagina of ['/mis-reservas', '/reservar']) {
      await page.goto(pagina);
      // REQ-F-001 AC6: "GIVEN a session with 30 minutes without activity WHEN the user opens any page THEN the user sees the form "Entrar""
      await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
      await expect(page.getByText('Hola, Lucía')).toHaveCount(0);
    }
    await narrar(page, testInfo, 'Entrar y salir. En Entrar se ve «Entrar», porque la sesión caducó por inactividad.', { criterio: 'AC-001-06' });
    await captura(page, testInfo, 'AC-001-06', { ve: ['Entrar'] });
  });

  test('AC-002-01 REQ-F-001 AC7 Lucía pulsa «Salir», ve el formulario «Entrar» y al volver atrás no ve datos privados', async ({ page }, testInfo) => {
    await reiniciar();
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Lucía entra con su correo y su contraseña');
    await escribirCredenciales(page, ...LUCIA);
    await expect(page.getByRole('banner')).toContainText('Hola, Lucía');
    await narrar(page, testInfo, 'Lucía pulsa Salir');
    await page.getByRole('button', { name: 'Salir' }).click();
    // REQ-F-001 AC7: "GIVEN a logged-in user WHEN they press "Salir" THEN the user sees the form "Entrar" and going back does not show private data"
    await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    await narrar(page, testInfo, 'Después vuelve atrás con el navegador');
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByText('Hola, Lucía')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Mis reservas' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salir' })).toHaveCount(0);
    await narrar(page, testInfo, 'Entrar y salir. En Entrar se ve «Entrar» y «Entrar», y al volver atrás no aparece ningún dato privado de Lucía.', { criterio: 'AC-002-01' });
    await captura(page, testInfo, 'AC-002-01', { ve: ['Entrar', 'Entrar'] });
  });

  test('AC-001-08 un socio que abre /material ve la página «Sin permiso» y ningún dato del encargado', async ({ page }, testInfo) => {
    await reiniciar();
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Lucía entra como socia');
    await escribirCredenciales(page, ...LUCIA);
    await expect(page.getByRole('banner')).toContainText('Hola, Lucía');
    await narrar(page, testInfo, 'Lucía escribe la dirección de Material, que es del encargado');
    await page.goto('/material');
    await expect(page.getByRole('heading', { name: 'Sin permiso', level: 1 })).toBeVisible();
    await expect(page.getByText('No tienes permiso para ver esta página')).toBeVisible();
    await expect(page.getByText('Casco: 3 unidades')).toHaveCount(0);
    await narrar(page, testInfo, 'La web muestra Sin permiso y no enseña nada del material', { criterio: 'AC-001-08' });
    await captura(page, testInfo, 'AC-001-08', { ve: ['Sin permiso', 'No tienes permiso para ver esta página'] });
  });
});

test.describe('FASE-0 · Material (REQ-F-007)', () => {
  test('AC-015-01 REQ-F-007 AC1 con 4 «Cuerda», el encargado añade 2 y ve «Cuerda: 6 unidades» en Material', async ({ page }, testInfo) => {
    await reiniciar({ material: [{ nombre: 'Cuerda', total: 4 }], reservas: [] });
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Pablo entra como encargado y abre Material, donde hay 4 unidades de Cuerda');
    await escribirCredenciales(page, ...PABLO);
    await irAMaterial(page);
    await expect(filaDe(page, 'Cuerda: 4 unidades')).toBeVisible();
    await narrar(page, testInfo, 'Pablo escribe 2 en la cantidad de Cuerda y pulsa Añadir');
    await page.getByLabel('Cantidad de Cuerda').fill('2');
    await filaDe(page, 'Cuerda: 4 unidades').getByRole('button', { name: 'Añadir', exact: true }).click();
    // REQ-F-007 AC1: "GIVEN "Cuerda" has 4 units WHEN the encargado adds 2 units THEN the user sees "Cuerda: 6 unidades" in "Material""
    await expect(filaDe(page, 'Cuerda: 6 unidades')).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Cuerda: 6 unidades');
    await narrar(page, testInfo, 'Inventario. En Material se ve «Cuerda: 6 unidades».', { criterio: 'AC-015-01' });
    await captura(page, testInfo, 'AC-015-01', { ve: ['Cuerda: 6 unidades'] });
  });

  test('AC-015-02 REQ-F-007 AC2 el encargado crea el tipo nuevo «Mosquetón» con 10 unidades y ve «Mosquetón: 10 unidades»', async ({ page }, testInfo) => {
    await reiniciar({ material: [{ nombre: 'Cuerda', total: 4 }], reservas: [] });
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Pablo entra como encargado y abre Material');
    await escribirCredenciales(page, ...PABLO);
    await irAMaterial(page);
    await narrar(page, testInfo, 'Pablo da de alta un tipo nuevo: Mosquetón, con 10 unidades');
    await page.getByLabel('Nombre').fill('Mosquetón');
    await page.getByLabel('Unidades').fill('10');
    await page.getByRole('button', { name: 'Añadir tipo' }).click();
    // REQ-F-007 AC2: "GIVEN a new type WHEN the encargado adds "Mosquetón" with 10 units THEN the user sees "Mosquetón: 10 unidades""
    await expect(filaDe(page, 'Mosquetón: 10 unidades')).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Mosquetón: 10 unidades');
    await narrar(page, testInfo, 'Inventario. En Material se ve «Mosquetón: 10 unidades».', { criterio: 'AC-015-02' });
    await captura(page, testInfo, 'AC-015-02', { ve: ['Mosquetón: 10 unidades'] });
  });

  test('AC-016-01 REQ-F-007 AC3 con 6 «Cuerda» libres, el encargado retira 1 rota y ve «Cuerda: 5 unidades»', async ({ page }, testInfo) => {
    await reiniciar({ material: [{ nombre: 'Cuerda', total: 6 }], reservas: [] });
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Pablo entra como encargado y abre Material, donde hay 6 unidades de Cuerda sin reservar');
    await escribirCredenciales(page, ...PABLO);
    await irAMaterial(page);
    await narrar(page, testInfo, 'Pablo escribe 1 en la cantidad de Cuerda, pulsa Dar de baja y confirma');
    await page.getByLabel('Cantidad de Cuerda').fill('1');
    await filaDe(page, 'Cuerda: 6 unidades').getByRole('button', { name: 'Dar de baja' }).click();
    await expect(page.getByText('¿Dar de baja 1 unidades de Cuerda?')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    // REQ-F-007 AC3: "GIVEN "Cuerda" has 6 units and none lent or reserved WHEN the encargado withdraws 1 broken unit THEN the user sees "Cuerda: 5 unidades""
    await expect(filaDe(page, 'Cuerda: 5 unidades')).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Cuerda: 5 unidades');
    await narrar(page, testInfo, 'Inventario. En Material se ve «Cuerda: 5 unidades».', { criterio: 'AC-016-01' });
    await captura(page, testInfo, 'AC-016-01', { ve: ['Cuerda: 5 unidades'] });
  });

  test('AC-016-02 REQ-F-007 AC4 con las 2 «Tienda» reservadas el 2026-12-06, retirar 1 da el error con las unidades necesarias y sigue «Tienda: 2 unidades»', async ({ page }, testInfo) => {
    await reiniciar({
      material: [{ nombre: 'Tienda', total: 2 }],
      reservas: [{ socio: 'lucia@club.test', material: 'Tienda', cantidad: 2, inicio: '2026-12-06', fin: '2026-12-06' }],
    });
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Pablo entra como encargado y abre Material, donde hay 2 tiendas y las dos están reservadas el 6 de diciembre');
    await escribirCredenciales(page, ...PABLO);
    await irAMaterial(page);
    await narrar(page, testInfo, 'Pablo intenta dar de baja 1 tienda y confirma');
    await page.getByLabel('Cantidad de Tienda').fill('1');
    await filaDe(page, 'Tienda: 2 unidades').getByRole('button', { name: 'Dar de baja' }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    // REQ-F-007 AC4: "GIVEN "Tienda" has 2 units, both reserved on 2026-12-06 WHEN the encargado withdraws 1 THEN the user sees "No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06" and "Tienda: 2 unidades""
    await expect(page.getByRole('alert')).toHaveText('No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06');
    // REQ-F-007 AC4 cláusula: "and "Tienda: 2 unidades""
    await expect(filaDe(page, 'Tienda: 2 unidades')).toBeVisible();
    await narrar(page, testInfo, 'Inventario. En Material se ve «No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06» y «Tienda: 2 unidades».', { criterio: 'AC-016-02' });
    await captura(page, testInfo, 'AC-016-02', { ve: ['No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06', 'Tienda: 2 unidades'] });
  });

  test('AC-016-03 REQ-F-007 AC5 repetir la baja de la única «Cuerda» da «No hay tantas unidades para dar de baja» y sigue «Cuerda: 0 unidades»', async ({ page }, testInfo) => {
    await reiniciar({ material: [{ nombre: 'Cuerda', total: 1 }], reservas: [] });
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Pablo entra como encargado y abre Material, donde queda 1 unidad de Cuerda');
    await escribirCredenciales(page, ...PABLO);
    await irAMaterial(page);
    await narrar(page, testInfo, 'Pablo da de baja la única Cuerda y confirma; el stock queda a 0');
    await page.getByLabel('Cantidad de Cuerda').fill('1');
    await filaDe(page, 'Cuerda: 1 unidades').getByRole('button', { name: 'Dar de baja' }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(filaDe(page, 'Cuerda: 0 unidades')).toBeVisible();
    await narrar(page, testInfo, 'Pablo envía la misma baja otra vez');
    await page.getByLabel('Cantidad de Cuerda').fill('1');
    await filaDe(page, 'Cuerda: 0 unidades').getByRole('button', { name: 'Dar de baja' }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    // REQ-F-007 AC5: "GIVEN "Cuerda" has 1 unit and none lent or reserved, and the encargado just withdrew it (stock 0) WHEN the same withdrawal is submitted again THEN the user sees "No hay tantas unidades para dar de baja" and "Cuerda: 0 unidades""
    await expect(page.getByRole('alert')).toHaveText('No hay tantas unidades para dar de baja');
    await expect(filaDe(page, 'Cuerda: 0 unidades')).toBeVisible();
    await narrar(page, testInfo, 'Inventario. En Material se ve «No hay tantas unidades para dar de baja» y «Cuerda: 0 unidades».', { criterio: 'AC-016-03' });
    await captura(page, testInfo, 'AC-016-03', { ve: ['No hay tantas unidades para dar de baja', 'Cuerda: 0 unidades'] });
  });

  test('AC-007-10 REQ-F-007 AC6 con «Casco» a 6 y «Cuerda» a 0, un socio abre Reservar y ve «Casco» entre los tipos sin que se ofrezca «Cuerda»', async ({ page }, testInfo) => {
    await reiniciar({ material: [{ nombre: 'Casco', total: 6 }, { nombre: 'Cuerda', total: 0 }], reservas: [] });
    await page.goto('/mis-reservas');
    await narrar(page, testInfo, 'Lucía entra como socia y abre Reservar; hay 6 cascos y la cuerda está a 0');
    await escribirCredenciales(page, ...LUCIA);
    await page.getByRole('navigation').getByRole('link', { name: 'Reservar' }).click();
    await expect(page.getByRole('heading', { name: 'Reservar', level: 1 })).toBeVisible();
    // REQ-F-007 AC6: "GIVEN "Casco" with 6 units and "Cuerda" with 0 units WHEN a socio opens "Reservar" THEN the user sees "Casco" among the types and "Cuerda" does not offer reservation"
    const ofrecidos = page.getByRole('list', { name: 'Material' }).getByRole('listitem');
    await expect(ofrecidos.filter({ hasText: 'Casco' })).toHaveCount(1);
    await expect(ofrecidos.filter({ hasText: 'Cuerda' })).toHaveCount(0);
    await expect(page.getByText('Sin unidades por ahora: Cuerda')).toBeVisible();
    await narrar(page, testInfo, 'Inventario. En Reservar se ve «Casco» entre los tipos, y «Cuerda», que está sin unidades, no se ofrece.', { criterio: 'AC-007-10' });
    await captura(page, testInfo, 'AC-007-10', { ve: ['Casco', 'Cuerda'] });
  });
});

test.describe('FASE-0 · Datos en el servidor (ADR-DRAFT-002)', () => {
  const PUERTO = 5175;
  const BASE = `http://127.0.0.1:${PUERTO}`;
  let servidor = null;

  const parar = () => {
    if (!servidor) return;
    try { process.kill(-servidor.pid); } catch { /* ya parado */ }
    servidor = null;
  };
  async function arrancar(fichero) {
    servidor = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PUERTO), '--strictPort'], {
      detached: true, stdio: 'ignore', env: { ...process.env, MM_DATOS: fichero, MM_HOY: HOY },
    });
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`${BASE}/api/sesion`)).status === 401) return; } catch { /* aún no escucha */ }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('El servidor no arrancó');
  }
  const esperarParado = async () => {
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${BASE}/api/sesion`); } catch { return; }
      await new Promise((r) => setTimeout(r, 100));
    }
  };
  test.afterEach(() => parar());

  test('FASE-0 el material cargado por el encargado sigue en el servidor tras pararlo y arrancarlo', async ({ page }, testInfo) => {
    const fichero = path.resolve('data/e2e/reinicio.json');
    await sembrar(fichero, { hoy: HOY });   // Lucía, Pablo, Elena, 3 «Casco» y una reserva de 2 «Casco»
    await arrancar(fichero);

    await page.goto(`${BASE}/mis-reservas`);
    await narrar(page, testInfo, 'Pablo, el encargado, entra en el club');
    await escribirCredenciales(page, ...PABLO);
    await page.getByRole('navigation').getByRole('link', { name: 'Material' }).click();
    await expect(filaDe(page, 'Casco: 3 unidades')).toBeVisible();

    await narrar(page, testInfo, 'Pablo da de alta 2 piolets, un tipo nuevo');
    await page.getByLabel('Nombre').fill('Piolet');
    await page.getByLabel('Unidades').fill('2');
    await page.getByRole('button', { name: 'Añadir tipo' }).click();
    await expect(filaDe(page, 'Piolet: 2 unidades')).toBeVisible();

    await narrar(page, testInfo, 'Intenta dar de baja 3 cascos, pero 2 están reservados: la web se lo impide');
    await page.getByLabel('Cantidad de Casco').fill('3');
    await filaDe(page, 'Casco: 3 unidades').getByRole('button', { name: 'Dar de baja' }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByRole('alert')).toContainText('No se puede dar de baja: hay 2 unidades de Casco necesarias el 2026-12-05');

    await narrar(page, testInfo, 'Da de baja solo 1 casco roto y quedan 2');
    await page.getByLabel('Cantidad de Casco').fill('1');
    await filaDe(page, 'Casco: 3 unidades').getByRole('button', { name: 'Dar de baja' }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(filaDe(page, 'Casco: 2 unidades')).toBeVisible();

    await narrar(page, testInfo, 'Se para el servidor y se vuelve a arrancar');
    parar();
    await esperarParado();
    await arrancar(fichero);
    // El servidor recién reiniciado puede abortar una primera navegación: se reintenta hasta que carga.
    await expect(async () => { await page.goto(`${BASE}/material`); }).toPass({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
    await narrar(page, testInfo, 'Las sesiones se cierran al reiniciar: Pablo vuelve a entrar y abre Material');
    await escribirCredenciales(page, ...PABLO);
    await page.getByRole('navigation').getByRole('link', { name: 'Material' }).click();
    await expect(filaDe(page, 'Piolet: 2 unidades')).toBeVisible();
    await expect(filaDe(page, 'Casco: 2 unidades')).toBeVisible();
    await narrar(page, testInfo, 'Siguen ahí los 2 piolets y los 2 cascos: los datos viven en el servidor');
  });
});
