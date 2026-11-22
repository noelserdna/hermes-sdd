# Tasks: FASE-3 - Alta, baja y contraseña de los socios

> **Input:** plan/fases/FASE-3-SOCIOS.md + plan/fase-plans/PLAN-FASE-3.md
> **Generated:** 2026-11-22
> **Total tasks:** 10
> **Parallel capacity:** 1 work Stream (serial)
> **Critical path:** 7 tasks

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 10 |
| Parallelizable | 0 (0%) |
| Work Streams | 1 (A: 8 tasks) |
| Setup phase | 0 tasks |
| Foundation phase | 1 task |
| Slices phase | 8 tasks |
| Integration phase | 0 tasks |
| Verification phase | 1 task |

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-003 | TASK-F3-002, TASK-F3-006 |
| UC-004 | TASK-F3-003, TASK-F3-006 |
| UC-005 | TASK-F3-004, TASK-F3-006 |
| UC-006 | TASK-F3-005, TASK-F3-006 |
| API-001-03..06 | TASK-F3-002..005 |
| ADR-003, ADR-005 | TASK-F3-001, TASK-F3-005 |
| INV-SOC-001..003 | TASK-F3-002, TASK-F3-003 |
| INV-SOC-006, 102 | TASK-F3-003, TASK-F3-004 |
| INV-SOC-007, 008, 101 | TASK-F3-005 |
| INV-SOC-009 | TASK-F3-001, TASK-F3-002 |
| REQ-F-002 | TASK-F3-002..007 |

---

## Phase 2: Foundation

**Purpose:** Campo de fecha de baja en la cuenta (D-PA-003), con su migración.
**Checkpoint:** `tests/unit/migraciones.test.js` en verde.

- [ ] TASK-F3-001 Add the `bajaEn` account field with migration 002 | `tests/unit/migraciones.test.js`, `src/server/store/migraciones.js`, `src/server/store/almacen-json.js`
  - **Commit:** `feat(store): migration 002_baja_en adds bajaEn to accounts`
  - **Acceptance:**
    - Test first: `INV-SOC-009 (ADR-003, D-PA-003)` — opening a version-1 file runs 002, adds `bajaEn: null` to every account without touching other data, and bumps `version`; running it twice changes nothing; the down step removes the field
  - **Refs:** FASE-3, ADR-003, INV-SOC-009, D-PA-003, ENT-001
  - **Revert:** MIGRATION — quitar `bajaEn` con el paso de bajada antes de revertir el commit
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] La migración es idempotente y reversible

---

## Phase 3: Slices

**Purpose:** Un recorrido por caso de uso, test primero.
**Checkpoint:** `tests/integration/socios.test.js` en verde.

### UC-003 — Dar de alta socio

- [ ] TASK-F3-002 Register a member with a provisional password (API-001-04), test-first | `tests/integration/socios.test.js`, `src/server/servicios/cuentas.js`, `src/server/http/rutas.js`, `demo/sembrar.mjs`
  - blocked-by: TASK-F3-001
  - **Commit:** `feat(cuentas): register member with provisional password`
  - **Acceptance:**
    - Test first: `AC-003-01 (REQ-F-002)` — Pablo registers Álvaro with a provisional password: «Socio creado: Álvaro», account with `mustChangePassword`, response without hash
    - Test first: `AC-003-02 AC-003-03` — e-mail repeated (also of a baja account) or the same submission twice: error without duplicating; password shorter than `PASSWORD_MIN_LENGTH`: error
    - Test first: `AC-003-04` — only the encargado registers members
    - Test first: `REQ-F-002 AC1 (INV-SOC-009, INV-SOC-003)` — the stored account has only name, e-mail, scrypt hash with salt, role and flags (`SEC-T-004`: no plaintext password in `datos.json`)
    - `demo/sembrar.mjs fase-3` seeds Pablo, Lucía with a future reservation and Marta with an unreturned loan
  - **Refs:** FASE-3, REQ-F-002, UC-003, API-001-04, INV-SOC-001, INV-SOC-002, INV-SOC-003, INV-SOC-009
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] El hash nunca sale en una respuesta

### UC-004 — Cambiar contraseña provisional

