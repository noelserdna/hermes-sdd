# Tasks: FASE-4 - Multas y bloqueo hasta pagarlas

> **Input:** plan/fases/FASE-4-MULTAS.md + plan/fase-plans/PLAN-FASE-4.md
> **Generated:** 2026-11-22
> **Total tasks:** 5
> **Parallel capacity:** 1 work Stream (serial)
> **Critical path:** 5 tasks

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 5 |
| Parallelizable | 0 (0%) |
| Work Streams | 1 (A: 4 tasks) |
| Setup phase | 0 tasks |
| Foundation phase | 0 tasks |
| Slices phase | 4 tasks |
| Integration phase | 0 tasks |
| Verification phase | 1 task |

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-012 | TASK-F4-001, TASK-F4-004 |
| UC-013 | TASK-F4-002, TASK-F4-004 |
| UC-014 | TASK-F4-003, TASK-F4-004 |
| API-004-01..03 | TASK-F4-001..003 |
| ADR-004, ADR-005 | TASK-F4-002 |
| INV-MUL-002, 003 | TASK-F4-002 |
| INV-SEC-001, 003 | TASK-F4-001..003 |
| REQ-F-006 | TASK-F4-001..005 |

---

## Phase 3: Slices

**Purpose:** Un recorrido por caso de uso, test primero.
**Checkpoint:** `tests/integration/multas.test.js` en verde.

### UC-012 — Ver mis multas

- [ ] TASK-F4-001 List my fines (API-004-01), test-first | `tests/integration/multas.test.js`, `src/server/servicios/multas.js`, `src/server/http/rutas.js`, `demo/sembrar.mjs`
  - **Commit:** `feat(multas): list own fines`
  - **Acceptance:**
    - Test first: `AC-012-01 (REQ-F-006)` — Lucía sees her Pending fine of 3 days with its amount (`FINE_PER_DAY_EUR` × 3)
    - Test first: `AC-012-02` — a socio without fines gets the empty message
    - Test first: `AC-012-03 AC-012-04 (INV-SEC-001)` — another socio's fine does not appear; other roles get `E_ACCESO_DENEGADO`
    - `demo/sembrar.mjs fase-4` seeds Lucía with a loan overdue by 3 days
  - **Refs:** FASE-4, REQ-F-006, UC-012, API-004-01, ENT-004, INV-SEC-001
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Solo multas de la sesión

### UC-013 — Marcar multa pagada

- [ ] TASK-F4-002 Mark a fine paid and lift the reservation block (API-004-02), test-first | `tests/integration/multas.test.js`, `src/server/servicios/multas.js`, `src/server/http/rutas.js`
  - blocked-by: TASK-F4-001
  - **Commit:** `feat(multas): pay fine with replay notice and computed unblock`
  - **Acceptance:**
    - Test first: `AC-013-01 AC-013-03 (INV-MUL-003, D-PA-012)` — paying the only Pending fine makes it Pagada and Lucía can reserve again; with another Pending fine she still cannot; reservations already made stay
    - Test first: `AC-013-02 (ADR-005)` — paying again answers 200 `{aviso}` «ya estaba pagada», no change
    - Test first: `AC-013-04 AC-013-05` — unknown fine gives `E_MULTA_NO_ENCONTRADA`; non-encargado roles (also junta) get `E_ACCESO_DENEGADO` without changes
    - The block is computed (any Pending fine of the socio), no flag stored
  - **Refs:** FASE-4, REQ-F-006, UC-013, API-004-02, INV-MUL-002, INV-MUL-003, INV-SEC-003, ADR-004, ADR-005, D-PA-012
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] No se guarda indicador de bloqueo

### UC-014 — Ver todas las multas

- [ ] TASK-F4-003 List all fines for the encargado (API-004-03), test-first | `tests/integration/multas.test.js`, `src/server/servicios/multas.js`, `src/server/http/rutas.js`
  - blocked-by: TASK-F4-002
  - **Commit:** `feat(multas): list all fines with status`
  - **Acceptance:**
    - Test first: `AC-014-01 (REQ-F-006)` — the encargado sees every fine with its state (Pendiente, Pagada)
    - Test first: `AC-014-02 (INV-SEC-003)` — socio and junta get `E_ACCESO_DENEGADO`
  - **Refs:** FASE-4, REQ-F-006, UC-014, API-004-03, INV-SEC-003
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Solo encargado

