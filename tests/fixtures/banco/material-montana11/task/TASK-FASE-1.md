# Tasks: FASE-1 - Reservar material, ver y cancelar mis reservas

> **Input:** plan/fases/FASE-1-RESERVAS.md + plan/fase-plans/PLAN-FASE-1.md
> **Generated:** 2026-11-21
> **Total tasks:** 6
> **Parallel capacity:** 1
> **Critical path:** 6 tasks

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
| Verification phase | 1 task |

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-013, API-004-01, API-004-02 | TASK-F1-001 |
| API-003-03, INV-LOA-002, RN-004 | TASK-F1-002 |
| UC-005, API-002-01, API-002-02, ADR-005, RN-011 | TASK-F1-003 |
| UC-006, API-002-03, INV-SEC-001 | TASK-F1-004 |
| UC-007, API-002-04, INV-RES-006, INV-RES-007 | TASK-F1-005 |
| INV-RES-001..009, INV-STK-001, INV-STK-002 | TASK-F1-001, TASK-F1-003, TASK-F1-005 |
| REQ-F-003, REQ-F-004, REQ-F-008 | TASK-F1-001, TASK-F1-003, TASK-F1-004, TASK-F1-005, TASK-F1-006 |
| REQ-NF-001, REQ-C-003 | TASK-F1-003, TASK-F1-004 |

---

## Phase 1: Setup

**Purpose:** Sin tareas: el scaffold lo entregó FASE-0.
**Checkpoint:** No aplica.

---

## Phase 2: Foundation

**Purpose:** Sin tareas: nada que compartan dos slices y no haya entregado FASE-0 (`store.transaccion`, `permisos.js`, `reloj.js`).
**Checkpoint:** No aplica.

---

## Phase 3: Slices

**Purpose:** Un slice vertical por caso de uso (dominio, ruta del plugin, pantalla y test en la misma tarea), en serie.
**Checkpoint:** Los tests de cada slice en verde.

### UC-013 — Añadir material

- [ ] TASK-F1-001 Añadir material y listar inventario (API-004-01, API-004-02), test-first | `src/domain/inventario.js`, `src/domain/permisos.js`, `src/server/plugin.js`, `src/ui/pantallas/inventario.js`, `src/ui/textos.js`, `tests/unit/inventario.test.js`, `tests/unit/ui-inventario.test.js`
  - **Commit:** `feat(reservas): añadir material y listar inventario`
  - **Acceptance:**
    - Test first: `AC-013-01 añadir 2 crampones` — el encargado añade 2 Crampones y el inventario muestra "Crampones: 2 unidades"; las unidades se numeran dentro del tipo (INV-STK-001, INV-STK-002)
    - Test first: `AC-013-03 cantidad 0` — error "La cantidad debe ser al menos 1" junto al campo
    - Test first: `AC-013-06 socio o junta` — Socio y junta reciben "Acceso no permitido" en Inventario
    - Test first: `AC-013-02, AC-013-04, AC-013-05 tipo no válido, datos ausentes, tipo sin unidades` y `AC-013-07 almacén caído` con su error literal del BDD
    - Test first: `AC-013-08 envío repetido` — el mismo alta enviado dos veces no duplica unidades (RN-016)
  - **Refs:** FASE-1, REQ-F-008, UC-013, API-004-01, API-004-02, INV-STK-001, INV-STK-002, AC-013-01, AC-013-02, AC-013-03, AC-013-04, AC-013-05, AC-013-06, AC-013-07, AC-013-08, PLAN-FASE-1 §4.2
  - **Revert:** SAFE — añade módulos y rutas nuevas; el documento del almacén ya tiene `unidades`
  - **Review:**
    - [ ] The test failed before the implementation
    - [ ] Solo el encargado puede añadir; mensajes literales de VO-010
    - [ ] Tipo dentro de `MATERIAL_TYPES` y cantidad entera >= 1

### Transversal — No recogidas

