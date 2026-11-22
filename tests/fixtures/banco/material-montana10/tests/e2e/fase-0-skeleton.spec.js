// Recorrido de la FASE-0 por la ruta del usuario (WF-002): una prueba por criterio, con su locución y su captura.
// Entra siempre por la dirección de la web y la pantalla de Entrar, con la semilla de pruebas (reloj fijo en 2026-12-01).
import { test, expect, narrar, captura } from './fixtures/evidence.js';
import { sembrar, leerAlmacen, modificarAlmacen, envejecerSesion } from './fixtures/semilla.js';

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
const reservar = async (page, tipo, desde, hasta) => {
  await page.getByRole('link', { name: 'Reservar' }).click();
  await expect(page.getByRole('heading', { name: 'Reservar material' })).toBeVisible();
  await page.getByLabel('Material').selectOption(tipo);
  await page.getByLabel('Desde').fill(desde);
  await page.getByLabel('Hasta').fill(hasta);
  await page.getByRole('button', { name: 'Reservar' }).click();
};
const anadir = async (page, tipo, cantidad) => {
  await page.getByLabel('Material').selectOption(tipo);
  await page.getByLabel('Cantidad').fill(String(cantidad));
  await page.getByRole('button', { name: 'Añadir' }).click();
};

// ───────────── UC-001 Entrar y salir (WF-002) ─────────────

test('REQ-F-001 AC1 · AC-001-01 WF-002 Lucía entra y ve «Hola, Lucía» en Mis reservas', async ({ page }, testInfo) => {
  sembrar();
  await narrar(page, testInfo, 'Lucía abre la web, ve Entrar y envía su correo y su contraseña');
  await entrarComo(page, 'lucia@club.es', 'Cumbre2026');
  await narrar(page, testInfo, 'Entrar, salir y proteger la sesión. En Mis reservas se ve «Hola, Lucía».', { criterio: 'AC-001-01' });
  // REQ-F-001 AC1: "…THEN the user sees "Hola, Lucía" in Mis reservas"
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await expect(page.locator('#saludo')).toHaveText('Hola, Lucía');
  await captura(page, testInfo, 'AC-001-01', { ve: ['Hola, Lucía'] });
});

test('REQ-F-001 AC2 · AC-001-02 WF-002 Pablo entra y ve «Hola, Pablo» en Mis reservas', async ({ page }, testInfo) => {
  sembrar();
  await narrar(page, testInfo, 'Pablo abre la web, ve Entrar y envía su correo y su contraseña');
  await entrarComo(page, 'pablo@club.es', 'Arista2026');
  await narrar(page, testInfo, 'Entrar, salir y proteger la sesión. En Mis reservas se ve «Hola, Pablo».', { criterio: 'AC-001-02' });
  // REQ-F-001 AC2: "…THEN the user sees "Hola, Pablo" in Mis reservas"
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await expect(page.locator('#saludo')).toHaveText('Hola, Pablo');
  await captura(page, testInfo, 'AC-001-02', { ve: ['Hola, Pablo'] });
});

test('REQ-F-001 AC3 · AC-001-03 WF-002 con la contraseña «mala» sigue en Entrar con el error', async ({ page }, testInfo) => {
  sembrar();
  await narrar(page, testInfo, 'Lucía abre Entrar y envía su correo con una contraseña equivocada');
  await entrarComo(page, 'lucia@club.es', 'mala');
  await narrar(page, testInfo, 'Entrar, salir y proteger la sesión. En Entrar se ve «Correo o contraseña incorrectos» y se queda en Entrar.', { criterio: 'AC-001-03' });
  // REQ-F-001 AC3: "…THEN the user sees "Correo o contraseña incorrectos" and stays in Entrar"
  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
  // REQ-F-001 AC3 cláusula: "and stays in Entrar"
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page).toHaveURL(/#\/entrar$/);
  await captura(page, testInfo, 'AC-001-03', { ve: ['Correo o contraseña incorrectos'] });
});

