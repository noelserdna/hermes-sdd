# Tasks: FASE-0 - Esqueleto: entrar, inventario y reservar

> **Input:** plan/fases/FASE-0-SKELETON.md + plan/fase-plans/PLAN-FASE-0.md
> **Generated:** 2026-11-21
> **Total tasks:** 10
> **Parallel capacity:** 1 (serial)
> **Critical path:** 9 tasks

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 10 |
| Parallelizable | 1 (10%) |
| Work Streams | 1 (A: 5 tasks) |
| Setup phase | 1 tasks |
| Foundation phase | 3 tasks |
| Slices phase | 5 tasks |
| Integration phase | 0 tasks |
| Verification phase | 1 tasks |

> Convención de nombres de test (toda la FASE): el título lleva `REQ-F-NNN ACn` cuando el escenario del BDD lo declara entre corchetes (AC-001-01…09 = REQ-F-001 AC1…AC9; AC-008-01…06 = REQ-F-008 AC1…AC6; AC-003-01…10 = REQ-F-003 AC1…AC10) y el id `AC-NNN-NN` siempre. Los valores literales de cada ejemplo salen del `Scenario:` con ese id en `spec/tests/BDD-UC-00N.md` y se afirman tal cual desde la primera versión.

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-001 / API-001-01, API-001-02 | TASK-F0-005, TASK-F0-006 |
| UC-008 / API-004-01..03 | TASK-F0-007 |
| UC-003 / API-002-01, API-002-02 | TASK-F0-008, TASK-F0-009 |
| ADR-001 (reloj) | TASK-F0-002 |
| ADR-002 (almacén y transacción) | TASK-F0-002, TASK-F0-008 |
| INV-ACC-001..006, 008, 009, 102 | TASK-F0-005, TASK-F0-008 |
| INV-RES-001..005, 008 | TASK-F0-008 |
| INV-STK-001..004 | TASK-F0-007 |
| REQ-F-001 / REQ-F-003 / REQ-F-008 | TASK-F0-005..009, TASK-F0-010 |
| REQ-C-001, REQ-C-003 | TASK-F0-004 |
| REQ-C-002 | TASK-F0-001 |
| D-PA-003 (cuentas de encargado y junta) | TASK-F0-005 |
| D-PA-004 (baja = sesión cortada) | TASK-F0-005 |

---

## Phase 1: Setup

**Purpose:** La app arranca igual que en producción desde el primer commit.
**Checkpoint:** `npm run build && npm start` sirve la web en `PORT`/`HOST`.

- [ ] TASK-F0-001 Montar el esqueleto desplegable (build, start, test, README) | `package.json`, `vite.config.js`, `vitest.config.js`, `index.html`, `README.md`, `tests/unit/stack.test.js`
  - **Commit:** `chore(app): esqueleto Vite con build, start y vitest de 2 workers`
  - **Acceptance:**
    - Test first: `REQ-C-002 el proyecto es JavaScript ESM con Vite y Vitest` lee `package.json` y afirma `type: "module"`, `vite` y `vitest` en las dependencias y `maxWorkers: 2` en `vitest.config.js`
    - Verify: `npm run build && PORT=4999 HOST=127.0.0.1 npm start` → `curl -s http://127.0.0.1:4999/` devuelve el `index.html`; `start` sirve lo construido (`vite preview`, nunca el servidor de desarrollo), lee `process.env.PORT` y `process.env.HOST` (por defecto `0.0.0.0`, nunca `127.0.0.1` fijo)
    - `package.json` define `dev`, `build`, `start`, `test` (`vitest run --maxWorkers=2`), `lint` y `cuentas` (`node src/server/preparar-cuentas.js`)
    - `README.md` explica cómo instalar (`npm ci`), probar (`npm test`, `npm run lint`, `npx playwright test`) y arrancar (`npm run build && npm start`, `PORT`/`HOST`, `CLOCK_FIXED` y `STORE_FILE` de pruebas)
  - **Refs:** FASE-0, REQ-C-002, ADR-DRAFT-002
  - **Revert:** CONFIG — cambia scripts y configuración de arranque; tras revertir hay que reinstalar y reiniciar el servidor
  - **Review:**
    - [ ] `start` no arranca `vite` en modo desarrollo ni fija 127.0.0.1
    - [ ] El README basta para instalar, probar y arrancar sin leer más

