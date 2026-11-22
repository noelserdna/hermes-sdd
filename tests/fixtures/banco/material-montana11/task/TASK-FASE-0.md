# Tasks: FASE-0 - Skeleton: entrar, crear socios y que todo persista

> **Input:** plan/fases/FASE-0-SKELETON.md + plan/fase-plans/PLAN-FASE-0.md
> **Generated:** 2026-11-21
> **Total tasks:** 9
> **Parallel capacity:** 1
> **Critical path:** 9 tasks

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 9 |
| Parallelizable | 2 (22%) |
| Work Streams | 1 (A: 5 tasks) |
| Setup phase | 1 tasks |
| Foundation phase | 2 tasks |
| Slices phase | 5 tasks |
| Integration phase | 0 tasks |
| Verification phase | 1 tasks |

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-001 | TASK-F0-004, TASK-F0-005 |
| UC-002 | TASK-F0-006 |
| UC-003 | TASK-F0-007 |
| API-001-01 | TASK-F0-004 |
| API-001-02, API-001-03 | TASK-F0-006 |
| API-001-04, API-001-05 | TASK-F0-007 |
| ADR-001, ADR-005 | TASK-F0-002 |
| ADR-002 | TASK-F0-002 |
| ADR-004 | TASK-F0-002, TASK-F0-003 |
| INV-ACC-001..004 | TASK-F0-004, TASK-F0-007 |
| INV-ACC-005..007 | TASK-F0-004, TASK-F0-006 |
| INV-SEC-001..003 | TASK-F0-004, TASK-F0-007 |
| REQ-F-001 | TASK-F0-004, TASK-F0-005, TASK-F0-006, TASK-F0-009 |
| REQ-F-002 | TASK-F0-007, TASK-F0-009 |
| REQ-C-001, REQ-C-002, REQ-C-003, REQ-NF-001 | TASK-F0-001, TASK-F0-003, TASK-F0-004 |
| WF-002 | TASK-F0-009 |

---

## Phase 1: Setup

**Purpose:** Scaffold desplegable (build, start, vitest, plugin de Vite, README).
**Checkpoint:** `npm run build` y `npm start` funcionan.

- [ ] TASK-F0-001 Scaffold desplegable: vitest, Vite con plugin en dev y preview, start/build/seed, README | `package.json`, `vitest.config.js`, `vite.config.js`, `index.html`, `src/server/plugin.js`, `README.md`
  - **Files:** `.gitignore`
  - **Commit:** `chore(acceso): scaffold desplegable con start, build y plugin de Vite`
  - **Acceptance:**
    - Verify: `npm run build` → termina con código 0 y genera `dist/`
    - Verify: `PORT=4180 HOST=0.0.0.0 npm start` → `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4180/` devuelve `200` y el plugin está registrado también en `configurePreviewServer` (la API se sirve con `npm start`, nunca con el servidor de desarrollo)
    - `vitest.config.js` contiene `test: { maxWorkers: 2 }`; el servidor lee `process.env.PORT` y `process.env.HOST` (por defecto `0.0.0.0`, nunca `127.0.0.1` fijo)
    - `package.json` define `seed` (`node scripts/seed.js`); `README.md` explica instalar (`npm ci`), probar (`npm test`), arrancar (`npm run build && npm start`) y el `seed` del encargado con `SEED_ENCARGADO_CORREO`, `SEED_ENCARGADO_NOMBRE`, `SEED_ENCARGADO_CONTRASENA` (y `SEED_ROL=junta`)
  - **Refs:** FASE-0, REQ-C-001, PLAN-FASE-0 D-PA-002
  - **Revert:** CONFIG — cambia scripts y configuración de Vite/Vitest; revertir deja el proyecto sin arranque en producción
  - **Review:**
    - [ ] `start` nunca lanza el servidor de desarrollo
    - [ ] Ningún host ni puerto fijo en el código
    - [ ] README en español con los comandos reales

---

## Phase 2: Foundation

**Purpose:** Lo que comparten UC-001, UC-002 y UC-003: errores, reloj, almacén, validación y esqueleto de UI.
**Checkpoint:** Foundation tests pass.

