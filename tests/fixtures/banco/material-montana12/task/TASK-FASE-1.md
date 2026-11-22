# Tasks: FASE-1 - Reservar material y gestionar mis reservas

> **Input:** plan/fases/FASE-1-RESERVAS.md + plan/fase-plans/PLAN-FASE-1.md
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
| Work Streams | 1 (A: 7 tasks) |
| Setup phase | 0 tasks |
| Foundation phase | 1 task |
| Slices phase | 7 tasks |
| Integration phase | 0 tasks |
| Verification phase | 1 task |

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-007 | TASK-F1-002, TASK-F1-005 |
| UC-008 | TASK-F1-003, TASK-F1-006 |
| UC-009 | TASK-F1-004, TASK-F1-006 |
| API-002-01..03 | TASK-F1-002, 003, 004 |
| ADR-001, ADR-002, ADR-005 | TASK-F1-001, 002, 004 |
| INV-RES-001..006, 009, 010 | TASK-F1-001..004 |
| INV-MUL-002, INV-MAT-003 | TASK-F1-002 |
| REQ-F-003 | TASK-F1-002, 005, 007 |
| REQ-F-004 | TASK-F1-003, 004, 006, 007 |

---

## Phase 2: Foundation

**Purpose:** Estado derivado de la reserva, compartido por reservar, listar y cancelar.
**Checkpoint:** `tests/unit/estados.test.js` en verde.

- [ ] TASK-F1-001 Derive the reservation state from dates and marks | `tests/unit/estados.test.js`, `src/server/dominio/estados.js`
  - **Commit:** `feat(dominio): derived reservation state (ADR-002)`
  - **Acceptance:**
    - Test first: `INV-RES-005 INV-RES-006 (PROP-012, 014, 015)` — `estadoReserva(reserva, hoy)` returns Reservada, Prestada, Devuelta, Cancelada or No recogida; a Prestada past `fin` keeps occupying until today; a Reservada with `fin < hoy` is No recogida (`INV-RES-008`)
    - The state is never stored: the test builds reservations from dates and marks only
  - **Refs:** FASE-1, ADR-002, SM-001, INV-RES-005, INV-RES-006, INV-RES-008
  - **Revert:** SAFE — módulo puro nuevo
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Función pura, `hoy` recibido por parámetro

---

## Phase 3: Slices

**Purpose:** Un recorrido por caso de uso, test primero.
**Checkpoint:** `tests/integration/prestamos.test.js` en verde.

### UC-007 — Reservar material

- [ ] TASK-F1-002 Reserve material when units are free every day (API-002-01), test-first | `tests/integration/prestamos.test.js`, `src/server/servicios/prestamos.js`, `src/server/http/rutas.js`, `demo/sembrar.mjs`
  - blocked-by: TASK-F1-001
  - **Commit:** `feat(prestamos): reserve material with ordered validation`
  - **Acceptance:**
    - Test first: `AC-007-01 AC-007-02 (REQ-F-003)` — 2 × Casco tomorrow for 2 days answers «Reserva creada: 2 × Casco del … al …»; 2 more the same days (3 total units) fails because there are no free units that day
    - Test first: `AC-007-03 (D-PA-009, ADR-005)` — the same form repeated (socio+material+dates+quantity of a live reservation) does not duplicate it
    - Test first: `AC-007-04 AC-007-05 AC-007-06 AC-007-07 (D-T-006)` — validation order: past date, end before start, maximum days, maximum units
    - Test first: `AC-007-08 AC-007-09 (INV-MUL-002)` — a socio with a Pending fine of their own (Marta) cannot reserve; a fine of another socio does not affect Lucía
    - Test first: `AC-007-10 AC-007-11 (INV-MAT-003)` — types with 0 units are not offered; only the socio reserves
    - Availability is computed per day from reservations (ADR-001), in one transaction; `demo/sembrar.mjs fase-1` seeds Lucía, Pablo, 3 «Casco» and Marta with a Pending fine
  - **Refs:** FASE-1, REQ-F-003, UC-007, API-002-01, INV-RES-001, INV-RES-002, INV-RES-003, INV-RES-004, INV-RES-005, INV-MUL-002, INV-MAT-003, ADR-001, ADR-005, D-PA-009
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Una sola transacción por reserva