---

## Phase 2: Foundation

**Purpose:** Lo que comparten los tres casos de uso: dominio base y almacén, servidor HTTP y SPA.
**Checkpoint:** `npm test` en verde con dominio base, almacén, servidor y shell; tag `fase-0-foundation`.

- [ ] TASK-F0-002 Dominio base y almacén: constantes, reloj inyectado, errores, permisos y store transaccional | `src/domain/config.js`, `src/domain/reloj.js`, `src/domain/errores.js`, `src/domain/permisos.js`, `src/server/store.js`, `tests/unit/domain/reloj.test.js`, `tests/unit/domain/permisos.test.js`, `tests/unit/server/store.test.js`
  - blocked-by: TASK-F0-001
  - **Commit:** `feat(dominio): constantes, reloj, errores VO-010, permisos por rol y almacén con transaction`
  - **Acceptance:**
    - Test first: `ADR-001 reloj.hoy() devuelve la fecha natural Europe/Madrid` con `CLOCK_FIXED=2026-12-01` → `"2026-12-01"`, y sin la variable devuelve la fecha de Madrid (23:30 UTC del 30-nov ya es `"2026-12-01"`)
    - Test first: `permisos.puede(rol, operacion)` sigue `contracts/PERMISSIONS-MATRIX.md` (Socio no puede `anadirUnidades`; Encargado sí; Junta solo lectura)
    - Test first: `ADR-002 dos transaction concurrentes se ejecutan una tras otra` (la segunda ve el resultado de la primera)
    - Test first: escritura en fichero temporal + `rename`; un fallo inyectado devuelve `E_ALMACEN_NO_DISPONIBLE` y deja el fichero anterior intacto
    - `config.js` exporta cada valor de `spec/VALUE-REGISTRY.md` (`LOGIN_MAX_FAILURES` 5, `LOGIN_LOCK_MINUTES` 15, `SESSION_IDLE_HOURS` 8, máximo 14 días de reserva, `FINE_PER_DAY_EUR` 2, `RETENTION_YEARS` 2) y `errores.js` el catálogo VO-010
    - `load()` crea `data/store.json` con `schemaVersion: 1` y colecciones `cuentas`, `unidades`, `reservas`, `multas`, `sesiones`; la ruta se puede cambiar con `STORE_FILE`; en tests hay almacén en memoria
  - **Refs:** FASE-0, ADR-001, ADR-002, ADR-DRAFT-001, VO-010, REQ-C-003, INV-ACC-001, INV-ACC-102
  - **Revert:** SAFE — módulos nuevos sin consumidores aún
  - **Review:**
    - [ ] Ningún valor numérico del registro queda repetido fuera de `config.js`
    - [ ] Un fallo a mitad de escritura no corrompe el fichero
    - [ ] Toda escritura posterior pasará por `transaction`

- [ ] TASK-F0-003 Servidor HTTP como middleware de Vite (dev y preview) con `GET /api/salud` | `src/server/http.js`, `src/server/vite-plugin.js`, `vite.config.js`, `tests/unit/server/http.test.js`
  - blocked-by: TASK-F0-002
  - **Commit:** `feat(servidor): API JSON como middleware de Vite con salud, Origin y errores`
  - **Acceptance:**
    - Test first: `GET /api/salud` → 200 `{ ok: true }`
    - Test first: una petición `POST` con `Origin` de otro sitio se rechaza; un error de dominio sale como `{ error: "E_…", mensaje }` con el HTTP 4xx de su familia (`design/OPERATION-MAPPING.md`); `E_ALMACEN_NO_DISPONIBLE` sale como 503
    - Una línea JSON por petición en el log, sin cuerpo ni credenciales; el mismo plugin se registra en `server` y en `preview`, de modo que `npm start` también sirve `/api/*`
  - **Refs:** FASE-0, ADR-DRAFT-002, VO-010
  - **Revert:** CONFIG — cambia `vite.config.js`; reiniciar el servidor tras revertir
  - **Review:**
    - [ ] El log no contiene contraseñas ni cuerpos
    - [ ] Las rutas salen de `OPERATION-MAPPING.md`, no de memoria