- [ ] TASK-F0-002 [P] Errores literales, reloj único, almacén JSON con transacción y validación de entradas | `src/domain/errores.js`, `src/domain/reloj.js`, `src/domain/validacion.js`, `src/server/store.js`, `tests/unit/store.test.js`, `tests/unit/reloj.test.js`
  - **Files:** `tests/unit/validacion.test.js`
  - **Commit:** `feat(acceso): errores, reloj, almacén JSON transaccional y validación`
  - **Acceptance:**
    - Test first: `INT-T-001 el almacén conserva los datos al recrear el store` — escribir una cuenta en `transaccion`, crear otro `crearStore` sobre el mismo archivo y `leer()` la devuelve; el almacén nace con `{version:1, contadores, cuentas, unidades, reservas, multas, sesiones}`
    - Test first: `D-T-003 fallo de escritura` — con `falloEscritura` inyectado la transacción lanza `E_ALMACEN_NO_DISPONIBLE` con el texto "No se pudo guardar. Inténtalo de nuevo" y el almacén queda sin cambios; un `.tmp` residual se ignora
    - Test first: `D-T-001 reloj fijo` — `crearReloj({fijo:'2026-12-05'}).hoy()` devuelve `'2026-12-05'`; `CLOCK_FIXED` se ignora con `NODE_ENV=production`
    - Test first: `validacion rechaza vacíos` — correo sin forma válida o nombre vacío lanza `E_DATOS_INVALIDOS` "Revisa los datos del formulario"; el correo se normaliza a minúsculas
    - `ERRORES` copia los literales de VO-010 (p. ej. `E_NO_AUTENTICADO` → "Entrar")
  - **Refs:** FASE-0, ADR-001, ADR-002, ADR-004, ADR-005, REQ-C-003, INV-SEC-003
  - **Revert:** COUPLED — define el formato del almacén `{version:1,…}` que leen las demás tareas
  - **Review:**
    - [ ] `hoy()` y `ahora()` solo existen en `reloj.js`
    - [ ] La transacción copia, valida y vuelca de una vez

- [ ] TASK-F0-003 [P] Esqueleto de UI: router por hash, textos y errores en español, cabecera con Salir y aviso | `src/ui/main.js`, `src/ui/router.js`, `src/ui/textos.js`, `src/ui/errores.js`, `src/ui/componentes/cabecera.js`, `src/ui/componentes/aviso.js`
  - **Files:** `tests/unit/ui-base.test.js`
  - **Commit:** `feat(acceso): esqueleto de UI con router, textos, cabecera y aviso`
  - **Acceptance:**
    - Test first: `REQ-C-002 textos únicos` — `textos.js` y `errores.js` exportan los literales ("Entrar", "Salir", "Material disponible", "Panel del encargado", "Acceso no permitido") y `errores.js` traduce cada código con el mensaje de `src/domain/errores.js`
    - Test first: `router navega por hash` — cambiar a `#/inicio` monta la pantalla registrada para esa ruta y una ruta desconocida lleva a `#/entrar`
    - Test first: `aviso accesible` — un error se pinta con `role="alert"` y un éxito con `role="status"`, usando `textContent` (un `<b>x</b>` se ve como texto)
    - La cabecera muestra el nombre del usuario y un botón "Salir"
  - **Refs:** FASE-0, REQ-C-001, REQ-C-002, ADR-004
  - **Revert:** SAFE — solo UI nueva sin consumidores previos
  - **Review:**
    - [ ] Ningún literal en español fuera de `textos.js` / `errores.js`
    - [ ] Sin `innerHTML` con datos

---

## Phase 3: Slices

**Purpose:** Un slice vertical por caso de uso, con su test escrito primero.
**Checkpoint:** Every slice's tests green.

### UC-001 — Entrar con correo y contraseña

