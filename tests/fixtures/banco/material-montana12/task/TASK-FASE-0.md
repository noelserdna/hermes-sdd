# Tasks: FASE-0 - Entrar y cargar el material

> **Input:** plan/fases/FASE-0-SKELETON.md + plan/fase-plans/PLAN-FASE-0.md
> **Generated:** 2026-11-22
> **Total tasks:** 9
> **Parallel capacity:** 1 work Stream (serial)
> **Critical path:** 9 tasks

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 9 |
| Parallelizable | 0 (0%) |
| Work Streams | 1 (A: 5 tasks) |
| Setup phase | 1 task |
| Foundation phase | 2 tasks |
| Slices phase | 5 tasks |
| Integration phase | 0 tasks |
| Verification phase | 1 task |

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-001 | TASK-F0-004, TASK-F0-006 |
| UC-002 | TASK-F0-004, TASK-F0-006 |
| UC-015 | TASK-F0-007, TASK-F0-008 |
| UC-016 | TASK-F0-007 |
| API-001-01, API-001-02 | TASK-F0-004 |
| API-001-08 | TASK-F0-003 |
| API-003-01..03 | TASK-F0-007 |
| ADR-001, ADR-005 | TASK-F0-007, TASK-F0-004 |
| INV-SOC-003..005, 008 | TASK-F0-003, TASK-F0-004 |
| INV-MAT-001..004 | TASK-F0-007 |
| INV-RES-004, 005 | TASK-F0-007 |
| REQ-F-001 | TASK-F0-003..006, TASK-F0-009 |
| REQ-F-007 | TASK-F0-007, TASK-F0-008, TASK-F0-009 |
| REQ-C-001, REQ-C-002 | TASK-F0-001, TASK-F0-005 |

---

## Phase 1: Setup

**Purpose:** Aplicación arrancable como en producción desde el primer commit.
**Checkpoint:** `npm run build` y `npm start` sirven la web; `npm test` arranca.

- [ ] TASK-F0-001 Scaffold the app runnable as in production (build, start on PORT/HOST, README) | `package.json`, `vite.config.js`, `vitest.config.js`, `index.html`, `README.md`
  - **Commit:** `chore(app): scaffold Vite app with build, start and README`
  - **Acceptance:**
    - Verify: `npm run build && PORT=4180 npm start` → `GET /` answers 200 with the built `index.html`; `start` runs `vite preview` (never the dev server), listens on `process.env.PORT` and `process.env.HOST` (default `0.0.0.0`, never a hard-coded `127.0.0.1`), `strictPort`
    - Verify: `npx vitest run --maxWorkers=2` → runner starts with `test: { maxWorkers: 2 }` in `vitest.config.js`; `package.json` keeps `"type": "module"` and only Vite and Vitest as dependencies (REQ-C-002)
    - `vite.config.js` registers the API plugin for `configureServer` and `configurePreviewServer` (the plugin body arrives in TASK-F0-004); `README.md` says in Spanish how to install, test (`npm test`, `npx playwright test`) and start (`npm run build && npm start`), and lists `PORT`, `HOST`, `MM_DATOS`
  - **Refs:** FASE-0, REQ-C-002, ADR-DRAFT-001
  - **Revert:** CONFIG — vuelve al manifiesto anterior; reinstalar dependencias
  - **Review:**
    - [ ] `start` no usa el servidor de desarrollo ni fija `127.0.0.1`
    - [ ] Textos del README en español

---

## Phase 2: Foundation

**Purpose:** Lo que comparten las rebanadas: almacén, reloj, sesiones y `authorize`.
**Checkpoint:** Tests unitarios de la base en verde.

