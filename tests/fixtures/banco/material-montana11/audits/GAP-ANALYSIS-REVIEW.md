# Revisión de huecos: especificación frente a código

- **Fecha:** 2026-11-22
- **Fuente:** `.sdd/gap-analysis.json` (modo `--semantic`; sin `TYPESAFE_API_KEY`, así que el juicio semántico lo hizo el modelo leyendo el código, sin enviar nada fuera)
- **Resultado:** 24/24 operaciones implementadas · 0 MISSING · 1 ORPHAN · 0 MISMATCH · 116/116 escenarios BDD con test · 13 de 14 requisitos cubiertos (REQ-C-001 no comprobable leyendo código).

| Decisión | Significado | Acción |
|----------|-------------|--------|
| **PROMOTE** | La función vale: hacerla requisito con `/sdd-req-change` | Crear REQ, actualizar specs, conservar código |
| **REMOVE** | No se pidió | Borrar código y ajustar tests |
| **ACCEPT** | Se conserva sin requisito formal | Sin cambios; la justificación queda como documentación |
| **DEFER** | Decidir más tarde | Sin acción ahora |

## Rutas sin especificar (ORPHAN)

### ORPHAN-001: `GET /api/listarSociosHistorial`
- **File:** `src/server/plugin.js:41`, `src/domain/prestamos.js:112`
- **Origin:** decisión de implementación (Q-task-implementer-005, FASE-5), no un requisito formal.
- **What it does:** devuelve id, nombre y estado de cada socio, solo para la junta y solo lectura, para poblar el selector de la pantalla Historial (SCR-011).
- **Why it's orphan:** ningún `API-*` ni fila de `design/OPERATION-MAPPING.md` la recoge. REQ-F-010 pide que la junta consulte el historial de un socio, pero la operación para elegir socio no está en el contrato.
- **Contexto:** el cliente ya contestó «se deja así; la junta ve la lista de socios por una vía de solo lectura propia». Esa respuesta no es una decisión de este documento: sigue pendiente decidir si se añade al contrato.
- **Risk of removing:** la junta no podría elegir socio en Historial, y `listarSocios` es solo del encargado (INV-SEC-002 / `permisos.test.js`).
- **Risk of keeping as-is:** superficie sin contrato ni BDD propio; la autorización de solo lectura de la junta no queda especificada.
- **Decision:** `________` **Rationale:** _______________________

## Operaciones sin ruta HTTP (informativo, no es un hueco)

`API-003-03 marcarNoRecogidas` y `API-003-05 aplicarMultaPorRetraso` son actor «sistema» y no tienen ruta por diseño (`OPERATION-MAPPING.md`, «Deviations»). Existen como `aplicarNoRecogidas` en `src/domain/prestamos.js:12`, llamada desde lecturas y escrituras de reservas y préstamos.

## Escenarios BDD sin test

Ninguno: los 116 escenarios `AC-NNN-NN` aparecen citados en `tests/`.

## Requisitos (`--semantic`)

Sin grafo de trazabilidad (`dashboard/traceability-graph.json`), todos los REQ eran objetivo. Sin Jev, juicio del modelo.

**Sin verificar:** ninguno como `partial`, `likely-missing` o `no-candidates`.

**No comprobable leyendo código:** REQ-C-001 (Stack: Vite + JavaScript), se ve en `package.json`.

**Cubiertos (evidencia):**
- REQ-F-001 `src/domain/cuentas.js`, `src/server/sesiones.js`
- REQ-F-002 `src/domain/cuentas.js`
- REQ-F-003, REQ-F-004 `src/domain/reservas.js`
- REQ-F-005 `src/domain/prestamos.js`
- REQ-F-006, REQ-F-007 `src/domain/multas.js`, `src/domain/prestamos.js`
- REQ-F-008 `src/domain/inventario.js` (AC1 exento por el cliente, `acceptance/PENDIENTES.md` MATERIALMONTANA11-1; el aviso MISSING del recuento «unidades» es un falso aviso del arnés, no un hueco del proyecto)
- REQ-F-009, REQ-F-010 `src/domain/prestamos.js`
- REQ-C-002 `src/domain/errores.js`, `src/ui/textos.js`
- REQ-C-003 `src/server/store.js`
- REQ-NF-001 `src/domain/permisos.js`, `src/server/plugin.js`

Este análisis lee solo código de producción. Que los tests comprueben la letra de cada criterio lo cubre `sdd-acceptance --adversarial`.

## How to process this document
1. Revisar cada hallazgo y escribir decisión y justificación
2. PROMOTE / AMEND: `/sdd-req-change`
3. REMOVE: borrar el código y ajustar los tests
4. IMPLEMENT: `/sdd-task-generator --fase=N --incremental`
5. ACCEPT: sin cambios de código; la justificación es la documentación
6. Commitear este documento con las decisiones como registro