### UC-008 — Ver mis reservas

- [ ] TASK-F1-003 List my reservations with derived state (API-002-02), test-first | `tests/integration/prestamos.test.js`, `src/server/servicios/prestamos.js`, `src/server/http/rutas.js`
  - blocked-by: TASK-F1-002
  - **Commit:** `feat(prestamos): list own reservations with derived state`
  - **Acceptance:**
    - Test first: `AC-008-01 AC-008-04 (INV-RES-010)` — Lucía sees only her own reservations with their state; another socio's are not returned
    - Test first: `AC-008-03` — a new socio gets «Aún no tienes reservas»
    - Test first: `AC-008-02` — a reservation starting today is flagged as not cancellable
    - Test first: `AC-008-05` — encargado and junta get `E_ACCESO_DENEGADO`
  - **Refs:** FASE-1, REQ-F-004, UC-008, API-002-02, INV-RES-006, INV-RES-010, INV-SEC-001
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] La propiedad se comprueba antes de leer
    - [ ] Vacío devuelve el texto literal

### UC-009 — Cancelar reserva

- [ ] TASK-F1-004 Cancel a reservation that has not started (API-002-03), test-first | `tests/integration/prestamos.test.js`, `src/server/servicios/prestamos.js`, `src/server/http/rutas.js`
  - blocked-by: TASK-F1-003
  - **Commit:** `feat(prestamos): cancel reservation with replay notice`
  - **Acceptance:**
    - Test first: `AC-009-01 (REQ-F-004)` — cancelling a future reservation answers «Reserva cancelada» and the 2 units become free again (3 free)
    - Test first: `AC-009-02 (ADR-005, D-T-007)` — cancelling again answers 200 `{aviso}` «La reserva ya estaba cancelada», no change
    - Test first: `AC-009-03 AC-009-04` — a reservation that starts today or already started is not cancelled
    - Test first: `AC-009-05 (INV-RES-010)` — another socio's reservation is rejected without revealing it
  - **Refs:** FASE-1, REQ-F-004, UC-009, API-002-03, INV-RES-006, INV-RES-009, INV-RES-010, ADR-005
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] El replay no cambia el almacén

### Interfaz

- [ ] TASK-F1-005 Add the reservation form to `/reservar` | `tests/unit/ui/reservar.test.js`, `src/ui/paginas/reservar.js`
  - blocked-by: TASK-F1-002
  - **Commit:** `feat(ui): reservation form on /reservar`
  - **Acceptance:**
    - Test first: `AC-007-01 (REQ-F-003)` — submitting 2 × Casco shows «Reserva creada: 2 × Casco…»
    - Test first: `AC-007-02 AC-007-04 AC-007-09` — the no-free-units, past-date and fine-block errors are shown next to the form
    - The type list from FASE-0 (only types with units) is kept
  - **Refs:** FASE-1, REQ-F-003, UC-007, SCR-004
  - **Revert:** SAFE — página ampliada
  - **Review:**
    - [ ] Errores accesibles junto al campo
    - [ ] Textos desde `textos.js`

- [ ] TASK-F1-006 Show my reservations with a Cancelar button per row | `tests/unit/ui/mis-reservas.test.js`, `src/ui/paginas/mis-reservas.js`
  - blocked-by: TASK-F1-004
  - **Commit:** `feat(ui): my reservations list with cancel`
  - **Acceptance:**
    - Test first: `AC-008-03 (REQ-F-004)` — an empty list shows «Aún no tienes reservas»
    - Test first: `AC-008-02` — a reservation starting today has no «Cancelar» button
    - Test first: `AC-009-01 AC-009-02 (REQ-F-004)` — cancelling shows «Reserva cancelada»; repeating shows «La reserva ya estaba cancelada»
  - **Refs:** FASE-1, REQ-F-004, UC-008, UC-009, SCR-003
  - **Revert:** SAFE — página ampliada
  - **Review:**
    - [ ] El botón solo aparece si `hoy < inicio`
    - [ ] Textos desde `textos.js`

