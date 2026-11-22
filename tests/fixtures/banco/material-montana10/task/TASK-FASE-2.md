# Tasks: FASE-2 - Devolver, multar y consultar el historial

> **Input:** plan/fases/FASE-2-DEVOLUCION.md + plan/fase-plans/PLAN-FASE-2.md
> **Generated:** 2026-11-21
> **Total tasks:** 6
> **Parallel capacity:** 1 (serial)
> **Critical path:** 5 tasks

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 6 |
| Parallelizable | 0 (0%) |
| Work Streams | 1 (A: 5 tasks) |
| Setup phase | 0 tasks |
| Foundation phase | 0 tasks |
| Slices phase | 5 tasks |
| Integration phase | 0 tasks |
| Verification phase | 1 tasks |

> Convención de nombres de test: el título lleva `REQ-F-NNN ACn` cuando el escenario del BDD lo declara entre corchetes (AC-006-01…05 = REQ-F-006 AC1…AC5; AC-007-01…04 = REQ-F-007 AC1…AC4; AC-010-01…04 = REQ-F-010 AC1…AC4) y el id `AC-NNN-NN` siempre. Literales en `spec/tests/BDD-UC-006.md`, `-007.md`, `-010.md`.

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-006 / API-003-02 | TASK-F2-001, TASK-F2-004 |
| UC-007 / API-003-03, API-003-04 | TASK-F2-002, TASK-F2-004 |
| UC-010 / API-003-06 | TASK-F2-003, TASK-F2-005 |
| INV-LOA-003, INV-LOA-004 | TASK-F2-001 |
| INV-LOA-005 | TASK-F2-002 |
| INV-LOA-402 | TASK-F2-003 |
| INV-RES-005 (desbloqueo al pagar) | TASK-F2-002 |
| REQ-F-006 / REQ-F-007 / REQ-F-010 | TASK-F2-001..006 |
| WF-001 | TASK-F2-006 |

---

## Phase 1: Setup

**Purpose:** —
**Checkpoint:** —

Sin tareas.

---

## Phase 2: Foundation

**Purpose:** —
**Checkpoint:** —

Sin tareas: `prestamos.js`, `store`, `reloj` y las pantallas vienen de FASE-0 y FASE-1.

---

## Phase 3: Slices

**Purpose:** Un corte vertical por operación, con su test escrito primero.
**Checkpoint:** Los tests de cada slice en verde.

### UC-006 — Devolver y multar

- [ ] TASK-F2-001 Devolver un préstamo y poner la multa por retraso (API-003-02) | `src/domain/prestamos.js`, `src/server/http.js`, `tests/unit/domain/prestamos-cierre.test.js`
  - **Commit:** `feat(prestamos): devolverPrestamo con multa de 2 euros por dia de retraso`
  - **Acceptance:**
    - Test first (`REQ-F-006 ACn · AC-006-nn`): AC-006-01 devolución a tiempo → Devuelta y sin multa; AC-006-02 retraso de 3 días → multa Pendiente de 6 €; AC-006-03 retraso de 1 día → 2 € (`FINE_PER_DAY_EUR` × días naturales, una multa por préstamo, INV-LOA-004)
    - AC-006-04 repetir la devolución no cambia nada ni duplica multa (INV-LOA-003); AC-006-05 reserva no prestada y AC-006-06 reserva inexistente, cada una con su error
    - Devolución y multa en una sola `transaction`; la unidad queda libre
  - **Refs:** FASE-1, FASE-2, REQ-F-006, UC-006, API-003-02, INV-LOA-003, INV-LOA-004, ADR-001, ADR-002, AC-006-01, AC-006-02, AC-006-03, AC-006-04, AC-006-05, AC-006-06
  - **Revert:** SAFE — añade una operación y su ruta
  - **Review:**
    - [ ] Un fallo a mitad no deja devolución sin multa
    - [ ] Importes con los valores de `config.js`

### UC-007 — Pagar multa