- [ ] TASK-F3-003 Force the password change on first access (API-001-03), test-first | `tests/integration/socios.test.js`, `tests/unit/autorizar-provisional.test.js`, `src/server/servicios/cuentas.js`, `src/server/http/autorizar.js`, `src/server/http/rutas.js`
  - blocked-by: TASK-F3-002
  - **Commit:** `feat(cuentas): change provisional password and gate other routes`
  - **Acceptance:**
    - Test first: `AC-004-01 AC-004-02 (INV-SOC-006)` — with a provisional password only logout and change password are allowed; any other route redirects to `/cambiar-contrasena`
    - Test first: `AC-004-03 AC-004-04` — a short password is rejected; a valid one activates the account and leads to the role's home
    - Test first: `AC-004-05 AC-004-06` — without a session it is rejected; repeating changes nothing
    - Test first: `REQ-F-002 REQ-NF-001 (INV-SEC-003)` — a socio opening `/socios` gets `E_PAGINA_PROHIBIDA`
  - **Refs:** FASE-3, REQ-F-002, UC-004, API-001-03, INV-SOC-006, INV-SEC-003, SEC-T-001, SEC-T-002
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] La regla vive en `authorize`, no en las páginas

### UC-005 — Restablecer contraseña

- [ ] TASK-F3-004 Reset a member's password (API-001-05), test-first | `tests/integration/socios.test.js`, `src/server/servicios/cuentas.js`, `src/server/http/rutas.js`
  - blocked-by: TASK-F3-003
  - **Commit:** `feat(cuentas): reset member password to a provisional one`
  - **Acceptance:**
    - Test first: `AC-005-01 AC-005-02 AC-005-03 (INV-SOC-102)` — the provisional is stored hashed, the member logs in with it and must choose another; the old one stops working
    - Test first: `AC-005-04 AC-005-05 AC-005-06` — short password, non-encargado role and repetition are controlled
  - **Refs:** FASE-3, REQ-F-002, UC-005, API-001-05, INV-SOC-003, INV-SOC-102
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] La contraseña antigua queda invalidada

### UC-006 — Dar de baja socio

- [ ] TASK-F3-005 Remove a member logically and cancel future reservations (API-001-06), test-first | `tests/integration/socios.test.js`, `src/server/servicios/cuentas.js`, `src/server/http/rutas.js`
  - blocked-by: TASK-F3-004
  - **Commit:** `feat(cuentas): logical removal with bajaEn and reservation cancel`
  - **Acceptance:**
    - Test first: `AC-006-01 AC-006-02 (INV-SOC-008)` — removal answers «Socio dado de baja»; the account no longer logs in and gets «Correo o contraseña incorrectos»
    - Test first: `AC-006-03 (D-PA-011)` — future reservations are cancelled through `cancelReservation` in the same transaction; if something fails nothing changes
    - Test first: `AC-006-04 AC-006-05` — rejected with unreturned material or a Pending fine, nothing changed
    - Test first: `AC-006-07 (D-PA-002, ADR-005)` — removing someone already removed answers 200 `{aviso}` «ya estaba de baja», no error, no change
    - Test first: `AC-006-06` — only the encargado removes members
    - `bajaEn` is filled with the removal date (D-PA-003)
  - **Refs:** FASE-3, REQ-F-002, UC-006, API-001-06, INV-SOC-007, INV-SOC-008, INV-SOC-101, ADR-003, ADR-005, D-PA-002, D-PA-003, D-PA-011
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Los datos de la cuenta se conservan (baja lógica)

### Interfaz

- [ ] TASK-F3-006 Build the Socios and Cambiar contraseña pages | `tests/unit/ui/socios.test.js`, `tests/unit/ui/cambiar-contrasena.test.js`, `src/ui/paginas/socios.js`, `src/ui/paginas/cambiar-contrasena.js`
  - blocked-by: TASK-F3-005
  - **Commit:** `feat(ui): members management and password change pages`
  - **Acceptance:**
    - Test first: `AC-003-01 AC-003-02 (REQ-F-002)` — the form shows «Socio creado: Álvaro» and the repeated-e-mail error under the field
    - Test first: `AC-006-01 AC-006-07` — «Dar de baja» shows «Socio dado de baja»; repeating shows «ya estaba de baja»
    - Test first: `AC-004-01 AC-004-03 (REQ-F-002)` — «Elige una contraseña nueva», field «Contraseña nueva» with «Mostrar» and «Guardar»; short password error under the field
    - Rows have «Restablecer» and «Dar de baja»
  - **Refs:** FASE-3, REQ-F-002, UC-003, UC-004, UC-005, UC-006, SCR-002, SCR-007
  - **Revert:** SAFE — páginas nuevas
  - **Review:**
    - [ ] Errores bajo el campo, accesibles
    - [ ] Textos desde `textos.js`

### Observaciones de FASE-2 (Andres Leon, 2026-11-22)