- [ ] TASK-F1-008 Apply the visual design of `ux/` to every screen (FASE-0 observation by Andres Leon, 2026-11-22) | `tests/unit/ui/estilos.test.js`, `src/ui/estilos.css`, `src/ui/main.js`
  - blocked-by: TASK-F1-006
  - **Commit:** `feat(ui): apply the ux/ design tokens to every screen`
  - **Acceptance:**
    - Test first: the stylesheet carries the colors, typography, 44 px targets and focus ring of `ux/DESIGN-TOKENS.json`, and `main.js` loads it
    - Forms, lists, header, messages and buttons of the existing screens (Entrar, Material, Sin permiso) and of the new ones (Reservar, Mis reservas) are styled by class and tag; no text or behaviour changes
  - **Refs:** FASE-1, SCR-001, SCR-003, SCR-004, SCR-008, SCR-011
  - **Revert:** SAFE — hoja de estilos nueva
  - **Review:**
    - [ ] Contraste y foco visibles según `ux/ACCESSIBILITY-SPEC.md`
    - [ ] Ningún test existente editado

- [ ] TASK-F1-009 Let an e2e fix «hoy» to the day of its GIVEN (dev only) | `tests/unit/hoy-fichero.test.js`, `src/server/dominio/fechas.js`, `playwright.config.js`
  - blocked-by: TASK-F1-008
  - **Commit:** `test(e2e): MM_HOY_FICHERO lets a journey live the day of its GIVEN`
  - **Acceptance:**
    - Test first: while the file named by `MM_HOY_FICHERO` holds a valid day, that day is «hoy» (over `MM_HOY`); a missing or invalid file falls back to `MM_HOY`; `NODE_ENV=production` ignores it
    - The criteria whose GIVEN names today (AC-007-04 today 2026-11-22, AC-009-01 today 2026-12-04, AC-008-02 today 2026-12-05) are lived on those dates
  - **Refs:** FASE-1, D-PA-008, RN-022
  - **Revert:** SAFE — solo desarrollo y pruebas
  - **Review:**
    - [ ] Ignorado en producción

- [ ] TASK-F1-010 Capture of AC-007-02 shows the screen where its THEN is visible (review CH-002) | `tests/e2e/fase-1.spec.js`
  - blocked-by: TASK-F1-007
  - **Commit:** `test(e2e): AC-007-02 capture shows the empty list under the error`
  - **Acceptance:**
    - Test first: the capture of REQ-F-003 AC2 has «No hay unidades libres: solo queda 1 de Tienda el 2026-12-06» and «Aún no tienes reservas» both inside the captured viewport, not just in the page
    - Rule for every capture of the FASE: the texts of `ve` are asserted in the viewport before the capture
  - **Refs:** FASE-1, REQ-F-003
  - **Revert:** SAFE — solo test e2e
  - **Review:**
    - [ ] Ninguna captura de la FASE deja un texto de «Se ve» fuera de pantalla

- [ ] TASK-F1-011 Capture of AC-007-03 shows the screen where its THEN is visible (review CH-003) | `tests/e2e/fase-1.spec.js`
  - blocked-by: TASK-F1-010
  - **Commit:** `test(e2e): AC-007-03 capture shows the reservation row under the error`
  - **Acceptance:**
    - Test first: the capture of REQ-F-003 AC3 has the error and «2 × Linterna del 2026-12-05 al 2026-12-07 — Reservada» inside the captured viewport
  - **Refs:** FASE-1, REQ-F-003
  - **Revert:** SAFE — solo test e2e
  - **Review:**
    - [ ] Ninguna captura de la FASE deja un texto de «Se ve» fuera de pantalla

