# Tasks: FASE-4 - Restablecer contraseñas y dar de baja

> **Input:** plan/fases/FASE-4-BAJAS.md + plan/fase-plans/PLAN-FASE-4.md
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
| Verification phase | 1 tasks |

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-004 | TASK-F4-001, TASK-F4-002, TASK-F4-003 |
| UC-014 | TASK-F4-004, TASK-F4-005 |
| API-001-06 | TASK-F4-001 |
| API-001-07 | TASK-F4-002 |
| API-004-03 | TASK-F4-004 |
| ADR-005 | TASK-F4-002, TASK-F4-004 |
| INV-ACC-008 | TASK-F4-001, TASK-F4-002 |
| INV-ACC-009 | TASK-F4-001 |
| INV-LOA-004 | TASK-F4-002 |
| INV-STK-003 | TASK-F4-004 |
| INV-STK-004 | TASK-F4-004 |
| INV-STK-005 | TASK-F4-004 |
| REQ-F-002 | TASK-F4-001, TASK-F4-002, TASK-F4-003, TASK-F4-006 |
| REQ-F-008 | TASK-F4-004, TASK-F4-005, TASK-F4-006 |
| FASE-4 | TASK-F4-006 |

---

## Phase 1: Setup

**Purpose:** Sin tareas: el andamiaje, el plugin de Vite y las sesiones ya existen desde FASE-0.
**Checkpoint:** No aplica.

---

## Phase 2: Foundation

**Purpose:** Sin tareas: lo compartido (reservas Entregado y Reservada, `confirmar-en-linea`) lo entregaron FASE-1 y FASE-2; el resto se construye en el primer slice que lo usa.
**Checkpoint:** No aplica.

---

## Phase 3: Slices

**Purpose:** Un slice vertical por operación o grupo afín (dominio + API + pantalla), con el test escrito primero.
**Checkpoint:** Los tests de cada slice en verde.

### UC-004 — Restablecer contraseña y dar de baja socio

- [ ] TASK-F4-001 Restablecer la contraseña de un socio y cerrar sus sesiones (API-001-06), test-first | `tests/unit/cuentas.test.js`, `tests/unit/sesiones.test.js`, `tests/api/cuentas.test.js`, `src/domain/cuentas.js`, `src/server/sesiones.js`, `src/server/plugin.js`
  - **Commit:** `feat(bajas): restablecerContrasena con cierre de sesiones (API-001-06)`
  - **Acceptance:**
    - Test first: `AC-004-01 restablecer contraseña [REQ-F-002 AC4]` — el encargado fija "Hielo2026x" a "Lucía Gil": entra con "Hielo2026x", con la antigua da error y la operación responde éxito (la UI mostrará "Contraseña restablecida")
    - Test first: `INV-ACC-008 sesiones cerradas` — una sesión abierta de Lucía deja de ser válida tras restablecer (`comprobarSesion` falla); la sesión del encargado sigue
    - Test first: `AC-004-03 contraseña corta` — "corta1" da `E_CONTRASENA_CORTA` y la contraseña anterior sigue vigente
    - Test first: `AC-004-04 socio inexistente` — `E_SOCIO_NO_ENCONTRADO` y nada cambia; con la cuenta en Baja también `E_SOCIO_NO_ENCONTRADO` (INV-ACC-009)
    - Test first: `AC-004-08 restablecer repetido` — fijar otra vez "Hielo2026x" responde éxito y solo vale "Hielo2026x"
    - Test first: `AC-004-06 socio no autorizado` — con rol socio o junta `E_ACCESO_NO_PERMITIDO` y nada cambia; `AC-004-07 almacén caído` — `E_ALMACEN_NO_DISPONIBLE` y la contraseña anterior sigue vigente
    - La contraseña no se escribe en el log (SPEC-SEC-006); el socio no tiene que cambiarla al entrar (D-PA-005)
  - **Refs:** FASE-4, REQ-F-002, UC-004, API-001-06, INV-ACC-008, INV-ACC-009, SEC-T-005, AC-004-01, AC-004-03, AC-004-04, AC-004-06, AC-004-07, AC-004-08
  - **Revert:** SAFE — operación nueva sin cambios de esquema
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] La ruta POST `/api/restablecerContrasena` y los errores coinciden con `contracts/API-acceso.md`
    - [ ] Ni la contraseña ni su hash aparecen en el log ni en la respuesta

