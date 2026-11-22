# Tasks: FASE-2 - Entregar y recibir el material

> **Input:** plan/fases/FASE-2-PRESTAMO.md + plan/fase-plans/PLAN-FASE-2.md
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
| Work Streams | 1 (A: 5 tasks) |
| Setup phase | 0 tasks |
| Foundation phase | 0 tasks |
| Slices phase | 4 tasks |
| Integration phase | 0 tasks |
| Verification phase | 1 tasks |

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-008 | TASK-F2-001, TASK-F2-002 |
| UC-009 | TASK-F2-003, TASK-F2-004 |
| UC-010 | TASK-F2-004 |
| API-003-01 | TASK-F2-001 |
| API-003-02 | TASK-F2-003 |
| API-003-04 | TASK-F2-001 |
| API-003-05 | TASK-F2-004 |
| ADR-005 | TASK-F2-004 |
| INV-LOA-001 | TASK-F2-001 |
| INV-LOA-002 | TASK-F2-001 |
| INV-LOA-003 | TASK-F2-003 |
| INV-FIN-001, INV-FIN-002, INV-FIN-004 | TASK-F2-004 |
| REQ-F-005 | TASK-F2-001, TASK-F2-002, TASK-F2-003, TASK-F2-005 |
| REQ-F-006 | TASK-F2-004, TASK-F2-005 |

---

## Phase 1: Setup

**Purpose:** Scaffold, dependencies, configuration.
**Checkpoint:** Ninguna tarea: FASE-0 ya dejó el proyecto construible y FASE-1 las dependencias comunes.

Sin tareas en esta fase.

---

## Phase 2: Foundation

**Purpose:** Infraestructura compartida por >= 2 slices que ninguna FASE anterior entregó.
**Checkpoint:** Ninguna tarea: lo compartido (permisos, textos, plugin) se construye en el primer slice que lo necesita.

Sin tareas en esta fase.

---

## Phase 3: Slices

**Purpose:** Un slice vertical por caso de uso o grupo de operaciones afines, con el test escrito primero.
**Checkpoint:** Todos los tests de los slices en verde.

### UC-008 — Entregar material

- [ ] TASK-F2-001 Listar préstamos y entregar reserva (API-003-04, API-003-01), test-first | `tests/unit/prestamos.test.js`, `tests/api/prestamos.api.test.js`, `src/domain/prestamos.js`, `src/domain/permisos.js`, `src/server/plugin.js`
  - **Commit:** `feat(prestamos): listar préstamos y entregar la reserva el día de inicio`
  - **Acceptance:**
    - Test first: `AC-008-01 REQ-F-005 AC1 entregar el día de inicio` — con hoy 2026-12-05 y la reserva "Piolet" de "lucia" que empieza ese día, `entregarReserva` la deja en "Entregado" con `entregadaEl` 2026-12-05
    - Test first: `AC-008-03 REQ-F-005 AC3 entrega anticipada` — con hoy 2026-12-04 devuelve `E_ENTREGA_ANTICIPADA` con el texto "No se puede entregar antes de la fecha de inicio" y la reserva sigue "Reservada"
    - Test first: `AC-008-02 REQ-F-005 AC4 no recogida` — `listarPrestamosYReservas` con hoy 2026-12-06 muestra "No recogida" la reserva sin entregar con inicio 2026-12-05 y la unidad queda libre para nuevas reservas (INV-LOA-002)
    - Test first: `AC-008-05 reserva inexistente` — `E_RESERVA_NO_ENCONTRADA` y sin cambios
    - Test first: `AC-008-06 entrega doble concurrente` (D-T-009) — la segunda entrega da `E_ESTADO_INVALIDO` y se conserva la primera `entregadaEl`
    - Test first: `AC-008-07 almacén caído` — `E_ALMACEN_NO_DISPONIBLE` y la reserva sigue "Reservada"
    - `POST /api/entregarReserva` y `GET /api/listarPrestamosYReservas` registrados en el plugin; solo el rol encargado (fila de `permisos.js`), un socio recibe `E_ACCESO_NO_PERMITIDO`
  - **Refs:** FASE-2, REQ-F-005, UC-008, API-003-01, API-003-04, INV-LOA-001, INV-LOA-002, SM-001, RN-003, AC-008-01, AC-008-02, AC-008-03, AC-008-05, AC-008-06, AC-008-07
  - **Revert:** SAFE — añade operaciones nuevas; quitarlas no afecta a lo ya entregado
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Solo transita Reservada → Entregado y solo el día de `inicio` (INV-LOA-001)
    - [ ] Los errores devuelven los códigos y textos del contrato API-003