- [ ] TASK-F1-002 Aplicar no recogidas (API-003-03, interna), test-first | `src/domain/prestamos.js`, `tests/unit/prestamos.test.js`
  - blocked-by: TASK-F1-001
  - **Commit:** `feat(reservas): aplicar no recogidas a reservas vencidas`
  - **Acceptance:**
    - Test first: `INV-LOA-002 no recogida` — una Reservada con `inicio` < hoy pasa a "No recogida" y su unidad queda libre
    - Test first: `INV-LOA-002 repetición` — llamar de nuevo no cambia nada (GAP-002)
    - Función interna `aplicarNoRecogidas(tx, hoy)`, sin ruta ni fila de rol (D-PA-003)
  - **Refs:** FASE-1, REQ-F-004, API-003-03, INV-LOA-002, RN-004, D-PA-003, PLAN-FASE-1 §4.3
  - **Revert:** SAFE — función interna nueva sin consumidores aún
  - **Review:**
    - [ ] The test failed before the implementation
    - [ ] No expone ruta HTTP ni permiso de rol

### UC-005 — Reservar material

- [ ] TASK-F1-003 Reservar material y consultar disponibilidad (API-002-01, API-002-02), test-first | `src/domain/reservas.js`, `src/server/plugin.js`, `src/ui/pantallas/reservar.js`, `src/ui/pantallas/inicio.js`, `src/ui/textos.js`, `tests/unit/reservas.test.js`, `tests/api/reservar.test.js`
  - blocked-by: TASK-F1-001, TASK-F1-002
  - **Commit:** `feat(reservas): reservar material con unidad libre todos los días`
  - **Acceptance:**
    - Test first: `AC-005-01 reservar con 3 piolets` — queda "2 libres" y el mensaje "Reserva creada: Piolet, 2026-12-05 a 2026-12-07"
    - Test first: `AC-005-04 sin unidad libre` — error "No hay unidades libres esas fechas"; `AC-005-02` días contiguos no solapan; `AC-005-03` sin multas sí se reserva
    - Test first: `AC-005-05` "No se puede reservar en fechas pasadas"; `AC-005-06` "La fecha de fin no puede ser anterior a la de inicio"; `AC-005-07` "La reserva no puede superar 14 días"
    - Test first: `AC-005-08 multa pendiente` — "Tienes una multa pendiente: no puedes reservar hasta pagarla" (multa sembrada en el almacén)
    - Test first: `AC-005-14 envío repetido` — la misma petición deja una sola reserva (RN-011, INV-RES-008)
    - Test first: `AC-005-12 última unidad a la vez` (tests/api) — de dos peticiones simultáneas solo una gana (D-PA-008, INV-RES-001)
    - Test first: `AC-005-09, AC-005-10, AC-005-11, AC-005-13` tipo inválido, datos vacíos, rol y almacén caído con su error literal
    - Test first: `INV-RES-009 menor número` — se asigna la unidad libre de menor número
    - Test first: `REQ-C-003 otra sesión` — otra sesión con otra cuenta ve las unidades libres que dejó la primera reserva
    - Orden de validación: sesión, rol, datos, fecha pasada, invertida, más de 14 días, multa, unidades; 422 en validación y 409 en `E_SIN_UNIDADES`
  - **Refs:** FASE-1, REQ-F-003, REQ-C-003, UC-005, API-002-01, API-002-02, INV-RES-001, INV-RES-002, INV-RES-003, INV-RES-004, INV-RES-005, INV-RES-008, INV-RES-009, ADR-002, ADR-005, RN-001, RN-011, D-PA-008, AC-005-01, AC-005-02, AC-005-03, AC-005-04, AC-005-05, AC-005-06, AC-005-07, AC-005-08, AC-005-09, AC-005-10, AC-005-11, AC-005-12, AC-005-13, AC-005-14, PLAN-FASE-1 §4.1
  - **Revert:** SAFE — rutas y pantallas nuevas; sin cambio de formato del almacén
  - **Review:**
    - [ ] The test failed before the implementation
    - [ ] Todo dentro de `store.transaccion`; replay antes de buscar unidad
    - [ ] Error de fecha junto al campo con `aria-invalid`
    - [ ] El rango incluye ambos extremos