- [ ] TASK-F0-004 Iniciar sesión con bloqueo a los 5 fallos (API-001-01), test-first | `tests/unit/cuentas.test.js`, `tests/unit/sesiones.test.js`, `tests/api/acceso.test.js`, `src/domain/cuentas.js`, `src/domain/permisos.js`, `src/server/sesiones.js`
  - blocked-by: TASK-F0-002
  - **Files:** `src/server/hash.js`, `src/server/plugin.js`
  - **Commit:** `feat(acceso): iniciar sesión con bloqueo a los 5 fallos y cookie de sesión`
  - **Acceptance:**
    - Test first: `AC-001-06 contraseña errónea` — `iniciarSesion` con clave `x` lanza `E_CREDENCIALES_INVALIDAS` "Correo o contraseña incorrectos"; `AC-001-08 cuenta en Baja` lanza el mismo error
    - Test first: `AC-001-07 quinto fallo bloquea` — al 5.º fallo y con la clave buena después lanza `E_CUENTA_BLOQUEADA` "Cuenta bloqueada durante 15 minutos" en ambos envíos (INV-ACC-004)
    - Test first: `AC-001-04 bloqueo cumplido` — con el reloj falso 15 minutos después la clave `Cumbre2026` abre sesión
    - Test first: `AC-001-05 datos vacíos` — correo o clave vacíos lanzan `E_DATOS_INVALIDOS` y el contador de fallos no cambia
    - Test first: `AC-001-09 almacén caído` — con `falloEscritura` lanza `E_ALMACEN_NO_DISPONIBLE` y no hay sesión
    - Test first: `SEC-T-003 solo hash` — el almacén guarda la contraseña con scrypt (nunca `Cumbre2026` en claro) y ni la respuesta ni el log la contienen (INV-ACC-003)
    - Test first: `SEC-T-004 cookie` — `POST /api/iniciarSesion` fija `sid` HttpOnly SameSite=Strict, `Cache-Control: no-store`, rechaza cuerpo >16 KB y POST sin `Content-Type`
    - `permisos.js` nace con `autorizar(ctx, operacion)` (sesión → rol → validación, D-T-006) y la operación `iniciarSesion` pública
  - **Refs:** FASE-0, REQ-F-001, UC-001, API-001-01, INV-ACC-003, INV-ACC-004, INV-ACC-006, INV-ACC-007, INV-SEC-002, AC-001-04, AC-001-05, AC-001-06, AC-001-07, AC-001-08, AC-001-09, SEC-T-003, SEC-T-004
  - **Revert:** SAFE — añade dominio y API de acceso sin migrar datos
  - **Review:**
    - [ ] The test failed before the implementation
    - [ ] El mismo error para Baja y para clave errónea (no revela si el correo existe)
    - [ ] Nunca se registra la contraseña

- [ ] TASK-F0-005 Pantallas Entrar e Inicio por rol, test-first | `tests/unit/ui-entrar.test.js`, `src/ui/pantallas/entrar.js`, `src/ui/pantallas/inicio.js`
  - blocked-by: TASK-F0-003, TASK-F0-004
  - **Files:** `src/ui/main.js`
  - **Commit:** `feat(acceso): pantallas de entrar e inicio por rol`
  - **Acceptance:**
    - Test first: `AC-001-01 socio entra` — tras entrar el título es "Material disponible"
    - Test first: `AC-001-02 encargado entra` — el título es "Panel del encargado"
    - Test first: `AC-001-03 junta entra` — el título es "Historial del socio" y no hay acciones de escritura
    - Test first: `AC-001-10 envío repetido` — dos pulsaciones seguidas de Entrar envían una sola petición (botón deshabilitado mientras espera)
    - Un error del servidor se muestra con `role="alert"` ("Correo o contraseña incorrectos", "Cuenta bloqueada durante 15 minutos")
  - **Refs:** FASE-0, REQ-F-001, UC-001, AC-001-01, AC-001-02, AC-001-03, AC-001-10
  - **Revert:** SAFE — pantallas nuevas
  - **Review:**
    - [ ] The test failed before the implementation
    - [ ] Los textos salen de `textos.js` y `errores.js`

### UC-002 — Mantener y cerrar la sesión