- [ ] TASK-F0-004 [P] Shell de la SPA: router por hash, cliente de API y textos en español | `src/ui/main.js`, `src/ui/router.js`, `src/ui/api.js`, `src/ui/textos.js`, `tests/unit/ui/shell.test.js`
  - blocked-by: TASK-F0-001
  - **Commit:** `feat(ui): shell de la SPA con rutas por hash, cliente de API y textos`
  - **Acceptance:**
    - Test first: `REQ-C-001 los textos de la interfaz no contienen cadenas inglesas de la lista de control` (`Error`, `Loading`, `Submit`, `Cancel`, `Login`, `Logout`, `Save`, `Delete`) recorriendo `src/ui/textos.js` y los literales de `src/ui/pantallas/`
    - Test first: `REQ-C-003 ningún dato de negocio en localStorage ni sessionStorage`: `src/` no contiene `localStorage` ni `sessionStorage`
    - Test first: el router resuelve `#/entrar`, `#/mis-reservas`, `#/reservar`, `#/inventario` a su pantalla (comprueba que están, no el conjunto cerrado de rutas)
  - **Refs:** FASE-0, REQ-C-001, REQ-C-003, MNT-001, MNT-003
  - **Revert:** SAFE — módulos nuevos sin consumidores aún
  - **Review:**
    - [ ] Ningún texto de pantalla escrito fuera de `textos.js`
    - [ ] La lista de rutas puede crecer sin romper el test

---

## Phase 3: Slices

**Purpose:** Un corte vertical por caso de uso, con su test escrito primero.
**Checkpoint:** Los tests de cada slice en verde.

### UC-001 — Entrar y salir

- [ ] TASK-F0-005 Entrar, salir y sesión por petición, con cuentas de encargado y junta preparadas (API-001-01, API-001-02) | `src/domain/acceso.js`, `src/server/sesiones.js`, `src/server/preparar-cuentas.js`, `src/server/http.js`, `tests/unit/domain/acceso.test.js`, `tests/unit/server/sesiones.test.js`, `tests/unit/server/cuentas.test.js`
  - blocked-by: TASK-F0-003
  - **Commit:** `feat(acceso): entrar, salir, caducidad y cuentas de encargado y junta preparadas por instalación`
  - **Acceptance:**
    - Test first (un test por escenario, `REQ-F-001 ACn · AC-001-nn`): AC-001-01 `lucia@club.es`/`Cumbre2026` entra como Socio llamada «Lucía»; AC-001-02 `pablo@club.es`/`Arista2026` entra como «Pablo»; AC-001-12 encargado y junta entran con su rol
    - AC-001-03 contraseña `mala` → `E_CREDENCIALES_INVALIDAS` con «Correo o contraseña incorrectos», idéntico para AC-001-10 (correo desconocido o cuenta en Baja)
    - AC-001-04 tras 5 fallos seguidos, la contraseña correcta da `E_CUENTA_BLOQUEADA` («Cuenta bloqueada. Inténtalo de nuevo en 15 minutos») y no hay sesión; AC-001-05 bloqueada hace 15 minutos entra; AC-001-11 un acierto reinicia el contador de fallos
    - AC-001-09 doble envío del acceso no duplica la sesión (una sola sesión viva)
    - AC-001-06 (`REQ-F-001 AC6`) una sesión con 8 h sin actividad da `E_SESION_CADUCADA`; AC-001-07 (`REQ-F-001 AC7`) tras Salir la misma cookie ya no vale
    - AC-001-13 sin sesión, cualquier operación protegida da `E_NO_AUTENTICADO` (401) antes de mirar rol o datos (sesión > rol > validación > estado, D-T-009)
    - `sesiones.validar` vuelve a leer la cuenta en cada petición y rechaza una cuenta que ya no está Activa (D-PA-004)
    - Test first: `D-PA-003 npm run cuentas crea encargado y junta` con correo y contraseña por argumentos o entorno (`--encargado e@club.es --junta j@club.es`); ambos entran después con su rol (AC-001-12); es idempotente y ninguna ruta de la API crea ni cambia cuentas de encargado o junta
    - La contraseña se guarda solo como hash scrypt con sal por cuenta y no sale en ninguna respuesta (SEC-001, SEC-002, INV-ACC-003); la cookie es `HttpOnly; SameSite=Strict`
  - **Refs:** FASE-0, REQ-F-001, UC-001, API-001-01, API-001-02, INV-ACC-001, INV-ACC-002, INV-ACC-003, INV-ACC-004, INV-ACC-005, INV-ACC-006, INV-ACC-008, SEC-001, SEC-002, D-PA-003, D-PA-004, AC-001-01, AC-001-02, AC-001-03, AC-001-04, AC-001-05, AC-001-06, AC-001-07, AC-001-09, AC-001-10, AC-001-11, AC-001-12, AC-001-13
  - **Revert:** SAFE — rutas y módulos nuevos; el resto sigue funcionando
  - **Review:**
    - [ ] Mismo mensaje para correo desconocido, cuenta en Baja y contraseña mala
    - [ ] Ninguna contraseña en claro en el almacén, en las salidas ni en el log
    - [ ] Salir invalida la sesión en el servidor, no solo borra la cookie
    - [ ] No hay endpoint que cree encargado o junta