### UC-006 — Ver mis reservas

- [ ] TASK-F1-004 Listar mis reservas (API-002-03), test-first | `src/domain/reservas.js`, `src/server/plugin.js`, `src/ui/pantallas/mis-reservas.js`, `src/ui/textos.js`, `tests/unit/reservas.test.js`, `tests/unit/ui-mis-reservas.test.js`, `tests/api/mis-reservas.test.js`
  - blocked-by: TASK-F1-003
  - **Commit:** `feat(reservas): listar mis reservas aplicando no recogidas`
  - **Acceptance:**
    - Test first: `AC-006-01 solo lo mío` — Lucía ve su "Piolet" y no el "Casco" de Pablo (INV-SEC-001, SEC-T-001, GAP-003)
    - Test first: `AC-006-02 sin reservas` — se muestra "No tienes reservas"
    - Test first: `AC-006-03 sin sesión` y `AC-006-04 almacén caído` con su error literal
    - Test first: `INV-LOA-002 al leer` — una Reservada con `inicio` < hoy se lista "No recogida" (llama `aplicarNoRecogidas` en la misma transacción)
  - **Refs:** FASE-1, REQ-F-004, REQ-NF-001, UC-006, API-002-03, INV-SEC-001, INV-LOA-002, RN-004, AC-006-01, AC-006-02, AC-006-03, AC-006-04, PLAN-FASE-1 §4.1
  - **Revert:** SAFE — completa la ruta mínima de FASE-0 sin tocar el formato del almacén
  - **Review:**
    - [ ] The test failed before the implementation
    - [ ] Filtra por `socioId` de la sesión, nunca por parámetro

### UC-007 — Cancelar reserva

- [ ] TASK-F1-005 Cancelar reserva con confirmación en línea (API-002-04), test-first | `src/domain/reservas.js`, `src/server/plugin.js`, `src/ui/pantallas/mis-reservas.js`, `src/ui/textos.js`, `tests/unit/reservas.test.js`, `tests/unit/ui-mis-reservas.test.js`, `tests/api/cancelar.test.js`
  - blocked-by: TASK-F1-004
  - **Commit:** `feat(reservas): cancelar reserva hasta el día antes`
  - **Acceptance:**
    - Test first: `AC-007-01 a tiempo` — "Reserva cancelada", estado "Cancelada" y la unidad vuelve a quedar libre (INV-RES-006)
    - Test first: `AC-007-02 día de inicio` — error "Solo se puede cancelar hasta el día antes"
    - Test first: `AC-007-03 repetir` — cancelar otra vez no cambia nada (INV-RES-007)
    - Test first: `AC-007-04 ajena` — `E_RESERVA_NO_ENCONTRADA` sin revelar existencia; `AC-007-05` estado no cancelable; `AC-007-06` almacén caído
    - Test first: `confirmar-en-linea` — "Cancelar reserva" muestra Sí/No con el foco en el primero
  - **Refs:** FASE-1, REQ-F-004, UC-007, API-002-04, INV-RES-006, INV-RES-007, INV-SEC-001, RN-005, AC-007-01, AC-007-02, AC-007-03, AC-007-04, AC-007-05, AC-007-06, PLAN-FASE-1 §4.1
  - **Revert:** SAFE — ruta y botón nuevos
  - **Review:**
    - [ ] The test failed before the implementation
    - [ ] Solo `Reservada` con `inicio` > hoy; mensaje `M_RESERVA_CANCELADA`

---

## Phase 4: Integration

**Purpose:** Sin tareas: cada slice registró sus rutas y pantallas en su propia tarea.
**Checkpoint:** No aplica.

---

## Phase 5: Verification

**Purpose:** Journey de la FASE desde la ruta del usuario.
**Checkpoint:** El journey de la Demo pasa con capturas y vídeo.

