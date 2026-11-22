# Revisión de huecos entre especificación y código

Fecha: 2026-11-22 · Fuente: `.sdd/gap-analysis.json` · Modo: completo + semántico (juez: lectura directa, sin Jev; no hay `TYPESAFE_API_KEY`, no se envió código fuera).
Sin grafo de trazabilidad: todos los REQ se trataron como objetivo.

Resumen: 21/21 operaciones de contrato implementadas (todas con ruta o tarea interna según `design/OPERATION-MAPPING.md`), 0 faltantes, 2 rutas sin contrato, 0 desajustes, 109/110 escenarios con prueba. 12/12 REQ funcionales y no funcionales con implementación localizada; `REQ-C-001` y `REQ-C-002` no se comprueban leyendo código.

| Decisión | Significado | Acción |
|----------|-------------|--------|
| **PROMOTE** | Función valiosa: pasa a REQ con `/sdd-req-change` | Crear REQ, actualizar specs, conservar código |
| **REMOVE** | No se pidió | Borrar código y ajustar pruebas |
| **ACCEPT** | Se queda sin REQ formal | Sin cambios; la justificación queda como documentación |
| **DEFER** | Se decide más tarde | Nada por ahora |

## Rutas sin contrato (ORPHAN)

### ORPHAN-001: `GET /api/socios` (listar socios)
- **File:** `src/server/http/rutas.js:59` (`listMembers`, `src/server/servicios/cuentas.js:74`)
- **Origin:** decisión de implementación; los UC-003 y UC-006 hablan de la lista «Socios» pero ninguna operación de `spec/contracts/API-cuentas.md` la define (la ruta se registra bajo el id API-001-04, que es el alta).
- **What it does:** devuelve la lista de socios con su estado, solo para el encargado, para la página Socios.
- **Why it's orphan:** la lista se menciona en casos de uso y escenarios BDD, pero no tiene operación propia en el contrato.
- **Risk of removing:** el encargado no podría ver ni dar de baja a los socios (UC-003, UC-006 y escenarios AC-006-* dependen de ella).
- **Decision:** `________` **Rationale:** _______________________

### ORPHAN-002: `GET /api/sesion`
- **File:** `src/server/http/rutas.js:99`
- **Origin:** mecánica de la guardia del router de API-001-08 (`authorize`); `OPERATION-MAPPING.md` describe la guardia, no esta URL.
- **What it does:** informa al navegador si la sesión puede abrir una página (Entrar, cambiar contraseña, página prohibida).
- **Why it's orphan:** es el transporte de API-001-08, que en el contrato es una operación del sistema sin ruta.
- **Risk of removing:** la SPA no sabría a qué pantalla llevar al usuario.
- **Decision:** `________` **Rationale:** _______________________

## Operaciones del contrato sin implementar (MISSING)

Ninguna.

## Desajustes (MISMATCH)

Ninguno detectado (comprobación por expresiones regulares, mejor esfuerzo).

## Escenarios BDD sin prueba (uncovered)

### BDD-001: AC-002-02 — volver atrás tras salir
- **File:** `spec/tests/BDD-UC-002.md:13`
- **Origin:** UC-002, REQ-F-001 AC7.
- **What it does:** tras «Salir» y volver atrás, solo se ve «Entrar», sin datos privados.
- **Why it's uncovered:** ninguna prueba cita su id; el e2e `AC-002-01` (`tests/e2e/fase-0.spec.js:147`) dice en el título que comprueba también el «volver atrás», así que probablemente está cubierto bajo otro id.
- **Risk of not implementing:** si ese e2e no comprueba de verdad el «volver atrás», el criterio quedaría sin vigilar.
- **Decision:** `________` **Rationale:** _______________________

## Requisitos sin implementación verificada

Ninguno. Todos con implementación localizada (`covered`, juez: lectura directa; añade `// Refs: REQ-…` si quieres anclarlos):

| REQ | Evidencia |
|---|---|
| REQ-F-001 | `src/server/servicios/cuentas.js:32-72`, `sesiones.js` (30 min) |
| REQ-F-002 | `src/server/servicios/cuentas.js:86-160` |
| REQ-F-003 | `src/server/servicios/prestamos.js:14-41` |
| REQ-F-004 | `src/server/servicios/prestamos.js:42-82` |
| REQ-F-005 | `src/server/servicios/prestamos.js:83-130` |
| REQ-F-006 | `src/server/servicios/multas.js:6-40`, `dominio/multas.js` |
| REQ-F-007 | `src/server/servicios/material.js:10-45` |
| REQ-F-008 | `src/server/servicios/panel.js:13` |
| REQ-F-009 | `src/server/servicios/historial.js:31` |
| REQ-NF-001 | `src/server/http/autorizar.js`, `rutas.js` |
| REQ-NF-002 | `src/server/store/almacen-json.js` |
| REQ-NF-003 | `src/server/servicios/depurar.js:21-60` (3 años de retención y borrado de datos personales de bajas) |

No comprobables leyendo código: `REQ-C-001`, `REQ-C-002`.
Nota: `src/server/servicios/depurar.js` (`eraseRemovedMembers`) existe por una decisión del cliente (Q-security-auditor-001), recogida en el contrato como INV-SOC-009.

## Cómo procesar este documento
1. Revisa cada hallazgo y escribe decisión y justificación
2. PROMOTE / AMEND: `/sdd-req-change`
3. REMOVE: borra el código y ajusta pruebas
4. IMPLEMENT: `/sdd-task-generator --fase=N --incremental`
5. ACCEPT: sin cambios de código; la justificación es la documentación
6. Commitea este documento con las decisiones como registro