- [ ] TASK-F2-002 Pantalla Préstamos: lista y acción "Entregar" (SCR-007), test-first | `tests/unit/ui-prestamos.test.js`, `src/ui/pantallas/prestamos.js`, `src/ui/textos.js`
  - blocked-by: TASK-F2-001
  - **Commit:** `feat(prestamos): pantalla Préstamos con la lista y el botón Entregar`
  - **Acceptance:**
    - Test first: `AC-008-01 REQ-F-005 AC1 la pantalla muestra "Entregado"` — en `#/prestamos` una fila por reserva con su estado; pulsar "Entregar" en la reserva "Piolet" muestra "Entregado"
    - Test first: `AC-008-04 REQ-F-005 AC6 socio sin acceso` — un socio que abre `#/prestamos` ve "Acceso no permitido" y ninguna lista
    - Test first: `AC-008-03 la pantalla muestra el error de entrega anticipada` — se ve "No se puede entregar antes de la fecha de inicio"
    - Cada fila ofrece solo la acción válida de su estado (Reservada: "Entregar"); las filas "No recogida" no ofrecen acción
    - Los comprobamos sobre DOM (jsdom); no se fija la lista completa de pantallas ni de entradas del menú
  - **Refs:** FASE-2, REQ-F-005, UC-008, SCR-007, AC-008-01, AC-008-03, AC-008-04
  - **Revert:** SAFE — pantalla nueva; la ruta `#/prestamos` deja de existir
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Textos en español tomados de `src/ui/textos.js`, sin cadenas sueltas
    - [ ] El socio no llega a ver datos de otros socios

### UC-009 — Registrar devolución

- [ ] TASK-F2-003 Registrar devolución en plazo y repetida (API-003-02), test-first | `tests/unit/prestamos.test.js`, `tests/api/prestamos.api.test.js`, `src/domain/prestamos.js`, `src/server/plugin.js`, `src/ui/pantallas/prestamos.js`, `tests/unit/ui-prestamos.test.js`
  - blocked-by: TASK-F2-002
  - **Files:** `src/ui/textos.js`
  - **Commit:** `feat(prestamos): registrar la devolución y dejar la unidad libre`
  - **Acceptance:**
    - Test first: `AC-009-01 REQ-F-005 AC2 devolver en plazo` — un "Piolet" Entregado con fin 2026-12-07 devuelto el 2026-12-07 queda "Devuelto" y su unidad libre (INV-LOA-003)
    - Test first: `AC-009-03 REQ-F-005 AC5 repetir la devolución` (D-T-008) — devolver otra vez el 2026-12-08 deja "Devuelto" con `devueltaEl` 2026-12-07 y no crea segunda multa
    - Test first: `AC-009-04 socio sin acceso` — `E_ACCESO_NO_PERMITIDO` y "Acceso no permitido"
    - Test first: `AC-009-05 reserva inexistente` — `E_RESERVA_NO_ENCONTRADA` y sin cambios
    - Test first: `AC-009-06 reserva no entregada` — una Reservada da `E_ESTADO_INVALIDO` y sin cambios
    - Test first: `AC-009-07 almacén caído` — `E_ALMACEN_NO_DISPONIBLE`, sigue "Entregado" y sin multa
    - `POST /api/registrarDevolucion` registrado; la fila Entregada ofrece "Registrar devolución" en `#/prestamos` y tras pulsarla se ve "Devuelto"
  - **Refs:** FASE-2, REQ-F-005, UC-009, API-003-02, INV-LOA-003, SM-001, RN-004, AC-009-01, AC-009-03, AC-009-04, AC-009-05, AC-009-06, AC-009-07
  - **Revert:** SAFE — operación y botón nuevos; sin cambios de esquema
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] La devolución repetida es idempotente: conserva `devueltaEl`
    - [ ] Un fallo del almacén no deja la reserva a medias