- [ ] TASK-F2-002 Pagar una multa, listar multas y que el socio vea la suya (API-003-03, API-003-04) | `src/domain/prestamos.js`, `src/server/http.js`, `tests/unit/domain/prestamos-pago.test.js`
  - blocked-by: TASK-F2-001
  - **Commit:** `feat(prestamos): pagarMulta y listarMultas con desbloqueo para reservar`
  - **Acceptance:**
    - Test first (`REQ-F-007 ACn · AC-007-nn`): AC-007-01 pagar la multa de Lucía la deja Pagada con su fecha y le permite reservar (AC-003-09); AC-007-02 con otra multa Pendiente sigue bloqueada
    - AC-007-03 pagar de nuevo no cambia la fecha de pago (INV-LOA-005); AC-007-04 un Socio sin permiso; AC-007-05 multa inexistente, con su error
    - Test first: `REQ-F-006 el socio ve su multa` `listarMisReservas` de Lucía devuelve su multa Pendiente de 6 € en `multas`
  - **Refs:** FASE-2, REQ-F-007, REQ-F-006, UC-007, API-003-03, API-003-04, INV-LOA-005, INV-RES-005, AC-007-01, AC-007-02, AC-007-03, AC-007-04, AC-007-05
  - **Revert:** SAFE — añade dos operaciones
  - **Review:**
    - [ ] El desbloqueo es derivado de «sin multas Pendientes», no un indicador aparte
    - [ ] Solo el Encargado paga

### UC-010 — Consultar historial

- [ ] TASK-F2-003 Consultar el historial de un socio (API-003-06) | `src/domain/prestamos.js`, `src/server/http.js`, `tests/unit/domain/prestamos-historial.test.js`
  - blocked-by: TASK-F2-002
  - **Commit:** `feat(prestamos): consultarHistorial de solo lectura para junta y encargado`
  - **Acceptance:**
    - Test first (`REQ-F-010 ACn · AC-010-nn`): AC-010-01 la Junta ve préstamos y multas de un socio; AC-010-05 el Encargado también; AC-010-02 sin historial devuelve vacío; AC-010-04 un Socio sin permiso; AC-010-06 socio inexistente, con su error
    - Es lectura pura (INV-LOA-402); `GET /api/historial?socioId=`
  - **Refs:** FASE-2, REQ-F-010, UC-010, API-003-06, INV-LOA-402, AC-010-01, AC-010-02, AC-010-04, AC-010-05, AC-010-06
  - **Revert:** SAFE — operación de lectura nueva
  - **Review:**
    - [ ] Ninguna escritura en el almacén
    - [ ] No expone el hash de la contraseña

- [ ] TASK-F2-004 Acción Devolver en Entregas y pantalla Multas (SCR-004, SCR-005) | `src/ui/pantallas/entregas.js`, `src/ui/pantallas/multas.js`, `src/ui/router.js`, `src/ui/textos.js`, `tests/unit/ui/entregas.test.js`, `tests/unit/ui/multas.test.js`
  - blocked-by: TASK-F2-002
  - **Commit:** `feat(ui): Devolver en Entregas y pantalla Multas con Marcar pagada`
  - **Acceptance:**
    - Test first: `REQ-F-006 AC2 · AC-006-02` tras Devolver a Lucía con 3 días de retraso la pantalla muestra la multa «6 €» en estado Pendiente
    - Test first: `REQ-F-007 AC1 · AC-007-01` en Multas, Marcar pagada pasa la fila a «Pagada» con su fecha y el botón desaparece
    - La Junta no ve botones en ninguna de las dos; las rutas `#/multas` y la acción Devolver no fijan el conjunto de rutas
  - **Refs:** FASE-2, REQ-F-006, REQ-F-007, UC-006, UC-007, SCR-004, SCR-005, AC-006-02, AC-007-01
  - **Revert:** SAFE — amplía una pantalla y añade otra
  - **Review:**
    - [ ] Textos solo en `textos.js`
    - [ ] El importe sale del dato, no de un literal

- [ ] TASK-F2-005 Pantalla Historial con selector de socio (SCR-008) | `src/ui/pantallas/historial.js`, `src/ui/router.js`, `src/ui/textos.js`, `tests/unit/ui/historial.test.js`
  - blocked-by: TASK-F2-003
  - **Commit:** `feat(ui): pantalla Historial de un socio sin acciones`
  - **Acceptance:**
    - Test first: `REQ-F-010 AC3 · AC-010-03` al elegir a Lucía la pantalla lista su préstamo y su multa y no contiene ningún botón de acción
    - Test first: un Socio que abre `#/historial` ve el error de permiso de la API (AC-010-04 en dominio; aquí solo su presentación)
  - **Refs:** FASE-2, REQ-F-010, UC-010, SCR-008, AC-010-03
  - **Revert:** SAFE — pantalla nueva
  - **Review:**
    - [ ] Sin acciones para Junta ni Encargado
    - [ ] Textos solo en `textos.js`

