# Tasks: FASE-5 - Historial para la junta y datos personales protegidos

> **Input:** plan/fases/FASE-5-JUNTA.md + plan/fase-plans/PLAN-FASE-5.md
> **Generated:** 2026-11-22
> **Total tasks:** 7
> **Parallel capacity:** 1 work Stream (serial)
> **Critical path:** 6 tasks

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 7 |
| Parallelizable | 0 (0%) |
| Work Streams | 1 (A: 4 tasks) |
| Setup phase | 0 tasks |
| Foundation phase | 0 tasks |
| Slices phase | 4 tasks |
| Integration phase | 0 tasks |
| Verification phase | 3 tasks |

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-018 | TASK-F5-001, TASK-F5-002 |
| UC-019 | TASK-F5-003, TASK-F5-004 |
| API-001-07 | TASK-F5-001 |
| API-002-07 | TASK-F5-003, TASK-F5-004 |
| ADR-003 | TASK-F5-004 |
| INV-SEC-001..003 | TASK-F5-001, TASK-F5-005 |
| INV-RES-011 | TASK-F5-003 |
| INV-SOC-009 | TASK-F5-004, TASK-F5-005 |
| REQ-F-009 | TASK-F5-001, TASK-F5-002, TASK-F5-006 |
| REQ-NF-001 | TASK-F5-005, TASK-F5-006 |
| REQ-NF-003 | TASK-F5-003..006 |

---

## Phase 3: Slices

**Purpose:** Un recorrido por caso de uso, test primero.
**Checkpoint:** Tests de integración de historial y depuración en verde.

### UC-018 — Consultar historial de un socio

- [ ] TASK-F5-001 Search a member's history, read-only (API-001-07), test-first | `tests/integration/historial.test.js`, `src/server/servicios/historial.js`, `src/server/http/rutas.js`, `demo/sembrar.mjs`
  - **Commit:** `feat(historial): read-only member history search`
  - **Acceptance:**
    - Test first: `AC-018-01 (REQ-F-009)` — searching «Lucía» returns her loans and her paid fine
    - Test first: `AC-018-02 AC-018-03 AC-018-05` — a member without loans, a search with no match and several matches each give their own message (`E_BUSQUEDA_VACIA` for an empty query)
    - Test first: `AC-018-04 AC-018-06 (INV-SEC-002)` — the junta reads but cannot manage: deliver or pay answers «Acceso denegado» without changes; socio gets `E_ACCESO_DENEGADO`
    - The response has `Cache-Control: no-store` and no hash; `demo/sembrar.mjs fase-5` seeds Lucía with loans and a paid fine, Marta with a 2023 loan and a junta member
  - **Refs:** FASE-5, REQ-F-009, UC-018, API-001-07, INV-SEC-001, INV-SEC-002, INV-SEC-003
  - **Revert:** SAFE — rebanada nueva
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Ninguna operación de escritura expuesta a la junta

- [ ] TASK-F5-002 Build the Historial page | `tests/unit/ui/historial.test.js`, `src/ui/paginas/historial.js`
  - blocked-by: TASK-F5-001
  - **Commit:** `feat(ui): history page with member search`
  - **Acceptance:**
    - Test first: `AC-018-01 (REQ-F-009)` — «Buscar socio» with «Lucía» lists her loans and the paid fine
    - Test first: `AC-018-03 AC-018-05` — shows the no-match message and the result list with links
    - The history view has no action buttons (read-only)
  - **Refs:** FASE-5, REQ-F-009, UC-018, SCR-010
  - **Revert:** SAFE — página nueva
  - **Review:**
    - [ ] Textos desde `textos.js`
    - [ ] Sin botones de acción

### UC-019 — Depurar historial antiguo

- [ ] TASK-F5-003 Purge old closed records after RETENTION_YEARS (API-002-07), test-first | `tests/integration/depurar.test.js`, `src/server/servicios/depurar.js`, `src/server/http/plugin.js`
  - **Commit:** `feat(depurar): purge closed loans and fines past retention`
  - **Acceptance:**
    - Test first: `AC-019-01 AC-019-02 (REQ-NF-003, INV-RES-011)` — with `hoy` = 2026-11-22 the loan ended 2023-11-01 disappears; the one ended 2025-01-10 stays; exactly `hoy − RETENTION_YEARS` stays
    - Test first: `AC-019-03 (RN-033)` — purging twice leaves the same state; never deletes live loans or Pending fines
    - `purgeOldRecords(ctx, {hoy})` takes the date for tests (D-PA-013); it makes `datos.json.bak` before deleting; the plugin runs it at startup and every 24 h
  - **Refs:** FASE-5, REQ-NF-003, UC-019, API-002-07, INV-RES-011, RN-033, D-PA-013
  - **Revert:** SAFE — tarea nueva (los datos borrados se recuperan de `datos.json.bak`)
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Idempotente y en una sola transacción