### UC-010 — Aplicar multa por retraso

- [ ] TASK-F2-004 Multa por retraso en la misma escritura de la devolución (API-003-05), test-first | `tests/unit/multas.test.js`, `src/domain/multas.js`, `src/domain/prestamos.js`, `src/ui/pantallas/prestamos.js`, `tests/unit/ui-prestamos.test.js`, `src/ui/textos.js`
  - blocked-by: TASK-F2-003
  - **Commit:** `feat(multas): aplicar la multa de 2 € por día en la misma escritura de la devolución`
  - **Acceptance:**
    - Test first: `AC-010-01 REQ-F-006 AC1 tres días de retraso` — "Casco" de "pablo" con fin 2026-12-07 devuelto el 2026-12-10 crea una multa Pendiente de 6,00 € (`FINE_PER_DAY_EUR` × 3)
    - Test first: `AC-010-03 REQ-F-006 AC3 un día de retraso` — devuelto el 2026-12-08, la multa es 2,00 €
    - Test first: `AC-010-02 REQ-F-006 AC2 sin retraso` — devuelto el 2026-12-07 no crea multa
    - Test first: `AC-009-02 devolución tardía crea la multa` — la misma escritura deja "Devuelto" y la multa Pendiente
    - Test first: `AC-010-06 una reserva, una multa` (INV-FIN-002) — volver a aplicar conserva la existente y no hay segunda
    - Test first: `AC-010-05 almacén caído` — `E_ALMACEN_NO_DISPONIBLE`, sin devolución ni multa (ADR-005)
    - Test first: `PROP-004 importe = FINE_PER_DAY_EUR × días de retraso, y 0 multas si devueltaEl <= fin`
    - Test first: `PROP-005 el estado de la reserva solo avanza por las transiciones de SM-001`
    - Tras devolver tarde, la fila de `#/prestamos` muestra "6,00 €" y "Pendiente" (importe con coma decimal, VO-008)
  - **Refs:** FASE-2, REQ-F-005, REQ-F-006, UC-009, UC-010, API-003-05, INV-FIN-001, INV-FIN-002, INV-FIN-004, ADR-005, D-PA-003, RN-008, RN-009, VO-007, VO-008, SM-002, AC-009-02, AC-010-01, AC-010-02, AC-010-03, AC-010-05, AC-010-06
  - **Revert:** COUPLED — escribe multas en el almacén; revertir deja multas ya creadas sin operación que las produzca
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] `aplicarMultaPorRetraso` es interna: no hay ruta HTTP que la exponga
    - [ ] Devolución y multa se confirman juntas o ninguna

---

## Phase 4: Integration

**Purpose:** Cableado tocado por >= 2 slices.
**Checkpoint:** Ninguna tarea: el plugin y los textos se amplían dentro de cada slice (un solo bloque en serie).

Sin tareas en esta fase.

---

## Phase 5: Verification

**Purpose:** Journey de la FASE desde la ruta del usuario.
**Checkpoint:** El journey de FASE-2 pasa con sus capturas.

