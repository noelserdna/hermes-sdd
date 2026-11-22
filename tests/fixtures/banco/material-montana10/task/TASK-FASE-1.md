# Tasks: FASE-1 - Cuidar las reservas y entregar

> **Input:** plan/fases/FASE-1-ENTREGA.md + plan/fase-plans/PLAN-FASE-1.md
> **Generated:** 2026-11-21
> **Total tasks:** 7
> **Parallel capacity:** 1 (serial)
> **Critical path:** 5 tasks

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 7 |
| Parallelizable | 0 (0%) |
| Work Streams | 1 (A: 6 tasks) |
| Setup phase | 0 tasks |
| Foundation phase | 0 tasks |
| Slices phase | 6 tasks |
| Integration phase | 0 tasks |
| Verification phase | 1 tasks |

> Convención de nombres de test: el título lleva `REQ-F-NNN ACn` cuando el escenario del BDD lo declara entre corchetes (AC-004-01…07 = REQ-F-004 AC1…AC7; AC-005-01…04 = REQ-F-005 AC1…AC4; AC-009-01…05 = REQ-F-009 AC1…AC5) y el id `AC-NNN-NN` siempre. Los literales salen del `Scenario:` con ese id en `spec/tests/BDD-UC-00N.md`.

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-004 / API-002-02, API-002-03 | TASK-F1-002, TASK-F1-003 |
| UC-005 / API-003-01 | TASK-F1-004, TASK-F1-006 |
| UC-009 / API-003-05 | TASK-F1-005, TASK-F1-006 |
| API-003-07 (no recogidas) | TASK-F1-001 |
| INV-RES-006, INV-RES-007 | TASK-F1-001, TASK-F1-002 |
| INV-LOA-001, 002, 301 | TASK-F1-004 |
| INV-LOA-401 | TASK-F1-005 |
| INV-ACC-009 | TASK-F1-002 |
| REQ-F-004 / REQ-F-005 / REQ-F-009 | TASK-F1-001..007 |
| REQ-C-001, REQ-C-003 | cubiertos una sola vez en TASK-F0-004 |

---

## Phase 1: Setup

**Purpose:** —
**Checkpoint:** —

Sin tareas: el esqueleto de FASE-0 ya está desplegable.

---

## Phase 2: Foundation

**Purpose:** —
**Checkpoint:** —

Sin tareas: `store`, `reloj`, `permisos`, `sesiones` y `errores` vienen de FASE-0; lo nuevo se construye dentro del primer slice que lo necesita.

---

## Phase 3: Slices

**Purpose:** Un corte vertical por operación, con su test escrito primero.
**Checkpoint:** Los tests de cada slice en verde.

### UC-005 — Entregar reserva (derivación No recogida)

- [ ] TASK-F1-001 Derivar «No recogida» al leer y en la tarea diaria (API-003-07) | `src/domain/reservas.js`, `src/domain/tareas.js`, `src/server/tareas-diarias.js`, `src/server/http.js`, `tests/unit/domain/reservas-ciclo.test.js`, `tests/unit/domain/tareas.test.js`
  - **Commit:** `feat(reservas): derivar No recogida al leer y persistirla en la tarea diaria`
  - **Acceptance:**
    - Test first: `REQ-F-005 AC4 · AC-005-04` una reserva Reservada cuyo `hasta` ya pasó sin entregar se lee como «No recogida»
    - Test first: `AC-005-05` esa reserva libera sus unidades (otro socio puede reservar esos días)
    - Test first: `D-T-010 resolverNoRecogidas({store, reloj})` persiste el resultado y devuelve contadores; es idempotente (D-PA-008)
    - `POST /api/tareas-diarias` exige la cabecera `x-cron-secret`; `setInterval` interno la lanza a las 00:05 y al arrancar
  - **Refs:** FASE-1, REQ-F-005, UC-005, API-003-07, INV-RES-007, ADR-001, D-PA-008, AC-005-04, AC-005-05
  - **Revert:** SAFE — añade derivación y una ruta; no cambia datos existentes
  - **Review:**
    - [ ] La derivación es una función pura sobre el estado y el reloj
    - [ ] La ruta de tareas rechaza peticiones sin el secreto