test('REQ-F-001 AC4 · AC-001-04 WF-002 tras 5 fallos seguidos la cuenta queda bloqueada', async ({ page }, testInfo) => {
  sembrar();
  await narrar(page, testInfo, 'Lucía se equivoca de contraseña cinco veces seguidas');
  await page.goto('/');
  for (let intento = 1; intento <= 5; intento += 1) {
    await entrar(page, 'lucia@club.es', 'mala');
    await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
  }
  await narrar(page, testInfo, 'Ahora envía la contraseña correcta, «Cumbre2026», dentro de los 15 minutos');
  await entrar(page, 'lucia@club.es', 'Cumbre2026');
  const sesion = await page.request.get('/api/sesion');
  await narrar(page, testInfo, 'Entrar, salir y proteger la sesión. En Entrar se ve «Cuenta bloqueada. Inténtalo de nuevo en 15 minutos» y no se abre ninguna sesión.', { criterio: 'AC-001-04' });
  // REQ-F-001 AC4: "…THEN the user sees "Cuenta bloqueada. Inténtalo de nuevo en 15 minutos" and no session starts"
  await expect(page.getByRole('alert')).toHaveText('Cuenta bloqueada. Inténtalo de nuevo en 15 minutos');
  // REQ-F-001 AC4 cláusula: "no session starts"
  expect(sesion.status()).toBe(401);
  expect(leerAlmacen().sesiones).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await captura(page, testInfo, 'AC-001-04', { ve: ['Cuenta bloqueada. Inténtalo de nuevo en 15 minutos'] });
});

test('REQ-F-001 AC5 · AC-001-05 WF-002 cumplido el bloqueo de 15 minutos, Lucía entra', async ({ page }, testInfo) => {
  // Lucía se bloqueó hace 15 minutos: el bloqueo termina justo ahora (reloj fijo a las 11:00 UTC).
  sembrar({ cuentas: { lucia: { fallosSeguidos: 5, bloqueadaHasta: '2026-12-01T11:00:00.000Z' } } });
  await narrar(page, testInfo, 'Lucía se bloqueó hace 15 minutos y vuelve a Entrar con su contraseña correcta');
  await entrarComo(page, 'lucia@club.es', 'Cumbre2026');
  await narrar(page, testInfo, 'Entrar, salir y proteger la sesión. En Mis reservas se ve «Hola, Lucía», cumplido el bloqueo de 15 minutos.', { criterio: 'AC-001-05' });
  // REQ-F-001 AC5: "…THEN the user sees "Hola, Lucía" in Mis reservas"
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await expect(page.locator('#saludo')).toHaveText('Hola, Lucía');
  await captura(page, testInfo, 'AC-001-05', { ve: ['Hola, Lucía'] });
});

test('REQ-F-001 AC6 · AC-001-06 WF-002 con 8 horas sin actividad la sesión caduca', async ({ page }, testInfo) => {
  sembrar();
  await narrar(page, testInfo, 'Lucía entra y deja la web abierta sin usarla');
  await entrarComo(page, 'lucia@club.es', 'Cumbre2026');
  await expect(page.locator('#saludo')).toHaveText('Hola, Lucía');
  envejecerSesion('lucia@club.es', 8);
  await narrar(page, testInfo, 'Pasadas 8 horas sin actividad, Lucía abre cualquier pantalla');
  await page.reload();
  await narrar(page, testInfo, 'Entrar, salir y proteger la sesión. En Entrar se ve «Tu sesión ha caducado».', { criterio: 'AC-001-06' });
  // REQ-F-001 AC6: "…THEN the user sees the Entrar form with "Tu sesión ha caducado""
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('Tu sesión ha caducado');
  await captura(page, testInfo, 'AC-001-06', { ve: ['Tu sesión ha caducado'] });
});

test('REQ-F-001 AC7 · AC-001-07 WF-002 Salir lleva a Entrar y volver atrás pide entrar', async ({ page }, testInfo) => {
  sembrar();
  await narrar(page, testInfo, 'Lucía está dentro de la app y pulsa Salir');
  await entrarComo(page, 'lucia@club.es', 'Cumbre2026');
  await expect(page.locator('#saludo')).toHaveText('Hola, Lucía');
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await narrar(page, testInfo, 'Vuelve atrás hacia Mis reservas');
  await page.goBack();
  await narrar(page, testInfo, 'Entrar, salir y proteger la sesión. En Entrar se ve «Entrar», y al volver atrás a Mis reservas se vuelve a pedir entrar.', { criterio: 'AC-001-07' });
  // REQ-F-001 AC7: "…THEN the user sees the Entrar form and going back to Mis reservas asks to enter again"
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page).toHaveURL(/#\/entrar$/);
  expect((await page.request.get('/api/sesion')).status()).toBe(401);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await captura(page, testInfo, 'AC-001-07', { ve: ['Entrar'] });
});