- [ ] TASK-F0-006 Cerrar y comprobar sesión con caducidad a 30 min y Mis reservas mínima (API-001-02, API-001-03), test-first | `tests/unit/ui-mis-reservas.test.js`, `tests/api/sesion.test.js`, `src/domain/cuentas.js`, `src/server/plugin.js`, `src/ui/pantallas/mis-reservas.js`
  - blocked-by: TASK-F0-005
  - **Files:** `tests/unit/cuentas.test.js`, `src/server/sesiones.js`
  - **Commit:** `feat(acceso): cerrar y comprobar sesión con caducidad y ruta mínima de Mis reservas`
  - **Acceptance:**
    - Test first: `AC-002-01 Salir` — "Salir" invalida la sesión y se ve el formulario "Entrar"
    - Test first: `AC-002-02 volver atrás` — con la sesión cerrada, la operación devuelve `E_NO_AUTENTICADO` y se ve "Entrar"
    - Test first: `AC-002-03 anónimo en #/reservas` — sin sesión `#/reservas` muestra "Entrar" (REQ-F-001 AC8); un socio ve la cabecera y el título "Mis reservas"
    - Test first: `AC-002-05 caducidad` — a los 30 min sin actividad `comprobarSesion` lanza `E_SESION_CADUCADA` "Sesión caducada, vuelve a entrar"
    - Test first: `AC-002-04 la actividad renueva` — una operación válida a los 29 min mantiene viva la sesión (INV-ACC-005)
    - Test first: `AC-002-06 / AC-002-07` — salir dos veces o con almacén caído no rompe: segundo `E_NO_AUTENTICADO`; con almacén caído `E_ALMACEN_NO_DISPONIBLE` sin renovar actividad
    - `cerrarSesion` y `comprobarSesion` admiten socio, encargado y junta (D-PA-004; exentas de INV-SEC-002)
  - **Refs:** FASE-0, REQ-F-001, UC-002, API-001-02, API-001-03, INV-ACC-005, INV-ACC-007, D-PA-004, D-PA-020, AC-002-01, AC-002-02, AC-002-03, AC-002-04, AC-002-05, AC-002-06, AC-002-07
  - **Revert:** SAFE — añade operaciones y una ruta; no cambia el almacén
  - **Review:**
    - [ ] The test failed before the implementation
    - [ ] La junta puede cerrar sesión y mantenerla
    - [ ] `mis-reservas.js` queda mínima, FASE-1 la completa

### UC-003 — Crear socio y listar socios

- [ ] TASK-F0-007 Crear socio y listar socios con pantalla Socios y Acceso no permitido (API-001-04, API-001-05), test-first | `tests/unit/socios.test.js`, `tests/unit/permisos.test.js`, `tests/unit/ui-socios.test.js`, `src/domain/cuentas.js`, `src/domain/permisos.js`, `src/ui/pantallas/socios.js`
  - blocked-by: TASK-F0-006
  - **Files:** `src/server/plugin.js`, `src/ui/pantallas/prohibido.js`
  - **Commit:** `feat(acceso): alta y lista de socios con permisos por rol`
  - **Acceptance:**
    - Test first: `AC-003-01 alta` — el encargado crea "Pablo Ruiz", `pablo@club.test`, `Nieve2026` y la lista de Socios muestra "Pablo Ruiz"
    - Test first: `AC-003-04 contraseña corta` — `corta1` lanza `E_CONTRASENA_CORTA` "La contraseña debe tener al menos 8 caracteres"
    - Test first: `AC-003-05 correo duplicado` — `PABLO@club.test` lanza `E_CORREO_DUPLICADO` "Ya existe un socio con ese correo" (INV-ACC-001)
    - Test first: `AC-003-06 socio en Socios` — un socio recibe `E_ACCESO_NO_PERMITIDO` y ve "Acceso no permitido"
    - Test first: `AC-003-02 lista con Baja` — la lista incluye a un socio en Baja marcado "Baja"
    - Test first: `AC-003-03 / AC-003-07` — datos vacíos lanzan `E_DATOS_INVALIDOS` y la lista queda igual; con almacén caído `E_ALMACEN_NO_DISPONIBLE` y no se crea la cuenta
    - Test first: `SEC-T-002 sin sesión` — `crearSocio` y `listarSocios` sin sesión devuelven `E_NO_AUTENTICADO`; `permisos.js` contiene las 5 operaciones de esta FASE
  - **Refs:** FASE-0, REQ-F-002, UC-003, API-001-04, API-001-05, INV-ACC-001, INV-ACC-002, INV-ACC-003, INV-SEC-002, AC-003-01, AC-003-02, AC-003-03, AC-003-04, AC-003-05, AC-003-06, AC-003-07, SEC-T-002
  - **Revert:** SAFE — añade operaciones y pantallas
  - **Review:**
    - [ ] The test failed before the implementation
    - [ ] Orden de errores sesión → rol → validación
    - [ ] La lista nunca devuelve el hash