- [ ] TASK-F0-002 Add atomic JSON store, in-memory store, clock and message catalogue | `src/server/store/almacen-json.js`, `src/server/store/almacen-memoria.js`, `src/server/dominio/fechas.js`, `src/server/mensajes.js`, `tests/unit/almacen-json.test.js`, `tests/unit/fechas.test.js`
  - blocked-by: TASK-F0-001
  - **Commit:** `feat(store): atomic JSON store, injectable clock and VO-010 messages`
  - **Acceptance:**
    - Test first: `ADR-DRAFT-002 almacén JSON` — a transaction writes to `.tmp` and renames; reopening the file returns the same data; two concurrent transactions are serialized; a write failure throws `E_ALMACEN_NO_DISPONIBLE` and leaves the file unchanged (D-T-002)
    - Test first: `RN-022 reloj` — `hoy` comes from the injected clock (Europe/Madrid); `MM_HOY` is ignored when `NODE_ENV=production`
    - `mensajes.js` exposes the VO-010 catalogue in Spanish (`E_CREDENCIALES` = «Correo o contraseña incorrectos», `E_PAGINA_PROHIBIDA`, `E_ACCESO_DENEGADO`, `E_ALMACEN_NO_DISPONIBLE`)
  - **Refs:** FASE-0, ADR-DRAFT-002, ADR-005, VO-010, REQ-C-001
  - **Revert:** SAFE — módulos nuevos sin consumidores
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Ningún fichero queda a medias si se corta la escritura

- [ ] TASK-F0-003 Add sessions with idle expiry and the central `authorize` | `src/server/servicios/sesiones.js`, `src/server/http/autorizar.js`, `src/server/app.js`, `tests/unit/sesiones.test.js`, `tests/unit/autorizar.test.js`
  - blocked-by: TASK-F0-002
  - **Commit:** `feat(http): sessions with 30-minute idle expiry and authorize by role`
  - **Acceptance:**
    - Test first: `AC-001-06 (REQ-F-001, D-PA-001)` — a session with exactly 30 minutes without activity is still open; at 30 minutes and 1 second it is closed (`inactividad > SESSION_IDLE_MINUTES`); `authorize` renews activity only when it authorizes
    - Test first: `AC-001-08 (REQ-F-001, INV-SEC-003)` — `authorize` for a socio on `/material` returns `E_PAGINA_PROHIBIDA`; an operation outside the role returns `E_ACCESO_DENEGADO`; the table follows `PERMISSIONS-MATRIX.md`
    - Test first: `INV-SOC-005` — the session id is opaque and the cookie is `HttpOnly; SameSite=Strict`
    - `crearApp({store, reloj})` builds the services; plugin and tests use the same factory (D-PA-008)
  - **Refs:** FASE-0, REQ-F-001, INV-SOC-005, INV-SEC-001, INV-SEC-003, D-PA-001, D-PA-008
  - **Revert:** SAFE — módulos nuevos sin consumidores
  - **Review:**
    - [ ] Con exactamente 30 minutos la sesión sigue abierta
    - [ ] `authorize` es el único punto de decisión por rol

---

## Phase 3: Slices

**Purpose:** Un recorrido por caso de uso, con su test escrito antes.
**Checkpoint:** Todos los tests de integración y de UI en verde.

### UC-001 / UC-002 — Entrar y salir