- [ ] TASK-F4-002 Dar de baja a un socio: reservas canceladas e historial conservado (API-001-07), test-first | `tests/unit/cuentas.test.js`, `tests/api/cuentas.test.js`, `src/domain/cuentas.js`, `src/domain/permisos.js`, `src/server/plugin.js`
  - blocked-by: TASK-F4-001
  - **Commit:** `feat(bajas): darDeBajaSocio cancela reservas futuras (API-001-07)`
  - **Acceptance:**
    - Test first: `AC-004-02 dar de baja [REQ-F-002 AC5]` — "Pablo Ruiz" con 1 reserva futura de "Casco 2": queda "Baja", la reserva queda Cancelada y "Casco 2" libre, todo en una sola escritura (ADR-005)
    - Test first: `AC-004-05 material sin devolver [REQ-F-002 AC6]` — con una unidad Entregado `E_SOCIO_CON_MATERIAL` (INV-LOA-004), la cuenta sigue Activa y sus reservas intactas
    - Test first: `AC-004-09 baja repetida` — con "Pablo Ruiz" ya en Baja, repetir responde éxito y no cambia nada
    - Test first: `INV-ACC-008 sesiones cerradas` — las sesiones abiertas de Pablo dejan de ser válidas tras la baja
    - Test first: `RN-007 historial conservado` — tras la baja las reservas Devuelta y préstamos de Pablo siguen en el almacén
    - Test first: `AC-004-06 socio no autorizado` — con rol socio `E_ACCESO_NO_PERMITIDO`; `AC-004-07 almacén caído` — `E_ALMACEN_NO_DISPONIBLE` y la cuenta sigue Activa con sus reservas
    - No se modifica `src/domain/reservas.js` ni `src/domain/multas.js`; las reservas se cancelan desde `cuentas.js`
  - **Refs:** FASE-4, REQ-F-002, UC-004, API-001-07, ADR-005, INV-ACC-008, INV-LOA-004, SM-004, RN-007, AC-004-02, AC-004-05, AC-004-06, AC-004-07, AC-004-09
  - **Revert:** SAFE — operación nueva sin cambios de esquema
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Un fallo del almacén no deja reservas canceladas con la cuenta Activa
    - [ ] La baja no borra historial: solo cambia el estado

- [ ] TASK-F4-003 Pantalla Socios con "Restablecer contraseña" y "Dar de baja" por fila (UC-004), test-first | `tests/unit/ui-socios-bajas.test.js`, `src/ui/pantallas/socios.js`, `src/ui/textos.js`
  - blocked-by: TASK-F4-002
  - **Commit:** `feat(bajas): acciones Restablecer contraseña y Dar de baja en Socios (UC-004)`
  - **Acceptance:**
    - Test first: `AC-004-01 mensaje al restablecer` — en `#/socios` "Restablecer contraseña" pide la nueva clave, y al confirmar con "Hielo2026x" muestra "Contraseña restablecida"
    - Test first: `AC-004-02 marca Baja en la lista` — "Dar de baja" pide confirmación en línea y, al confirmar, la fila de "Pablo Ruiz" muestra "Baja" y deja de ofrecer las acciones
    - Test first: `AC-004-05 mensaje material sin devolver` — con `E_SOCIO_CON_MATERIAL` se muestra "No se puede dar de baja: tiene material sin devolver" y la fila sigue Activa
    - Tras cada acción el foco vuelve al botón que la lanzó; los textos están en `src/ui/textos.js`
  - **Refs:** FASE-4, REQ-F-002, UC-004, SCR-006, AC-004-01, AC-004-02, AC-004-05
  - **Revert:** SAFE — acciones y textos nuevos en una pantalla
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Reutiliza `confirmar-en-linea` de FASE-1
    - [ ] La contraseña no se pinta en la pantalla tras restablecer

### UC-014 — Dar de baja unidad