---

## Phase 4: Integration

**Purpose:** —
**Checkpoint:** —

Sin tareas: cada slice registra su ruta y pantalla en su commit.

---

## Phase 5: Verification

**Purpose:** El ciclo WF-001 desde la ruta del usuario.
**Checkpoint:** Criterios de Éxito de FASE-2 demostrados; tag `fase-2-verified`.

- [ ] TASK-F2-006 Recorrido FASE-2 (WF-001) por la ruta del usuario con capturas y vídeo | `tests/e2e/fase-2-devolucion.spec.js`, `tests/e2e/fixtures/semilla.js`
  - blocked-by: TASK-F2-004, TASK-F2-005
  - **Commit:** `test(e2e): recorrido FASE-2 WF-001 con capturas por criterio`
  - **Acceptance:**
    - Test first: el título lleva `WF-001` (el vídeo se llama así) y recorre cada escenario de `Escenarios` con su id en el título del paso: AC-006-01…06, AC-007-01…05, AC-010-01…06 (los que no están en la Demo se provocan con la semilla y se capturan en pantalla, sin repetir su lógica)
    - Entra por el paso 1 de la Demo: el encargado inicia sesión y abre `#/entregas` con `CLOCK_FIXED=2026-12-08` y a Lucía con un piolet Prestado hasta el 5 dic
    - Afirma el texto en el elemento que lo muestra: tras Devolver, multa Pendiente de «6 €»; repetir no crea segunda multa; Lucía no puede reservar (multa Pendiente); tras Marcar pagada figura «Pagada» con su fecha y Lucía reserva de nuevo; la Junta ve en Historial de Lucía el préstamo y la multa sin botones; un Socio ve el error de permiso
    - Guarda `evidencias/FASE-2/{AC-NNN-NN}.png` por criterio y un vídeo con `WF-001` en su nombre, adjuntos al test
  - **Refs:** FASE-2, REQ-F-006, REQ-F-007, REQ-F-010, WF-001, AC-006-01, AC-006-02, AC-006-03, AC-006-04, AC-006-05, AC-006-06, AC-007-01, AC-007-02, AC-007-03, AC-007-04, AC-007-05, AC-010-01, AC-010-02, AC-010-03, AC-010-04, AC-010-05, AC-010-06, E2E-WF-001-01, E2E-WF-001-02, E2E-WF-001-03, E2E-WF-001-05
  - **Revert:** SAFE — solo pruebas
  - **Review:**
    - [ ] Entra por `#/entregas`, no por una función interna
    - [ ] Una captura por criterio y vídeo `WF-001`

---

## Dependencies

### Task Dependency Graph

```text
001 ─► 002 ─┬─► 003 ─► 005 ─┐
            └─► 004 ────────┴─► 006
```

### Critical Path

1. TASK-F2-001 → 002 → 003 → 005 → 006
   (5 tasks on critical path)

### Parallel Execution Plan

**Stream A:** devolver, multas e historial, en serie (comparten `prestamos.js`, `http.js`, `router.js` y `textos.js`) — see Stream Ownership

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | — | — | main checkout, before worktrees (checkpoint `fase-2-foundation`) |
| A | TASK-F2-001, TASK-F2-002, TASK-F2-003, TASK-F2-004, TASK-F2-005 | src/domain/prestamos.js, src/server/http.js, src/ui/{router,textos}.js, src/ui/pantallas/{entregas,multas,historial}.js, tests/unit/domain/prestamos-{cierre,pago,historial}.test.js, tests/unit/ui/{entregas,multas,historial}.test.js | worktree `feat/fase-2-a` |
| integración | — | — | main checkout, after `--integrate --fase 2` |
| verificación | TASK-F2-006 | — | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Foundation | — (sin tareas base) | `fase-2-foundation` | main checkout |
| Verified | TASK-F2-006 | `fase-2-verified` | main checkout |