- [ ] TASK-F0-006 Pantalla Entrar y guarda de rutas sin sesión (SCR-001) | `src/ui/pantallas/entrar.js`, `src/ui/router.js`, `src/ui/textos.js`, `tests/unit/ui/entrar.test.js`
  - blocked-by: TASK-F0-004, TASK-F0-005
  - **Commit:** `feat(ui): pantalla Entrar y redirección a Entrar sin sesión`
  - **Acceptance:**
    - Test first: `REQ-F-001 AC8 · AC-001-08` abrir `#/mis-reservas` sin sesión lleva a `#/entrar`; tras Salir, volver atrás también pide entrar
    - Test first: el formulario muestra el `mensaje` que devuelve la API («Correo o contraseña incorrectos») y se queda en Entrar; al entrar bien lleva a `#/mis-reservas` (socio) o `#/inventario` (encargado)
  - **Refs:** FASE-0, REQ-F-001, UC-001, SCR-001, AC-001-08
  - **Revert:** SAFE — pantalla nueva y una guarda de router
  - **Review:**
    - [ ] Todos los textos vienen de `textos.js`
    - [ ] El formulario es accesible (etiquetas y foco, ux/)

### UC-008 — Gestionar inventario

- [ ] TASK-F0-007 Gestionar inventario: añadir y dar de baja unidades, listar, con su pantalla (API-004-01..03, SCR-007) | `src/domain/inventario.js`, `src/server/http.js`, `src/ui/pantallas/inventario.js`, `src/ui/router.js`, `src/ui/textos.js`, `tests/unit/domain/inventario.test.js`, `tests/unit/ui/inventario.test.js`
  - blocked-by: TASK-F0-005, TASK-F0-006
  - **Commit:** `feat(inventario): añadir y dar de baja unidades, listar inventario y pantalla Inventario`
  - **Acceptance:**
    - Test first (un test por escenario): AC-008-01 añadir 2 «Piolet» deja 2 unidades; AC-008-02 añadir otra vez suma (sin idempotencia, INV-STK-003); AC-008-03 dar de baja una unidad libre
    - AC-008-04 no se da de baja una unidad Prestada; AC-008-05 repetir la baja no cambia nada
    - AC-008-06 un Socio recibe error de permiso; AC-008-07 tipo inválido, AC-008-08 cantidad inválida, AC-008-09 unidad inexistente, cada uno con su error del catálogo VO-010
    - Test first: `REQ-F-008 el encargado añade 2 piolets y la pantalla Inventario muestra 2` (el recuento sale en el elemento de «Piolet», no en el contenedor)
    - El botón de baja no aparece en una unidad Prestada; los errores de la API se muestran con su `mensaje`
  - **Refs:** FASE-0, REQ-F-008, UC-008, API-004-01, API-004-02, API-004-03, SCR-007, INV-STK-001, INV-STK-002, INV-STK-003, INV-STK-004, AC-008-01, AC-008-02, AC-008-03, AC-008-04, AC-008-05, AC-008-06, AC-008-07, AC-008-08, AC-008-09
  - **Revert:** SAFE — módulo, rutas y pantalla nuevos
  - **Review:**
    - [ ] Permiso comprobado en el caso de uso, no solo en la UI
    - [ ] Estados de la unidad según SM-003
    - [ ] Un socio no ve la ruta de Inventario

