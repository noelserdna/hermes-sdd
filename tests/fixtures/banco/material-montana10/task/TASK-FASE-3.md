# Tasks: FASE-3 - Socios y datos personales

> **Input:** plan/fases/FASE-3-SOCIOS.md + plan/fase-plans/PLAN-FASE-3.md
> **Generated:** 2026-11-21
> **Total tasks:** 9
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

> Convención de nombres de test: el título lleva `REQ-F-002 ACn` cuando el escenario del BDD lo declara (AC-002-01…07 = REQ-F-002 AC1…AC7), `REQ-NF-001 AC1` / `REQ-NF-001 AC2` para los de datos personales (ejemplos de `requirements/REQUIREMENTS.md`: «Glaciar2026»; devolución de 2024-11-01 con hoy 2026-11-21) y el id `AC-NNN-NN` siempre. Literales en `spec/tests/BDD-UC-002.md`.

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-002 / API-001-03, API-001-06 | TASK-F3-001, TASK-F3-005 |
| API-001-04 darDeBajaSocio | TASK-F3-002, TASK-F3-005 |
| API-001-05 restablecerContrasena | TASK-F3-003, TASK-F3-005 |
| API-003-08 purgarRegistrosAntiguos | TASK-F3-004 |
| INV-ACC-001..003 | TASK-F3-001 |
| INV-ACC-006, INV-ACC-007 | TASK-F3-002 |
| INV-ACC-103 | TASK-F3-003 |
| INV-LOA-006 | TASK-F3-004 |
| D-PA-003, D-PA-004, D-PA-005 | TASK-F3-001, TASK-F3-002, TASK-F3-004 |
| REQ-F-002 / REQ-NF-001 | TASK-F3-001..006 |

---

## Phase 1: Setup

**Purpose:** —
**Checkpoint:** —

Sin tareas.

---

## Phase 2: Foundation

**Purpose:** —
**Checkpoint:** —

Sin tareas: el hash, las sesiones y la tarea diaria vienen de FASE-0 y FASE-1.

---

## Phase 3: Slices

**Purpose:** Un corte vertical por operación, con su test escrito primero.
**Checkpoint:** Los tests de cada slice en verde.

### UC-002 — Gestionar socios

- [ ] TASK-F3-001 Dar de alta socios y listarlos, solo rol Socio (API-001-03, API-001-06) | `src/domain/socios.js`, `src/server/http.js`, `tests/unit/domain/socios.test.js`
  - **Commit:** `feat(socios): crearSocio y listarSocios solo para el encargado`
  - **Acceptance:**
    - Test first (`REQ-F-002 ACn · AC-002-nn`): AC-002-01 alta de Marta con contraseña válida; AC-002-02 correo duplicado rechazado; AC-002-03 contraseña corta y AC-002-12 datos inválidos rechazados; AC-002-09 dos altas simultáneas con el mismo correo: gana una (`transaction`)
    - AC-002-07 solo el Encargado; la operación solo crea cuentas con rol Socio: ninguna operación crea ni cambia cuentas de encargado o junta (D-PA-003)
    - Test first: `REQ-NF-001 AC1` Marta creada con la contraseña «Glaciar2026» → el almacén guardado y las respuestas no contienen «Glaciar2026» (solo hash con sal)
  - **Refs:** FASE-3, REQ-F-002, REQ-NF-001, UC-002, API-001-03, API-001-06, INV-ACC-001, INV-ACC-002, INV-ACC-003, SEC-001, SEC-002, D-PA-003, AC-002-01, AC-002-02, AC-002-03, AC-002-07, AC-002-09, AC-002-12
  - **Revert:** SAFE — módulo y rutas nuevos
  - **Review:**
    - [ ] Correo normalizado y único
    - [ ] Ninguna salida incluye hash ni contraseña