- [ ] TASK-F2-005 Journey FASE-2: el encargado entrega, recibe y multa, test-first | `tests/e2e/fase-2-prestamo.spec.js`
  - blocked-by: TASK-F2-004
  - **Commit:** `test(prestamos): recorrido de FASE-2 desde la ruta del usuario con capturas`
  - **Acceptance:**
    - Test first: nombrado por cada escenario REQ-F de la FASE: `AC-008-01`, `AC-008-02`, `AC-008-03`, `AC-008-04`, `AC-009-01`, `AC-009-02`, `AC-009-03`, `AC-010-01`
    - El título del journey lleva FASE-2 (la FASE no declara workflows) y el vídeo se nombra con él
    - Entra por el paso 1 de la Demo (con `CLOCK_FIXED=2026-12-04`, el encargado abre `#/prestamos`), nunca por un punto de entrada interno
    - Afirma con `toHaveText` / `toContainText`: "No se puede entregar antes de la fecha de inicio" (AC-008-03), "Entregado" (AC-008-01), "Devuelto" (AC-009-01, AC-009-03 con la fecha original), "6,00 €" y "Pendiente" (AC-009-02, AC-010-01), "No recogida" (AC-008-02), "Acceso no permitido" (AC-008-04)
    - Guarda `evidencias/FASE-2/{AC-NNN-NN}.png` por cada escenario REQ-F y un vídeo con `FASE-2` en el nombre, adjunto al test
    - Los criterios de borde (AC-008-05..07, AC-009-04..07, AC-010-05, AC-010-06) ya los cubren los tests unit/api y no se repiten aquí
  - **Refs:** FASE-2, REQ-F-005, REQ-F-006, N-005, N-006, AC-008-01, AC-008-02, AC-008-03, AC-008-04, AC-009-01, AC-009-02, AC-009-03, AC-010-01
  - **Revert:** SAFE — solo añade un test de aceptación
  - **Review:**
    - [ ] Entra por la ruta del usuario, no por la API
    - [ ] Cada captura corresponde a su criterio y muestra el texto afirmado

- [ ] TASK-F2-006 Corregir WEAKENED-ASSERT de CH-003 (REQ-F-005 AC5): la devolución repetida parte de una devolución tardía con multa | `tests/unit/prestamos-devolucion.test.js`, `tests/e2e/fase-2-prestamo.spec.js`
  - blocked-by: TASK-F2-005
  - **Source:** FEEDBACK-FASE-2
  - **Commit:** `test(prestamos): AC5 de REQ-F-005 comprueba que la devolución repetida no crea segunda multa`
  - **Acceptance:**
    - Reproduce first: con la devolución a tiempo (2026-12-07) el test pasaba sin multa alguna, así que "no second fine is created" no probaba nada
    - El GIVEN devuelve con retraso (2026-12-10, multa 6,00 €), el WHEN repite "Devolver" y el THEN afirma estado "Devuelto", fecha 2026-12-10 y una sola multa idéntica a la primera
    - La captura de AC-009-03 muestra Préstamos con «Devuelto» y «6,00 € Pendiente»
  - **Refs:** FASE-2, REQ-F-005, AC-009-03
  - **Revert:** SAFE — solo cambia tests

### Test Exclusions

Files excluded from unit test coverage (from PLAN-FASE §7.4 Exclusions):

| File | Reason | Verified By |
|------|--------|-------------|
| — | ninguna | N/A |

---

## Dependencies

### Task Dependency Graph

```text
TASK-F2-001 ──► TASK-F2-002 ──► TASK-F2-003 ──► TASK-F2-004 ──► TASK-F2-005
```

### Critical Path

1. TASK-F2-001 → TASK-F2-002 → TASK-F2-003 → TASK-F2-004 → TASK-F2-005
   (5 tasks on critical path)

### Parallel Execution Plan

**Stream A:** entregar, devolver y multar en un solo bloque en serie — see Stream Ownership

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | — | — | main checkout, before worktrees (checkpoint `fase-2-foundation`) |
| A | TASK-F2-001, TASK-F2-002, TASK-F2-003, TASK-F2-004 | `src/domain/prestamos.js`, `src/domain/multas.js`, `src/domain/permisos.js`, `src/server/plugin.js`, `src/ui/pantallas/prestamos.js`, `src/ui/textos.js`, `tests/unit/prestamos.test.js`, `tests/unit/multas.test.js`, `tests/unit/ui-prestamos.test.js`, `tests/api/prestamos.api.test.js` | worktree `feat/fase-2-a` |
| integración | — | — | main checkout, after `--integrate --fase 2` |
| verificación | TASK-F2-005, TASK-F2-006 | `tests/e2e/fase-2-prestamo.spec.js`, `tests/unit/prestamos-devolucion.test.js` | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Foundation | — | `fase-2-foundation` | main checkout |
| Verified | TASK-F2-005 | `fase-2-verified` | main checkout |