### UC-003 — Reservar material

- [ ] TASK-F0-008 Reservar material y listar las reservas propias (API-002-01, API-002-02 mínima) | `src/domain/reservas.js`, `src/server/http.js`, `tests/unit/domain/reservas.test.js`
  - blocked-by: TASK-F0-007
  - **Commit:** `feat(reservas): reservarMaterial en transaccion y listarMisReservas minima`
  - **Acceptance:**
    - Test first (un test por escenario, `REQ-F-003 ACn · AC-003-nn`): AC-003-01 con unidades libres todos los días se crea la reserva («Piolet» del 2026-12-05 al 2026-12-07 según el BDD); AC-003-02 repetir la misma no duplica
    - AC-003-03 y AC-003-04 sin unidades un día se rechaza (2 piolets del 4 al 4 cuando solo queda 1); AC-003-10 dos reservas a la vez por la última unidad: gana una sola (fila `race`, `transaction`)
    - AC-003-05 fechas pasadas, AC-003-06 invertidas, AC-003-07 de más de 14 días, rechazadas con su error
    - AC-003-08 con una multa Pendiente se rechaza; AC-003-09 con la multa Pagada vuelve a poder (multas sembradas en el almacén)
    - AC-003-11 un rol sin permiso y AC-003-12 un tipo inválido, rechazados
    - Test first: `INV-ACC-009 listarMisReservas devuelve solo las reservas del socio` con `{ reservas, multas: [] }`
  - **Refs:** FASE-0, REQ-F-003, UC-003, API-002-01, API-002-02, ADR-001, ADR-002, INV-RES-001, INV-RES-002, INV-RES-003, INV-RES-004, INV-RES-005, INV-RES-008, INV-ACC-009, AC-003-01, AC-003-02, AC-003-03, AC-003-04, AC-003-05, AC-003-06, AC-003-07, AC-003-08, AC-003-09, AC-003-10, AC-003-11, AC-003-12
  - **Revert:** SAFE — módulo y rutas nuevos
  - **Review:**
    - [ ] Disponibilidad comprobada por día dentro de la transacción
    - [ ] La reserva idéntica devuelve la existente

- [ ] TASK-F0-009 Pantallas Mis reservas (solo lectura) y Reservar con el rechazo por falta de unidades (SCR-002, SCR-003) | `src/ui/pantallas/mis-reservas.js`, `src/ui/pantallas/reservar.js`, `src/ui/router.js`, `src/ui/textos.js`, `tests/unit/ui/mis-reservas.test.js`, `tests/unit/ui/reservar.test.js`
  - blocked-by: TASK-F0-006, TASK-F0-008
  - **Commit:** `feat(ui): Mis reservas minima y pantalla Reservar con errores de la API`
  - **Acceptance:**
    - Test first: `REQ-F-001 AC1 · AC-001-01` Mis reservas muestra «Hola, Lucía» (y «Hola, Pablo» para AC-001-02) en el elemento de saludo
    - Test first: `REQ-F-003 AC1 · AC-003-01` tras reservar muestra «Reserva creada: Piolet del 2026-12-03 al 2026-12-05»; `AC-003-02` una sola fila de esa reserva tras repetir el envío
    - Test first: `REQ-F-003 AC4 · AC-003-04` Pablo pide 2 piolets del 4 al 4 y la pantalla Reservar muestra el `mensaje` de rechazo (solo queda 1 el día 4) y no navega; al reservar con éxito lleva a `#/mis-reservas`
    - Mis reservas sin Cancelar ni multas (FASE-1); el router lleva aquí tras entrar o reservar
  - **Refs:** FASE-0, REQ-F-001, REQ-F-003, UC-001, UC-003, SCR-002, SCR-003, AC-001-01, AC-001-02, AC-003-01, AC-003-02, AC-003-04
  - **Revert:** SAFE — pantallas nuevas
  - **Review:**
    - [ ] Solo se listan reservas del propio socio
    - [ ] El envío doble no crea dos reservas
    - [ ] Textos solo en `textos.js`