- [ ] TASK-F0-004 Log in and out with lockout (API-001-01, API-001-02), test-first | `tests/integration/cuentas.test.js`, `src/server/servicios/cuentas.js`, `src/server/http/plugin.js`, `src/server/http/rutas.js`, `demo/sembrar.mjs`
  - blocked-by: TASK-F0-003
  - **Commit:** `feat(cuentas): login, logout and lockout with scrypt hashes`
  - **Acceptance:**
    - Test first: `AC-001-01 AC-001-02 (REQ-F-001)` — socio Lucía lands on `/mis-reservas` and encargado Pablo on `/panel` with name «Lucía» / «Pablo»
    - Test first: `AC-001-03` — wrong password, unknown e-mail and e-mail of a baja account all return «Correo o contraseña incorrectos» (`E_CREDENCIALES`, `timingSafeEqual`)
    - Test first: `AC-001-04 AC-001-05` — after `LOGIN_MAX_FAILURES` (5) failures the account is blocked `LOGIN_LOCK_MINUTES` (15): «Cuenta bloqueada. Vuelve a intentarlo en 15 minutos»; a success resets the counter
    - Test first: `AC-001-09` — logging in with a session already open changes nothing
    - Test first: `AC-002-01 AC-002-03 (REQ-F-001, ADR-005)` — logout invalidates the session on the server; a second logout answers 200 `{aviso}` without error
    - `INV-SOC-003` — `datos.json` holds only the scrypt hash with salt, never the password; `demo/sembrar.mjs fase-0` seeds Lucía (socio), Pablo (encargado), a junta member, 3 «Casco», 0 «Cuerda» and one reservation occupying 2 «Casco» with the same hash as login
    - `plugin.js` mounts `/api` (routes `entrar`, `salir`) in dev and preview, with `Cache-Control: no-store`
  - **Refs:** FASE-0, REQ-F-001, UC-001, UC-002, API-001-01, API-001-02, INV-SOC-003, INV-SOC-004, INV-SOC-005, INV-SOC-008, ADR-005, D-PA-001, D-PA-004
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Ninguna respuesta ni log contiene contraseñas

### Interfaz base

- [ ] TASK-F0-005 Add the SPA shell: router, texts and "Sin permiso" | `src/ui/router.js`, `src/ui/textos.js`, `src/ui/main.js`, `src/ui/paginas/sin-permiso.js`, `tests/unit/ui/router.test.js`, `tests/unit/textos.test.js`
  - blocked-by: TASK-F0-004
  - **Commit:** `feat(ui): History API router, Spanish texts and permission page`
  - **Acceptance:**
    - Test first: `AC-001-07 (REQ-F-001)` — without a session, `/mis-reservas` renders the «Entrar» form
    - Test first: `AC-001-08 (REQ-F-001)` — a socio on `/material` gets the «Sin permiso» page (`E_PAGINA_PROHIBIDA`)
    - Test first: `REQ-C-001` — every text exported by `textos.js` is in Spanish and none is hard-coded in the pages (MNT-T-001); the test checks that the entries it names exist, never the closed list of routes or menu entries (A-03)
  - **Refs:** FASE-0, REQ-F-001, REQ-C-001, SCR-011, UC-001
  - **Revert:** SAFE — módulos nuevos
  - **Review:**
    - [ ] Las rutas se resuelven con `authorize`, sin lógica de rol en las páginas
    - [ ] Sin `toEqual` sobre la lista completa de rutas o entradas

- [ ] TASK-F0-006 Build the login page and the role home pages | `src/ui/paginas/entrar.js`, `src/ui/paginas/mis-reservas.js`, `src/ui/paginas/panel.js`, `tests/unit/ui/entrar.test.js`
  - blocked-by: TASK-F0-005
  - **Commit:** `feat(ui): login form and role home pages with Salir`
  - **Acceptance:**
    - Test first: `AC-001-03 (REQ-F-001)` — the form shows the error text «Correo o contraseña incorrectos» under the form
    - Test first: `AC-001-04 (REQ-F-001)` — the form shows «Cuenta bloqueada. Vuelve a intentarlo en 15 minutos»
    - Test first: `AC-001-01 AC-001-02 (REQ-F-001)` — after login Lucía sees «Hola, Lucía» on Mis reservas and Pablo «Hola, Pablo» on the encargado's Panel
    - Test first: `AC-002-02 (REQ-F-001)` — pressing «Salir» and going back shows «Entrar» and no private data
  - **Refs:** FASE-0, REQ-F-001, UC-001, UC-002, SCR-001, SCR-003, SCR-006
  - **Revert:** SAFE — páginas nuevas
  - **Review:**
    - [ ] El error se anuncia al lector de pantalla
    - [ ] Tras salir no queda nada en caché del navegador