- [ ] TASK-F4-004 Dar de baja una unidad con cancelación de reservas y carrera con la entrega (API-004-03), test-first | `tests/unit/inventario.test.js`, `tests/api/inventario.test.js`, `src/domain/inventario.js`, `src/domain/permisos.js`, `src/server/plugin.js`
  - blocked-by: TASK-F4-003
  - **Commit:** `feat(bajas): darDeBajaUnidad cancela reservas Reservada (API-004-03)`
  - **Acceptance:**
    - Test first: `AC-014-01 baja de Casco 3 [REQ-F-008 AC2]` — "Casco" con 4 unidades: tras dar de baja "Casco 3" el inventario devuelve 3 unidades de "Casco" y "Casco 3" en "De baja"
    - Test first: `AC-014-02 reservas futuras canceladas [REQ-F-008 AC4]` — "Tienda" con 1 unidad y una reserva futura desde 2026-12-20: la reserva queda Cancelada y la respuesta trae `M_RESERVAS_CANCELADAS_BAJA` con 1 reserva cancelada
    - Test first: `AC-014-03 unidad prestada [REQ-F-008 AC3]` — "Casco 2" con un Entregado: `E_UNIDAD_PRESTADA` y sigue en Alta (INV-STK-003)
    - Test first: `AC-014-07 baja repetida [REQ-F-008 AC5]` — con "Casco 3" ya "De baja", repetir deja "Casco: 3 unidades" (INV-STK-004)
    - Test first: `AC-014-06 entrega y baja a la vez (D-T-009)` — gana la primera confirmada: la baja da `E_UNIDAD_PRESTADA` o la entrega da `E_ESTADO_INVALIDO`, nunca ambas con éxito
    - Test first: `PROP-008` — la propiedad de baja de unidad del plan de propiedades se cumple (INV-STK-005: ninguna reserva Reservada queda sobre una unidad De baja)
    - Test first: `AC-014-04 unidad inexistente` — "Casco 99" da `E_UNIDAD_NO_ENCONTRADA` y nada cambia; `AC-014-05 socio o junta` — `E_ACCESO_NO_PERMITIDO` y "Casco 3" sigue en Alta; `AC-014-08 almacén caído` — `E_ALMACEN_NO_DISPONIBLE` y la unidad y sus reservas no cambian
  - **Refs:** FASE-4, REQ-F-008, UC-014, API-004-03, ADR-005, INV-STK-003, INV-STK-004, INV-STK-005, SM-003, D-T-009, PROP-008, AC-014-01, AC-014-02, AC-014-03, AC-014-04, AC-014-05, AC-014-06, AC-014-07, AC-014-08
  - **Revert:** SAFE — operación nueva sin cambios de esquema
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] La baja y la cancelación van en una sola escritura, sin huecos a medias
    - [ ] La ruta POST `/api/darDeBajaUnidad` y los errores coinciden con `contracts/API-inventario.md`

- [ ] TASK-F4-005 Pantalla Inventario con "Dar de baja" por unidad y confirmación (UC-014), test-first | `tests/unit/ui-inventario-bajas.test.js`, `src/ui/pantallas/inventario.js`, `src/ui/textos.js`
  - blocked-by: TASK-F4-004
  - **Commit:** `feat(bajas): acción Dar de baja por unidad en Inventario (UC-014)`
  - **Acceptance:**
    - Test first: `AC-014-01 recuento y estado [REQ-F-008 AC2]` — en `#/inventario` "Dar de baja" de "Casco 3" pide confirmación en línea y, al confirmar, se ve "Casco: 3 unidades" y "Casco 3" con "De baja"
    - Test first: `AC-014-03 mensaje unidad prestada [REQ-F-008 AC3]` — con `E_UNIDAD_PRESTADA` se muestra "No se puede dar de baja: está prestada"
    - Test first: `AC-014-02 aviso de reservas canceladas [REQ-F-008 AC4]` — con 1 reserva cancelada se muestra "1 reserva cancelada por la baja"
    - Una unidad ya "De baja" no ofrece el botón; el foco vuelve al botón tras la acción
  - **Refs:** FASE-4, REQ-F-008, UC-014, SCR-009, AC-014-01, AC-014-02, AC-014-03
  - **Revert:** SAFE — acción y textos nuevos en una pantalla
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Los textos están en `src/ui/textos.js`, en español

---

## Phase 4: Integration

**Purpose:** Sin tareas: las rutas `#/socios` e `#/inventario` y las operaciones se enganchan dentro de los slices; no hay cableado compartido por varios Streams.
**Checkpoint:** No aplica.

---

## Phase 5: Verification

**Purpose:** Journey de FASE-4 por la ruta del usuario.
**Checkpoint:** El journey de la Demo de FASE-4 pasa con capturas y vídeo.