---

## Phase 4: Integration

**Purpose:** Cableado compartido por varios slices.
**Checkpoint:** —

Sin tareas: cada slice registra su ruta en `http.js` y su pantalla en `router.js` dentro de su propio commit, en un solo Stream serie.

---

## Phase 5: Verification

**Purpose:** El recorrido de la FASE desde la ruta del usuario.
**Checkpoint:** Criterios de Éxito de FASE-0 demostrados; tag `fase-0-verified`.

- [ ] TASK-F0-010 Recorrido FASE-0 (WF-002) por la ruta del usuario con capturas y vídeo | `tests/e2e/fase-0-skeleton.spec.js`, `tests/e2e/fixtures/semilla.js`, `playwright.config.js`
  - blocked-by: TASK-F0-005, TASK-F0-007, TASK-F0-009
  - **Commit:** `test(e2e): recorrido FASE-0 WF-002 con capturas por criterio`
  - **Acceptance:**
    - Test first: el título lleva `WF-002` (el vídeo se llama así) y recorre cada escenario de `Escenarios` con su id en el título del paso: AC-001-01…13, AC-008-01…09, AC-003-01…12 (los que no aparecen en la Demo se provocan con la semilla o con `page.request` y se capturan en pantalla, sin repetir su lógica)
    - Entra por el paso 1 de la Demo: abre `/` sin sesión y comprueba que lleva a Entrar; usa la semilla de pruebas (`CLOCK_FIXED=2026-12-01`, `STORE_FILE` temporal, encargado, junta, `lucia@club.es`, `pablo@club.es`) y no una puerta interna
    - Afirma el texto de cada ejemplo en el elemento que lo muestra (`toHaveText`/`toContainText`): «Correo o contraseña incorrectos», «Cuenta bloqueada. Inténtalo de nuevo en 15 minutos» tras el 5.º fallo, «Hola, Lucía», «Reserva creada: Piolet del 2026-12-03 al 2026-12-05», el rechazo de Pablo (solo queda 1 el día 4), Salir y volver atrás pide entrar
    - Guarda `evidencias/FASE-0/{AC-NNN-NN}.png` por criterio y un vídeo con `WF-002` en su nombre, adjuntos al test; sin fijar el conjunto de pantallas ni de enlaces del menú
  - **Refs:** FASE-0, REQ-F-001, REQ-F-003, REQ-F-008, WF-002, AC-001-01, AC-001-02, AC-001-03, AC-001-04, AC-001-05, AC-001-06, AC-001-07, AC-001-08, AC-001-09, AC-001-10, AC-001-11, AC-001-12, AC-001-13, AC-008-01, AC-008-02, AC-008-03, AC-008-04, AC-008-05, AC-008-06, AC-008-07, AC-008-08, AC-008-09, AC-003-01, AC-003-02, AC-003-03, AC-003-04, AC-003-05, AC-003-06, AC-003-07, AC-003-08, AC-003-09, AC-003-10, AC-003-11, AC-003-12, E2E-WF-002-01, E2E-ADM-02
  - **Revert:** SAFE — solo pruebas y configuración de Playwright
  - **Review:**
    - [ ] Entra por `/`, no por una función interna
    - [ ] Hay captura de cada criterio y el vídeo lleva `WF-002`

- [ ] TASK-F0-011 Inventario: «Marcar como rota» también en una unidad prestada, y AC-008-04 con su propio préstamo (CH-001) | `src/ui/pantallas/inventario.js`, `tests/unit/ui/inventario.test.js`, `tests/e2e/fase-0-skeleton.spec.js`
  - blocked-by: TASK-F0-010
  - Source: ACCEPTANCE-ADVERSARIAL-FASE-0
  - **Commit:** `fix(inventario): marcar como rota se ofrece también en una unidad prestada y AC-008-04 parte de un préstamo sembrado`
  - **Acceptance:**
    - Reproduce first: AC-008-04 con «Casco 1» ya Prestada a Pablo al abrir Inventario (semilla, sin cambiar el almacén durante la prueba): el encargado marca «Casco 1» como rota, confirma y ve «No se puede dar de baja: está prestada»; la unidad sigue Activa
    - La pantalla ofrece «Marcar como rota» en toda unidad Activa, prestada o no; el rechazo lo da el servidor (INV-STK-002)
    - La captura AC-008-04 muestra Inventario con ese mensaje
  - **Refs:** FASE-0, REQ-F-008, UC-008, SCR-007, INV-STK-002, AC-008-04
  - **Revert:** SAFE — un botón y pruebas
  - **Review:**
    - [ ] El test no toca el almacén durante la prueba