- [ ] TASK-F1-012 Capture of AC-007-08 shows the screen where its THEN is visible (review CH-004) | `tests/e2e/fase-1.spec.js`
  - blocked-by: TASK-F1-011
  - **Commit:** `test(e2e): AC-007-08 capture shows the empty list under the fine notice`
  - **Acceptance:**
    - Test first: the capture of REQ-F-003 AC8 has «No puedes reservar hasta pagar tu multa de 6 €» and «Aún no tienes reservas» inside the captured viewport
  - **Refs:** FASE-1, REQ-F-003
  - **Revert:** SAFE — solo test e2e
  - **Review:**
    - [ ] Ninguna captura de la FASE deja un texto de «Se ve» fuera de pantalla

---

## Phase 4: Integration

**Purpose:** Sin tareas: las rutas se registran en cada rebanada.
**Checkpoint:** n/a.

---

## Phase 5: Verification

**Purpose:** Recorrido de la demo por la ruta del usuario.
**Checkpoint:** El recorrido de FASE-1 pasa con capturas y vídeo.

- [ ] TASK-F1-007 Journey FASE-1: reserve, view and cancel through the user's route | `tests/e2e/fase-1.spec.js`
  - blocked-by: TASK-F1-005, TASK-F1-006, TASK-F1-008, TASK-F1-009
  - **Commit:** `test(e2e): FASE-1 journey from Mis reservas with captures`
  - **Acceptance:**
    - Test first: journey titled `FASE-1` (no `Workflows:` line), one step per Demo row, named `AC-008-03`, `AC-007-01`, `AC-007-02`, `AC-007-04`, `AC-009-01`, `AC-009-02`, `AC-007-09`, `AC-008-01`; other scenarios are proved at integration level and not repeated
    - Enters through Demo step 1: login as Lucía then «Mis reservas», after `node demo/sembrar.mjs fase-1`
    - Asserts «Aún no tienes reservas», «Reserva creada: 2 × Casco», «La reserva ya estaba cancelada» on the element that shows each; after restarting the server the reservation is still listed
    - Saves `evidencias/FASE-1/{scenario id}.png` per step and one video named with `FASE-1`, attached to the test
  - **Refs:** FASE-1, REQ-F-003, REQ-F-004, AC-007-01, AC-007-02, AC-007-04, AC-007-09, AC-008-01, AC-008-03, AC-009-01, AC-009-02
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] Entra por una URL del usuario
    - [ ] Los textos se comprueban en el elemento que los muestra

### Test Exclusions

| File | Reason | Verified By |
|------|--------|-------------|
| `src/server/http/rutas.js` (rutas nuevas) | infraestructura delgada | `tests/e2e/fase-1.spec.js` |

---

## Dependencies

### Task Dependency Graph

```text
F1-001 ──► F1-002 ──► F1-003 ──► F1-004 ──► F1-006 ──┐
              └──────► F1-005 ───────────────────────┴─► F1-007
```

### Critical Path

1. TASK-F1-001 → 002 → 003 → 004 → 006 → 007 (6 tasks)

### Parallel Execution Plan

**Stream A:** reservar, listar, cancelar — serie, ver Stream Ownership.

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | TASK-F1-001 | src/server/dominio/estados.js, tests/unit/estados.test.js | main checkout, before worktrees (checkpoint `fase-1-foundation`) |
| A | TASK-F1-002, TASK-F1-003, TASK-F1-004, TASK-F1-005, TASK-F1-006, TASK-F1-008, TASK-F1-009, TASK-F1-010, TASK-F1-011, TASK-F1-012 | src/server/servicios/prestamos.js, src/server/http/rutas.js, demo/sembrar.mjs, src/ui/paginas/reservar.js, src/ui/paginas/mis-reservas.js, tests/integration/prestamos.test.js, tests/unit/ui/reservar.test.js, tests/unit/ui/mis-reservas.test.js | worktree `feat/fase-1-a` |
| integración | — | — | main checkout, after `--integrate --fase 1` |
| verificación | TASK-F1-007 | — | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Foundation | TASK-F1-001 | `fase-1-foundation` | main checkout |
| Verified | TASK-F1-007 | `fase-1-verified` | main checkout |