- [ ] TASK-F3-002 Dar de baja a un socio y cortar su sesión al instante (API-001-04) | `src/domain/socios.js`, `src/server/sesiones.js`, `src/server/http.js`, `tests/unit/domain/socios.test.js`, `tests/unit/server/sesiones-baja.test.js`
  - blocked-by: TASK-F3-001
  - **Commit:** `feat(socios): darDeBajaSocio revoca sus sesiones en la misma transaccion`
  - **Acceptance:**
    - Test first (`REQ-F-002 ACn · AC-002-nn`): AC-002-04 baja de un socio sin préstamo Prestado ni multa Pendiente (Pablo); AC-002-05 con una multa Pendiente o una Prestada se bloquea con `E_BAJA_SOCIO_BLOQUEADA` (409); AC-002-10 repetir la baja no cambia nada
    - Test first: `REQ-F-002 un socio dado de baja con la sesión abierta deja de poder usar la web al instante` (decisión del cliente Q-spec-auditor-001, INV-ACC-006, D-PA-004): tras la baja, la cookie de Pablo da `E_NO_AUTENTICADO` en su siguiente petición, y `revocarDeCuenta` borró sus sesiones en la misma transacción (aún sin id AC)
  - **Refs:** FASE-3, REQ-F-002, UC-002, API-001-04, INV-ACC-006, INV-ACC-007, D-PA-004, AC-002-04, AC-002-05, AC-002-10
  - **Revert:** SAFE — añade una operación y `revocarDeCuenta`
  - **Review:**
    - [ ] La baja y el corte de sesión son una sola transacción
    - [ ] Nunca opera sobre encargado ni junta

- [ ] TASK-F3-003 Restablecer la contraseña de un socio (API-001-05) | `src/domain/socios.js`, `src/server/http.js`, `tests/unit/domain/socios.test.js`
  - blocked-by: TASK-F3-002
  - **Commit:** `feat(socios): restablecerContrasena sustituye el hash del socio`
  - **Acceptance:**
    - Test first (`REQ-F-002 ACn · AC-002-nn`): AC-002-06 restablecer sustituye el hash y el socio entra con la nueva y no con la vieja; AC-002-08 contraseña corta rechazada; AC-002-11 repetir sin cambios
    - Solo opera sobre cuentas Socio (INV-ACC-103); un encargado o una junta como destino da error
  - **Refs:** FASE-3, REQ-F-002, UC-002, API-001-05, INV-ACC-103, D-PA-003, AC-002-06, AC-002-08, AC-002-11
  - **Revert:** SAFE — añade una operación
  - **Review:**
    - [ ] No se registra ni devuelve la contraseña
    - [ ] Misma longitud mínima que el alta

### UC-006 / API-003-08 — Retención de datos

- [ ] TASK-F3-004 Purgar registros antiguos y cuentas en Baja sin registros (API-003-08) | `src/domain/tareas.js`, `src/server/http.js`, `tests/unit/domain/purga.test.js`
  - blocked-by: TASK-F3-002
  - **Commit:** `feat(tareas): purgarRegistrosAntiguos borra prestamos, multas y cuentas en Baja caducados`
  - **Acceptance:**
    - Test first: `REQ-NF-001 AC2` con hoy 2026-11-21, una devolución del 2024-11-01 desaparece y la del 2025-01-10 se queda
    - Test first: `INV-LOA-006` una multa Pendiente nunca se borra; el cierre de un préstamo es su devolución (o `hasta` si Cancelada o No recogida) y el de una multa su fecha de pago
    - Test first: `D-PA-005` una cuenta en Baja sin reservas ni multas conservadas se borra con nombre, correo y hash (decisión del cliente Q-security-auditor-001: se borran cuando ya no hacen falta para préstamos y multas); con registros conservados la cuenta se queda
    - Es idempotente; la lanzan la tarea diaria y `POST /api/tareas-diarias` (con `x-cron-secret`) tras `resolverNoRecogidas`
  - **Refs:** FASE-3, REQ-NF-001, API-003-08, INV-LOA-006, D-PA-005, SEC-006, LIM-004, LIM-005
  - **Revert:** COUPLED — borra datos al ejecutarse; revertir el commit no recupera lo ya purgado (hay copias diarias del almacén)
  - **Review:**
    - [ ] Nunca borra una multa Pendiente ni un préstamo Prestado
    - [ ] Plazo `RETENTION_YEARS` tomado de `config.js`

