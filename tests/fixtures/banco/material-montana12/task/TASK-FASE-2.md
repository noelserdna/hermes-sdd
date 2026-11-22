# Tasks: FASE-2 - Entregar y recibir el material, y el panel del día

> **Input:** plan/fases/FASE-2-ENTREGAS.md + plan/fase-plans/PLAN-FASE-2.md
> **Generated:** 2026-11-22
> **Total tasks:** 7
> **Parallel capacity:** 1 work Stream (serial)
> **Critical path:** 5 tasks

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 7 |
| Parallelizable | 0 (0%) |
| Work Streams | 1 (A: 5 tasks) |
| Setup phase | 0 tasks |
| Foundation phase | 1 task |
| Slices phase | 5 tasks |
| Integration phase | 0 tasks |
| Verification phase | 1 task |

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-010 | TASK-F2-002 |
| UC-011 | TASK-F2-003 |
| UC-017 | TASK-F2-004, TASK-F2-006 |
| API-002-04..06 | TASK-F2-002, 003, 004 |
| ADR-002, ADR-004, ADR-005 | TASK-F2-001, 002, 003 |
| INV-RES-007..009 | TASK-F2-002 |
| INV-MUL-001, 004 | TASK-F2-001, TASK-F2-003 |
| INV-SEC-003 | TASK-F2-002, 003, 004 |
| REQ-F-005 | TASK-F2-001..003, 006, 007 |
| REQ-F-008 | TASK-F2-004, 006, 007 |
| REQ-NF-002 | TASK-F2-005, TASK-F2-007 |

---

## Phase 2: Foundation

**Purpose:** Cálculo de multas puro, compartido por devolver y el panel.
**Checkpoint:** `tests/unit/multas-dominio.test.js` en verde.

- [ ] TASK-F2-001 Compute late days and fine amount | `tests/unit/multas-dominio.test.js`, `src/server/dominio/multas.js`
  - **Commit:** `feat(dominio): late days and fine amount (INV-MUL-004)`
  - **Acceptance:**
    - Test first: `AC-011-02 AC-011-03 (REQ-F-005, PROP-017, PROP-020)` — `diasRetraso` gives 3 for a loan due 3 days ago and 1 for 1 day; `importeMulta(3)` = `FINE_PER_DAY_EUR` × 3 and `importeMulta(1)` = `FINE_PER_DAY_EUR` × 1; 0 days gives no fine
  - **Refs:** FASE-2, REQ-F-005, INV-MUL-004, ADR-004
  - **Revert:** SAFE — módulo puro nuevo
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] El importe sale del valor `FINE_PER_DAY_EUR`, sin literal en el código

---

## Phase 3: Slices

**Purpose:** Un recorrido por caso de uso, test primero.
**Checkpoint:** Tests de integración de entregas, panel y datos compartidos en verde.

### UC-010 — Entregar reserva

- [ ] TASK-F2-002 Deliver a reservation (API-002-04), test-first | `tests/integration/entregas.test.js`, `src/server/servicios/prestamos.js`, `src/server/http/rutas.js`
  - **Commit:** `feat(prestamos): deliver reservation with replay notice`
  - **Acceptance:**
    - Test first: `AC-010-01 (REQ-F-005)` — delivering today's reservation turns it Prestada and records the delivery date
    - Test first: `AC-010-02 (D-PA-005, ADR-005)` — delivering again answers `{aviso}` «ya estaba entregada», no change; the notice wins over `E_NO_PRESTADA`
    - Test first: `AC-010-03 AC-010-04 (INV-RES-007, INV-RES-008)` — before `startDate` it is not delivered; one past its end without pickup shows «No recogida» and frees the units
    - Test first: `AC-010-05 AC-010-06 AC-010-07 (INV-SEC-003)` — unknown, Cancelada or Devuelta reservation and non-encargado roles: error, no change
  - **Refs:** FASE-2, REQ-F-005, UC-010, API-002-04, INV-RES-007, INV-RES-008, INV-RES-009, INV-SEC-003, ADR-002, ADR-005, D-PA-005
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Solo el encargado entrega

### UC-011 — Recibir devolución

- [ ] TASK-F2-003 Receive a return and create the fine (API-002-05), test-first | `tests/integration/entregas.test.js`, `src/server/servicios/prestamos.js`, `src/server/http/rutas.js`
  - blocked-by: TASK-F2-001, TASK-F2-002
  - **Commit:** `feat(prestamos): return loan and fine on late return (ADR-004)`
  - **Acceptance:**
    - Test first: `AC-011-01 (REQ-F-005)` — on-time return closes the loan and creates no fine
    - Test first: `AC-011-02 AC-011-03` — 3 days late creates one fine of `FINE_PER_DAY_EUR` × 3 and 1 day late of × 1, in the same transaction as the return
    - Test first: `AC-011-04 (INV-MUL-001, D-PA-005)` — returning again answers `{aviso}` and creates no second fine
    - Test first: `AC-011-05 AC-011-06 AC-011-07` — not delivered (`E_NO_PRESTADA`), unknown and non-encargado roles: error
  - **Refs:** FASE-2, REQ-F-005, UC-011, API-002-05, INV-MUL-001, INV-MUL-004, INV-SEC-003, ADR-004, ADR-005, D-PA-005
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Una multa por préstamo aunque se repita

