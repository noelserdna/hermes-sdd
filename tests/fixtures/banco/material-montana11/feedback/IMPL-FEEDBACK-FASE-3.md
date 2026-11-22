# Implementation Feedback — FASE-3

> Las entradas IF-3-001 son de la revisión independiente de la Fase 9 (paso 2b): una opinión sin contrastar que decide una persona en la puerta de la FASE. Las demás son avisos de la implementación. Esta etapa no ha corregido ninguna.

## Issues

### IF-3-001: cuerpo JSON `null` en `marcarMultaPagada` da 503 en vez de 401/403/422

| Field | Value |
|---|---|
| **ID** | IF-3-001 |
| **Severity** | BLOCKER |
| **Task** | n/a (CODE-REVIEW) |
| **Affected Specs** | design/OPERATION-MAPPING.md |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** el valor por defecto `= {}` de `marcarMultaPagada` (`src/domain/multas.js`) solo cubre `undefined`, no `null`; un cuerpo JSON `null` lanza `TypeError` antes de autenticar y el plugin lo traduce a `E_ALMACEN_NO_DISPONIBLE`. Misma causa que IF-0-002, IF-1-002 e IF-2-001.
**Evidence:** `POST /api/marcarMultaPagada` con cuerpo `null` → 503 en vez de 401 sin sesión, 403 a un socio o 422 al encargado. Sin fuga ni escritura. No se ha lanzado la petición.
**Suggested Resolution:** normalizar el cuerpo a `{}` cuando no es un objeto, en un solo punto del plugin (resuelve también las anteriores).

---

### IF-3-002: la Demo de FASE-3 pide reservar Casco «12-05 a 12-06» el día de la multa (2026-12-11)

| Field | Value |
|---|---|
| **ID** | IF-3-002 |
| **Severity** | WARNING |
| **Task** | TASK-F3-005 |
| **Affected Specs** | plan/fases/FASE-3-MULTAS.md (## Demo, pasos 2 y 5) |
| **Category** | SPEC-DEVIATION |
| **Status** | OPEN |

**Problem:** la multa de 6,00 € nace con la devolución del 2026-12-10; para entonces las fechas 12-05 a 12-06 están en el pasado y `reservarMaterial` da `E_FECHA_PASADA` antes que `E_MULTA_PENDIENTE` (orden de errores de API-002-02). Los criterios AC-010-04, AC-012-01 y AC-012-02 no fijan las fechas de la reserva.
**Workaround:** el journey pide Casco del 2026-12-15 al 2026-12-16 (rechazado con multa; «Reserva creada: Casco, 2026-12-15 a 2026-12-16» al pagarla). El texto de la Demo conviene corregirlo.

---

### IF-3-003: tests nuevos en ficheros nuevos y una cita menos en el test de pantalla de Multas

| Field | Value |
|---|---|
| **ID** | IF-3-003 |
| **Severity** | WARNING |
| **Task** | TASK-F3-001, TASK-F3-003, TASK-F3-004 |
| **Affected Specs** | task/TASK-FASE-3.md |
| **Category** | TASK-DEFECT |
| **Status** | OPEN |

**Problem:** el documento de tareas ubica los tests de dominio en `tests/unit/multas.test.js`, un fichero aceptado en FASE-2 que no se puede editar sin un registro `test-edit` (Art. 12). Los tests nuevos van en `tests/unit/multas-propias.test.js` y `tests/unit/multas-pago.test.js`. Además `tests/unit/ui-multas.test.js` no cita `AC-012-01`/`REQ-F-007 AC1` en su título: ese criterio incluye «pablo puede reservar Casco», que prueba `multas-pago.test.js` (y el journey), y citarlo en la pantalla obligaba a un literal que esa pantalla no puede producir.
**Workaround:** ninguno necesario; los criterios están cubiertos en esos ficheros.

---

### IF-3-004: REQ-F-006 AC2 queda «weakened» por un test de FASE-2 que no se puede editar

| Field | Value |
|---|---|
| **ID** | IF-3-004 |
| **Severity** | BLOCKER |
| **Task** | n/a |
| **Affected Specs** | requirements/REQUIREMENTS.md (REQ-F-006 AC2) |
| **Category** | ACCEPTANCE-GAP |
| **Status** | OPEN |

**Problem:** `tests/unit/multas.test.js:41` (FASE-2, aceptado) cita REQ-F-006 AC2 sin el literal «Sin multas» (`sdd lint --quotes` Q-03; `sdd accept`: `weakened-test`, REQ-F-006 MISSING 5/6). El literal está en `tests/unit/ui-mis-multas.test.js` y en la captura AC-010-02 de Multas. Hace falta un registro `test-edit` (endurecer) del notario o una excepción de literal de una persona. Pregunta: Q-task-implementer-002 (su opción recomendada «dejarlo» no resuelve el MISSING: la salida que lo cierra es la B, autorizar el retoque).
**Suggested Resolution:** autorizar el retoque de `tests/unit/multas.test.js` (solo añade una aserción) o registrar la excepción.