### Interfaz

- [ ] TASK-F4-004 Build Mis multas and Multas pages | `tests/unit/ui/mis-multas.test.js`, `tests/unit/ui/multas.test.js`, `src/ui/paginas/mis-multas.js`, `src/ui/paginas/multas.js`
  - blocked-by: TASK-F4-003
  - **Commit:** `feat(ui): my fines and all fines pages`
  - **Acceptance:**
    - Test first: `AC-012-01 AC-012-02 (REQ-F-006)` — «Mis multas» shows the Pending fine with amount and days, or the empty message
    - Test first: `AC-014-01 AC-013-01 (REQ-F-006)` — «Multas» lists every fine and «Marcar pagada» turns the row to Pagada
    - Test first: `AC-013-02` — repeating shows «ya estaba pagada»
  - **Refs:** FASE-4, REQ-F-006, UC-012, UC-013, UC-014, SCR-005, SCR-009
  - **Revert:** SAFE — páginas nuevas
  - **Review:**
    - [ ] Textos desde `textos.js`
    - [ ] «Marcar pagada» solo en filas Pendiente

---

## Phase 4: Integration

**Purpose:** Sin tareas: las rutas se registran en cada rebanada.
**Checkpoint:** n/a.

---

## Phase 5: Verification

**Purpose:** Ciclo completo WF-001 en vídeo por la ruta del usuario.
**Checkpoint:** El recorrido de FASE-4 pasa con capturas y vídeo.

- [ ] TASK-F4-005 Journey WF-001 FASE-4: the full loan cycle through the user's route | `tests/e2e/fase-4-ciclo-prestamo.spec.js`
  - blocked-by: TASK-F4-004
  - **Commit:** `test(e2e): WF-001 loan cycle journey for FASE-4 with video`
  - **Acceptance:**
    - Test first: journey titled `WF-001` (FASE-4 `Workflows:` line), steps named `AC-011-02`, `AC-012-01`, `AC-007-09`, `AC-014-01`, `AC-013-01`, `AC-013-02`, `AC-012-02`; other scenarios are proved at integration level. The file name carries the `fase-4-` prefix so `SDD_FASE=4` runs it (the plan's `ciclo-prestamo.spec.js` would be skipped)
    - Enters through Demo step 1: login as Pablo then `/panel`, after `node demo/sembrar.mjs fase-4`
    - Asserts the 3-day fine on «Mis multas», the reservation block text, «ya estaba pagada» and the empty/paid state on the element that shows each; Lucía reserves again after payment
    - Saves `evidencias/FASE-4/{scenario id}.png` per step and one video with `WF-001` in its file name, attached to the test
  - **Refs:** FASE-4, REQ-F-006, WF-001, AC-007-09, AC-011-02, AC-012-01, AC-012-02, AC-013-01, AC-013-02, AC-014-01
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] Recorre el ciclo completo reservar-entregar-devolver-pagar
    - [ ] Los textos se comprueban en el elemento que los muestra

### Test Exclusions

| File | Reason | Verified By |
|------|--------|-------------|
| `src/server/http/rutas.js` (rutas nuevas) | infraestructura delgada | `tests/e2e/fase-4-ciclo-prestamo.spec.js` |

---

## Dependencies

### Task Dependency Graph

```text
F4-001 ──► F4-002 ──► F4-003 ──► F4-004 ──► F4-005
```

### Critical Path

1. TASK-F4-001 → 002 → 003 → 004 → 005 (5 tasks)

### Parallel Execution Plan

**Stream A:** multas — serie, ver Stream Ownership.

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | — | — | main checkout, before worktrees (checkpoint `fase-4-foundation`) |
| A | TASK-F4-001, TASK-F4-002, TASK-F4-003, TASK-F4-004 | src/server/servicios/multas.js, src/server/http/rutas.js, src/ui/paginas/mis-multas.js, src/ui/paginas/multas.js, demo/sembrar.mjs, tests/integration/multas.test.js, tests/unit/ui/mis-multas.test.js, tests/unit/ui/multas.test.js | worktree `feat/fase-4-a` |
| integración | — | — | main checkout, after `--integrate --fase 4` |
| verificación | TASK-F4-005 | — | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Foundation | — (sin tareas base) | `fase-4-foundation` | main checkout |
| Verified | TASK-F4-005 | `fase-4-verified` | main checkout |