test('REQ-F-001 AC8 · AC-001-08 WF-002 sin haber entrado, abrir Mis reservas lleva a Entrar', async ({ page }, testInfo) => {
  sembrar();
  await narrar(page, testInfo, 'Nadie ha entrado: se abre directamente la dirección de Mis reservas');
  await page.goto('/#/mis-reservas');
  await narrar(page, testInfo, 'Entrar, salir y proteger la sesión. En Entrar se ve «Entrar».', { criterio: 'AC-001-08' });
  // REQ-F-001 AC8: "…THEN the user sees the Entrar form"
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page).toHaveURL(/#\/entrar$/);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await captura(page, testInfo, 'AC-001-08', { ve: ['Entrar'] });
});

test('REQ-F-001 AC9 · AC-001-09 WF-002 el mismo formulario correcto llega dos veces y queda una sola sesión', async ({ page }, testInfo) => {
  sembrar();
  await narrar(page, testInfo, 'Lucía rellena Entrar y el formulario se envía dos veces a la vez: las dos peticiones llegan al servidor');
  await page.goto('/');
  await page.getByLabel('Correo').fill('lucia@club.es');
  await page.getByLabel('Contraseña').fill('Cumbre2026');
  // El doble clic de la pantalla no repite la petición; aquí las dos llegan de verdad, con el mismo navegador y su cookie.
  const respuestas = await page.evaluate(async () => {
    const enviar = () => fetch('/api/iniciar-sesion', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ correo: 'lucia@club.es', contrasena: 'Cumbre2026' }),
    }).then((r) => r.status);
    return Promise.all([enviar(), enviar()]);
  });
  expect(respuestas).toEqual([200, 200]);
  await page.goto('/#/mis-reservas');
  await page.reload();
  await narrar(page, testInfo, 'Entrar, salir y proteger la sesión. En Mis reservas se ve «Hola, Lucía» y hay una sola sesión.', { criterio: 'AC-001-09' });
  // REQ-F-001 AC9: "…THEN there is one single session and the user sees "Hola, Lucía""
  expect(leerAlmacen().sesiones).toHaveLength(1);
  await expect(page.locator('#saludo')).toHaveText('Hola, Lucía');
  await expect(page).toHaveURL(/#\/mis-reservas$/);
  await captura(page, testInfo, 'AC-001-09', { ve: ['Hola, Lucía'] });
});

// ───────────── UC-008 Gestionar inventario ─────────────