### UC-015 / UC-016 — Material

- [ ] TASK-F0-007 Add and withdraw material units (API-003-01..03), test-first | `tests/integration/material.test.js`, `tests/unit/disponibilidad.test.js`, `src/server/dominio/disponibilidad.js`, `src/server/servicios/material.js`, `src/server/http/rutas.js`
  - blocked-by: TASK-F0-004
  - **Commit:** `feat(material): add, withdraw and list units with per-day availability`
  - **Acceptance:**
    - Test first: `AC-015-01 AC-015-02 (REQ-F-007)` — adding 2 «Piolet» (new type) lists «Piolet» with 2 units; adding to «Casco» increases its total; names are unique ignoring case (`INV-MAT-001..004`); data survives reopening the JSON store
    - Test first: `AC-015-03 AC-015-04 AC-015-06` — quantity 0 or empty name: error and nothing changes; a repeated submission answers `{aviso}` without duplicating
    - Test first: `AC-015-05 AC-016-05` — only the encargado manages material; socio and junta get `E_ACCESO_DENEGADO`
    - Test first: `AC-016-01 AC-016-02 (REQ-F-007)` — withdrawing 3 «Casco» with 2 reserved fails with the units needed; withdrawing 1 leaves 2; rule `total − n ≥ ocupadas` for every day ≥ hoy (`INV-RES-004`, `INV-RES-005`, PROP-021..023)
    - Test first: `AC-016-03 AC-016-04` — withdrawing again answers `{aviso}`; invalid quantity gives error
    - Test first: `REQ-F-007 AC6` — `listMaterial` offers «Casco» and does not offer «Cuerda» (0 units)
  - **Refs:** FASE-0, REQ-F-007, UC-015, UC-016, API-003-01, API-003-02, API-003-03, INV-MAT-001, INV-MAT-002, INV-MAT-003, INV-MAT-004, INV-RES-004, INV-RES-005, ADR-001, ADR-005
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Ocupadas se calcula al leer, nunca es un contador guardado

- [ ] TASK-F0-008 Build the Material page and the minimal Reservar list | `src/ui/paginas/material.js`, `src/ui/paginas/reservar.js`, `tests/unit/ui/material.test.js`, `tests/unit/ui/reservar.test.js`
  - blocked-by: TASK-F0-006, TASK-F0-007
  - **Commit:** `feat(ui): material management page and minimal reservation list`
  - **Acceptance:**
    - Test first: `AC-015-02 (REQ-F-007)` — after adding 2 «Piolet» the page lists «Piolet» with 2 units
    - Test first: `AC-016-02 AC-016-01 (REQ-F-007)` — the error names the units needed; after withdrawing 1 «Casco» it shows 2
    - Test first: `REQ-F-007 AC6` — `/reservar` for a socio lists «Casco» and does not list «Cuerda» (0 units); no form or «Reservar» button yet (arrives in FASE-1)
  - **Refs:** FASE-0, REQ-F-007, UC-015, UC-016, SCR-004, SCR-008
  - **Revert:** SAFE — páginas nuevas
  - **Review:**
    - [ ] Mensajes de error junto al campo
    - [ ] Sin formulario de reserva (alcance de FASE-1)

---

## Phase 4: Integration

**Purpose:** Sin tareas: las rutas y la navegación se registran dentro de cada rebanada (un solo bloque).
**Checkpoint:** n/a.

---

## Phase 5: Verification

**Purpose:** El recorrido de la demo, entrando por la ruta del usuario.
**Checkpoint:** El recorrido de FASE-0 pasa con capturas y vídeo.