- [ ] TASK-F3-005 Pantalla Socios: alta, baja y restablecer contraseña (SCR-006) | `src/ui/pantallas/socios.js`, `src/ui/router.js`, `src/ui/textos.js`, `tests/unit/ui/socios.test.js`
  - blocked-by: TASK-F3-003
  - **Commit:** `feat(ui): pantalla Socios con alta, baja y restablecer contraseña`
  - **Acceptance:**
    - Test first: `REQ-F-002 AC1 · AC-002-01` tras dar de alta a Marta, la tabla Socios muestra su fila
    - Test first: `REQ-F-002 AC5 · AC-002-05` la baja de quien tiene una multa Pendiente muestra el `mensaje` de bloqueo y la fila no cambia
    - La ruta `#/socios` solo está disponible para el encargado
  - **Refs:** FASE-3, REQ-F-002, UC-002, SCR-006, AC-002-01, AC-002-05
  - **Revert:** SAFE — pantalla nueva
  - **Review:**
    - [ ] Textos solo en `textos.js`
    - [ ] Confirmación visible antes de dar de baja

### Observaciones de FASE-2 (aceptada con observaciones por Andres Leon, 2026-11-21)

- [ ] TASK-F3-007 Multa con un día de retraso: «1 día», no «1 días» (observación FASE-2) | `src/ui/textos.js`, `tests/e2e/fase-2-devolucion.spec.js`
  - **Commit:** `fix(ui): la multa con un dia de retraso dice «1 dia»`
  - **Acceptance:**
    - Con 1 día de retraso el aviso dice «Multa de 2 € a Lucía (1 día de retraso)»; con 3, «(3 días de retraso)»
    - Requiere un `test-edit` firmado para `tests/e2e/fase-2-devolucion.spec.js` (pregunta Q-task-implementer-002, abierta): hasta entonces no se toca
  - **Refs:** FASE-3, FASE-2, REQ-F-006, AC-006-03, Q-task-implementer-002
  - **Revert:** SAFE — un texto
  - **Review:**
    - [ ] Singular y plural en `textos.js`

- [ ] TASK-F3-008 Historial muestra el material si la reserva aún no tiene unidad (observación FASE-2) | `src/domain/prestamos.js`, `src/ui/pantallas/historial.js`, `tests/unit/domain/prestamos-historial.test.js`
  - **Commit:** `fix(prestamos): el historial muestra el material de una reserva sin unidad`
  - **Acceptance:**
    - Una reserva Reservada de Piolet sale como «Piolet · {desde} a {hasta} · Reservada» en vez de «Sin unidad · …»
    - Requiere un `test-edit` firmado para `tests/unit/domain/prestamos-historial.test.js` (pregunta Q-task-implementer-003, abierta): hasta entonces no se toca
  - **Refs:** FASE-3, FASE-2, REQ-F-010, Q-task-implementer-003
  - **Revert:** SAFE — un campo más en la respuesta
  - **Review:**
    - [ ] Sin correo ni hash en la respuesta

### Hallazgos de la revisión independiente de FASE-3

- [ ] TASK-F3-009 Restablecer no se aplica a una cuenta en Baja (REQ-F-002, CH-003) | `src/domain/socios.js`, `tests/unit/domain/socios.test.js`
  - blocked-by: TASK-F3-003
  - **Commit:** `fix(socios): restablecerContrasena no se aplica a una cuenta en Baja`
  - **Acceptance:**
    - Reproduce first: GIVEN «pablo@club.es» dado de baja WHEN el encargado le fija «Nieve2026» THEN da `E_SOCIO_NO_ENCONTRADO` («El socio elegido no existe»), el hash no cambia y Pablo sigue sin poder entrar (decisión del cliente Q-spec-auditor-001: no se restablece una cuenta en Baja)
  - **Refs:** FASE-3, REQ-F-002, API-001-05, INV-ACC-103, Q-spec-auditor-001
  - **Revert:** SAFE — una comprobación más
  - **Review:**
    - [ ] Una cuenta Activa se sigue restableciendo igual