### UC-004 — Ver y cancelar mis reservas

- [ ] TASK-F1-002 Cancelar una reserva y completar la lista propia (API-002-03, API-002-02) | `src/domain/reservas.js`, `src/server/http.js`, `tests/unit/domain/reservas-ciclo.test.js`
  - blocked-by: TASK-F1-001
  - **Commit:** `feat(reservas): cancelarReserva hasta el dia antes y listarMisReservas con multas`
  - **Acceptance:**
    - Test first (`REQ-F-004 ACn · AC-004-nn`): AC-004-01 el socio ve solo sus reservas (INV-ACC-009); AC-004-07 una reserva ajena no aparece; AC-004-03 cancela una Reservada hasta el día antes de `desde` (Pablo, 10 dic, hoy 3 dic → Cancelada); AC-004-04 repetir devuelve la Cancelada sin cambios
    - AC-004-05 el mismo día de `desde` o posterior se rechaza (Lucía, 3 dic, hoy 3 dic); AC-004-06 con una multa Pendiente sigue pudiendo cancelar; AC-004-08 reserva inexistente con su error; una ajena da `E_SIN_PERMISO_CANCELAR`
    - `listarMisReservas` devuelve `{ reservas, multas }` con las multas propias y la derivación No recogida
  - **Refs:** FASE-1, REQ-F-004, UC-004, API-002-02, API-002-03, INV-RES-006, INV-ACC-009, AC-004-01, AC-004-03, AC-004-04, AC-004-05, AC-004-06, AC-004-07, AC-004-08
  - **Revert:** SAFE — amplía una operación y añade otra
  - **Review:**
    - [ ] Cancelar comprueba la propiedad antes que el estado
    - [ ] Los días se cuentan con el reloj inyectado

- [ ] TASK-F1-003 Completar la pantalla Mis reservas con Cancelar, multas y mensaje vacío (SCR-002) | `src/ui/pantallas/mis-reservas.js`, `src/ui/textos.js`, `tests/unit/ui/mis-reservas.test.js`
  - blocked-by: TASK-F1-002
  - **Commit:** `feat(ui): Mis reservas con Cancelar, multas y estado vacio`
  - **Acceptance:**
    - Test first: `REQ-F-004 AC2 · AC-004-02` un socio sin reservas ve «No tienes reservas» y ninguna de otra persona
    - Test first: el botón Cancelar aparece solo en reservas Reservadas; al pulsarlo la fila pasa a «Cancelada»; una reserva «No recogida» se muestra como tal; las multas propias salen en su sección
    - Mantiene los tests de FASE-0 de saludo y «Reserva creada: …»
  - **Refs:** FASE-1, REQ-F-004, UC-004, SCR-002, AC-004-02
  - **Revert:** SAFE — amplía una pantalla
  - **Review:**
    - [ ] Textos solo en `textos.js`
    - [ ] Un rechazo de la API se muestra con su `mensaje`

### UC-005 — Entregar reserva