- [ ] TASK-F0-009 Journey FASE-0: enter and load material through the user's route | `tests/e2e/fase-0.spec.js`
  - blocked-by: TASK-F0-008
  - **Commit:** `test(e2e): FASE-0 journey from /mis-reservas with captures`
  - **Acceptance:**
    - Test first: journey titled `FASE-0` (no `Workflows:` line), steps of the FASE's Demo; each step is named after the scenario it shows: `AC-001-07`, `AC-001-01`, `AC-001-08`, `AC-002-01 AC-002-02`, `AC-001-03 AC-001-04`, `AC-001-02`, `AC-015-02`, `AC-016-02 AC-016-01`, `REQ-F-007 AC6`, `AC-015-01`; the other scenarios of `Escenarios` are proved at unit/integration level and are not repeated here
    - Enters through Demo step 1 (`/mis-reservas` without a session), after `node demo/sembrar.mjs fase-0`
    - Asserts text on the element that shows it: «Entrar», «Hola, Lucía», «Sin permiso», «Cuenta bloqueada. Vuelve a intentarlo en 15 minutos», «Hola, Pablo», «Piolet», and after stopping and restarting the server «Piolet» 2 and «Casco» 2 are still listed
    - Saves `evidencias/FASE-0/{scenario id}.png` per step and one video named with `FASE-0`, attached to the test
  - **Refs:** FASE-0, REQ-F-001, REQ-F-007, AC-001-01, AC-001-02, AC-001-03, AC-001-04, AC-001-07, AC-001-08, AC-002-01, AC-002-02, AC-015-01, AC-015-02, AC-016-01, AC-016-02
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] Entra por una URL del usuario, no por un punto interno
    - [ ] Los textos se comprueban en el elemento que los muestra

### Test Exclusions

| File | Reason | Verified By |
|------|--------|-------------|
| `src/server/store/almacen-memoria.js` | doble de test, ejercitado por toda la integración | integration tests |
| `src/server/http/plugin.js`, `src/server/http/rutas.js` | infraestructura delgada | `tests/e2e/fase-0.spec.js` |
| `src/ui/paginas/{mis-reservas,panel,sin-permiso}.js` | cabecera sin lógica | `tests/e2e/fase-0.spec.js` |
| `demo/sembrar.mjs` | script de demo | N/A - infrastructure |

---

## Dependencies

### Task Dependency Graph

```text
F0-001 ──► F0-002 ──► F0-003 ──► F0-004 ──► F0-005 ──► F0-006 ──┐
                                    └──────► F0-007 ─────────────┴─► F0-008 ──► F0-009
```

### Critical Path

1. TASK-F0-001 → 002 → 003 → 004 → 005 → 006 → 008 → 009 (8 tasks)

### Parallel Execution Plan

**Stream A:** entrar/salir, material y páginas — un solo bloque serie, ver Stream Ownership.

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | TASK-F0-001, TASK-F0-002, TASK-F0-003 | package.json, vite.config.js, vitest.config.js, index.html, README.md, src/server/store/**, src/server/dominio/fechas.js, src/server/mensajes.js, src/server/app.js, src/server/servicios/sesiones.js, src/server/http/autorizar.js, tests/unit/almacen-json.test.js, tests/unit/fechas.test.js, tests/unit/sesiones.test.js, tests/unit/autorizar.test.js | main checkout, before worktrees (checkpoint `fase-0-foundation`) |
| A | TASK-F0-004, TASK-F0-005, TASK-F0-006, TASK-F0-007, TASK-F0-008 | src/server/servicios/cuentas.js, src/server/servicios/material.js, src/server/dominio/disponibilidad.js, src/server/http/plugin.js, src/server/http/rutas.js, src/ui/**, demo/**, tests/integration/**, tests/unit/ui/**, tests/unit/textos.test.js, tests/unit/disponibilidad.test.js | worktree `feat/fase-0-a` |
| integración | — | — | main checkout, after `--integrate --fase 0` |
| verificación | TASK-F0-009 | — | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Foundation | TASK-F0-003 | `fase-0-foundation` | main checkout |
| Verified | TASK-F0-009 | `fase-0-verified` | main checkout |