- [ ] TASK-F4-006 Journey FASE-4: el encargado restablece a Lucía, da de baja a Pablo y retira unidades | `tests/e2e/fase-4-bajas.spec.js`
  - blocked-by: TASK-F4-005
  - **Commit:** `test(bajas): journey de FASE-4 con capturas`
  - **Acceptance:**
    - Test first: `AC-004-01`, `AC-004-05`, `AC-004-02`, `AC-014-01`, `AC-014-03`, `AC-014-02`, `AC-014-07` — un test por escenario REQ-F de la FASE, con datos de partida de la Demo (Lucía con reserva futura, Pablo con un Casco entregado)
    - El título lleva FASE-4, el id con el que se nombra el vídeo (la FASE no tiene workflow)
    - Entra por el paso 1 de la Demo (el encargado abre "Socios" y restablece la clave de Lucía a `Hielo2026x`), nunca por una entrada interna
    - Afirma con `toHaveText`/`toContainText`: "Contraseña restablecida" y que Lucía entra con la nueva; "No se puede dar de baja: tiene material sin devolver"; "Baja" en la fila de Pablo tras devolver el Casco; "Casco: 3 unidades" y "Casco 3" "De baja" (y sigue "Casco: 3 unidades" al repetir); "No se puede dar de baja: está prestada"; "1 reserva cancelada por la baja"
    - Guarda `evidencias/FASE-4/{AC-NNN-NN}.png` por criterio y un vídeo con FASE-4 en el nombre, con `narrar` y `captura` de `tests/e2e/fixtures/evidence.js`
    - Los demás escenarios (AC-004-03, AC-004-04, AC-004-06, AC-004-07, AC-004-08, AC-004-09, AC-014-04, AC-014-05, AC-014-06, AC-014-08) los cubren los tests de TASK-F4-001, TASK-F4-002 y TASK-F4-004 y no se repiten aquí
  - **Refs:** FASE-4, REQ-F-002, REQ-F-008, AC-004-01, AC-004-02, AC-004-05, AC-014-01, AC-014-02, AC-014-03, AC-014-07
  - **Revert:** SAFE — solo añade un test
  - **Review:**
    - [ ] El journey entra por la ruta del usuario
    - [ ] Las capturas se guardan en `evidencias/FASE-4/`

### Test Exclusions

Files excluded from unit test coverage (from PLAN-FASE §7.4 Exclusions):

| File | Reason | Verified By |
|------|--------|-------------|
| src/ui/pantallas/socios.js, src/ui/pantallas/inventario.js | las acciones nuevas se pintan en DOM en sus slices y el recorrido real lo cubre E2E | TASK-F4-006 |

---

## Dependencies

### Task Dependency Graph

```text
TASK-F4-001 ──► TASK-F4-002 ──► TASK-F4-003 ──► TASK-F4-004 ──► TASK-F4-005 ──► TASK-F4-006
```

### Critical Path

1. TASK-F4-001 → TASK-F4-002 → TASK-F4-003 → TASK-F4-004 → TASK-F4-005 → TASK-F4-006
   (6 tasks on critical path)

### Parallel Execution Plan

**Stream A:** cuentas e inventario en serie (restablecer, baja de socio, pantalla Socios, baja de unidad, pantalla Inventario) — see Stream Ownership

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | — | — | main checkout, before worktrees (checkpoint `fase-4-foundation`) |
| A | TASK-F4-001, TASK-F4-002, TASK-F4-003, TASK-F4-004, TASK-F4-005 | `src/domain/cuentas.js`, `src/domain/inventario.js`, `src/domain/permisos.js`, `src/server/plugin.js`, `src/server/sesiones.js`, `src/ui/pantallas/socios.js`, `src/ui/pantallas/inventario.js`, `src/ui/textos.js`, `tests/unit/cuentas.test.js`, `tests/unit/inventario.test.js`, `tests/unit/sesiones.test.js`, `tests/unit/ui-socios-bajas.test.js`, `tests/unit/ui-inventario-bajas.test.js`, `tests/api/cuentas.test.js`, `tests/api/inventario.test.js` | worktree `feat/fase-4-a` |
| integración | — | — | main checkout, after `--integrate --fase 4` |
| verificación | TASK-F4-006 | `tests/e2e/fase-4-bajas.spec.js` | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Verified | TASK-F4-006 | `fase-4-verified` | main checkout |
