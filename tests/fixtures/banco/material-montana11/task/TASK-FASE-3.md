# Tasks: FASE-3 - Multas, bloqueo y pago

> **Input:** plan/fases/FASE-3-MULTAS.md + plan/fase-plans/PLAN-FASE-3.md
> **Generated:** 2026-11-21
> **Total tasks:** 5
> **Parallel capacity:** 1
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
| Verification phase | 1 tasks |

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-011 | TASK-F3-001, TASK-F3-002 |
| UC-012 | TASK-F3-003, TASK-F3-004 |
| API-003-06 | TASK-F3-001 |
| API-003-07 | TASK-F3-003 |
| API-003-08 | TASK-F3-003 |
| ADR-005 | TASK-F3-003 |
| INV-FIN-003 | TASK-F3-003 |
| INV-FIN-004 | TASK-F3-003 |
| INV-RES-005 | TASK-F3-003 |
| INV-SEC-001 | TASK-F3-001 |
| REQ-F-006 | TASK-F3-001, TASK-F3-002, TASK-F3-003, TASK-F3-005 |
| REQ-F-007 | TASK-F3-003, TASK-F3-004, TASK-F3-005 |
| WF-001 | TASK-F3-005 |

---

## Phase 1: Setup

**Purpose:** Sin tareas: la FASE-2 ya dejó andamiaje, plugin y confirmación en línea.
**Checkpoint:** No aplica.

---

## Phase 2: Foundation

**Purpose:** Sin tareas: lo compartido (`aplicarMultaPorRetraso`, `confirmar-en-linea`) lo entregaron FASE-2 y FASE-1; el resto se construye en el primer slice que lo usa.
**Checkpoint:** No aplica.

---

## Phase 3: Slices

**Purpose:** Un slice vertical por caso de uso (dominio + API + pantalla), con el test escrito primero.
**Checkpoint:** Los tests de cada slice en verde.

### UC-011 — Ver mis multas

- [ ] TASK-F3-001 Listar las multas propias del socio (API-003-06), test-first | `tests/unit/multas.test.js`, `tests/api/multas.test.js`, `src/domain/multas.js`, `src/domain/permisos.js`, `src/server/plugin.js`
  - **Commit:** `feat(multas): listarMisMultas filtra por dueño (API-003-06)`
  - **Acceptance:**
    - Test first: `AC-011-02 solo las propias (INV-SEC-001)` — con una multa Pendiente de 2,00 € de "lucia" y otra de 6,00 € de "pablo", `listarMisMultas` de "pablo" devuelve solo la de 6,00 € (importe 600 céntimos o equivalente del dominio) y ninguna de 2,00 €
    - Test first: `AC-011-03 fallo del almacén` — con el almacén caído `GET /api/listarMisMultas` responde `E_ALMACEN_NO_DISPONIBLE` y no devuelve ninguna multa
    - Con rol encargado o junta la operación responde `E_ACCESO_NO_PERMITIDO`; el importe se devuelve sin formatear ("6,00 €" solo en la UI)
  - **Refs:** FASE-3, REQ-F-006, UC-011, API-003-06, INV-SEC-001, AC-011-02, AC-011-03
  - **Revert:** SAFE — añade una operación de solo lectura sin cambios de esquema
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] La ruta GET `/api/listarMisMultas` y el error coinciden con `contracts/API-prestamos.md`
    - [ ] Ninguna consulta devuelve multas de otro socio

- [ ] TASK-F3-002 Pantalla Mis multas con importe y estado, y "Sin multas" (UC-011), test-first | `tests/unit/ui-mis-multas.test.js`, `src/ui/pantallas/mis-multas.js`, `src/ui/textos.js`
  - blocked-by: TASK-F3-001
  - **Commit:** `feat(multas): pantalla Mis multas (UC-011)`
  - **Acceptance:**
    - Test first: `AC-011-01 multa pendiente visible [REQ-F-006 AC6]` — en `#/mis-multas` una multa de 600 céntimos Pendiente se pinta "6,00 €" y "Pendiente"
    - Test first: `REQ-F-006 AC1 REQ-F-006 AC2 REQ-F-006 AC3` — 3 días de retraso se ven "6,00 €", 1 día "2,00 €" y sin retraso la pantalla muestra "Sin multas"
    - Si la operación devuelve `E_ALMACEN_NO_DISPONIBLE` no se pinta ninguna multa y se muestra el mensaje de error
  - **Refs:** FASE-3, REQ-F-006, UC-011, SCR-004, AC-011-01
  - **Revert:** SAFE — pantalla y textos nuevos
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Los textos están en `src/ui/textos.js`, en español
    - [ ] El formato "6,00 €" solo existe en la UI