- [ ] TASK-F1-004 Entregar una reserva asignando una unidad libre (API-003-01) | `src/domain/prestamos.js`, `src/server/http.js`, `tests/unit/domain/prestamos.test.js`
  - blocked-by: TASK-F1-001
  - **Commit:** `feat(prestamos): entregarReserva asigna una unidad libre en transaccion`
  - **Acceptance:**
    - Test first (`REQ-F-005 ACn · AC-005-nn`): AC-005-01 la entrega asigna la primera unidad activa libre del tipo y la reserva pasa a Prestada (Lucía, hoy 3 dic); AC-005-02 repetirla no asigna otra unidad (INV-LOA-301)
    - AC-005-03 antes de `desde` se rechaza (INV-LOA-001); AC-005-06 unidad ocupada y AC-005-07 reserva no entregable, con su error
    - Solo el Encargado entrega (permisos); la asignación va dentro de `transaction` (INV-LOA-002)
  - **Refs:** FASE-1, REQ-F-005, UC-005, API-003-01, INV-LOA-001, INV-LOA-002, INV-LOA-301, ADR-002, AC-005-01, AC-005-02, AC-005-03, AC-005-06, AC-005-07
  - **Revert:** SAFE — módulo y ruta nuevos
  - **Review:**
    - [ ] La reserva gana `unidadId` y la unidad pasa a Prestada en la misma transacción
    - [ ] Repetir no cambia nada

### UC-009 — Ver entregas y devoluciones

- [ ] TASK-F1-005 Consultar lo prestado y lo que vuelve hoy (API-003-05) | `src/domain/prestamos.js`, `src/server/http.js`, `tests/unit/domain/prestamos-listado.test.js`
  - blocked-by: TASK-F1-004
  - **Commit:** `feat(prestamos): consultarEntregasYDevoluciones de solo lectura`
  - **Acceptance:**
    - Test first (`REQ-F-009 ACn · AC-009-nn`): AC-009-01 hoy 2026-12-07 devuelve «Vuelve hoy: Piolet 2 · Lucía» y «Prestado: Casco 1 · Pablo · hasta 2026-12-09»; AC-009-02 los retrasos; AC-009-03 lo que se entrega hoy (Lucía, 3 dic)
    - AC-009-07 una reserva No recogida no figura como prestada; AC-009-06 un Socio recibe error de permiso; AC-009-05 la Junta lo consulta (solo lectura, INV-LOA-401)
    - Es lectura pura: no cambia el almacén
  - **Refs:** FASE-1, REQ-F-009, UC-009, API-003-05, INV-LOA-401, AC-009-01, AC-009-02, AC-009-03, AC-009-06, AC-009-07
  - **Revert:** SAFE — operación de lectura nueva
  - **Review:**
    - [ ] Ninguna escritura en el almacén
    - [ ] Retrasos calculados con días naturales

- [ ] TASK-F1-006 Pantalla Entregas y devoluciones con Entregar y vista de solo lectura para la junta (SCR-004) | `src/ui/pantallas/entregas.js`, `src/ui/router.js`, `src/ui/textos.js`, `tests/unit/ui/entregas.test.js`
  - blocked-by: TASK-F1-005
  - **Commit:** `feat(ui): pantalla Entregas y devoluciones con Entregar`
  - **Acceptance:**
    - Test first: `REQ-F-009 AC4 · AC-009-04` sin nada prestado muestra el mensaje de lista vacía de `textos.js`
    - Test first: `REQ-F-009 AC5 · AC-009-05` con rol Junta la pantalla lista lo prestado y lo que vuelve y no contiene ningún botón; con Encargado aparece Entregar y al pulsarlo la fila pasa a Prestada con su unidad
  - **Refs:** FASE-1, REQ-F-009, REQ-F-005, UC-005, UC-009, SCR-004, AC-009-04, AC-009-05
  - **Revert:** SAFE — pantalla nueva
  - **Review:**
    - [ ] La Junta no ve acciones
    - [ ] Ruta `#/entregas` añadida sin fijar el conjunto de rutas

---

## Phase 4: Integration

**Purpose:** —
**Checkpoint:** —

Sin tareas: cada slice registra su ruta y su pantalla en su commit, en un solo Stream serie.

---

## Phase 5: Verification

**Purpose:** El recorrido de la FASE desde la ruta del usuario.
**Checkpoint:** Criterios de Éxito de FASE-1 demostrados; tag `fase-1-verified`.