- [ ] TASK-F3-008 Say «No hay multas» in the encargado's Panel (observation 1) | `tests/unit/ui/panel.test.js`, `tests/e2e/fase-2.spec.js`, `src/ui/textos.js`
  - blocked-by: TASK-F3-006
  - **Commit:** `fix(ui): panel del encargado dice «No hay multas»`
  - **Acceptance:**
    - Test first: `REQ-F-005 AC3 (observación 1)` — the Panel's empty fines section reads «No hay multas», not «No tienes multas» (which speaks to a member)
    - Needs a test-edit record for `tests/unit/ui/panel.test.js` and `tests/e2e/fase-2.spec.js` (Q-task-implementer-003); without it the task stays blocked
  - **Refs:** FASE-3, REQ-F-005, SCR-006, Q-task-implementer-003
  - **Revert:** SAFE — solo un texto
  - **Review:**
    - [ ] Solo cambia el texto del Panel del encargado

- [ ] TASK-F3-009 Show date fields as día/mes/año (observation 2) | `tests/unit/ui/campo-fecha.test.js`, `src/ui/campo-fecha.js`, `src/ui/paginas/reservar.js`, `src/ui/paginas/panel.js`, `src/ui/textos.js`
  - blocked-by: TASK-F3-006
  - **Commit:** `feat(ui): campos de fecha en día/mes/año`
  - **Acceptance:**
    - Test first: `REQ-C-001 (observación 2)` — the date field shows «dd/mm/aaaa»; typing «05/12/2026» sends «2026-12-05» to the server; an ISO value typed is shown as «05/12/2026»; anything else is sent as typed so the server answers «Elige una fecha válida»
  - **Refs:** FASE-3, REQ-C-001, SCR-004, SCR-006
  - **Revert:** SAFE — solo interfaz
  - **Review:**
    - [ ] El servidor sigue recibiendo AAAA-MM-DD
    - [ ] Los tests existentes no se editan

- [ ] TASK-F3-010 Make the «No recogida» video show the units free again (observation 3) | `tests/e2e/fase-2.spec.js`
  - blocked-by: TASK-F3-008
  - **Commit:** `test(e2e): AC-010-04 enseña las unidades libres tras la No recogida`
  - **Acceptance:**
    - Test first: `AC-010-04 (REQ-F-005 AC7, observación 3)` — after «No recogida», another member reserves the same 2 × Casco on the same dates and sees «Reserva creada»
    - Needs a test-edit record for `tests/e2e/fase-2.spec.js` (Q-task-implementer-003); without it the task stays blocked
  - **Refs:** FASE-3, REQ-F-005, AC-010-04, Q-task-implementer-003
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] No se quita ninguna comprobación del test

---

## Phase 4: Integration

**Purpose:** Sin tareas: las rutas se registran en cada rebanada.
**Checkpoint:** n/a.

---

## Phase 5: Verification

**Purpose:** Recorrido WF-002 por la ruta del usuario.
**Checkpoint:** El recorrido de FASE-3 pasa con capturas y vídeo.

- [ ] TASK-F3-007 Journey WF-002 FASE-3: register, first access and removal through the user's route | `tests/e2e/fase-3-alta-primer-acceso.spec.js`
  - blocked-by: TASK-F3-006
  - **Commit:** `test(e2e): WF-002 journey for FASE-3 with captures`
  - **Acceptance:**
    - Test first: journey titled `WF-002` (FASE-3 `Workflows:` line), steps named `AC-003-01`, `AC-003-02`, `AC-004-01 AC-004-02`, `AC-004-04`, `AC-005-01 AC-005-03`, `AC-006-01 AC-006-03`, `AC-006-02`, `AC-006-04`, `AC-006-07`; other scenarios are proved at integration level
    - Enters through Demo step 1: login as Pablo then `/socios`, after `node demo/sembrar.mjs fase-3`
    - Asserts «Socio creado: Álvaro», «Elige una contraseña nueva», «Socio dado de baja», «Correo o contraseña incorrectos» and «ya estaba de baja» on the element that shows each
    - Saves `evidencias/FASE-3/{scenario id}.png` per step and one video with `WF-002` in its file name, attached to the test
  - **Refs:** FASE-3, REQ-F-002, WF-002, AC-003-01, AC-003-02, AC-004-01, AC-004-04, AC-005-01, AC-006-01, AC-006-02, AC-006-04, AC-006-07
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] Entra por una URL del usuario
    - [ ] Los textos se comprueban en el elemento que los muestra