### UC-012 — Marcar multa pagada

- [ ] TASK-F3-003 Listar multas y marcar pagada con bloqueo y desbloqueo (API-003-07, API-003-08), test-first | `tests/unit/multas.test.js`, `tests/api/multas.test.js`, `src/domain/multas.js`, `src/domain/permisos.js`, `src/server/plugin.js`
  - blocked-by: TASK-F3-002
  - **Commit:** `feat(multas): listarMultas y marcarMultaPagada idempotente (API-003-07, API-003-08)`
  - **Acceptance:**
    - Test first: `AC-012-01 pagar la única multa [REQ-F-007 AC1]` — "pablo" con una multa Pendiente de 6,00 €: `marcarMultaPagada` la deja "Pagada" y `reservarMaterial` de "Casco" ya no falla
    - Test first: `AC-012-02 queda otra pendiente [REQ-F-006 AC5]` — con 2 multas Pendiente y una pagada, reservar da `E_MULTA_PENDIENTE` (INV-FIN-004)
    - Test first: `AC-010-04 bloqueo al reservar [REQ-F-006 AC4]` — con multa Pendiente de 6,00 € y una reserva existente, reservar da `E_MULTA_PENDIENTE` y la reserva existente se conserva (INV-RES-005)
    - Test first: `AC-012-03 repetir el pago [REQ-F-007 AC2]` — multa pagada el 2026-12-11 y pago repetido el 2026-12-12 sigue "Pagada" con `pagadaEl` 2026-12-11
    - Test first: `AC-012-04 socio sin acceso [REQ-F-007 AC3]` — con rol socio `listarMultas` y `marcarMultaPagada` dan `E_ACCESO_NO_PERMITIDO`
    - Test first: `AC-012-05 multa inexistente` — `E_MULTA_NO_ENCONTRADA` y sin cambios; `AC-012-06 fallo del almacén` — `E_ALMACEN_NO_DISPONIBLE` y la multa sigue "Pendiente"
    - `marcarMultaPagada` corre en transacción (D-PA-008); el bloqueo se calcula al reservar, sin marca en la cuenta; `src/domain/reservas.js` no se modifica
  - **Refs:** FASE-3, REQ-F-006, REQ-F-007, UC-012, API-003-07, API-003-08, ADR-005, INV-FIN-003, INV-FIN-004, INV-RES-005, AC-010-04, AC-012-01, AC-012-02, AC-012-03, AC-012-04, AC-012-05, AC-012-06
  - **Revert:** SAFE — operaciones nuevas sin cambios de esquema
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Pagar es idempotente y conserva la primera `pagadaEl`
    - [ ] Un fallo del almacén no deja la multa a medias

- [ ] TASK-F3-004 Pantalla Multas del encargado con "Marcar pagada" confirmada (UC-012), test-first | `tests/unit/ui-multas.test.js`, `src/ui/pantallas/multas.js`, `src/ui/textos.js`
  - blocked-by: TASK-F3-003
  - **Commit:** `feat(multas): pantalla Multas con Marcar pagada (UC-012)`
  - **Acceptance:**
    - Test first: `AC-012-01 marcar pagada muestra "Pagada"` — en `#/multas` "Marcar pagada" pide confirmación en línea y, al confirmar, la fila pasa a "Pagada" y deja de ofrecer el botón
    - Test first: `AC-012-04 acceso no permitido [REQ-F-007 AC3]` — si la operación devuelve `E_ACCESO_NO_PERMITIDO` la pantalla muestra "Acceso no permitido"
    - La tabla muestra socio, importe "6,00 €" y estado; sin multas muestra "Sin multas"
  - **Refs:** FASE-3, REQ-F-007, UC-012, SCR-008, AC-012-01, AC-012-04
  - **Revert:** SAFE — pantalla y textos nuevos
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Reutiliza `confirmar-en-linea` de FASE-1