- [ ] TASK-F3-010 Restablecer la contraseña levanta el bloqueo de la cuenta (REQ-F-002 AC6, CH-004) | `src/domain/socios.js`, `tests/unit/domain/socios.test.js`, `tests/e2e/fase-3-socios.spec.js`
  - blocked-by: TASK-F3-009
  - **Commit:** `fix(socios): restablecer la contrasena levanta el bloqueo de la cuenta`
  - **Acceptance:**
    - Reproduce first: GIVEN «marta@club.es» bloqueada tras 5 errores WHEN el encargado le fija «Nieve2026» THEN Marta entra con ella en ese momento y «Glaciar2026» ya no vale; `fallosSeguidos` 0 y sin `bloqueadaHasta`
    - El e2e de AC6 bloquea antes a Marta y la captura sigue mostrando «Contraseña restablecida»
  - **Refs:** FASE-3, REQ-F-002, API-001-05, INV-ACC-103, CH-004
  - **Revert:** SAFE — dos asignaciones
  - **Review:**
    - [ ] Una cuenta sin bloqueo queda igual (AC-002-11)

- [ ] TASK-F3-011 Un intento con la contraseña antigua no abre sesión si un restablecimiento se cuela (REQ-F-002 AC6, CH-006) | `src/domain/acceso.js`, `tests/unit/domain/socios.test.js`
  - blocked-by: TASK-F3-010
  - **Commit:** `fix(acceso): el login no abre sesion con una contrasena restablecida mientras tanto`
  - **Acceptance:**
    - Reproduce first: GIVEN «marta@club.es» con «Glaciar2026» WHEN alguien entra con ella justo mientras el encargado fija «Nieve2026» THEN el intento da `E_CREDENCIALES_INVALIDAS`, no queda sesión abierta con la antigua, Marta entra con «Nieve2026» y «Glaciar2026» ya no vale
  - **Refs:** FASE-3, REQ-F-002, API-001-05, INV-ACC-103, CH-006
  - **Revert:** SAFE — una comparación más
  - **Review:**
    - [ ] El login normal y el bloqueo por errores siguen igual

- [ ] TASK-F3-012 REQ-C-001: los textos de la interfaz están en español (prueba con su criterio) | `tests/unit/restricciones/idioma.test.js`
  - **Commit:** `test(restricciones): REQ-C-001 AC1 textos de la interfaz en español`
  - **Acceptance:**
    - Test first (`REQ-C-001 AC1`): «All texts of the interface SHALL be in Spanish»: ningún texto de `src/ui/textos.js` ni literal de `src/ui/pantallas/` contiene «Error», «Loading», «Submit», «Cancel», «Login», «Logout», «Save» ni «Delete»
  - **Refs:** FASE-3, REQ-C-001
  - **Revert:** SAFE — solo pruebas
  - **Review:**
    - [ ] El nombre de la prueba lleva `REQ-C-001 AC1`

- [ ] TASK-F3-013 REQ-C-002: JavaScript ESM con Vite y Vitest (prueba con su criterio) | `tests/unit/restricciones/stack.test.js`
  - **Commit:** `test(restricciones): REQ-C-002 AC1 stack JavaScript, Vite y Vitest`
  - **Acceptance:**
    - Test first (`REQ-C-002 AC1`): «The application SHALL be built with JavaScript (ES modules), Vite and Vitest»: `package.json` tiene `type: module` y las dependencias `vite` y `vitest`
  - **Refs:** FASE-3, REQ-C-002
  - **Revert:** SAFE — solo pruebas
  - **Review:**
    - [ ] El nombre de la prueba lleva `REQ-C-002 AC1`

- [ ] TASK-F3-014 REQ-C-003: datos compartidos en el servidor, no en el navegador (prueba con su criterio) | `tests/unit/restricciones/datos-compartidos.test.js`
  - **Commit:** `test(restricciones): REQ-C-003 AC1 datos en el servidor, no en el navegador`
  - **Acceptance:**
    - Test first (`REQ-C-003 AC1`): «keep reservas, inventory, multas and accounts in one place read by every device, never only in the browser»: el código de `src/` no usa `localStorage` ni `sessionStorage`, y `src/server/` guarda el almacén en un fichero (`STORE_FILE`)
  - **Refs:** FASE-3, REQ-C-003, N-001
  - **Revert:** SAFE — solo pruebas
  - **Review:**
    - [ ] El nombre de la prueba lleva `REQ-C-003 AC1`

