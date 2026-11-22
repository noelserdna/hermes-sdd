# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fase-0.spec.js >> FASE-0 · Datos en el servidor (ADR-DRAFT-002) >> FASE-0 el material cargado por el encargado sigue en el servidor tras pararlo y arrancarlo
- Location: tests/e2e/fase-0.spec.js:320:3

# Error details

```
Error: page.goto: net::ERR_ABORTED at http://127.0.0.1:5175/material
Call log:
  - navigating to "http://127.0.0.1:5175/material", waiting until "load"

```

# Test source

```ts
  253 |   test('AC-016-03 REQ-F-007 AC5 repetir la baja de la única «Cuerda» da «No hay tantas unidades para dar de baja» y sigue «Cuerda: 0 unidades»', async ({ page }, testInfo) => {
  254 |     await reiniciar({ material: [{ nombre: 'Cuerda', total: 1 }], reservas: [] });
  255 |     await page.goto('/mis-reservas');
  256 |     await narrar(page, testInfo, 'Pablo entra como encargado y abre Material, donde queda 1 unidad de Cuerda');
  257 |     await escribirCredenciales(page, ...PABLO);
  258 |     await irAMaterial(page);
  259 |     await narrar(page, testInfo, 'Pablo da de baja la única Cuerda y confirma; el stock queda a 0');
  260 |     await page.getByLabel('Cantidad de Cuerda').fill('1');
  261 |     await filaDe(page, 'Cuerda: 1 unidades').getByRole('button', { name: 'Dar de baja' }).click();
  262 |     await page.getByRole('button', { name: 'Confirmar' }).click();
  263 |     await expect(filaDe(page, 'Cuerda: 0 unidades')).toBeVisible();
  264 |     await narrar(page, testInfo, 'Pablo envía la misma baja otra vez');
  265 |     await page.getByLabel('Cantidad de Cuerda').fill('1');
  266 |     await filaDe(page, 'Cuerda: 0 unidades').getByRole('button', { name: 'Dar de baja' }).click();
  267 |     await page.getByRole('button', { name: 'Confirmar' }).click();
  268 |     // REQ-F-007 AC5: "GIVEN "Cuerda" has 1 unit and none lent or reserved, and the encargado just withdrew it (stock 0) WHEN the same withdrawal is submitted again THEN the user sees "No hay tantas unidades para dar de baja" and "Cuerda: 0 unidades""
  269 |     await expect(page.getByRole('alert')).toHaveText('No hay tantas unidades para dar de baja');
  270 |     await expect(filaDe(page, 'Cuerda: 0 unidades')).toBeVisible();
  271 |     await narrar(page, testInfo, 'Inventario. En Material se ve «No hay tantas unidades para dar de baja» y «Cuerda: 0 unidades».', { criterio: 'AC-016-03' });
  272 |     await captura(page, testInfo, 'AC-016-03', { ve: ['No hay tantas unidades para dar de baja', 'Cuerda: 0 unidades'] });
  273 |   });
  274 | 
  275 |   test('AC-007-10 REQ-F-007 AC6 con «Casco» a 6 y «Cuerda» a 0, un socio abre Reservar y ve «Casco» entre los tipos sin que se ofrezca «Cuerda»', async ({ page }, testInfo) => {
  276 |     await reiniciar({ material: [{ nombre: 'Casco', total: 6 }, { nombre: 'Cuerda', total: 0 }], reservas: [] });
  277 |     await page.goto('/mis-reservas');
  278 |     await narrar(page, testInfo, 'Lucía entra como socia y abre Reservar; hay 6 cascos y la cuerda está a 0');
  279 |     await escribirCredenciales(page, ...LUCIA);
  280 |     await page.getByRole('navigation').getByRole('link', { name: 'Reservar' }).click();
  281 |     await expect(page.getByRole('heading', { name: 'Reservar', level: 1 })).toBeVisible();
  282 |     // REQ-F-007 AC6: "GIVEN "Casco" with 6 units and "Cuerda" with 0 units WHEN a socio opens "Reservar" THEN the user sees "Casco" among the types and "Cuerda" does not offer reservation"
  283 |     const ofrecidos = page.getByRole('list', { name: 'Material' }).getByRole('listitem');
  284 |     await expect(ofrecidos.filter({ hasText: 'Casco' })).toHaveCount(1);
  285 |     await expect(ofrecidos.filter({ hasText: 'Cuerda' })).toHaveCount(0);
  286 |     await expect(page.getByText('Sin unidades por ahora: Cuerda')).toBeVisible();
  287 |     await narrar(page, testInfo, 'Inventario. En Reservar se ve «Casco» entre los tipos, y «Cuerda», que está sin unidades, no se ofrece.', { criterio: 'AC-007-10' });
  288 |     await captura(page, testInfo, 'AC-007-10', { ve: ['Casco', 'Cuerda'] });
  289 |   });
  290 | });
  291 | 
  292 | test.describe('FASE-0 · Datos en el servidor (ADR-DRAFT-002)', () => {
  293 |   const PUERTO = 5175;
  294 |   const BASE = `http://127.0.0.1:${PUERTO}`;
  295 |   let servidor = null;
  296 | 
  297 |   const parar = () => {
  298 |     if (!servidor) return;
  299 |     try { process.kill(-servidor.pid); } catch { /* ya parado */ }
  300 |     servidor = null;
  301 |   };
  302 |   async function arrancar(fichero) {
  303 |     servidor = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PUERTO), '--strictPort'], {
  304 |       detached: true, stdio: 'ignore', env: { ...process.env, MM_DATOS: fichero, MM_HOY: HOY },
  305 |     });
  306 |     for (let i = 0; i < 100; i++) {
  307 |       try { if ((await fetch(`${BASE}/api/sesion`)).status === 401) return; } catch { /* aún no escucha */ }
  308 |       await new Promise((r) => setTimeout(r, 200));
  309 |     }
  310 |     throw new Error('El servidor no arrancó');
  311 |   }
  312 |   const esperarParado = async () => {
  313 |     for (let i = 0; i < 50; i++) {
  314 |       try { await fetch(`${BASE}/api/sesion`); } catch { return; }
  315 |       await new Promise((r) => setTimeout(r, 100));
  316 |     }
  317 |   };
  318 |   test.afterEach(() => parar());
  319 | 
  320 |   test('FASE-0 el material cargado por el encargado sigue en el servidor tras pararlo y arrancarlo', async ({ page }, testInfo) => {
  321 |     const fichero = path.resolve('data/e2e/reinicio.json');
  322 |     await sembrar(fichero, { hoy: HOY });   // Lucía, Pablo, Elena, 3 «Casco» y una reserva de 2 «Casco»
  323 |     await arrancar(fichero);
  324 | 
  325 |     await page.goto(`${BASE}/mis-reservas`);
  326 |     await narrar(page, testInfo, 'Pablo, el encargado, entra en el club');
  327 |     await escribirCredenciales(page, ...PABLO);
  328 |     await page.getByRole('navigation').getByRole('link', { name: 'Material' }).click();
  329 |     await expect(filaDe(page, 'Casco: 3 unidades')).toBeVisible();
  330 | 
  331 |     await narrar(page, testInfo, 'Pablo da de alta 2 piolets, un tipo nuevo');
  332 |     await page.getByLabel('Nombre').fill('Piolet');
  333 |     await page.getByLabel('Unidades').fill('2');
  334 |     await page.getByRole('button', { name: 'Añadir tipo' }).click();
  335 |     await expect(filaDe(page, 'Piolet: 2 unidades')).toBeVisible();
  336 | 
  337 |     await narrar(page, testInfo, 'Intenta dar de baja 3 cascos, pero 2 están reservados: la web se lo impide');
  338 |     await page.getByLabel('Cantidad de Casco').fill('3');
  339 |     await filaDe(page, 'Casco: 3 unidades').getByRole('button', { name: 'Dar de baja' }).click();
  340 |     await page.getByRole('button', { name: 'Confirmar' }).click();
  341 |     await expect(page.getByRole('alert')).toContainText('No se puede dar de baja: hay 2 unidades de Casco necesarias el 2026-12-05');
  342 | 
  343 |     await narrar(page, testInfo, 'Da de baja solo 1 casco roto y quedan 2');
  344 |     await page.getByLabel('Cantidad de Casco').fill('1');
  345 |     await filaDe(page, 'Casco: 3 unidades').getByRole('button', { name: 'Dar de baja' }).click();
  346 |     await page.getByRole('button', { name: 'Confirmar' }).click();
  347 |     await expect(filaDe(page, 'Casco: 2 unidades')).toBeVisible();
  348 | 
  349 |     await narrar(page, testInfo, 'Se para el servidor y se vuelve a arrancar');
  350 |     parar();
  351 |     await esperarParado();
  352 |     await arrancar(fichero);
> 353 |     await page.goto(`${BASE}/material`);
      |                ^ Error: page.goto: net::ERR_ABORTED at http://127.0.0.1:5175/material
  354 |     await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
  355 |     await narrar(page, testInfo, 'Las sesiones se cierran al reiniciar: Pablo vuelve a entrar y abre Material');
  356 |     await escribirCredenciales(page, ...PABLO);
  357 |     await page.getByRole('navigation').getByRole('link', { name: 'Material' }).click();
  358 |     await expect(filaDe(page, 'Piolet: 2 unidades')).toBeVisible();
  359 |     await expect(filaDe(page, 'Casco: 2 unidades')).toBeVisible();
  360 |     await narrar(page, testInfo, 'Siguen ahí los 2 piolets y los 2 cascos: los datos viven en el servidor');
  361 |   });
  362 | });
  363 | 
```