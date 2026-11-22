# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fase-0.spec.js >> FASE-0 · Material (REQ-F-007) >> AC-007-10 REQ-F-007 AC6 con «Casco» a 6 y «Cuerda» a 0, un socio abre Reservar y ve «Casco» entre los tipos sin que se ofrezca «Cuerda»
- Location: tests/e2e/fase-0.spec.js:275:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('button', { name: 'Reservar' })
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" getByRole('button', { name: 'Reservar' }) with timeout 5000ms
  - waiting for getByRole('button', { name: 'Reservar' })
    14 × locator resolved to 1 element
       - unexpected value "1"

```

# Test source

```ts
  188 |     await page.getByLabel('Cantidad de Cuerda').fill('2');
  189 |     await filaDe(page, 'Cuerda: 4 unidades').getByRole('button', { name: 'Añadir', exact: true }).click();
  190 |     // REQ-F-007 AC1: "GIVEN "Cuerda" has 4 units WHEN the encargado adds 2 units THEN the user sees "Cuerda: 6 unidades" in "Material""
  191 |     await expect(filaDe(page, 'Cuerda: 6 unidades')).toBeVisible();
  192 |     await expect(page.getByRole('status')).toHaveText('Cuerda: 6 unidades');
  193 |     await narrar(page, testInfo, 'Inventario. En Material se ve «Cuerda: 6 unidades».', { criterio: 'AC-015-01' });
  194 |     await captura(page, testInfo, 'AC-015-01', { ve: ['Cuerda: 6 unidades'] });
  195 |   });
  196 | 
  197 |   test('AC-015-02 REQ-F-007 AC2 el encargado crea el tipo nuevo «Mosquetón» con 10 unidades y ve «Mosquetón: 10 unidades»', async ({ page }, testInfo) => {
  198 |     await reiniciar({ material: [{ nombre: 'Cuerda', total: 4 }], reservas: [] });
  199 |     await page.goto('/mis-reservas');
  200 |     await narrar(page, testInfo, 'Pablo entra como encargado y abre Material');
  201 |     await escribirCredenciales(page, ...PABLO);
  202 |     await irAMaterial(page);
  203 |     await narrar(page, testInfo, 'Pablo da de alta un tipo nuevo: Mosquetón, con 10 unidades');
  204 |     await page.getByLabel('Nombre').fill('Mosquetón');
  205 |     await page.getByLabel('Unidades').fill('10');
  206 |     await page.getByRole('button', { name: 'Añadir tipo' }).click();
  207 |     // REQ-F-007 AC2: "GIVEN a new type WHEN the encargado adds "Mosquetón" with 10 units THEN the user sees "Mosquetón: 10 unidades""
  208 |     await expect(filaDe(page, 'Mosquetón: 10 unidades')).toBeVisible();
  209 |     await expect(page.getByRole('status')).toHaveText('Mosquetón: 10 unidades');
  210 |     await narrar(page, testInfo, 'Inventario. En Material se ve «Mosquetón: 10 unidades».', { criterio: 'AC-015-02' });
  211 |     await captura(page, testInfo, 'AC-015-02', { ve: ['Mosquetón: 10 unidades'] });
  212 |   });
  213 | 
  214 |   test('AC-016-01 REQ-F-007 AC3 con 6 «Cuerda» libres, el encargado retira 1 rota y ve «Cuerda: 5 unidades»', async ({ page }, testInfo) => {
  215 |     await reiniciar({ material: [{ nombre: 'Cuerda', total: 6 }], reservas: [] });
  216 |     await page.goto('/mis-reservas');
  217 |     await narrar(page, testInfo, 'Pablo entra como encargado y abre Material, donde hay 6 unidades de Cuerda sin reservar');
  218 |     await escribirCredenciales(page, ...PABLO);
  219 |     await irAMaterial(page);
  220 |     await narrar(page, testInfo, 'Pablo escribe 1 en la cantidad de Cuerda, pulsa Dar de baja y confirma');
  221 |     await page.getByLabel('Cantidad de Cuerda').fill('1');
  222 |     await filaDe(page, 'Cuerda: 6 unidades').getByRole('button', { name: 'Dar de baja' }).click();
  223 |     await expect(page.getByText('¿Dar de baja 1 unidades de Cuerda?')).toBeVisible();
  224 |     await page.getByRole('button', { name: 'Confirmar' }).click();
  225 |     // REQ-F-007 AC3: "GIVEN "Cuerda" has 6 units and none lent or reserved WHEN the encargado withdraws 1 broken unit THEN the user sees "Cuerda: 5 unidades""
  226 |     await expect(filaDe(page, 'Cuerda: 5 unidades')).toBeVisible();
  227 |     await expect(page.getByRole('status')).toHaveText('Cuerda: 5 unidades');
  228 |     await narrar(page, testInfo, 'Inventario. En Material se ve «Cuerda: 5 unidades».', { criterio: 'AC-016-01' });
  229 |     await captura(page, testInfo, 'AC-016-01', { ve: ['Cuerda: 5 unidades'] });
  230 |   });
  231 | 
  232 |   test('AC-016-02 REQ-F-007 AC4 con las 2 «Tienda» reservadas el 2026-12-06, retirar 1 da el error con las unidades necesarias y sigue «Tienda: 2 unidades»', async ({ page }, testInfo) => {
  233 |     await reiniciar({
  234 |       material: [{ nombre: 'Tienda', total: 2 }],
  235 |       reservas: [{ socio: 'lucia@club.test', material: 'Tienda', cantidad: 2, inicio: '2026-12-06', fin: '2026-12-06' }],
  236 |     });
  237 |     await page.goto('/mis-reservas');
  238 |     await narrar(page, testInfo, 'Pablo entra como encargado y abre Material, donde hay 2 tiendas y las dos están reservadas el 6 de diciembre');
  239 |     await escribirCredenciales(page, ...PABLO);
  240 |     await irAMaterial(page);
  241 |     await narrar(page, testInfo, 'Pablo intenta dar de baja 1 tienda y confirma');
  242 |     await page.getByLabel('Cantidad de Tienda').fill('1');
  243 |     await filaDe(page, 'Tienda: 2 unidades').getByRole('button', { name: 'Dar de baja' }).click();
  244 |     await page.getByRole('button', { name: 'Confirmar' }).click();
  245 |     // REQ-F-007 AC4: "GIVEN "Tienda" has 2 units, both reserved on 2026-12-06 WHEN the encargado withdraws 1 THEN the user sees "No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06" and "Tienda: 2 unidades""
  246 |     await expect(page.getByRole('alert')).toHaveText('No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06');
  247 |     // REQ-F-007 AC4 cláusula: "and "Tienda: 2 unidades""
  248 |     await expect(filaDe(page, 'Tienda: 2 unidades')).toBeVisible();
  249 |     await narrar(page, testInfo, 'Inventario. En Material se ve «No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06» y «Tienda: 2 unidades».', { criterio: 'AC-016-02' });
  250 |     await captura(page, testInfo, 'AC-016-02', { ve: ['No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06', 'Tienda: 2 unidades'] });
  251 |   });
  252 | 
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
  287 |     // Sin formulario ni botón «Reservar» todavía: llega en FASE-1