- [ ] TASK-F1-006 Journey FASE-1: el encargado añade material y el socio reserva, ve y cancela | `tests/e2e/fase-1-reservas.spec.js`
  - blocked-by: TASK-F1-005
  - **Commit:** `test(reservas): recorrido de FASE-1 desde la web con capturas`
  - **Acceptance:**
    - Test first: nombrado `AC-013-01`, `AC-013-03`, `AC-005-01`, `AC-005-04`, `AC-005-05`, `AC-005-06`, `AC-005-07`, `AC-005-14`, `AC-006-01`, `AC-006-02`, `AC-007-01`, `AC-007-02`, `AC-007-03` (los escenarios de la Demo; el resto se prueba en unit/api)
    - El título lleva FASE-1 (la FASE no tiene Workflows), el id con el que se nombra el vídeo
    - Entra por el paso 1 de la Demo: login del encargado en `http://127.0.0.1:5173/` y Inventario; nunca por un punto de entrada interno; reloj `CLOCK_FIXED=2026-11-21` (2026-12-06 en el paso 8)
    - Afirma con `toHaveText` / `toContainText`: "Piolet: 3 unidades", "La cantidad debe ser al menos 1", "Reserva creada: Piolet, 2026-12-05 a 2026-12-07", "2 libres", "No hay unidades libres esas fechas", "No se puede reservar en fechas pasadas", "La fecha de fin no puede ser anterior a la de inicio", "La reserva no puede superar 14 días", "Piolet" sin la Tienda de Pablo, "Reserva cancelada", "Cancelada", "3 libres", "Solo se puede cancelar hasta el día antes", "No tienes reservas"
    - Guarda `evidencias/FASE-1/{AC-NNN-NN}.png` por escenario y un vídeo con `FASE-1` en su nombre, adjunto al test
  - **Refs:** FASE-1, REQ-F-003, REQ-F-004, REQ-F-008, AC-013-01, AC-013-03, AC-005-01, AC-005-04, AC-005-05, AC-005-06, AC-005-07, AC-005-14, AC-006-01, AC-006-02, AC-007-01, AC-007-02, AC-007-03
  - **Revert:** SAFE — solo añade un test
  - **Review:**
    - [ ] Entra por la Demo, no por una ruta interna
    - [ ] No fija el conjunto cerrado de pantallas ni de enlaces del menú

### Test Exclusions

Ficheros sin test unitario propio (PLAN-FASE-1 §7.4):

| File | Reason | Verified By |
|------|--------|-------------|
| `src/ui/pantallas/inicio.js` | cabecera sin lógica | E2E (TASK-F1-006) |
| `src/ui/componentes/confirmar.js` | componente genérico | E2E (TASK-F1-006) |

---

## Dependencies

### Task Dependency Graph

```text
TASK-F1-001 ──► TASK-F1-002 ──► TASK-F1-003 ──► TASK-F1-004 ──► TASK-F1-005 ──► TASK-F1-006
```

### Critical Path

1. TASK-F1-001 → TASK-F1-002 → TASK-F1-003 → TASK-F1-004 → TASK-F1-005 → TASK-F1-006
   (6 tasks on critical path)

### Parallel Execution Plan

**Stream A:** añadir material, no recogidas, reservar, listar y cancelar, en serie — see Stream Ownership

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | — | — | main checkout, before worktrees (checkpoint `fase-1-foundation`) |
| A | TASK-F1-001, TASK-F1-002, TASK-F1-003, TASK-F1-004, TASK-F1-005 | `src/domain/{reservas,inventario,prestamos,permisos}.js`, `src/server/plugin.js`, `src/ui/pantallas/{reservar,inventario,mis-reservas,inicio}.js`, `src/ui/textos.js`, `tests/unit/**`, `tests/api/**` | worktree `feat/fase-1-a` |
| integración | — | — | main checkout, after `--integrate --fase 1` |
| verificación | TASK-F1-006 | `tests/e2e/fase-1-reservas.spec.js` | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Foundation | — | `fase-1-foundation` | main checkout |
| Verified | TASK-F1-006 | `fase-1-verified` | main checkout |