- [ ] TASK-F5-004 Erase personal data 3 years after a member's removal, test-first | `tests/integration/depurar.test.js`, `src/server/servicios/depurar.js`
  - blocked-by: TASK-F5-003
  - **Commit:** `feat(depurar): erase name and e-mail 3 years after removal (D-PA-003)`
  - **Acceptance:**
    - Test first: `REQ-NF-003 (D-PA-003, INV-SOC-009, ADR-003)` — an account with `bajaEn` ≤ `hoy` − 3 years loses name and e-mail (a unique placeholder per id remains, the e-mail is freed for a new registration); one removed less than 3 years ago keeps them; exactly 3 years ago is erased only per the rule `bajaEn ≤ hoy − 3 años`
    - Test first: `INV-SOC-009` — running it again changes nothing; the history of the member keeps its own retention
  - **Refs:** FASE-5, REQ-NF-003, API-002-07, INV-SOC-009, ADR-003, D-PA-003
  - **Revert:** SAFE — cambio local de la tarea (los datos borrados se recuperan de `datos.json.bak`)
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] El marcador no contiene datos personales

---

## Phase 4: Integration

**Purpose:** Sin tareas: las rutas se registran en cada rebanada.
**Checkpoint:** n/a.

---

## Phase 5: Verification

**Purpose:** Aislamiento por rol de punta a punta y recorrido de la demo.
**Checkpoint:** SEC-T-001..004 y el recorrido de FASE-5 pasan.

- [ ] TASK-F5-005 Role isolation and no plaintext passwords across the whole matrix | `tests/security/aislamiento.test.js`
  - blocked-by: TASK-F5-001, TASK-F5-004
  - **Commit:** `test(security): role x operation matrix and stored-data checks`
  - **Acceptance:**
    - Test first: `REQ-NF-001 AC1 (SEC-T-001)` — a socio asking for another socio's reservation or fine gets `E_ACCESO_DENEGADO` and no data
    - Test first: `REQ-NF-001 AC2 (INV-SEC-002)` — the junta cannot deliver or mark a fine paid
    - Test first: `REQ-NF-001 AC3 (SEC-T-003)` — a socio opening `/socios` gets `E_PAGINA_PROHIBIDA`; the matrix is walked as a whole against `PERMISSIONS-MATRIX.md` checking that the operations each criterion names are denied, without pinning the closed list
    - Test first: `REQ-NF-001 AC4 REQ-NF-003 AC1 (SEC-T-004, D-T-009, INV-SOC-009)` — the stored JSON has only name, e-mail and hash with salt per account; no plaintext password anywhere
    - If a role leaks, the failing case is reported as a defect for `sdd-task-generator` Mode 5 and the plan is not changed here
  - **Refs:** FASE-5, REQ-NF-001, REQ-NF-003, SPEC-SEC-001, SPEC-SEC-002, SPEC-SEC-003, INV-SEC-001, INV-SEC-002, INV-SEC-003, INV-SOC-009
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] Cada rol probado contra cada operación nombrada por un criterio
    - [ ] Sin `toHaveLength` sobre la lista completa de operaciones

- [ ] TASK-F5-006 Journey FASE-5: history, isolation and purge through the user's route | `tests/e2e/fase-5.spec.js`
  - blocked-by: TASK-F5-002, TASK-F5-005
  - **Commit:** `test(e2e): FASE-5 journey from the junta's history with captures`
  - **Acceptance:**
    - Test first: journey titled `FASE-5` (no `Workflows:` line), steps named `AC-018-01`, `AC-018-03`, `AC-018-04 REQ-NF-001 AC2`, `REQ-NF-001 AC1`, `REQ-NF-001 AC3`, `REQ-NF-001 AC4 REQ-NF-003 AC1`, `AC-019-01 AC-019-02`, `AC-019-03`; other scenarios are proved at integration level
    - Enters through Demo step 1: login as the junta then `/historial`, after `node demo/sembrar.mjs fase-5`
    - Asserts the loans and paid fine of Lucía, the no-match message, «Acceso denegado» on the element that shows it, and after the purge with `hoy` = 2026-11-22 the 2023-11-01 loan gone and the 2025-01-10 one present
    - Saves `evidencias/FASE-5/{scenario id}.png` per step and one video named with `FASE-5`, attached to the test
  - **Refs:** FASE-5, REQ-F-009, REQ-NF-001, REQ-NF-003, AC-018-01, AC-018-03, AC-018-04, AC-019-01, AC-019-02, AC-019-03
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] Entra por una URL del usuario
    - [ ] Los textos se comprueban en el elemento que los muestra

