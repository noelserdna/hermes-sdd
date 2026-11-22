// FASE-0 · WF-002 Sesión de acceso: entrar, mantener y cerrar la sesión, crear socios y que todo persista.
// Cada test arranca su propio servidor con almacén y reloj propios (tests/e2e/fixtures/servidor.js).
import { test as base, expect, narrar, captura } from './fixtures/evidence.js';
import { crearServidor, despues, MARTA } from './fixtures/servidor.js';

const test = base.extend({
  servidor: async ({}, use) => {
    const servidor = await crearServidor();
    servidor.sembrar();
    await servidor.arrancar();
    await use(servidor);
    await servidor.parar();
  },
});

const LUCIA = { nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' };
const PABLO = { nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' };

async function entrar(page, correo, contrasena) {
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
}
async function crearSocio(page, { nombre, correo, contrasena }) {
  await page.getByLabel('Nombre').fill(nombre);
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Crear socio' }).click();
}
const titulo = (page) => page.getByRole('heading', { level: 1 });
const filaSocios = (page) => page.getByRole('table', { name: 'Socios' }).getByRole('row');

test.describe('WF-002 Sesión de acceso', () => {
  test('WF-002 AC-002-03 un visitante anónimo abre la dirección de Mis reservas y ve Entrar', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'Un visitante sin sesión abre la dirección de Mis reservas');
    await page.goto(`${servidor.url}/#/reservas`);
    await narrar(page, testInfo, 'Entrar con correo y contraseña. En Entrar se ve «Entrar».', { criterio: 'AC-002-03' });
    // REQ-F-001 AC8: "GIVEN an anonymous visitor WHEN they open the address of "Mis reservas" THEN the user sees the login form"
    await expect(titulo(page)).toHaveText('Entrar');
    await expect(page).toHaveURL(/#\/entrar$/);
    await captura(page, testInfo, 'AC-002-03', { ve: ['Entrar'] });
  });

  test('WF-002 AC-001-01 lucia entra con su correo y su contraseña y ve Material disponible', async ({ page, servidor }, testInfo) => {
    await servidor.socio(LUCIA);
    await narrar(page, testInfo, 'Lucía abre la web, escribe su correo y su contraseña y pulsa Entrar');
    await page.goto(servidor.url);
    await entrar(page, 'lucia@club.test', 'Cumbre2026');
    await narrar(page, testInfo, 'Entrar con correo y contraseña. En Inicio del socio se ve «Material disponible».', { criterio: 'AC-001-01' });
    // REQ-F-001 AC1: "GIVEN the socio "lucia@club.test" with password "Cumbre2026" WHEN she submits them on the login form THEN the user sees the heading "Material disponible""
    await expect(titulo(page)).toHaveText('Material disponible');
    await captura(page, testInfo, 'AC-001-01', { ve: ['Material disponible'] });
  });

  test('WF-002 AC-001-02 marta entra como encargada y ve Panel del encargado', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'Marta, la encargada, abre la web y entra con sus credenciales');
    await page.goto(servidor.url);
    await entrar(page, MARTA.correo, MARTA.contrasena);
    await narrar(page, testInfo, 'Entrar con correo y contraseña. En Inicio del encargado se ve «Panel del encargado».', { criterio: 'AC-001-02' });
    // REQ-F-001 AC2: "GIVEN the encargado "marta@club.test" WHEN she submits her correct credentials THEN the user sees the heading "Panel del encargado""
    await expect(titulo(page)).toHaveText('Panel del encargado');
    await captura(page, testInfo, 'AC-001-02', { ve: ['Panel del encargado'] });
  });

  test('WF-002 AC-001-06 lucia envía una contraseña errónea y ve Correo o contraseña incorrectos', async ({ page, servidor }, testInfo) => {
    await servidor.socio(LUCIA);
    await narrar(page, testInfo, 'Lucía escribe su correo y una contraseña equivocada');
    await page.goto(servidor.url);
    await entrar(page, 'lucia@club.test', 'x');
    await narrar(page, testInfo, 'Entrar con correo y contraseña. En Entrar se ve «Correo o contraseña incorrectos».', { criterio: 'AC-001-06' });
    // REQ-F-001 AC3: "GIVEN "lucia@club.test" WHEN she submits the wrong password "x" THEN the user sees "Correo o contraseña incorrectos""
    await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
    await captura(page, testInfo, 'AC-001-06', { ve: ['Correo o contraseña incorrectos'] });
  });

  test('WF-002 AC-001-07 el quinto fallo de lucia bloquea la cuenta y 10 minutos después la clave buena también se rechaza', async ({ page, servidor }, testInfo) => {
    await servidor.socio(LUCIA);
    await servidor.fallar('lucia@club.test', 4);
    await narrar(page, testInfo, 'Lucía ya ha fallado cuatro veces seguidas y falla una quinta con la contraseña equivocada');
    await page.goto(servidor.url);
    await entrar(page, 'lucia@club.test', 'x');
    await expect(page.getByRole('alert')).toHaveText('Cuenta bloqueada durante 15 minutos');
    await narrar(page, testInfo, 'Pasan diez minutos y Lucía escribe por fin su contraseña correcta');
    await servidor.reiniciar(despues(10));
    await page.goto(servidor.url);
    await entrar(page, 'lucia@club.test', 'Cumbre2026');
    await narrar(page, testInfo, 'Entrar con correo y contraseña. En Entrar se ve «Cuenta bloqueada durante 15 minutos». Y el sexto intento, con la contraseña correcta diez minutos después, también se rechaza.', { criterio: 'AC-001-07' });
    // REQ-F-001 AC4: "GIVEN "lucia@club.test" with 4 failed attempts in a row WHEN she fails a 5th time THEN the user sees "Cuenta bloqueada durante 15 minutos" and a 6th attempt with the correct password 10 minutes later is also rejected"
    await expect(page.getByRole('alert')).toHaveText('Cuenta bloqueada durante 15 minutos');
    await expect(titulo(page)).toHaveText('Entrar');
    await captura(page, testInfo, 'AC-001-07', { ve: ['Cuenta bloqueada durante 15 minutos'] });
  });

  test('WF-002 AC-001-04 lucia bloqueada hace 15 minutos entra con la contraseña correcta y ve Material disponible', async ({ page, servidor }, testInfo) => {
    await servidor.socio(LUCIA);
    await servidor.fallar('lucia@club.test', 5);
    await narrar(page, testInfo, 'Lucía se bloqueó hace quince minutos y vuelve a intentarlo con su contraseña correcta');
    await servidor.reiniciar(despues(15));
    await page.goto(servidor.url);
    await entrar(page, 'lucia@club.test', 'Cumbre2026');
    await narrar(page, testInfo, 'Entrar con correo y contraseña. En Inicio del socio se ve «Material disponible», una vez cumplido el bloqueo de quince minutos.', { criterio: 'AC-001-04' });
    // REQ-F-001 AC5: "GIVEN "lucia@club.test" was blocked 15 minutes ago WHEN she submits the correct password THEN the user sees the heading "Material disponible""
    await expect(titulo(page)).toHaveText('Material disponible');
    await captura(page, testInfo, 'AC-001-04', { ve: ['Material disponible'] });
  });

  test('WF-002 AC-002-05 la sesión de lucia sin actividad durante 30 minutos caduca y ve Sesión caducada, vuelve a entrar', async ({ page, servidor }, testInfo) => {
    await servidor.socio(LUCIA);
    await narrar(page, testInfo, 'Lucía entra y deja la web abierta sin tocar nada');
    await page.goto(servidor.url);
    await entrar(page, 'lucia@club.test', 'Cumbre2026');
    await expect(titulo(page)).toHaveText('Material disponible');
    await servidor.reiniciar(despues(30, 1));
    await narrar(page, testInfo, 'Pasan treinta minutos sin actividad y Lucía abre otra pantalla');
    await page.reload();
    await narrar(page, testInfo, 'Entrar con correo y contraseña. En Entrar se ve «Sesión caducada, vuelve a entrar».', { criterio: 'AC-002-05' });
    // REQ-F-001 AC6: "GIVEN a session with no activity for 30 minutes WHEN the member opens any screen THEN the user sees the login form with "Sesión caducada, vuelve a entrar""
    await expect(titulo(page)).toHaveText('Entrar');
    await expect(page.getByRole('alert')).toHaveText('Sesión caducada, vuelve a entrar');
    await captura(page, testInfo, 'AC-002-05', { ve: ['Sesión caducada, vuelve a entrar'] });
  });

  test('WF-002 AC-002-01 lucia pulsa Salir y ve Entrar; al volver a una pantalla de socio vuelve a ver Entrar', async ({ page, servidor }, testInfo) => {
    await servidor.socio(LUCIA);
    await narrar(page, testInfo, 'Lucía entra y abre Mis reservas');
    await page.goto(`${servidor.url}/#/reservas`);
    await entrar(page, 'lucia@club.test', 'Cumbre2026');
    await expect(titulo(page)).toHaveText('Material disponible');
    await page.goto(`${servidor.url}/#/reservas`);
    await expect(titulo(page)).toHaveText('Mis reservas');
    await narrar(page, testInfo, 'Lucía pulsa Salir');
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(titulo(page)).toHaveText('Entrar');
    await narrar(page, testInfo, 'Lucía intenta volver atrás a Mis reservas');
    // La app comprueba la sesión al abrir una pantalla de socio: se espera a esa respuesta y a que lleve a Entrar,
    // no a lo que quedaba en pantalla (que ya era Entrar y pasaría aunque se viera Mis reservas).
    const comprobacion = page.waitForResponse((r) => r.url().endsWith('/api/comprobarSesion'));
    await page.goBack();
    expect((await comprobacion).status()).toBe(401);
    await expect(page).toHaveURL(/#\/entrar$/);
    await narrar(page, testInfo, 'Entrar con correo y contraseña. En Entrar se ve «Entrar». Y al volver a una pantalla de socio se vuelve a ver el formulario Entrar.', { criterio: 'AC-002-01' });
    // REQ-F-001 AC7: "GIVEN a signed-in member WHEN she presses "Salir" THEN the user sees the login form and going back to a member screen shows the login form again"
    await expect(titulo(page)).toHaveText('Entrar');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    // «going back to a member screen shows the login form again»: ni «Mis reservas» ni «Salir» siguen a la vista
    await expect(page.getByRole('button', { name: 'Salir' })).toHaveCount(0);
    await expect(page.getByText('Mis reservas')).toHaveCount(0);
    await expect(page.getByLabel('Correo')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
    // Y la dirección de una pantalla de socio, abierta de nuevo tras salir, también lleva a Entrar.
    await page.goto(`${servidor.url}/#/reservas`);
    await expect(titulo(page)).toHaveText('Entrar');
    await expect(page.getByRole('button', { name: 'Salir' })).toHaveCount(0);
    await expect(page).toHaveURL(/#\/entrar$/);
    await captura(page, testInfo, 'AC-002-01', { ve: ['Entrar'] });
  });

  test('WF-002 AC-001-08 pablo dado de baja envía su contraseña correcta y ve Correo o contraseña incorrectos', async ({ page, servidor }, testInfo) => {
    await servidor.socio(PABLO);
    servidor.ponerEnBaja('pablo@club.test');
    await narrar(page, testInfo, 'Pablo, que está dado de baja, escribe su correo y su contraseña correcta');
    await page.goto(servidor.url);
    await entrar(page, 'pablo@club.test', 'Nieve2026');
    await narrar(page, testInfo, 'Entrar con correo y contraseña. En Entrar se ve «Correo o contraseña incorrectos».', { criterio: 'AC-001-08' });
    // REQ-F-001 AC9: "GIVEN a deactivated member "pablo@club.test" WHEN he submits his correct password THEN the user sees "Correo o contraseña incorrectos""
    await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
    await captura(page, testInfo, 'AC-001-08', { ve: ['Correo o contraseña incorrectos'] });
  });

  test('WF-002 AC-003-01 el encargado crea a Pablo Ruiz y lo ve en Socios, también tras recargar y reiniciar el servidor', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'Marta entra y abre Socios desde el menú');
    await page.goto(servidor.url);
    await entrar(page, MARTA.correo, MARTA.contrasena);
    await page.getByRole('link', { name: 'Socios' }).click();
    await expect(titulo(page)).toHaveText('Socios');
    await narrar(page, testInfo, 'Marta escribe el nombre, el correo y la contraseña del nuevo socio y pulsa Crear socio');
    await crearSocio(page, PABLO);
    await narrar(page, testInfo, 'Gestionar las cuentas de socios. En Socios se ve «Pablo Ruiz».', { criterio: 'AC-003-01' });
    // REQ-F-002 AC1: "GIVEN the encargado WHEN he creates the member "Pablo Ruiz", "pablo@club.test", password "Nieve2026" THEN the user sees "Pablo Ruiz" in the list of socios"
    await expect(filaSocios(page).filter({ hasText: 'Pablo Ruiz' })).toContainText('pablo@club.test');
    await captura(page, testInfo, 'AC-003-01', { ve: ['Pablo Ruiz'] });
    await narrar(page, testInfo, 'Se recarga la página y se reinicia el servidor: Pablo Ruiz sigue en la lista');
    await servidor.reiniciar(despues(1));
    await page.reload();
    await expect(filaSocios(page).filter({ hasText: 'Pablo Ruiz' })).toHaveCount(1);
  });

  test('WF-002 AC-003-04 el encargado crea un socio con la contraseña corta1 y ve el aviso de 8 caracteres', async ({ page, servidor }, testInfo) => {
    await narrar(page, testInfo, 'Marta entra, abre Socios y rellena el alta con una contraseña de seis caracteres');
    await page.goto(`${servidor.url}/#/socios`);
    await entrar(page, MARTA.correo, MARTA.contrasena);
    await expect(titulo(page)).toHaveText('Panel del encargado');
    await page.getByRole('link', { name: 'Socios' }).click();
    await crearSocio(page, { ...PABLO, contrasena: 'corta1' });
    await narrar(page, testInfo, 'Gestionar las cuentas de socios. En Socios se ve «La contraseña debe tener al menos 8 caracteres». Y no se crea ningún socio.', { criterio: 'AC-003-04' });
    // REQ-F-002 AC2: "GIVEN the encargado WHEN he creates a member with password "corta1" (6 characters) THEN the user sees "La contraseña debe tener al menos 8 caracteres" and no member is created"
    await expect(page.getByRole('alert')).toHaveText('La contraseña debe tener al menos 8 caracteres');
    // REQ-F-002 AC2 cláusula: "no member is created"
    await expect(filaSocios(page).filter({ hasText: 'pablo@club.test' })).toHaveCount(0);
    await captura(page, testInfo, 'AC-003-04', { ve: ['La contraseña debe tener al menos 8 caracteres'] });
  });

  test('WF-002 AC-003-05 el encargado crea otro socio con el correo pablo@club.test y ve que ya existe', async ({ page, servidor }, testInfo) => {
    await servidor.socio(PABLO);
    await narrar(page, testInfo, 'Marta abre Socios, donde ya está Pablo, y da de alta a otro socio con el mismo correo');
    await page.goto(servidor.url);
    await entrar(page, MARTA.correo, MARTA.contrasena);
    await page.getByRole('link', { name: 'Socios' }).click();
    await crearSocio(page, { nombre: 'Otro Pablo', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
    await narrar(page, testInfo, 'Gestionar las cuentas de socios. En Socios se ve «Ya existe un socio con ese correo». Y la lista sigue con un solo pablo@club.test.', { criterio: 'AC-003-05' });
    // REQ-F-002 AC3: "GIVEN "pablo@club.test" already exists WHEN the encargado creates another member with the same email THEN the user sees "Ya existe un socio con ese correo" and the list keeps a single "pablo@club.test""
    await expect(page.getByRole('alert')).toHaveText('Ya existe un socio con ese correo');
    // REQ-F-002 AC3 cláusula: "the list keeps a single "pablo@club.test""
    await expect(filaSocios(page).filter({ hasText: 'pablo@club.test' })).toHaveCount(1);
    await captura(page, testInfo, 'AC-003-05', { ve: ['Ya existe un socio con ese correo'] });
  });

  test('WF-002 AC-003-06 un socio abre la dirección de Socios y ve Acceso no permitido', async ({ page, servidor }, testInfo) => {
    await servidor.socio(LUCIA);
    await narrar(page, testInfo, 'Lucía, que es socia, entra y escribe a mano la dirección de Socios');
    await page.goto(servidor.url);
    await entrar(page, 'lucia@club.test', 'Cumbre2026');
    await expect(titulo(page)).toHaveText('Material disponible');
    await page.goto(`${servidor.url}/#/socios`);
    await narrar(page, testInfo, 'Gestionar las cuentas de socios. En Socios se ve «Acceso no permitido».', { criterio: 'AC-003-06' });
    // REQ-F-002 AC7: "GIVEN a socio session WHEN the socio opens the address of "Socios" THEN the user sees "Acceso no permitido""
    await expect(titulo(page)).toHaveText('Acceso no permitido');
    await captura(page, testInfo, 'AC-003-06', { ve: ['Acceso no permitido'] });
  });
});