### UC-017 — Panel del encargado

- [ ] TASK-F2-004 Daily panel by date (API-002-06), test-first | `tests/integration/panel.test.js`, `src/server/servicios/panel.js`, `src/server/http/rutas.js`
  - blocked-by: TASK-F2-003
  - **Commit:** `feat(panel): daily panel of loans, returns and deliveries`
  - **Acceptance:**
    - Test first: `AC-017-01 AC-017-02 AC-017-05 (REQ-F-008)` — lists what is lent, what returns today and what is to deliver; with no loans the empty message
    - Test first: `AC-017-03 AC-017-04 (D-PA-010)` — with a chosen date everything is recalculated for that day; an invalid date is a validation error
    - Test first: `AC-017-08 AC-017-09 (REQ-F-005)` — an overdue loan shows 3 days or 1 day of delay
    - Test first: `AC-017-06 AC-017-07 (REQ-F-008)` — socio and junta get `E_PAGINA_PROHIBIDA` / `E_ACCESO_DENEGADO`
    - Response carries `Cache-Control: no-store`
  - **Refs:** FASE-2, REQ-F-008, UC-017, API-002-06, INV-MUL-004, INV-SEC-003, D-PA-010
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] Lectura pura sobre el almacén
    - [ ] Retraso calculado con `dominio/multas`

### REQ-NF-002 — Datos compartidos

- [ ] TASK-F2-005 Shared data across devices and server restart, test-first | `tests/integration/rendimiento.test.js`, `src/server/store/almacen-json.js`, `demo/sembrar.mjs`
  - blocked-by: TASK-F2-004
  - **Commit:** `feat(store): reads see other clients' writes and survive restart`
  - **Acceptance:**
    - Test first: `REQ-NF-002 AC1 (SPEC-PERF-001, PERF-001)` — a reservation made through one session is returned by the panel of another session in ≤ `SYNC_VISIBILITY_SECONDS`
    - Test first: `REQ-NF-002 AC2 (SPEC-PERF-003, D-T-011)` — after closing and reopening the JSON store, reservations and loans are still there
    - `demo/sembrar.mjs fase-2` seeds Lucía's reservations for today and a loan overdue by 3 days
  - **Refs:** FASE-2, REQ-NF-002, SPEC-PERF-001, SPEC-PERF-002, SPEC-PERF-003, ADR-DRAFT-002
  - **Revert:** SAFE — cambio local del almacén
  - **Review:**
    - [ ] Un único almacén en el servidor, nada en el navegador
    - [ ] El tiempo sale de `SYNC_VISIBILITY_SECONDS`

### Interfaz

- [ ] TASK-F2-006 Build the Panel with Entregar and Devolver per row | `tests/unit/ui/panel.test.js`, `src/ui/paginas/panel.js`
  - blocked-by: TASK-F2-004
  - **Commit:** `feat(ui): panel with date picker and deliver/return actions`
  - **Acceptance:**
    - Test first: `AC-017-01 AC-017-05 (REQ-F-008)` — shows the three lists, or the empty message
    - Test first: `AC-010-01 AC-010-02 (REQ-F-005)` — «Entregar» turns the row Prestada; repeating shows the notice that it was already delivered
    - Test first: `AC-011-02 AC-017-08 (REQ-F-005)` — «Devolver» on a loan overdue 3 days shows «3 días de retraso» and the fine for `FINE_PER_DAY_EUR` × 3
    - Test first: `AC-017-03` — choosing another date shows that day's list
  - **Refs:** FASE-2, REQ-F-005, REQ-F-008, UC-010, UC-011, UC-017, SCR-006
  - **Revert:** SAFE — página ampliada
  - **Review:**
    - [ ] Textos desde `textos.js`
    - [ ] Las acciones usan las operaciones del servidor

---

## Phase 3b: Review fixes

- [ ] TASK-F2-008 Show «No recogida» in the Panel for reservations that ended without delivery (CH-009) | `tests/e2e/fase-2.spec.js`, `tests/integration/panel.test.js`, `tests/unit/ui/panel.test.js`, `src/server/servicios/panel.js`, `src/ui/paginas/panel.js`, `src/ui/textos.js`
  - blocked-by: TASK-F2-006
  - **Source:** FEEDBACK-FASE-2
  - **Reproduce first:** AC-010-04 opens the Panel on 2026-12-08 for a reservation that ended 2026-12-07 and never reached delivery; the Panel lists nothing and «No recogida» only appeared as an alert after pressing a stale «Entregar»
  - **Commit:** `fix(panel): list «No recogida» reservations without Entregar (RN-029)`
  - **Acceptance:**
    - Test first: the Panel API returns `noRecogidas` (Reservada with fin < hoy and ≥ hoy − 7 days), the page shows its «No recogida» group with «No recogida: 2 × Casco — Lucía Gil — hasta el 2026-12-07» and no «Entregar» button; e2e AC-010-04 does the GIVEN with its own data (hoy 2026-12-08), opens the Panel as Pablo and captures that screen
  - **Refs:** FASE-2, REQ-F-005, REQ-F-008, AC-010-04, UC-010, UC-017
  - **Revert:** SAFE — solo lectura del panel
  - **Review:**
    - [ ] «No recogida» no ofrece «Entregar» y no crea multa
    - [ ] El panel sigue sin cambiar nada al abrirse

