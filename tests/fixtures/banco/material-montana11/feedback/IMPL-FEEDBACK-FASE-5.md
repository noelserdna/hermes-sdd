# Implementation Feedback — FASE-5

> La revisión independiente de la Fase 9 (paso 2b) dejó 4 hallazgos (IF-5-005..IF-5-008); esta etapa no los ha corregido: una persona los encamina en la puerta de la FASE (tarea de arreglo o descarte).

## Issues

### IF-5-001: la junta no puede usar `listarSocios` porque un test aceptado lo prohíbe (Supuesto 1)

| Field | Value |
|---|---|
| **ID** | IF-5-001 |
| **Severity** | WARNING |
| **Task** | TASK-F5-003 |
| **Affected Specs** | plan/fase-plans/PLAN-FASE-5.md (Supuesto 1), spec/contracts/PERMISSIONS-MATRIX.md (fila junta) |
| **Category** | SPEC-DEVIATION |
| **Status** | RESOLVED-BY-CLIENT (Q-task-implementer-005, opción A: el test se deja y la junta usa `listarSociosHistorial`, solo lectura y solo junta; desviación anotada) |

| **Spec** | Supuesto 1: «la junta puede leer `listarSocios` para el selector» |
| **Deviation** | `tests/unit/permisos.test.js:34` (aceptado en FASE-0) exige `E_ACCESO_NO_PERMITIDO` para la junta en `listarSocios`. La junta obtiene la lista por `listarSociosHistorial` (solo junta, solo id, nombre y estado) |
| **Impact** | Una operación de lectura más que la matriz de permisos no nombra; ningún dato nuevo para la junta |
| **Recommendation** | ACCEPTED-BY-CLIENT |

**Workaround:** funcional; abrir `listarSocios` a la junta exige un registro `test-edit` de `tests/unit/permisos.test.js` y retirar `listarSociosHistorial`.

---

### IF-5-002: tests de las tareas en ficheros nuevos, no en los aceptados

| Field | Value |
|---|---|
| **ID** | IF-5-002 |
| **Severity** | WARNING |
| **Task** | TASK-F5-001, TASK-F5-003, TASK-F5-006 |
| **Affected Specs** | task/TASK-FASE-5.md |
| **Category** | SPEC-DEVIATION |
| **Status** | OPEN |

**Problem:** las tareas listan `tests/unit/prestamos.test.js` y `tests/unit/permisos.test.js`, aceptados en FASE-0/FASE-2 (editarlos exige un `test-edit`). Los tests nuevos van en `tests/unit/prestamos-prestado.test.js`, `prestamos-historial.test.js`, `permisos-junta.test.js` y `permisos-roles.test.js`.

---

### IF-5-003: criterios con test en varios niveles por exigencia de las capturas

| Field | Value |
|---|---|
| **ID** | IF-5-003 |
| **Severity** | WARNING |
| **Task** | TASK-F5-007 |
| **Affected Specs** | .sdd/demo/GUION-FASE-5.md, sdd lint --captures (C-07) |
| **Category** | SPEC-DEVIATION |
| **Status** | OPEN |

**Problem:** `lint --captures` (C-07) exige narrar y capturar AC-015-04, AC-016-02 y AC-016-03, que la tarea F5-007 daba por cubiertos por unit; y la tarea pide REQ-NF-001 AC1 y AC3 en el journey, ya probados en `tests/api/seguridad.test.js`. Esos cinco criterios se prueban en dos niveles (DOM/API y navegador).

---

### IF-5-004: dependencia nueva `@axe-core/playwright` y cuantía de la multa en euros

| Field | Value |
|---|---|
| **ID** | IF-5-004 |
| **Severity** | WARNING |
| **Task** | TASK-F5-007, TASK-F5-003 |
| **Affected Specs** | task/TASK-FASE-5.md (A11Y-T-001, AC-016-01) |
| **Category** | AMBIGUITY |
| **Status** | OPEN |

**Problem:** A11Y-T-001 pide axe-core y no estaba instalado: se añadió `@axe-core/playwright` (devDependency). La tarea F5-003 habla de «600 céntimos»; el almacén guarda `importeEur` (6 €) desde FASE-2 y se mantuvo.

---

### IF-5-005: la purga borra préstamos abiertos y multas pendientes

| Field | Value |
|---|---|
| **ID** | IF-5-005 |
| **Severity** | BLOCKER |
| **Task** | n/a |
| **Affected Specs** | spec/nfr/LIMITS.md (SPEC-LIM-003), RN-010 |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** `src/server/purga.js:35-36` filtra solo por fecha de actividad; una reserva `Entregado` sin devolver o una multa `Pendiente` con fecha anterior al corte se borra (la unidad queda libre sin haberse devuelto; la multa sin cobrar).
**Suggested Resolution:** no purgar `Entregado` ni `Pendiente`, o decidir en el requisito que sí.

---

### IF-5-006: la purga puede borrar la cuenta de un socio Activa

| Field | Value |
|---|---|
| **ID** | IF-5-006 |
| **Severity** | BLOCKER |
| **Task** | n/a |
| **Affected Specs** | spec/nfr/LIMITS.md (SPEC-LIM-003) |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** `src/server/purga.js:30` no distingue `estado`; una cuenta `Activa` cuya última actividad registrada (reservas, multas, sesiones) supera 2 años se borra aunque no esté de baja (la sesión cerrada ya no deja rastro).
**Suggested Resolution:** decidir si la retención de cuentas Activas se mide así o solo se purgan las de Baja.

---

### IF-5-007: el corte de la purga se desplaza un día tras un 29 de febrero

| Field | Value |
|---|---|
| **ID** | IF-5-007 |
| **Severity** | BLOCKER |
| **Task** | n/a |
| **Affected Specs** | spec/nfr/LIMITS.md (SPEC-LIM-003) |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** `src/server/purga.js:7-9`: con `hoy` = 2028-02-29 el corte sale 2026-03-01 (`setUTCFullYear`) y una actividad del 2026-02-28 se purga un día antes del límite. Impacto bajo, una vez cada cuatro años.

---

### IF-5-008: `consultarPrestado` falla entero si una reserva apunta a una unidad inexistente

| Field | Value |
|---|---|
| **ID** | IF-5-008 |
| **Severity** | BLOCKER |
| **Task** | n/a |
| **Affected Specs** | spec/contracts/API-prestamos.md (API-003-09) |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** `src/domain/prestamos.js:99` usa `unidad.tipo` sin `?.`; con un almacén inconsistente sale `E_ALMACEN_NO_DISPONIBLE` y Prestado no pinta nada. Ninguna ruta actual borra unidades.