- [ ] TASK-F0-012 AC-001-09: las dos peticiones del mismo envío llegan al servidor y la sesión que queda es la que tiene el navegador (CH-002) | `src/domain/acceso.js`, `tests/unit/domain/acceso.test.js`, `tests/e2e/fase-0-skeleton.spec.js`
  - blocked-by: TASK-F0-010
  - Source: ACCEPTANCE-ADVERSARIAL-FASE-0
  - **Commit:** `fix(acceso): dos envíos simultáneos del mismo formulario comparten una sola sesión válida`
  - **Acceptance:**
    - Reproduce first: lucia@club.es envía dos veces el mismo formulario correcto a la vez (dos peticiones que llegan las dos al servidor); queda una sola sesión y la cookie que recibe el navegador vale: Mis reservas muestra «Hola, Lucía»
    - El test unitario comprueba que el identificador devuelto en ambas respuestas valida la sesión que queda
  - **Refs:** FASE-0, REQ-F-001, UC-001, INV-ACC-101, AC-001-09
  - **Revert:** SAFE — solo el inicio de sesión
  - **Review:**
    - [ ] Un envío posterior, no simultáneo, sigue sustituyendo la sesión anterior

### Test Exclusions

| File | Reason | Verified By |
|------|--------|-------------|
| `src/domain/config.js`, `src/domain/errores.js` | constantes | integración (TASK-F0-005, TASK-F0-008) |
| `src/server/vite-plugin.js`, `src/server/preparar-cuentas.js` | envoltorios finos | E2E y `cuentas.test.js` |
| `src/ui/{main,router,api,textos}.js` | cableado de la SPA | TASK-F0-004 (REQ-C-001/003) y TASK-F0-010 |

---

## Dependencies

### Task Dependency Graph

```text
001 ─┬─► 002 ─► 003 ─► 005 ─┬─► 006 ─► 007 ─► 008 ─► 009 ─► 010
     └─► 004 ───────────────┘     (004 ► 006)  (005 ► 007, 010)
```

### Critical Path

1. TASK-F0-001 → 002 → 003 → 005 → 006 → 007 → 008 → 009 → 010
   (9 tasks on critical path)

### Parallel Execution Plan

**Stream A:** entrar, inventario y reservar, en serie (todas las pantallas y rutas comparten `http.js`, `router.js` y `textos.js`) — see Stream Ownership

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | TASK-F0-001, TASK-F0-002, TASK-F0-003, TASK-F0-004 | package.json, vite.config.js, vitest.config.js, index.html, README.md, src/domain/{config,reloj,errores,permisos}.js, src/server/{store,http,vite-plugin}.js, src/ui/{main,router,api,textos}.js, tests/unit/stack.test.js, tests/unit/domain/{reloj,permisos}.test.js, tests/unit/server/{store,http}.test.js, tests/unit/ui/shell.test.js | main checkout, before worktrees (checkpoint `fase-0-foundation`) |
| A | TASK-F0-005, TASK-F0-006, TASK-F0-007, TASK-F0-008, TASK-F0-009 | src/domain/{acceso,inventario,reservas}.js, src/server/{sesiones,preparar-cuentas}.js, src/server/http.js, src/ui/{router,textos}.js, src/ui/pantallas/**, tests/unit/domain/{acceso,inventario,reservas}.test.js, tests/unit/server/{sesiones,cuentas}.test.js, tests/unit/ui/{entrar,inventario,mis-reservas,reservar}.test.js | worktree `feat/fase-0-a` |
| integración | — | — | main checkout, after `--integrate --fase 0` |
| verificación | TASK-F0-010, TASK-F0-011, TASK-F0-012 | — | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Foundation | TASK-F0-004 | `fase-0-foundation` | main checkout |
| Verified | TASK-F0-010 | `fase-0-verified` | main checkout |