- [ ] TASK-F5-007 Show «No tienes multas» in Lucía's «Mis multas» in the REQ-F-005 AC3 and AC9 tests and videos (FASE-4 observation Q1) | `tests/e2e/fase-2.spec.js`
  - blocked-by: Q-task-implementer-008 (test-edit record signed for `tests/e2e/fase-2.spec.js`)
  - **Commit:** `test(e2e): enseñar «No tienes multas» en Mis multas de Lucía en AC-011-01 y AC-017-08` (cites `Autoriza: Q-task-implementer-008`)
  - **Acceptance:**
    - `AC-011-01 REQ-F-005 AC3` — after the return on time, Lucía opens «Mis multas» and sees «No tienes multas»; the narration and the capture say it
    - `AC-017-08 REQ-F-005 AC9` — with the loan not returned on 2026-12-10, Lucía opens «Mis multas» and sees «No tienes multas»
    - No existing assertion is removed; only the files of the signed `test-edit` record are touched
  - **Refs:** FASE-5, REQ-F-005, REQ-F-006, AC-011-01, AC-017-08
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] Solo se edita lo que autoriza el registro test-edit
    - [ ] La captura enseña la pantalla de Lucía con «No tienes multas»

- [ ] TASK-F5-008 Prove REQ-NF-003 AC2 with loans made through the real flow and the JSON file store (CH-012, BYPASS-PATH) | `tests/integration/depurar.test.js`
  - **Commit:** `test(depurar): probar REQ-NF-003 AC2 con préstamos hechos por el recorrido real y el almacén en fichero`
  - **Acceptance:**
    - `AC-019-01 REQ-NF-003 AC2` — Marta reserves, Pablo delivers and receives two loans (ending 2023-11-01 and 2025-01-10) through the HTTP handler with the clock moved to each day; on 2026-11-22 the plugin's purge (`programarDepuracion` → `runPurge`) runs and the file read by a new store holds only the loan ended 2025-01-10
    - No existing test is edited
  - **Refs:** FASE-5, REQ-NF-003, UC-019, API-002-07, INV-RES-011
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] Los datos del GIVEN los crea el propio test con su actor, sin sembrar reservas ya cerradas
    - [ ] El THEN se lee del fichero con un almacén nuevo

- [ ] TASK-F5-009 Prove REQ-C-001 AC1: no English phrase from the control list in the interface texts | `tests/unit/restriccion-textos.test.js`
  - **Commit:** `test(textos): probar REQ-C-001 AC1 sin frases en inglés de la lista de control`
  - **Acceptance:**
    - `REQ-C-001 AC1` — the interface texts (`src/ui/textos.js`) contain none of the English phrases of a control list («Login», «Logout», «Sign in», «Submit», «Password», «Loading», «Welcome», «Save», «Cancel», «Delete») and «Entrar», «Contraseña», «Salir» are in Spanish
    - No existing test is edited
  - **Refs:** FASE-5, REQ-C-001
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] El nombre del test lleva `REQ-C-001 AC1` y los literales del criterio están en el assert

- [ ] TASK-F5-010 Prove REQ-C-002 AC1: package.json declares vite, vitest and "type": "module" | `tests/unit/restriccion-stack.test.js`
  - **Commit:** `test(stack): probar REQ-C-002 AC1 con package.json que declara vite, vitest y type module`
  - **Acceptance:**
    - `REQ-C-002 AC1` — `package.json` declares `vite` and `vitest` and `"type": "module"`
    - No existing test is edited
  - **Refs:** FASE-5, REQ-C-002
  - **Revert:** SAFE — solo test
  - **Review:**
    - [ ] El nombre del test lleva `REQ-C-002 AC1` y los literales del criterio están en el assert

### Test Exclusions

| File | Reason | Verified By |
|------|--------|-------------|
| `src/server/http/rutas.js` (rutas nuevas) | infraestructura delgada | `tests/e2e/fase-5.spec.js` |

---

## Dependencies

### Task Dependency Graph

```text
F5-001 ──► F5-002 ──────────────────────┐
   └─────────────────► F5-005 ──────────┴─► F5-006
F5-003 ──► F5-004 ───────┘
```

### Critical Path

1. TASK-F5-003 → 004 → 005 → 006 (4 tasks)

### Parallel Execution Plan

**Stream A:** historial y depuración — serie, ver Stream Ownership.

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | — | — | main checkout, before worktrees (checkpoint `fase-5-foundation`) |
| A | TASK-F5-001, TASK-F5-002, TASK-F5-003, TASK-F5-004 | src/server/servicios/historial.js, src/server/servicios/depurar.js, src/server/http/rutas.js, src/server/http/plugin.js, src/ui/paginas/historial.js, demo/sembrar.mjs, tests/integration/historial.test.js, tests/integration/depurar.test.js, tests/unit/ui/historial.test.js | worktree `feat/fase-5-a` |
| integración | — | — | main checkout, after `--integrate --fase 5` |
| verificación | TASK-F5-005, TASK-F5-006, TASK-F5-007, TASK-F5-008, TASK-F5-009, TASK-F5-010 | — | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Foundation | — (sin tareas base) | `fase-5-foundation` | main checkout |
| Verified | TASK-F5-006 | `fase-5-verified` | main checkout |