---

## Phase 4: Integration

**Purpose:** —
**Checkpoint:** —

Sin tareas.

---

## Phase 5: Verification

**Purpose:** El recorrido de la FASE desde la ruta del usuario.
**Checkpoint:** Criterios de Éxito de FASE-3 demostrados; tag `fase-3-verified`.

- [ ] TASK-F3-006 Recorrido FASE-3 por la ruta del usuario con capturas y vídeo | `tests/e2e/fase-3-socios.spec.js`, `tests/e2e/fixtures/semilla.js`
  - blocked-by: TASK-F3-004, TASK-F3-005
  - **Commit:** `test(e2e): recorrido FASE-3 con capturas por criterio`
  - **Acceptance:**
    - Test first: el título lleva `FASE-3` (la FASE no declara workflow; el vídeo se llama así) y recorre cada escenario de `Escenarios` con su id en el título del paso: AC-002-01…12, `REQ-NF-001 AC1`, `REQ-NF-001 AC2` (los que no están en la Demo se provocan con la semilla y se capturan en pantalla, sin repetir su lógica)
    - Entra por el paso 1 de la Demo: el encargado inicia sesión y abre `#/socios` con `CLOCK_FIXED=2026-11-21`, Pablo con la sesión abierta en otro contexto, una devolución de 2024-11-01 y otra de 2025-01-10
    - Afirma el texto en el elemento que lo muestra: Marta aparece en Socios; el alta repetida da el aviso de correo duplicado; la baja de quien tiene multa Pendiente se bloquea; tras dar de baja a Pablo su siguiente acción lleva a Entrar («sin sesión»); Marta entra con la contraseña nueva; tras la limpieza diaria (`POST /api/tareas-diarias` con `x-cron-secret`) la devolución de 2024 ya no está y la de 2025 sí; el fichero de datos no contiene ninguna contraseña en claro
    - Guarda `evidencias/FASE-3/{AC-NNN-NN | REQ-NF-001-ACn}.png` por criterio y un vídeo con `FASE-3` en su nombre, adjuntos al test
  - **Refs:** FASE-3, REQ-F-002, REQ-NF-001, AC-002-01, AC-002-02, AC-002-03, AC-002-04, AC-002-05, AC-002-06, AC-002-07, AC-002-08, AC-002-09, AC-002-10, AC-002-11, AC-002-12, E2E-ADM-01
  - **Revert:** SAFE — solo pruebas
  - **Review:**
    - [ ] Entra por `#/socios`, no por una función interna
    - [ ] Una captura por criterio y vídeo de la FASE

---

## Dependencies

### Task Dependency Graph

```text
001 ─► 002 ─┬─► 003 ─► 005 ─┐
            └─► 004 ────────┴─► 006
```

### Critical Path

1. TASK-F3-001 → 002 → 003 → 005 → 006
   (5 tasks on critical path)

### Parallel Execution Plan

**Stream A:** socios, baja con corte de sesión y purga, en serie (comparten `socios.js`, `http.js` y `textos.js`) — see Stream Ownership

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | — | — | main checkout, before worktrees (checkpoint `fase-3-foundation`) |
| A | TASK-F3-001, TASK-F3-002, TASK-F3-003, TASK-F3-004, TASK-F3-005, TASK-F3-009 | src/domain/{socios,tareas}.js, src/server/{http,sesiones}.js, src/ui/{router,textos}.js, src/ui/pantallas/socios.js, tests/unit/domain/{socios,purga}.test.js, tests/unit/server/sesiones-baja.test.js, tests/unit/ui/socios.test.js | worktree `feat/fase-3-a` |
| integración | — | — | main checkout, after `--integrate --fase 3` |
| verificación | TASK-F3-006, TASK-F3-012, TASK-F3-013, TASK-F3-014 | — | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Foundation | — (sin tareas base) | `fase-3-foundation` | main checkout |
| Verified | TASK-F3-006 | `fase-3-verified` | main checkout |