- [ ] TASK-F3-006 El test de REQ-F-006 AC2 cita el literal "Sin multas" (Autoriza: Q-task-implementer-002) | `tests/unit/multas.test.js`
  - blocked-by: TASK-F3-003
  - **Commit:** `test(multas): REQ-F-006 AC2 lleva el literal "Sin multas"`
  - **Acceptance:**
    - Edita solo `tests/unit/multas.test.js` (registro test-edit del notario, Q-task-implementer-002): el test de REQ-F-006 AC2 comprueba que sin multa el socio no tiene nada que listar y el texto es "Sin multas"; no quita ninguna aserción
  - **Refs:** FASE-3, REQ-F-006
  - **Revert:** SAFE — solo endurece un test

---

## Phase 4: Integration

**Purpose:** Sin tareas: las rutas `#/mis-multas` y `#/multas` y la API se enganchan dentro de los slices; no hay cableado compartido por varios Streams.
**Checkpoint:** No aplica.

---

## Phase 5: Verification

**Purpose:** Journey de FASE-3 por la ruta del usuario.
**Checkpoint:** El journey de WF-001 pasa con capturas y vídeo.

- [ ] TASK-F3-005 Journey WF-001: Pablo ve su multa, queda bloqueado, el encargado la marca pagada y Pablo reserva otra vez | `tests/e2e/fase-3-ciclo-multas.spec.js`
  - blocked-by: TASK-F3-004
  - **Commit:** `test(multas): journey WF-001 de FASE-3 con capturas`
  - **Acceptance:**
    - Test first: `AC-011-01`, `AC-010-04`, `AC-012-01`, `AC-012-03`, `AC-012-04` — un test por escenario REQ-F de las Escenarios de la FASE (AC-010-04, AC-011-01, AC-012-01, AC-012-03, AC-012-04), con datos de partida como en el journey de FASE-2 (Pablo devolvió su Casco con 3 días de retraso)
    - El título lleva WF-001, el id con el que se nombra el vídeo
    - Entra por el paso 1 de la Demo (Pablo abre "Mis multas"), nunca por una entrada interna
    - Afirma con `toHaveText`/`toContainText`: "6,00 €" y "Pendiente"; "Tienes una multa pendiente: no puedes reservar hasta pagarla"; "Pagada" (y sigue "Pagada" al repetir); "Reserva creada: Casco"; "Acceso no permitido"
    - Guarda `evidencias/FASE-3/{AC-NNN-NN}.png` por criterio y un vídeo con WF-001 en el nombre, con `narrar` y `captura` de `tests/e2e/fixtures/evidence.js`
    - Los demás escenarios (AC-011-02, AC-011-03, AC-012-02, AC-012-05, AC-012-06) los cubren los tests de TASK-F3-001, TASK-F3-003 y TASK-F3-004 y no se repiten aquí
  - **Refs:** FASE-3, REQ-F-006, REQ-F-007, WF-001, AC-010-04, AC-011-01, AC-012-01, AC-012-03, AC-012-04
  - **Revert:** SAFE — solo añade un test
  - **Review:**
    - [ ] El journey entra por la ruta del usuario
    - [ ] Las capturas se guardan en `evidencias/FASE-3/`

### Test Exclusions

Files excluded from unit test coverage (from PLAN-FASE §7.4 Exclusions):

| File | Reason | Verified By |
|------|--------|-------------|
| — | ninguna | N/A |

---

## Dependencies

### Task Dependency Graph

```text
TASK-F3-001 ──► TASK-F3-002 ──► TASK-F3-003 ──► TASK-F3-004 ──► TASK-F3-005
```

### Critical Path

1. TASK-F3-001 → TASK-F3-002 → TASK-F3-003 → TASK-F3-004 → TASK-F3-005
   (5 tasks on critical path)

### Parallel Execution Plan

**Stream A:** multas en serie (listar propias, pantalla, pagar, pantalla del encargado) — see Stream Ownership

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | — | — | main checkout, before worktrees (checkpoint `fase-3-foundation`) |
| A | TASK-F3-001, TASK-F3-002, TASK-F3-003, TASK-F3-004 | `src/domain/multas.js`, `src/domain/permisos.js`, `src/server/plugin.js`, `src/ui/pantallas/mis-multas.js`, `src/ui/pantallas/multas.js`, `src/ui/textos.js`, `tests/unit/multas.test.js`, `tests/unit/ui-mis-multas.test.js`, `tests/unit/ui-multas.test.js`, `tests/api/multas.test.js` | worktree `feat/fase-3-a` |
| integración | — | — | main checkout, after `--integrate --fase 3` |
| verificación | TASK-F3-005 | `tests/e2e/fase-3-ciclo-multas.spec.js` | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Verified | TASK-F3-005 | `fase-3-verified` | main checkout |