- [ ] TASK-F2-009 Captures of AC-017-06 and AC-017-07 name and show the «Sin permiso» screen (CH-007, CH-008) | `tests/e2e/fase-2.spec.js`
  - blocked-by: TASK-F2-007
  - **Source:** FEEDBACK-FASE-2
  - **Reproduce first:** the narration of both captures says «En Panel del encargado se ve …» over a screen titled «Sin permiso» (SCR-011), and the test does not assert the URL or the screen heading
  - **Commit:** `test(e2e): AC-017-06 and AC-017-07 capture the Sin permiso screen they name`
  - **Acceptance:**
    - WRONG-CAPTURE rule applied to every capture of FASE-2: the other 15 captures name «Panel del encargado» and show it; AC-017-06/07 open «/panel» as Lucía (socia) and Elena (junta), assert the URL, the «Sin permiso» heading, the whole message and no panel data, and capture with both texts in view
  - **Refs:** FASE-2, REQ-F-008, AC-017-06, AC-017-07
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] La locución nombra la pantalla que se ve

## Phase 4: Integration

**Purpose:** Sin tareas: las rutas se registran en cada rebanada.
**Checkpoint:** n/a.

---

## Phase 5: Verification

**Purpose:** Recorrido de la demo por la ruta del usuario.
**Checkpoint:** El recorrido de FASE-2 pasa con capturas y vídeo.

- [ ] TASK-F2-007 Journey FASE-2: deliver, return and panel through the user's route | `tests/e2e/fase-2.spec.js`
  - blocked-by: TASK-F2-005, TASK-F2-006
  - **Commit:** `test(e2e): FASE-2 journey from the Panel with captures`
  - **Acceptance:**
    - Test first: journey titled `FASE-2` (no `Workflows:` line), steps named `AC-017-01`, `AC-010-01`, `AC-010-02`, `AC-011-02`, `AC-011-01`, `AC-017-03`, `AC-017-06`, `REQ-NF-002 AC1`, `REQ-NF-002 AC2`; other scenarios are proved at integration level
    - Enters through Demo step 1: login as Pablo then `/panel`, after `node demo/sembrar.mjs fase-2`
    - Asserts «3 días de retraso» and the fine amount on the row, «Sin permiso» for Lucía on `/panel`, and that after restarting the server reservations and loans are still listed
    - Saves `evidencias/FASE-2/{scenario id}.png` per step and one video named with `FASE-2`, attached to the test
  - **Refs:** FASE-2, REQ-F-005, REQ-F-008, REQ-NF-002, AC-010-01, AC-010-02, AC-011-01, AC-011-02, AC-017-01, AC-017-03, AC-017-06
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] Entra por una URL del usuario
    - [ ] Los textos se comprueban en el elemento que los muestra

### Test Exclusions

| File | Reason | Verified By |
|------|--------|-------------|
| `src/server/http/rutas.js` (rutas nuevas) | infraestructura delgada | `tests/e2e/fase-2.spec.js` |

---

## Dependencies

### Task Dependency Graph

```text
F2-001 ──┐
F2-002 ──┴─► F2-003 ──► F2-004 ──► F2-005 ──┐
                           └──────► F2-006 ──┴─► F2-007
```

### Critical Path

1. TASK-F2-002 → 003 → 004 → 005 → 008 (5 tasks)

### Parallel Execution Plan

**Stream A:** entregas, devoluciones, panel y datos compartidos — serie, ver Stream Ownership.

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | TASK-F2-001 | src/server/dominio/multas.js, tests/unit/multas-dominio.test.js | main checkout, before worktrees (checkpoint `fase-2-foundation`) |
| A | TASK-F2-002, TASK-F2-003, TASK-F2-004, TASK-F2-005, TASK-F2-006 | src/server/servicios/prestamos.js, src/server/servicios/panel.js, src/server/http/rutas.js, src/server/store/almacen-json.js, src/ui/paginas/panel.js, demo/sembrar.mjs, tests/integration/entregas.test.js, tests/integration/panel.test.js, tests/integration/rendimiento.test.js, tests/unit/ui/panel.test.js | worktree `feat/fase-2-a` |
| integración | — | — | main checkout, after `--integrate --fase 2` |
| verificación | TASK-F2-007 | — | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Foundation | TASK-F2-001 | `fase-2-foundation` | main checkout |
| Verified | TASK-F2-007 | `fase-2-verified` | main checkout |