### Petición de la persona tras el rechazo (CH-010, avisos entre sesiones)

- [ ] TASK-F3-011 Resetting a member's password lifts the lock (CH-010, Q-acceptance-002) | `tests/integration/restablecer-bloqueo.test.js`, `src/server/servicios/cuentas.js`
  - blocked-by: TASK-F3-010
  - **Commit:** `fix(cuentas): restablecer la contraseña levanta el bloqueo por fallos`
  - **Acceptance:**
    - Test first: `AC-005-01 (REQ-F-002 AC5)` — Marta locked by failed attempts, Pablo sets «Otra12345»: she enters with it at once (→ Cambiar contraseña) and no longer with the old one («Correo o contraseña incorrectos»); `lockedUntil` and `failedLogins` are cleared
  - **Refs:** FASE-3, REQ-F-002, UC-005, INV-SOC-004, Q-acceptance-002
  - **Revert:** SAFE — dos campos
  - **Review:**
    - [ ] Solo cambia API-001-05

- [ ] TASK-F3-012 Notices belong to the session that made the action | `tests/unit/ui/avisos-sesion.test.js`, `src/ui/router.js`, `src/ui/componentes.js`, `src/ui/paginas/entrar.js`
  - blocked-by: TASK-F3-011
  - **Commit:** `fix(ui): los avisos son de quien hizo la acción y no pasan a otra sesión`
  - **Acceptance:**
    - Test first: the encargado removes «Marta Ruiz» («Socio dado de baja: Marta Ruiz»), leaves, Lucía enters: neither Mis reservas nor Entrar show that notice; also when the session changes without «Salir»
  - **Refs:** FASE-3, REQ-F-002, SCR-001, Q-acceptance-001
  - **Revert:** SAFE — solo interfaz
  - **Review:**
    - [ ] Entrar no enseña avisos de nadie

- [ ] TASK-F3-013 Journey WF-002 shows each notice on its own person's screen | `tests/e2e/fase-3-alta-primer-acceso.spec.js`
  - blocked-by: TASK-F3-012
  - **Commit:** `test(e2e): WF-002 enseña cada aviso en la pantalla de su sesión`
  - **Acceptance:**
    - AC-005-01, AC-006-01 and AC-006-03 no longer rely on a notice crossing from one session to another; capture and narration per criterion, `sdd lint --captures --fase 3` without errors
  - **Refs:** FASE-3, REQ-F-002, AC-005-01, AC-006-01, AC-006-03
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] Los textos de «Se ve» siguen en la captura

### Test Exclusions

| File | Reason | Verified By |
|------|--------|-------------|
| `src/server/http/rutas.js` (rutas nuevas) | infraestructura delgada | `tests/e2e/fase-3-alta-primer-acceso.spec.js` |

---

## Dependencies

### Task Dependency Graph

```text
F3-001 ──► F3-002 ──► F3-003 ──► F3-004 ──► F3-005 ──► F3-006 ──► F3-007
```

### Critical Path

1. TASK-F3-001 → 002 → 003 → 004 → 005 → 006 → 007 (7 tasks)

### Parallel Execution Plan

**Stream A:** ciclo de la cuenta — serie, ver Stream Ownership.

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | TASK-F3-001 | src/server/store/migraciones.js, src/server/store/almacen-json.js, tests/unit/migraciones.test.js | main checkout, before worktrees (checkpoint `fase-3-foundation`) |
| A | TASK-F3-002, TASK-F3-003, TASK-F3-004, TASK-F3-005, TASK-F3-006, TASK-F3-008, TASK-F3-009, TASK-F3-010 | src/ui/campo-fecha.js, src/ui/textos.js, src/ui/paginas/panel.js, src/ui/paginas/reservar.js, tests/unit/ui/campo-fecha.test.js, tests/unit/ui/panel.test.js, tests/e2e/fase-2.spec.js, src/server/servicios/cuentas.js, src/server/http/autorizar.js, src/server/http/rutas.js, src/ui/paginas/socios.js, src/ui/paginas/cambiar-contrasena.js, demo/sembrar.mjs, tests/integration/socios.test.js, tests/unit/autorizar-provisional.test.js, tests/unit/ui/socios.test.js, tests/unit/ui/cambiar-contrasena.test.js | worktree `feat/fase-3-a` |
| integración | — | — | main checkout, after `--integrate --fase 3` |
| verificación | TASK-F3-007 | — | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Foundation | TASK-F3-001 | `fase-3-foundation` | main checkout |
| Verified | TASK-F3-007 | `fase-3-verified` | main checkout |