### Comando seed

- [ ] TASK-F0-008 Comando seed idempotente del encargado y la junta, test-first | `tests/api/seed.test.js`, `scripts/seed.js`
  - blocked-by: TASK-F0-007
  - **Commit:** `feat(acceso): comando seed para la primera cuenta del encargado y la junta`
  - **Acceptance:**
    - Test first: `D-PA-001 seed crea el encargado` — con `SEED_ENCARGADO_CORREO=marta@club.test`, `SEED_ENCARGADO_NOMBRE=Marta` y `SEED_ENCARGADO_CONTRASENA=Cumbre2026` crea la cuenta y `marta@club.test` entra con `Cumbre2026` ("Panel del encargado")
    - Test first: `D-PA-001 seed idempotente` — ejecutarlo dos veces no duplica la cuenta; con `SEED_ROL=junta` crea una cuenta de junta
    - Test first: `INV-ACC-003 seed con hash` — el almacén no contiene `Cumbre2026` en claro
    - Falta alguna variable de entorno: sale con código distinto de 0 y un mensaje en español
  - **Refs:** FASE-0, D-PA-001, INV-ACC-003, REQ-F-001
  - **Revert:** SAFE — comando independiente
  - **Review:**
    - [ ] The test failed before the implementation
    - [ ] Nunca imprime la contraseña

---

## Phase 4: Integration

**Purpose:** Sin wiring compartido entre varios componentes: cada slice registra su ruta y su operación en `main.js` y `plugin.js`.
**Checkpoint:** Integration tests pass.

Sin tareas (Stream integración vacío).

---

## Phase 5: Verification

**Purpose:** Journey de la FASE desde la ruta del usuario.
**Checkpoint:** El recorrido de WF-002 pasa con capturas y vídeo.

- [ ] TASK-F0-009 Journey FASE-0 WF-002: entrar, crear socios y que todo persista desde #/reservas | `tests/e2e/fase-0-wf-002.spec.js`
  - blocked-by: TASK-F0-008
  - **Commit:** `test(acceso): journey FASE-0 desde la ruta del usuario con capturas`
  - **Acceptance:**
    - Test first: named `AC-002-03`, `AC-001-06`, `AC-001-02`, `AC-003-01`, `AC-003-04`, `AC-003-05`, `AC-002-01`, `AC-001-01`, `AC-003-06`, `AC-001-07` (REQ-F-001 y REQ-F-002), uno por paso 1-9 de la Demo
    - El título del journey lleva `WF-002`, el id con el que se nombra el vídeo
    - Entra por el paso 1 de la Demo: abre `#/reservas` sin sesión, no una entrada interna; arranca con el comando `seed` (`marta@club.test`, `Cumbre2026`) y `CLOCK_FIXED=2026-12-05`
    - Afirma con `toHaveText` / `toContainText`: "Entrar", "Correo o contraseña incorrectos", "Panel del encargado", "Pablo Ruiz", "La contraseña debe tener al menos 8 caracteres", "Ya existe un socio con ese correo", "Material disponible", "Acceso no permitido", "Cuenta bloqueada durante 15 minutos"
    - Tras recargar y reiniciar el servidor "Pablo Ruiz" sigue en la lista (N-001, N-011)
    - Guarda `evidencias/FASE-0/{AC-NNN-NN}.png` por criterio y un vídeo con `WF-002` en el nombre, adjuntos al test
  - **Refs:** FASE-0, REQ-F-001, REQ-F-002, WF-002, AC-001-01, AC-001-02, AC-001-06, AC-001-07, AC-002-01, AC-002-03, AC-003-01, AC-003-04, AC-003-05, AC-003-06
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] Entra por la ruta del usuario, no por un punto interno
    - [ ] Cada texto se comprueba sobre el elemento que lo muestra