- [ ] TASK-F1-007 Recorrido FASE-1 por la ruta del usuario con capturas y vídeo | `tests/e2e/fase-1-entrega.spec.js`, `tests/e2e/fixtures/semilla.js`
  - blocked-by: TASK-F1-003, TASK-F1-006
  - **Commit:** `test(e2e): recorrido FASE-1 con capturas por criterio`
  - **Acceptance:**
    - Test first: el título lleva `FASE-1` (la FASE no declara workflow; el vídeo se llama así) y recorre cada escenario de `Escenarios` con su id en el título del paso: AC-004-01…08, AC-005-01…07, AC-009-01…07 (los que no están en la Demo se provocan con la semilla y se capturan en pantalla, sin repetir su lógica)
    - Entra por el paso 1 de la Demo: Pablo inicia sesión y abre `#/mis-reservas` con la semilla `CLOCK_FIXED=2026-12-03` (reservas de Lucía 3–5 dic y Pablo 10–12 dic, 2 piolets) y ve solo la suya
    - Afirma el texto en el elemento que lo muestra: la reserva de Pablo pasa a «Cancelada»; Lucía no puede cancelar la suya (rechazo con su `mensaje`); el encargado ve a Lucía por entregar hoy; tras Entregar la fila queda Prestada con una unidad y repetir no asigna otra; la Junta ve Entregas y devoluciones sin ningún botón
    - Guarda `evidencias/FASE-1/{AC-NNN-NN}.png` por criterio y un vídeo con `FASE-1` en su nombre, adjuntos al test; no fija el número de enlaces ni de pantallas
  - **Refs:** FASE-1, REQ-F-004, REQ-F-005, REQ-F-009, AC-004-01, AC-004-02, AC-004-03, AC-004-04, AC-004-05, AC-004-06, AC-004-07, AC-004-08, AC-005-01, AC-005-02, AC-005-03, AC-005-04, AC-005-05, AC-005-06, AC-005-07, AC-009-01, AC-009-02, AC-009-03, AC-009-04, AC-009-05, AC-009-06, AC-009-07, E2E-WF-001-04, E2E-WF-001-05
  - **Revert:** SAFE — solo pruebas
  - **Review:**
    - [ ] Entra por la pantalla de Mis reservas, no por una función interna
    - [ ] Una captura por criterio y vídeo de la FASE

### Test Exclusions

| File | Reason | Verified By |
|------|--------|-------------|
| `src/server/tareas-diarias.js` | envoltorio de temporizador | `tareas.test.js` (D-T-010) en TASK-F1-001 |

---

## Dependencies

### Task Dependency Graph

```text
001 ─┬─► 002 ─► 003 ────────────┐
     └─► 004 ─► 005 ─► 006 ─────┴─► 007
```

### Critical Path

1. TASK-F1-001 → 004 → 005 → 006 → 007
   (5 tasks on critical path)

### Parallel Execution Plan

**Stream A:** cancelar, entregar y listado diario, en serie (comparten `reservas.js`, `prestamos.js`, `http.js`, `router.js` y `textos.js`) — see Stream Ownership

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | — | — | main checkout, before worktrees (checkpoint `fase-1-foundation`) |
| A | TASK-F1-001, TASK-F1-002, TASK-F1-003, TASK-F1-004, TASK-F1-005, TASK-F1-006 | src/domain/{reservas,prestamos,tareas}.js, src/server/{http,tareas-diarias}.js, src/ui/{router,textos}.js, src/ui/pantallas/{mis-reservas,entregas}.js, tests/unit/domain/{reservas-ciclo,tareas,prestamos,prestamos-listado}.test.js, tests/unit/ui/{mis-reservas,entregas}.test.js | worktree `feat/fase-1-a` |
| integración | — | — | main checkout, after `--integrate --fase 1` |
| verificación | TASK-F1-007 | — | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Foundation | — (sin tareas base) | `fase-1-foundation` | main checkout |
| Verified | TASK-F1-007 | `fase-1-verified` | main checkout |
