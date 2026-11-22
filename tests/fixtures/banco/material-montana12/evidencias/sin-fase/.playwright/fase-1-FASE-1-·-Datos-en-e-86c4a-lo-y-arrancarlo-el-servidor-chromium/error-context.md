# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fase-1.spec.js >> FASE-1 · Datos en el servidor (SPEC-PERF-002) >> FASE-1 la reserva de Lucía sigue en Mis reservas tras pararlo y arrancarlo el servidor
- Location: tests/e2e/fase-1.spec.js:320:3

# Error details

```
Error: page.goto: net::ERR_ABORTED at http://127.0.0.1:5176/mis-reservas
Call log:
  - navigating to "http://127.0.0.1:5176/mis-reservas", waiting until "load"

```

# Test source

```ts
  225 |     await captura(page, testInfo, 'AC-008-02', { ve: ['No se puede cancelar: empieza hoy'] });
  226 |   });
  227 | 
  228 |   test('AC-008-03 REQ-F-004 AC5 una socia nueva sin reservas abre Mis reservas y ve «Aún no tienes reservas»', async ({ page }, testInfo) => {
  229 |     await reiniciar();
  230 |     await narrar(page, testInfo, 'Lucía, socia nueva, entra al club y abre Mis reservas');
  231 |     await entrar(page, LUCIA);
  232 |     // REQ-F-004 AC5: "GIVEN a new socio without reservations WHEN she opens "Mis reservas" THEN the user sees "Aún no tienes reservas""
  233 |     await expect(page.locator('.vacio')).toHaveText('Aún no tienes reservas');
  234 |     await narrar(page, testInfo, 'Mis reservas y cancelar. En Mis reservas se ve «Aún no tienes reservas».', { criterio: 'AC-008-03' });
  235 |     await captura(page, testInfo, 'AC-008-03', { ve: ['Aún no tienes reservas'] });
  236 |   });
  237 | 
  238 |   test('AC-008-04 REQ-F-004 AC6 Pablo, sin reservas mientras Lucía tiene una, abre Mis reservas y ve «Aún no tienes reservas»', async ({ page }, testInfo) => {
  239 |     await reiniciar({ reservas: [LUCIA_CASCO] });
  240 |     await narrar(page, testInfo, 'Lucía tiene una reserva de casco; Pablo no tiene ninguna. Pablo entra y abre Mis reservas');
  241 |     await entrar(page, PABLO);
  242 |     // REQ-F-004 AC6: "GIVEN Pablo is a socio with no reservations while Lucía has one WHEN he opens "Mis reservas" THEN the user sees "Aún no tienes reservas""
  243 |     await expect(page.locator('.vacio')).toHaveText('Aún no tienes reservas');
  244 |     await expect(page.getByText('Casco')).toHaveCount(0);
  245 |     await narrar(page, testInfo, 'Mis reservas y cancelar. En Mis reservas se ve «Aún no tienes reservas», sin la reserva de Lucía.', { criterio: 'AC-008-04' });
  246 |     await captura(page, testInfo, 'AC-008-04', { ve: ['Aún no tienes reservas'] });
  247 |   });
  248 | 
  249 |   test('AC-009-01 REQ-F-004 AC2 hoy es 2026-12-04 y Lucía cancela su reserva del 2026-12-05: ve «Reserva cancelada», su estado «Cancelada» y sus unidades libres', async ({ page }, testInfo) => {
  250 |     await reiniciar({ hoy: '2026-12-04', reservas: [LUCIA_CASCO] });   // «Casco» a 6 y 2 reservadas por Lucía
  251 |     await narrar(page, testInfo, 'Hoy es 4 de diciembre. Lucía abre Mis reservas y pulsa Cancelar en su reserva del 5 al 7');
  252 |     await entrar(page, LUCIA);
  253 |     await page.getByRole('button', { name: 'Cancelar' }).click();
  254 |     // REQ-F-004 AC2: "GIVEN today is 2026-12-04 and her reservation starts 2026-12-05 WHEN Lucía presses "Cancelar" THEN the user sees "Reserva cancelada", its state "Cancelada" and its units become free"
  255 |     await expect(aviso(page, 'Reserva cancelada')).toBeVisible();
  256 |     await expect(fila(page, '2 × Casco del 2026-12-05 al 2026-12-07 — Cancelada')).toBeVisible();
  257 |     await narrar(page, testInfo, 'Las 2 unidades han quedado libres: Lucía reserva ahora 5 cascos esos mismos días, algo que antes no cabía');
  258 |     await abrirReservar(page);
  259 |     await reservarCon(page, { cantidad: 5, inicio: '2026-12-05', fin: '2026-12-07' });
  260 |     await expect(aviso(page, 'Reserva creada: 5 × Casco del 2026-12-05 al 2026-12-07')).toBeVisible();
  261 |     await narrar(page, testInfo, 'Mis reservas y cancelar. En Mis reservas se ve «Reserva cancelada», «2 × Casco del 2026-12-05 al 2026-12-07 — Cancelada» y «Reserva creada: 5 × Casco del 2026-12-05 al 2026-12-07»: la reserva queda Cancelada y sus unidades, libres.', { criterio: 'AC-009-01' });
  262 |     await captura(page, testInfo, 'AC-009-01', { ve: ['Reserva cancelada', '2 × Casco del 2026-12-05 al 2026-12-07 — Cancelada', 'Reserva creada: 5 × Casco del 2026-12-05 al 2026-12-07'] });
  263 |   });
  264 | 
  265 |   test('AC-009-02 REQ-F-004 AC3 Lucía repite «Cancelar» desde una pestaña vieja y ve «La reserva ya estaba cancelada»; las unidades no se liberan dos veces', async ({ page }, testInfo) => {
  266 |     await reiniciar({ hoy: '2026-12-04', reservas: [LUCIA_CASCO] });
  267 |     await narrar(page, testInfo, 'Lucía tiene abierta Mis reservas con su reserva del 5 al 7 de diciembre');
  268 |     await entrar(page, LUCIA);
  269 |     await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  270 |     // La misma reserva se cancela desde otra pestaña y Pablo reserva 5 cascos esos días: la pantalla de Lucía se ha quedado vieja
  271 |     const otraLucia = await apiComo(LUCIA);
  272 |     const { reservas } = await (await otraLucia.get('/api/mis-reservas')).json();
  273 |     expect((await otraLucia.post(`/api/reservas/${reservas[0].id}/cancelar`, { data: {} })).ok()).toBe(true);
  274 |     const otroPablo = await apiComo(PABLO);
  275 |     expect((await otroPablo.post('/api/reservas', { data: { materialId: 'm-casco', cantidad: 5, inicio: '2026-12-05', fin: '2026-12-07' } })).ok()).toBe(true);
  276 |     await narrar(page, testInfo, 'La reserva ya está cancelada desde otra pestaña y Pablo ha reservado 5 cascos esos días. Lucía pulsa Cancelar en su pestaña vieja');
  277 |     await page.getByRole('button', { name: 'Cancelar' }).click();
  278 |     await expect(aviso(page, 'La reserva ya estaba cancelada')).toBeVisible();
  279 |     await narrar(page, testInfo, 'Lucía pide ahora 2 cascos esos días');
  280 |     await abrirReservar(page);
  281 |     await reservarCon(page, { cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' });
  282 |     // REQ-F-004 AC3: "GIVEN the reservation was just cancelled WHEN "Cancelar" is submitted again THEN the user sees "La reserva ya estaba cancelada" and the units are not freed twice"
  283 |     await expect(page.getByRole('alert')).toHaveText('No hay unidades libres: solo queda 1 de Casco el 2026-12-05');
  284 |     await expect(aviso(page, 'La reserva ya estaba cancelada')).toBeVisible();
  285 |     await narrar(page, testInfo, 'Mis reservas y cancelar. Se ve «La reserva ya estaba cancelada» y «No hay unidades libres: solo queda 1 de Casco el 2026-12-05»: las unidades no se liberan dos veces.', { criterio: 'AC-009-02' });
  286 |     await captura(page, testInfo, 'AC-009-02', { ve: ['La reserva ya estaba cancelada', 'No hay unidades libres: solo queda 1 de Casco el 2026-12-05'] });
  287 |     await otraLucia.dispose();
  288 |     await otroPablo.dispose();
  289 |   });
  290 | });
  291 | 
  292 | test.describe('FASE-1 · Datos en el servidor (SPEC-PERF-002)', () => {
  293 |   const PUERTO = 5176;
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
  320 |   test('FASE-1 la reserva de Lucía sigue en Mis reservas tras pararlo y arrancarlo el servidor', async ({ page }, testInfo) => {
  321 |     const fichero = path.resolve('data/e2e/reinicio-fase-1.json');
  322 |     await sembrar(fichero, { hoy: HOY, cuentas: SOCIOS, material: CASCO_6, reservas: [] });
  323 |     await arrancar(fichero);
  324 |     const entrarAqui = async () => {
> 325 |       await page.goto(`${BASE}/mis-reservas`);
      |                  ^ Error: page.goto: net::ERR_ABORTED at http://127.0.0.1:5176/mis-reservas
  326 |       await page.getByLabel('Correo').fill(LUCIA[0]);
  327 |       await page.getByLabel('Contraseña').fill(LUCIA[1]);
  328 |       await page.getByRole('button', { name: 'Entrar' }).click();
  329 |       await expect(page.getByRole('heading', { name: 'Mis reservas', level: 1 })).toBeVisible();
  330 |     };
  331 |     await narrar(page, testInfo, 'Lucía entra y reserva 2 cascos del 5 al 7 de diciembre');
  332 |     await entrarAqui();
  333 |     await irA(page, 'Reservar');
  334 |     await reservarCon(page, { cantidad: 2, inicio: '2026-12-05', fin: '2026-12-07' });
  335 |     await expect(fila(page, '2 × Casco del 2026-12-05 al 2026-12-07 — Reservada')).toBeVisible();
  336 |     await narrar(page, testInfo, 'Se para el servidor y se vuelve a arrancar');
  337 |     parar();
  338 |     await esperarParado();
  339 |     await arrancar(fichero);
  340 |     await narrar(page, testInfo, 'Las sesiones se cierran al reiniciar: Lucía vuelve a entrar y abre Mis reservas');
  341 |     await entrarAqui();
  342 |     await expect(fila(page, '2 × Casco del 2026-12-05 al 2026-12-07 — Reservada')).toBeVisible();
  343 |     await narrar(page, testInfo, 'Su reserva sigue ahí: los datos viven en el servidor, no en el navegador');
  344 |   });
  345 | });
  346 | 
```