test('REQ-F-008 AC1 · AC-008-01 el encargado añade 2 «Piolet» a 3 y ve «Piolet · 5 unidades»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 3 } });
  await narrar(page, testInfo, 'El encargado entra y abre Inventario, donde hay 3 piolets');
  await entrarComo(page, 'encargado@club.es', 'Glaciar2026');
  await expect(page.getByRole('heading', { name: 'Piolet · 3 unidades' })).toBeVisible();
  await narrar(page, testInfo, 'Indica Piolet, cantidad 2, y pulsa Añadir');
  await anadir(page, 'Piolet', 2);
  await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «Piolet · 5 unidades».', { criterio: 'AC-008-01' });
  // REQ-F-008 AC1: "…THEN the user sees "Piolet · 5 unidades" in Inventario"
  await expect(page.getByRole('heading', { name: 'Inventario', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Piolet · 5 unidades' })).toBeVisible();
  await captura(page, testInfo, 'AC-008-01', { ve: ['Piolet · 5 unidades'] });
});

test('REQ-F-008 AC2 · AC-008-02 enviar otra vez el mismo añadido suma: 7 unidades y «Añadidas 2 unidades de Piolet»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 3 } });
  await narrar(page, testInfo, 'El encargado entra y añade 2 unidades de Piolet sobre las 3 que hay');
  await entrarComo(page, 'encargado@club.es', 'Glaciar2026');
  await anadir(page, 'Piolet', 2);
  await expect(page.getByRole('heading', { name: 'Piolet · 5 unidades' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Añadidas 2 unidades de Piolet');
  await narrar(page, testInfo, 'Envía el mismo formulario otra vez');
  await anadir(page, 'Piolet', 2);
  await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «Añadidas 2 unidades de Piolet», y el encargado ve 7 unidades, porque cada envío añade unidades.', { criterio: 'AC-008-02' });
  // REQ-F-008 AC2: "…THEN the encargado sees 7 units, because each submission adds units (the form shows "Añadidas 2 unidades de Piolet" each time)"
  await expect(page.getByRole('heading', { name: 'Piolet · 7 unidades' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Añadidas 2 unidades de Piolet');
  await captura(page, testInfo, 'AC-008-02', { ve: ['Añadidas 2 unidades de Piolet'] });
});

test('REQ-F-008 AC3 · AC-008-03 el encargado marca «Casco 3» como rota: «Casco 3 · De baja» y «Casco · 2 unidades»', async ({ page, request }, testInfo) => {
  // Dos de los tres cascos ya están reservados el 2026-12-05: con «Casco 3» libre aún quedaría uno.
  sembrar({
    unidades: { Casco: 3 },
    reservas: [{ socio: 'ines', tipo: 'Casco', desde: '2026-12-05', hasta: '2026-12-05' }, { socio: 'lucia', tipo: 'Casco', desde: '2026-12-05', hasta: '2026-12-05' }],
  });
  await narrar(page, testInfo, 'El encargado entra, abre Inventario y marca «Casco 3» como rota');
  await entrarComo(page, 'encargado@club.es', 'Glaciar2026');
  await expect(page.getByRole('heading', { name: 'Casco · 3 unidades' })).toBeVisible();
  await page.locator('li', { hasText: 'Casco 3' }).getByRole('button', { name: 'Marcar como rota' }).click();
  await page.locator('li', { hasText: 'Casco 3' }).getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('heading', { name: 'Casco · 2 unidades' })).toBeVisible();
  // «no se puede reservar»: Pablo pide un casco ese día y ya no queda ninguno libre
  await request.post('/api/iniciar-sesion', { data: { correo: 'pablo@club.es', contrasena: 'Arista2026' } });
  const intento = await request.post('/api/reservas', { data: { tipo: 'Casco', desde: '2026-12-05', hasta: '2026-12-05' } });
  await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «Casco 3 · De baja» y «Casco · 2 unidades», y no se puede reservar.', { criterio: 'AC-008-03' });
  // REQ-F-008 AC3: "…THEN the user sees "Casco 3 · De baja" and "Casco · 2 unidades" in Inventario, and it cannot be reserved"
  await expect(page.getByText('Casco 3 · De baja', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Casco · 2 unidades' })).toBeVisible();
  expect(intento.status()).toBe(409);
  expect((await intento.json()).error).toBe('E_SIN_UNIDADES_LIBRES');
  await captura(page, testInfo, 'AC-008-03', { ve: ['Casco 3 · De baja', 'Casco · 2 unidades'] });
});

test('REQ-F-008 AC4 · AC-008-04 «Casco 1» está prestada a Pablo: no se da de baja y sigue activa', async ({ page }, testInfo) => {
  sembrar({
    unidades: { Casco: 3 },
    reservas: [{ socio: 'pablo', tipo: 'Casco', desde: '2026-12-01', hasta: '2026-12-03', estado: 'Prestada', unidad: 'Casco 1' }],
  });
  await narrar(page, testInfo, 'El encargado entra y abre Inventario; «Casco 1» está prestada a Pablo');
  await entrarComo(page, 'encargado@club.es', 'Glaciar2026');
  await expect(page.locator('li', { hasText: 'Casco 1' })).toContainText('Prestada');
  await narrar(page, testInfo, 'El encargado marca «Casco 1» como rota y confirma');
  await page.locator('li', { hasText: 'Casco 1' }).getByRole('button', { name: 'Marcar como rota' }).click();
  await page.locator('li', { hasText: 'Casco 1' }).getByRole('button', { name: 'Confirmar' }).click();
  const inventario = await (await page.request.get('/api/inventario')).json();
  await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «No se puede dar de baja: está prestada», y sigue activa.', { criterio: 'AC-008-04' });
  // REQ-F-008 AC4: "…THEN the user sees "No se puede dar de baja: está prestada" and it stays active"
  await expect(page.getByRole('alert')).toHaveText('No se puede dar de baja: está prestada');
  // REQ-F-008 AC4 cláusula: "it stays active"
  expect(inventario[0].unidades[0]).toMatchObject({ nombre: 'Casco 1', estado: 'Activa' });
  await expect(page.locator('li', { hasText: 'Casco 1' })).not.toContainText('De baja');
  await captura(page, testInfo, 'AC-008-04', { ve: ['No se puede dar de baja: está prestada'] });
});

test('REQ-F-008 AC5 · AC-008-05 una unidad ya «De baja» marcada otra vez sigue «De baja» una sola vez', async ({ page }, testInfo) => {
  sembrar({ unidades: { Casco: 3 }, bajas: ['Casco 3'] });
  await narrar(page, testInfo, 'El encargado entra; «Casco 3» ya está de baja, y se vuelve a marcar como rota');
  await entrarComo(page, 'encargado@club.es', 'Glaciar2026');
  await expect(page.getByText('Casco 3 · De baja', { exact: true })).toBeVisible();
  const antes = leerAlmacen().unidades;
  const repetida = await page.request.post('/api/inventario/unidades/baja', { data: { unidadId: 3 } });
  expect(repetida.status()).toBe(200);
  await page.reload();
  // REQ-F-008 AC5: "…THEN it stays "De baja" once"
  // REQ-F-008 AC5 cláusula: "it stays "De baja" once"
  await expect(page.getByText('Casco 3 · De baja', { exact: true })).toHaveCount(1);
  expect(leerAlmacen().unidades).toEqual(antes);
  await expect(page.getByRole('heading', { name: 'Casco · 2 unidades' })).toBeVisible();
});

test('REQ-F-008 AC6 · AC-008-06 Pablo abre Inventario por su dirección: «No tienes permiso para ver esta pantalla»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 3 } });
  await narrar(page, testInfo, 'Pablo entra como socio y escribe la dirección de Inventario');
  await entrarComo(page, 'pablo@club.es', 'Arista2026');
  await expect(page.locator('#saludo')).toHaveText('Hola, Pablo');
  await page.goto('/#/inventario');
  await narrar(page, testInfo, 'Gestionar el inventario. En Inventario se ve «No tienes permiso para ver esta pantalla».', { criterio: 'AC-008-06' });
  // REQ-F-008 AC6: "…THEN the user sees "No tienes permiso para ver esta pantalla""
  await expect(page.getByRole('alert')).toHaveText('No tienes permiso para ver esta pantalla');
  await expect(page.getByText('Piolet · 3 unidades')).toHaveCount(0);
  await captura(page, testInfo, 'AC-008-06', { ve: ['No tienes permiso para ver esta pantalla'] });
});

// ───────────── UC-003 Reservar material ─────────────

test('REQ-F-003 AC1 · AC-003-01 Lucía reserva «Piolet» del 2026-12-05 al 2026-12-07 y ve «Reserva creada…»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 3 } });
  await narrar(page, testInfo, 'Lucía entra, abre Reservar, elige Piolet del 5 al 7 de diciembre y envía');
  await entrarComo(page, 'lucia@club.es', 'Cumbre2026');
  await reservar(page, 'Piolet', '2026-12-05', '2026-12-07');
  await narrar(page, testInfo, 'Reservar material para unas fechas. En Mis reservas se ve «Reserva creada: Piolet del 2026-12-05 al 2026-12-07».', { criterio: 'AC-003-01' });
  // REQ-F-003 AC1: "…THEN the user sees "Reserva creada: Piolet del 2026-12-05 al 2026-12-07" in Mis reservas"
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Reserva creada: Piolet del 2026-12-05 al 2026-12-07');
  await captura(page, testInfo, 'AC-003-01', { ve: ['Reserva creada: Piolet del 2026-12-05 al 2026-12-07'] });
});

test('REQ-F-003 AC2 · AC-003-02 enviar de nuevo la misma reserva de «Piolet» no la duplica', async ({ page }, testInfo) => {
  sembrar({ unidades: { Piolet: 3 } });
  await narrar(page, testInfo, 'Lucía reserva Piolet del 5 al 7 de diciembre y vuelve a enviar el mismo formulario');
  await entrarComo(page, 'lucia@club.es', 'Cumbre2026');
  await reservar(page, 'Piolet', '2026-12-05', '2026-12-07');
  await expect(page.getByRole('status')).toHaveText('Reserva creada: Piolet del 2026-12-05 al 2026-12-07');
  await reservar(page, 'Piolet', '2026-12-05', '2026-12-07');
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  // REQ-F-003 AC2: "…THEN Mis reservas still has one reserva of "Piolet" for those dates"
  // REQ-F-003 AC2 cláusula: "still has one reserva of "Piolet" for those dates"
  await expect(page.getByRole('row', { name: /Piolet 2026-12-05 2026-12-07/ })).toHaveCount(1);
  expect(leerAlmacen().reservas.filter((r) => r.tipo === 'Piolet')).toHaveLength(1);
});

test('REQ-F-003 AC3 · AC-003-03 sin unidades de «Tienda» el 2026-12-06 Pablo ve el rechazo y no se crea la reserva', async ({ page }, testInfo) => {
  sembrar({
    unidades: { Tienda: 2 },
    reservas: [{ socio: 'ines', tipo: 'Tienda', desde: '2026-12-05', hasta: '2026-12-07' }, { socio: 'lucia', tipo: 'Tienda', desde: '2026-12-05', hasta: '2026-12-07' }],
  });
  await narrar(page, testInfo, 'Pablo entra y reserva una tienda para el 6 de diciembre, cuando las dos están reservadas');
  await entrarComo(page, 'pablo@club.es', 'Arista2026');
  await reservar(page, 'Tienda', '2026-12-06', '2026-12-06');
  const mias = await (await page.request.get('/api/mis-reservas')).json();
  await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «No quedan unidades libres de Tienda esas fechas» y no se crea ninguna reserva.', { criterio: 'AC-003-03' });
  // REQ-F-003 AC3: "…THEN the user sees "No quedan unidades libres de Tienda esas fechas" and no reserva is created"
  await expect(page.getByRole('alert')).toHaveText('No quedan unidades libres de Tienda esas fechas');
  await expect(page.getByRole('heading', { name: 'Reservar material' })).toBeVisible();
  expect(mias.reservas).toEqual([]);
  expect(leerAlmacen().reservas).toHaveLength(2);
  await captura(page, testInfo, 'AC-003-03', { ve: ['No quedan unidades libres de Tienda esas fechas'] });
});

test('REQ-F-003 AC4 · AC-003-04 Pablo reserva «Tienda» del 2026-12-07 al 2026-12-08, días con unidades libres', async ({ page }, testInfo) => {
  sembrar({ unidades: { Tienda: 2 }, reservas: [{ socio: 'ines', tipo: 'Tienda', desde: '2026-12-05', hasta: '2026-12-06' }] });
  await narrar(page, testInfo, 'Pablo entra y reserva una tienda del 7 al 8 de diciembre; la otra tienda solo está ocupada el 5 y el 6');
  await entrarComo(page, 'pablo@club.es', 'Arista2026');
  await reservar(page, 'Tienda', '2026-12-07', '2026-12-08');
  await narrar(page, testInfo, 'Reservar material para unas fechas. En Mis reservas se ve «Reserva creada: Tienda del 2026-12-07 al 2026-12-08», porque las unidades están libres esos días.', { criterio: 'AC-003-04' });
  // REQ-F-003 AC4: "…THEN the reserva is created (the units are free those days)"
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Reserva creada: Tienda del 2026-12-07 al 2026-12-08');
  await expect(page.getByRole('row', { name: /Tienda 2026-12-07 2026-12-08 Reservada/ })).toHaveCount(1);
  await captura(page, testInfo, 'AC-003-04', { ve: ['Reserva creada: Tienda del 2026-12-07 al 2026-12-08'] });
});

test('REQ-F-003 AC5 · AC-003-05 hoy es 2026-12-01: reservar «Casco» desde 2026-11-30 se rechaza por pasado', async ({ page }, testInfo) => {
  sembrar({ unidades: { Casco: 2 } });
  await narrar(page, testInfo, 'Lucía entra y reserva un casco desde el 30 de noviembre, cuando hoy es el 1 de diciembre');
  await entrarComo(page, 'lucia@club.es', 'Cumbre2026');
  await reservar(page, 'Casco', '2026-11-30', '2026-12-02');
  const mias = await (await page.request.get('/api/mis-reservas')).json();
  await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «Las fechas no pueden estar en el pasado» y no se crea ninguna reserva.', { criterio: 'AC-003-05' });
  // REQ-F-003 AC5: "…THEN the user sees "Las fechas no pueden estar en el pasado" and no reserva is created"
  await expect(page.getByRole('alert')).toHaveText('Las fechas no pueden estar en el pasado');
  expect(mias.reservas).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Reservar material' })).toBeVisible();
  await captura(page, testInfo, 'AC-003-05', { ve: ['Las fechas no pueden estar en el pasado'] });
});

test('REQ-F-003 AC6 · AC-003-06 reservar «Cuerda» del 2026-12-10 al 2026-12-09 se rechaza por fechas invertidas', async ({ page }, testInfo) => {
  sembrar({ unidades: { Cuerda: 2 } });
  await narrar(page, testInfo, 'Lucía entra y reserva una cuerda desde el 10 hasta el 9 de diciembre');
  await entrarComo(page, 'lucia@club.es', 'Cumbre2026');
  await reservar(page, 'Cuerda', '2026-12-10', '2026-12-09');
  await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «La fecha final no puede ser anterior a la inicial».', { criterio: 'AC-003-06' });
  // REQ-F-003 AC6: "…THEN the user sees "La fecha final no puede ser anterior a la inicial""
  await expect(page.getByRole('alert')).toHaveText('La fecha final no puede ser anterior a la inicial');
  await expect(page.getByRole('heading', { name: 'Reservar material' })).toBeVisible();
  await captura(page, testInfo, 'AC-003-06', { ve: ['La fecha final no puede ser anterior a la inicial'] });
});

test('REQ-F-003 AC7 · AC-003-07 reservar «Cuerda» del 2026-12-10 al 2026-12-25 (16 días) se rechaza', async ({ page }, testInfo) => {
  sembrar({ unidades: { Cuerda: 2 } });
  await narrar(page, testInfo, 'Lucía entra y reserva una cuerda del 10 al 25 de diciembre, 16 días');
  await entrarComo(page, 'lucia@club.es', 'Cumbre2026');
  await reservar(page, 'Cuerda', '2026-12-10', '2026-12-25');
  const mias = await (await page.request.get('/api/mis-reservas')).json();
  await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «Máximo 14 días por reserva» y no se crea ninguna reserva.', { criterio: 'AC-003-07' });
  // REQ-F-003 AC7: "…THEN the user sees "Máximo 14 días por reserva" and no reserva is created"
  await expect(page.getByRole('alert')).toHaveText('Máximo 14 días por reserva');
  expect(mias.reservas).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Reservar material' })).toBeVisible();
  await captura(page, testInfo, 'AC-003-07', { ve: ['Máximo 14 días por reserva'] });
});

test('REQ-F-003 AC8 · AC-003-08 Lucía con una multa pendiente de 4 € no puede reservar «Casco»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Casco: 2 }, multas: [{ socio: 'lucia', importeEur: 4 }] });
  await narrar(page, testInfo, 'Lucía, que debe una multa de 4 euros, entra y reserva un casco');
  await entrarComo(page, 'lucia@club.es', 'Cumbre2026');
  await reservar(page, 'Casco', '2026-12-05', '2026-12-06');
  const mias = await (await page.request.get('/api/mis-reservas')).json();
  await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar» y no se crea ninguna reserva.', { criterio: 'AC-003-08' });
  // REQ-F-003 AC8: "…THEN the user sees "Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar" and no reserva is created"
  await expect(page.getByRole('alert')).toHaveText('Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar');
  expect(mias.reservas).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Reservar material' })).toBeVisible();
  await captura(page, testInfo, 'AC-003-08', { ve: ['Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar'] });
});

test('REQ-F-003 AC9 · AC-003-09 Pablo con una multa pendiente de 2 € no puede reservar «Casco»', async ({ page }, testInfo) => {
  sembrar({ unidades: { Casco: 2 }, multas: [{ socio: 'pablo', importeEur: 2 }] });
  await narrar(page, testInfo, 'Pablo, que debe una multa de 2 euros, entra y reserva un casco');
  await entrarComo(page, 'pablo@club.es', 'Arista2026');
  await reservar(page, 'Casco', '2026-12-05', '2026-12-06');
  await narrar(page, testInfo, 'Reservar material para unas fechas. En Reservar se ve «Tienes una multa pendiente de 2 €. Págala al encargado para poder reservar».', { criterio: 'AC-003-09' });
  // REQ-F-003 AC9: "…THEN the user sees "Tienes una multa pendiente de 2 €. Págala al encargado para poder reservar""
  await expect(page.getByRole('alert')).toHaveText('Tienes una multa pendiente de 2 €. Págala al encargado para poder reservar');
  await expect(page.getByRole('heading', { name: 'Reservar material' })).toBeVisible();
  await captura(page, testInfo, 'AC-003-09', { ve: ['Tienes una multa pendiente de 2 €. Págala al encargado para poder reservar'] });
});

test('REQ-F-003 AC10 · AC-003-10 dos socios envían a la vez por el último «Crampones»: solo se crea una reserva', async ({ page, browser }, testInfo) => {
  sembrar({ unidades: { Crampones: 1 } });
  const otro = await (await browser.newContext({ baseURL: testInfo.project.use.baseURL, locale: 'es-ES' })).newPage();
  await narrar(page, testInfo, 'Lucía y Pablo entran a la vez y preparan la misma reserva del último par de crampones');
  for (const [pagina, correo, contrasena] of [[otro, 'pablo@club.es', 'Arista2026'], [page, 'lucia@club.es', 'Cumbre2026']]) {
    await entrarComo(pagina, correo, contrasena);
    await pagina.getByRole('link', { name: 'Reservar' }).click();
    await pagina.getByLabel('Material').selectOption('Crampones');
    await pagina.getByLabel('Desde').fill('2026-12-05');
    await pagina.getByLabel('Hasta').fill('2026-12-07');
  }
  await narrar(page, testInfo, 'Los dos pulsan Reservar al mismo tiempo');
  await Promise.all([otro.getByRole('button', { name: 'Reservar' }).click(), page.getByRole('button', { name: 'Reservar' }).click()]);
  // Una de las dos páginas termina en Mis reservas y la otra se queda en Reservar con el rechazo.
  await expect.poll(async () => (await page.getByRole('alert').count()) + (await otro.getByRole('alert').count())).toBe(1);
  const perdedor = (await page.getByRole('alert').count()) ? page : otro;
  await narrar(perdedor, testInfo, 'Reservar material para unas fechas. En Reservar se ve «No quedan unidades libres de Crampones esas fechas» y solo se crea una reserva.', { criterio: 'AC-003-10' });
  // REQ-F-003 AC10: "…THEN only one reserva is created and the other user sees "No quedan unidades libres de Crampones esas fechas""
  expect(leerAlmacen().reservas.filter((r) => r.tipo === 'Crampones')).toHaveLength(1);
  await expect(perdedor.getByRole('alert')).toHaveText('No quedan unidades libres de Crampones esas fechas');
  await captura(perdedor, testInfo, 'AC-003-10', { ve: ['No quedan unidades libres de Crampones esas fechas'] });
  await otro.context().close();
});

// ───────────── Demo de la FASE-0 (WF-002): el recorrido completo ─────────────

test('WF-002 Demo FASE-0: del acceso al inventario, a las reservas y a Salir', async ({ page, browser }, testInfo) => {
  sembrar();
  const otro = await (await browser.newContext({ baseURL: testInfo.project.use.baseURL, locale: 'es-ES' })).newPage();

  await narrar(page, testInfo, 'Paso 1: se abre la web sin haber entrado y lleva a Entrar');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();

  await narrar(page, testInfo, 'Paso 2: el encargado se equivoca de contraseña cinco veces; la quinta bloquea la cuenta');
  for (let intento = 1; intento <= 5; intento += 1) {
    await entrar(page, 'encargado@club.es', 'mala');
    await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
  }
  await entrar(page, 'encargado@club.es', 'Glaciar2026');
  await expect(page.getByRole('alert')).toHaveText('Cuenta bloqueada. Inténtalo de nuevo en 15 minutos');
  // El reloj de la demo está fijo: «pasan 15 minutos» se provoca terminando el bloqueo en el almacén.
  modificarAlmacen((datos) => { for (const c of datos.cuentas) { c.fallosSeguidos = 0; c.bloqueadaHasta = null; } });

  await narrar(page, testInfo, 'Paso 3: pasado el bloqueo, el encargado entra bien y añade 2 piolets; Inventario muestra 2');
  await entrar(page, 'encargado@club.es', 'Glaciar2026');
  await anadir(page, 'Piolet', 2);
  await expect(page.getByRole('heading', { name: 'Piolet · 2 unidades' })).toBeVisible();
  await page.getByRole('button', { name: 'Salir' }).click();

  await narrar(page, testInfo, 'Paso 4: Lucía entra, ve «Hola, Lucía» en Mis reservas y reserva 1 piolet del 3 al 5 de diciembre');
  await entrar(page, 'lucia@club.es', 'Cumbre2026');
  await expect(page.locator('#saludo')).toHaveText('Hola, Lucía');
  await reservar(page, 'Piolet', '2026-12-03', '2026-12-05');
  await expect(page.getByRole('status')).toHaveText('Reserva creada: Piolet del 2026-12-03 al 2026-12-05');

  await narrar(page, testInfo, 'Paso 5: Pablo, desde otro navegador, reserva el piolet que queda el día 4');
  await entrarComo(otro, 'pablo@club.es', 'Arista2026');
  await reservar(otro, 'Piolet', '2026-12-04', '2026-12-04');
  await expect(otro.getByRole('status')).toHaveText('Reserva creada: Piolet del 2026-12-04 al 2026-12-04');

  await narrar(page, testInfo, 'Paso 6: se recarga la página de Lucía y su reserva sigue; el encargado, desde otro navegador, ve las unidades');
  await page.reload();
  await expect(page.getByRole('row', { name: /Piolet 2026-12-03 2026-12-05/ })).toHaveCount(1);
  await otro.getByRole('button', { name: 'Salir' }).click();
  await entrar(otro, 'encargado@club.es', 'Glaciar2026');
  await expect(otro.getByRole('heading', { name: 'Piolet · 2 unidades' })).toBeVisible();

  await narrar(page, testInfo, 'Paso 7: Lucía pulsa Salir y vuelve atrás: la web pide entrar de nuevo');
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page).toHaveURL(/#\/entrar$/);
  await otro.context().close();
});