> 288 |     await expect(page.getByRole('button', { name: 'Reservar' })).toHaveCount(0);
      |                                                                  ^ Error: expect(locator).toHaveCount(expected) failed
  289 |     await narrar(page, testInfo, 'Inventario. En Reservar se ve «Casco» entre los tipos, y «Cuerda», que está sin unidades, no se ofrece.', { criterio: 'AC-007-10' });
  290 |     await captura(page, testInfo, 'AC-007-10', { ve: ['Casco', 'Cuerda'] });
  291 |   });
  292 | });
  293 | 
  294 | test.describe('FASE-0 · Datos en el servidor (ADR-DRAFT-002)', () => {
  295 |   const PUERTO = 5175;
  296 |   const BASE = `http://127.0.0.1:${PUERTO}`;
  297 |   let servidor = null;
  298 | 
  299 |   const parar = () => {
  300 |     if (!servidor) return;
  301 |     try { process.kill(-servidor.pid); } catch { /* ya parado */ }
  302 |     servidor = null;
  303 |   };
  304 |   async function arrancar(fichero) {
  305 |     servidor = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PUERTO), '--strictPort'], {
  306 |       detached: true, stdio: 'ignore', env: { ...process.env, MM_DATOS: fichero, MM_HOY: HOY },
  307 |     });
  308 |     for (let i = 0; i < 100; i++) {
  309 |       try { if ((await fetch(`${BASE}/api/sesion`)).status === 401) return; } catch { /* aún no escucha */ }
  310 |       await new Promise((r) => setTimeout(r, 200));
  311 |     }
  312 |     throw new Error('El servidor no arrancó');
  313 |   }
  314 |   const esperarParado = async () => {
  315 |     for (let i = 0; i < 50; i++) {
  316 |       try { await fetch(`${BASE}/api/sesion`); } catch { return; }
  317 |       await new Promise((r) => setTimeout(r, 100));
  318 |     }
  319 |   };
  320 |   test.afterEach(() => parar());
  321 | 
  322 |   test('FASE-0 el material cargado por el encargado sigue en el servidor tras pararlo y arrancarlo', async ({ page }, testInfo) => {
  323 |     const fichero = path.resolve('data/e2e/reinicio.json');
  324 |     await sembrar(fichero, { hoy: HOY });   // Lucía, Pablo, Elena, 3 «Casco» y una reserva de 2 «Casco»
  325 |     await arrancar(fichero);
  326 | 
  327 |     await page.goto(`${BASE}/mis-reservas`);
  328 |     await narrar(page, testInfo, 'Pablo, el encargado, entra en el club');
  329 |     await escribirCredenciales(page, ...PABLO);
  330 |     await page.getByRole('navigation').getByRole('link', { name: 'Material' }).click();
  331 |     await expect(filaDe(page, 'Casco: 3 unidades')).toBeVisible();
  332 | 
  333 |     await narrar(page, testInfo, 'Pablo da de alta 2 piolets, un tipo nuevo');
  334 |     await page.getByLabel('Nombre').fill('Piolet');
  335 |     await page.getByLabel('Unidades').fill('2');
  336 |     await page.getByRole('button', { name: 'Añadir tipo' }).click();
  337 |     await expect(filaDe(page, 'Piolet: 2 unidades')).toBeVisible();
  338 | 
  339 |     await narrar(page, testInfo, 'Intenta dar de baja 3 cascos, pero 2 están reservados: la web se lo impide');
  340 |     await page.getByLabel('Cantidad de Casco').fill('3');
  341 |     await filaDe(page, 'Casco: 3 unidades').getByRole('button', { name: 'Dar de baja' }).click();
  342 |     await page.getByRole('button', { name: 'Confirmar' }).click();
  343 |     await expect(page.getByRole('alert')).toContainText('No se puede dar de baja: hay 2 unidades de Casco necesarias el 2026-12-05');
  344 | 
  345 |     await narrar(page, testInfo, 'Da de baja solo 1 casco roto y quedan 2');
  346 |     await page.getByLabel('Cantidad de Casco').fill('1');
  347 |     await filaDe(page, 'Casco: 3 unidades').getByRole('button', { name: 'Dar de baja' }).click();
  348 |     await page.getByRole('button', { name: 'Confirmar' }).click();
  349 |     await expect(filaDe(page, 'Casco: 2 unidades')).toBeVisible();
  350 | 
  351 |     await narrar(page, testInfo, 'Se para el servidor y se vuelve a arrancar');
  352 |     parar();
  353 |     await esperarParado();
  354 |     await arrancar(fichero);
  355 |     await page.goto(`${BASE}/material`);
  356 |     await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
  357 |     await narrar(page, testInfo, 'Las sesiones se cierran al reiniciar: Pablo vuelve a entrar y abre Material');
  358 |     await escribirCredenciales(page, ...PABLO);
  359 |     await page.getByRole('navigation').getByRole('link', { name: 'Material' }).click();
  360 |     await expect(filaDe(page, 'Piolet: 2 unidades')).toBeVisible();
  361 |     await expect(filaDe(page, 'Casco: 2 unidades')).toBeVisible();
  362 |     await narrar(page, testInfo, 'Siguen ahí los 2 piolets y los 2 cascos: los datos viven en el servidor');
  363 |   });
  364 | });
  365 | 
```