- [ ] TASK-F0-010 Endurecer AC-002-01 (CH-001, WEAKENED-ASSERT): tras Salir, volver a una pantalla de socio muestra Entrar | `tests/e2e/fase-0-wf-002.spec.js`
  - blocked-by: TASK-F0-009
  - **Commit:** `test(acceso): AC-002-01 comprueba que al volver a una pantalla de socio se ve Entrar`
  - **Acceptance:**
    - Test first: `AC-002-01`: tras Salir y volver atrás (y al abrir `#/reservas` de nuevo) se ve «Entrar», el formulario (Correo, Contraseña) y ni «Salir» ni «Mis reservas»
    - La captura `AC-002-01` se toma sobre la pantalla Entrar
  - **Refs:** FASE-0, REQ-F-001, AC-002-01
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] Cada cláusula del THEN tiene su assert

- [ ] TASK-F0-011 Endurecer AC-002-01 (CH-002, WEAKENED-ASSERT): tras Salir y volver atrás, esperar a la comprobación de sesión y ver Entrar | `tests/e2e/fase-0-wf-002.spec.js`
  - blocked-by: TASK-F0-010
  - **Commit:** `test(acceso): AC-002-01 espera a la comprobación de sesión tras volver atrás antes de ver Entrar`
  - **Acceptance:**
    - Test first: `AC-002-01`: al volver atrás tras Salir, el test espera la respuesta de comprobarSesion (401) y que la dirección sea #/entrar, y entonces ve «Entrar» y el formulario
    - La captura `AC-002-01` se toma sobre la pantalla Entrar
  - **Refs:** FASE-0, REQ-F-001, AC-002-01
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] El test no pasa con lo que quedaba en pantalla antes de la comprobación

### Test Exclusions

Files excluded from unit test coverage (from PLAN-FASE §7.4 Exclusions):

| File | Reason | Verified By |
|------|--------|-------------|
| src/domain/errores.js | constantes; las usa cada test | tests/unit/store.test.js, tests/unit/cuentas.test.js |
| src/server/plugin.js | tested via `tests/api` | tests/api/acceso.test.js, tests/api/sesion.test.js |
| src/server/hash.js | envoltorio de `node:crypto` | SEC-T-003 en tests/unit/cuentas.test.js |
| scripts/seed.js | comando | tests/api/seed.test.js |

---

## Dependencies

### Task Dependency Graph

```text
TASK-F0-001 ──► TASK-F0-002 ──► TASK-F0-004 ──► TASK-F0-005 ──► TASK-F0-006 ──► TASK-F0-007 ──► TASK-F0-008 ──► TASK-F0-009
           └──► TASK-F0-003 ──────────────────┘
```

### Critical Path

1. TASK-F0-001 → TASK-F0-002 → TASK-F0-004 → TASK-F0-005 → TASK-F0-006 → TASK-F0-007 → TASK-F0-008 → TASK-F0-009
   (8 tasks; TASK-F0-003 es paralelo a TASK-F0-002)

### Parallel Execution Plan

**Stream A:** entrar, mantener sesión, crear y listar socios, seed — see Stream Ownership (serie)

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | TASK-F0-001, TASK-F0-002, TASK-F0-003 | `package.json`, `vitest.config.js`, `vite.config.js`, `index.html`, `README.md`, `.gitignore`, `src/domain/errores.js`, `src/domain/reloj.js`, `src/domain/validacion.js`, `src/server/store.js`, `src/ui/main.js`, `src/ui/router.js`, `src/ui/textos.js`, `src/ui/errores.js`, `src/ui/componentes/**`, `tests/unit/store.test.js`, `tests/unit/reloj.test.js`, `tests/unit/validacion.test.js`, `tests/unit/ui-base.test.js` | main checkout, before worktrees (checkpoint `fase-0-foundation`) |
| A | TASK-F0-004, TASK-F0-005, TASK-F0-006, TASK-F0-007, TASK-F0-008 | `src/domain/cuentas.js`, `src/domain/permisos.js`, `src/server/plugin.js`, `src/server/sesiones.js`, `src/server/hash.js`, `src/ui/pantallas/**`, `scripts/seed.js`, `tests/unit/**`, `tests/api/**` | worktree `feat/fase-0-a` |
| integración | — | — | main checkout, after `--integrate --fase 0` |
| verificación | TASK-F0-009, TASK-F0-010, TASK-F0-011 | `tests/e2e/fase-0-wf-002.spec.js` | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Foundation | TASK-F0-003 | `fase-0-foundation` | main checkout |
| Verified | TASK-F0-009 | `fase-0-verified` | main checkout |
