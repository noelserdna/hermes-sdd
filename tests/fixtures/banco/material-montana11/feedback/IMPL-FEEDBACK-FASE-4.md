# Implementation Feedback — FASE-4

> La revisión independiente de la Fase 9 (paso 2b) no encontró nada. Las entradas son avisos de la implementación; esta etapa no ha corregido ninguna por sí sola.

## Issues

### IF-4-001: acciones de Socios bajo la tabla, no en la fila (wireframe SCR-006)

| Field | Value |
|---|---|
| **ID** | IF-4-001 |
| **Severity** | WARNING |
| **Task** | TASK-F4-003 |
| **Affected Specs** | ux/WIREFRAMES.md (SCR-006), ux/ACCESSIBILITY-SPEC.md |
| **Category** | SPEC-DEVIATION |
| **Status** | OPEN (Q-task-implementer-003) |

**Problem:** `tests/unit/ui-socios.test.js` (aceptado en FASE-1) exige filas de exactamente 3 celdas; la 4.ª columna «Acciones» del wireframe lo rompería. Los botones «Restablecer contraseña» y «Dar de baja» van en una lista «Acciones» bajo la tabla, cada uno descrito por el nombre del socio (`aria-describedby`, no `aria-label`: un `aria-label` con «contraseña» haría que `getByLabel('Contraseña')` de los e2e aceptados encontrara también los botones).
**Workaround:** funcional y accesible; mover los botones a la fila exige un registro `test-edit` de ese fichero.

---

### IF-4-002: tests nuevos en ficheros nuevos

| Field | Value |
|---|---|
| **ID** | IF-4-002 |
| **Severity** | WARNING |
| **Task** | TASK-F4-001, TASK-F4-002, TASK-F4-004 |
| **Affected Specs** | task/TASK-FASE-4.md |
| **Category** | TASK-DEFECT |
| **Status** | OPEN |

**Problem:** el documento de tareas ubica tests en `tests/unit/cuentas.test.js`, `tests/unit/sesiones.test.js` e `tests/unit/inventario.test.js`, aceptados en fases anteriores y sin registro `test-edit`. Los tests nuevos van en `tests/unit/cuentas-bajas.test.js` (incluye INV-ACC-008) e `tests/unit/inventario-bajas.test.js`; los de API en `tests/api/cuentas.test.js` y `tests/api/inventario.test.js` (nuevos). Las tablas de permisos de FASE-4 van en `OPERACIONES_FASE_4` (Q-task-implementer-001).

---

### IF-4-003: REQ-F-008 AC1 queda «weakened» por tres tests de FASE-1 que no se pueden editar

| Field | Value |
|---|---|
| **ID** | IF-4-003 |
| **Severity** | BLOCKER |
| **Task** | n/a |
| **Affected Specs** | requirements/REQUIREMENTS.md (REQ-F-008 AC1) |
| **Category** | TEST-WEAKENED |
| **Status** | OPEN (Q-task-implementer-004) |

**Problem:** con FASE-4 cerrando REQ-F-008, `sdd lint --quotes --fase 4` y `sdd accept` dan Q-03 / «weakened» en `tests/e2e/fase-1-reservas.spec.js:61`, `tests/unit/inventario.test.js:18` y `tests/unit/ui-inventario.test.js:17`: la plantilla «{tipo}: {n} unidades» pide la forma «unidad(es)» en su código. El test nuevo `tests/e2e/fase-4-cuentas-inventario.spec.js` (AC-013-01) sí la lleva. Resultado de `accept`: REQ-F-002 VERIFIED 7/7; REQ-F-008 MISSING 6/7.
**Suggested Resolution:** autorizar `endurecer-test` de esos tres ficheros (Q-task-implementer-004, solo añade comprobación).

---

### IF-4-004: la Demo exige re-enseñar en FASE-4 los criterios de alta y acceso de REQ-F-002 y REQ-F-008

| Field | Value |
|---|---|
| **ID** | IF-4-004 |
| **Severity** | WARNING |
| **Task** | TASK-F4-006 |
| **Affected Specs** | plan/fases/FASE-4-BAJAS.md (Requisitos), .sdd/demo/GUION-FASE-4.md |
| **Category** | SPEC-DEVIATION |
| **Status** | OPEN |

**Problem:** FASE-4 lista REQ-F-002 y REQ-F-008 enteros como `Requisitos`; `sdd lint --captures --fase 4` (C-07) exige narrar y capturar también AC-003-01/04/05/06 y AC-013-01/03/06, ya demostrados en FASE-0 y FASE-1. Se añadieron siete tests e2e (`tests/e2e/fase-4-cuentas-inventario.spec.js`) que repiten esos criterios; el plan de pruebas pedía no repetirlos.
