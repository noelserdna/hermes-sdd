# Plan de pruebas — material-montana11

> Spec v1.0 · puerta de auditoría FAIL (planificado contra spec con auditoría pendiente, ver GAP-007) · Tipo: WEB-APP
> Alcance de esta ejecución: solo este fichero. Las matrices TEST-MATRIX-UC-NNN y E2E-SCENARIOS no se han generado (ver §4 GAP-008/009); PERF no aplica (route.artifacts: sin REQ-NF de velocidad).

## 1. Resumen de estrategia

| Dimensión | Objetivo | Actual | Fuente |
|---|---|---|---|
| Flujos principales y de excepción de UC con BDD | 100% | 100% (16 UC, 116 AC) | spec/tests/BDD-UC-* |
| Invariantes con prueba de propiedad o ejemplo | 100% de INV-* | PROP cubre 10; el resto por BDD (§7) | domain/05-INVARIANTS.md |
| Operaciones (API-NNN-NN) con prueba de contrato | 100% (24) | 0% planificado en matriz (GAP-008) | spec/contracts/ |
| NFR cuantificados con escenario | 100% | n/a: ninguno de velocidad; límites por INV | nfr/LIMITS.md |
| Controles de seguridad SPEC-SEC-001..006 | 100% | 100% (SEC-T-001..006) | nfr/SECURITY.md |
| WF-* de cara al usuario con E2E | 100% (2) | 100% planificado (§5) | spec/workflows/ |
| Criterios REQ-F con E2E que captura | 100% (61 con AC) | 100% planificado (§6) | requirements/ |

## 2. Niveles

| Nivel | Alcance | Técnica | Herramienta | Objetivo | Cuándo |
|---|---|---|---|---|---|
| Unitario | INV-*, VO-*, reglas puras (multa, solapes, bloqueo) | propiedades (PROP-001..010) + ejemplos | Vitest (maxWorkers 2), fast-check si se añade | 90% líneas en dominio | cada commit |
| Integración | UC y operaciones sobre el almacén real en memoria/fichero | BDD Given/When/Then, contrato por operación | Vitest; reloj inyectado | 100% flujos principales, 100% excepciones con AC | cada commit |
| E2E | WF-001, WF-002 y cada criterio REQ-F | Smoke / Crítico / Completo | Playwright (`npx playwright test`), axe-core | 100% WF y criterios | FASE, PR |
| Rendimiento | sin REQ-NF de velocidad | n/a | n/a | exento (route.artifacts perf=false) | n/a |
| Seguridad | SPEC-SEC-001..006, INV-SEC-* | casos de abuso por rol, intento de lectura cruzada | Vitest + Playwright | 100% aplicables | candidata a entrega |

## 3. Decisiones de diseño

| ID | Decisión | Aplica a | Refs |
|---|---|---|---|
| D-T-001 | "Hoy" sale de un único reloj inyectable; ningún test usa la fecha real ni el navegador | todos | ADR-002, INV-RES-002 |
| D-T-002 | Bloqueo (15 min) y caducidad (30 min) se prueban avanzando el reloj, nunca con esperas | AC-001-07, AC-002-05 | INV-ACC-004/005 |
| D-T-003 | Fallo del almacén: inyectar fallo de E/S en la escritura; se espera `E_ALMACEN_NO_DISPONIBLE` y estado sin cambios | AC-*-almacén caído | ADR-005, INV-SEC-003 |
| D-T-004 | Cada test con almacén y reloj propios (sin estado compartido ni orden); E2E con almacén aislado por test | todos | INV-SEC-003 |
| D-T-005 | Constantes de VALUE-REGISTRY importadas, no escritas a mano en los tests (8, 5, 15, 30, 14, 2 €) | unit, integración | VALUE-REGISTRY |
| D-T-006 | Orden de errores: sin sesión (`E_NO_AUTENTICADO`) antes que rol (`E_ACCESO_NO_PERMITIDO`) antes que validación | integración | INV-ACC-007 |
| D-T-007 | Contrato Style operations: el oráculo es código de error + efecto observable; sin estado HTTP | integración | API-* |
| D-T-008 | Reemplazo de matriz `replay`: operaciones de lectura exentas; escrituras con replay ya definido por AC (AC-001-10, 002-07, 004-08/09, 005-14, 007-03, 009-03, 012-03, 013-08, 014-07, 010-06) | integración | RN-011, RN-016 |
| D-T-009 | Carrera: AC-005-12 (última unidad), AC-008-06 y AC-014-06; dos llamadas concurrentes sobre un fixture, ganadora única | integración | INV-RES-001, ADR-005 |
| D-T-E2E | Cada criterio REQ-F: E2E desde Entrar, aserción con los textos de su `Se ve:`, captura `evidencias/FASE-{N}/{AC}.png` vía `captura()`; un vídeo por WF | E2E | § Evidencia visual |
| D-T-010 | Nombre de cada test lleva su id (`AC-005-04 ...`) | todos | Test Naming |

## 4. Huecos

| ID | Tipo | Elemento | Falta | Prioridad |
|---|---|---|---|---|
| GAP-001 | MISSING-PROPERTY-TEST | INV-RES-006/007/008/009, INV-LOA-001..004, INV-STK-001..005, INV-FIN-003/004, INV-ACC-002/003/005..009, INV-SEC-002/003 | Sin PROP; se cubren con BDD (ver §7) | Media |
| GAP-002 | MISSING-REPLAY-SPEC | API-001-03, 003-03 | Marcar no recogidas repetido: resultado no definido por AC | Media |
| GAP-003 | INCOMPLETE-BDD | UC-006, UC-011 | Sin escenario de rol no permitido (junta/encargado sobre lo ajeno) | Baja |
| GAP-004 | MISSING-E2E | AC-005-12, AC-014-06 | Concurrencia no reproducible desde navegador: solo integración | Baja |
| GAP-005 | MISSING-NFR-TEST | RN-010 / SPEC-LIM-003 | Retención 2 años sin INV ni escenario (INV-003, RN-010 pendiente) | Media |
| GAP-006 | OPEN-QUESTION | API-003-03, API-003-05 | Q-spec-auditor-001: quién dispara marcarNoRecogidas/aplicarMulta; se asume solo sistema (recomendada) | Media |
| GAP-007 | AUDIT-GATE | spec | Puerta del auditor FAIL; revisar este plan tras corregir la spec | Alta |
| GAP-008 | MISSING-MATRIX | UC-001..016 | route.artifacts.test-matrix=true pero esta ejecución solo escribe TEST-PLAN: faltan 16 TEST-MATRIX-UC-NNN | Alta |
| GAP-009 | MISSING-E2E-DOC | WF-001, WF-002 | Falta E2E-SCENARIOS.md con inventario de campos; §5 da solo los ids | Alta |

## 5. Objetivos por caso de uso (en orden de dependencia)

Sin ux/ ni design/: localizadores por rol y nombre accesible. Viaje 1 = UC-001..004 (WF-002); Viaje 2 = UC-005..007; Viaje 3 = UC-008..012 (WF-001); Viaje 4 = UC-013..016.

| UC | REQ | AC (nº) | Unitario | Integración | E2E | Seg. |
|---|---|---|---|---|---|---|
| UC-001 | F-001 | 001-01..10 (10) | PROP-007, INV-ACC-004/006 | T de matriz 001 | E2E-WF-002-01, -02, -03 | SEC-T-004 |
| UC-002 | F-001 | 002-01..07 (7) | INV-ACC-005 | matriz 002 | E2E-WF-002-04, -05 | SEC-T-002 |
| UC-003 | F-002 | 003-01..07 (7) | PROP-010, INV-ACC-002/003 | matriz 003 | E2E-WF-002-06, -07 | SEC-T-003 |
| UC-004 | F-002 | 004-01..09 (9) | INV-ACC-008/009, INV-LOA-004 | matriz 004 | E2E-WF-002-08, -09 | SEC-T-005 |
| UC-005 | F-003 | 005-01..14 (14) | PROP-001..003, 006, INV-RES-009 | matriz 005 (replay, race) | E2E-WF-001-01, -02 | — |
| UC-006 | F-004 | 006-01..04 (4) | PROP-009 | matriz 006 | E2E-WF-001-03 | SEC-T-001 |
| UC-007 | F-004 | 007-01..06 (6) | INV-RES-006/007 | matriz 007 | E2E-WF-001-03 | — |
| UC-008 | F-005 | 008-01..07 (7) | INV-LOA-001/002 | matriz 008 (race) | E2E-WF-001-04 | — |
| UC-009 | F-005 | 009-01..07 (7) | PROP-004, PROP-005 | matriz 009 | E2E-WF-001-05 | — |
| UC-010 | F-006 | 010-01..06 (6) | PROP-004, INV-FIN-002 | matriz 010 | E2E-WF-001-06 | — |
| UC-011 | F-006 | 011-01..03 (3) | PROP-009 | matriz 011 | E2E-WF-001-08 | SEC-T-001 |
| UC-012 | F-007 | 012-01..06 (6) | INV-FIN-003/004 | matriz 012 | E2E-WF-001-07 | SEC-T-005 |
| UC-013 | F-008 | 013-01..08 (8) | INV-STK-001/002 | matriz 013 (replay) | E2E-V-013 | — |
| UC-014 | F-008 | 014-01..08 (8) | PROP-008, INV-STK-003..005 | matriz 014 (race) | E2E-V-014 | — |
| UC-015 | F-009 | 015-01..07 (7) | — | matriz 015 | E2E-V-015 | SEC-T-005 |
| UC-016 | F-010 | 016-01..07 (7) | PROP-009 | matriz 016 | E2E-V-016 | SEC-T-001 |

Escenarios E2E: Smoke (P0) = WF-002-01 entrar, WF-001-01 reservar, WF-001-04 entregar. Crítico (P1) = resto de WF-001 (ciclo completo y bloqueo por multa, vídeo WF-001) y WF-002 (bloqueo, caducidad, salir, gestionar cuentas; vídeo WF-002). Completo (P2) = E2E-V-0NN: una variación por AC de los UC 013..016 y errores de validación.

## 6. Trazabilidad REQ → pruebas

| REQ | UC / WF | AC con captura (Se ve) | E2E | Seg. / otros |
|---|---|---|---|---|
| REQ-F-001 | UC-001, 002 / WF-002 | AC1..AC9 | WF-002-01..05 | SEC-T-002, 004 |
| REQ-F-002 | UC-003, 004 / WF-002 | AC1..AC7 | WF-002-06..09 | SEC-T-003, 005 |
| REQ-F-003 | UC-005 / WF-001 | AC1..AC9 | WF-001-01, 02, 08 | — |
| REQ-F-004 | UC-006, 007 / WF-001 | AC1..AC5 | WF-001-03 | SEC-T-001 |
| REQ-F-005 | UC-008, 009 / WF-001 | AC1..AC6 | WF-001-04, 05 | — |
| REQ-F-006 | UC-010, 011 / WF-001 | AC1..AC6 | WF-001-06, 08 | — |
| REQ-F-007 | UC-012 / WF-001 | AC1..AC3 | WF-001-07 | SEC-T-005 |
| REQ-F-008 | UC-013, 014 | AC1..AC7 | V-013, V-014 | — |
| REQ-F-009 | UC-015 | AC1..AC4 | V-015 | — |
| REQ-F-010 | UC-016 | AC1..AC4 | V-016 | SEC-T-001 |
| REQ-NF-001 | UC-* | n/a (sin captura) | WF-002-09 | SEC-T-001, PROP-009 |
| REQ-C-001..003 | n/a | n/a (restricciones) | MNT-T-001..003 | revisión estática |

Criterio con `Se ve:` ausente o `No visible:` se marca NO-SEES para el ingeniero de requisitos (ninguno hallado en las líneas revisadas). Todo criterio con texto se afirma literal y se captura.

## 7. Identificadores transversales

| ID | Objeto | Verifica | Refs |
|---|---|---|---|
| INT-T-001 | Almacén | una escritura fallida no deja cambios; dos escrituras concurrentes se serializan | INV-SEC-003, ADR-005 |
| INT-T-002 | Invariantes sin PROP | cada INV del GAP-001 tiene al menos un test con su id en el nombre (vía AC citado en BDD) | INV-* |
| SEC-T-001 | Lectura cruzada | un socio nunca obtiene datos de otro; junta y encargado sí | SPEC-SEC-001, CWE-639 |
| SEC-T-002 | Sin sesión | toda operación salvo iniciarSesion devuelve `E_NO_AUTENTICADO` | SPEC-SEC-002, CWE-306 |
| SEC-T-003 | Contraseñas | el almacén solo contiene hash con sal | SPEC-SEC-003, CWE-256 |
| SEC-T-004 | Bloqueo y caducidad | 5 fallos bloquean, incluso con la clave correcta; sesión caduca a los 30 min | SPEC-SEC-004, CWE-307 |
| SEC-T-005 | Rol junta y permisos | ninguna escritura admite junta; socio no ejecuta operaciones de encargado | SPEC-SEC-005, INV-SEC-002 |
| SEC-T-006 | Registros y errores | sin contraseñas ni hash en mensajes ni logs | SPEC-SEC-006, CWE-532 |
| MNT-T-001 | Stack | Vite + JS ESM + Vitest, sin cambiar | REQ-C-001 |
| MNT-T-002 | Textos | interfaz y errores en español | REQ-C-002 |
| MNT-T-003 | Datos compartidos | dos dispositivos ven el mismo almacén | REQ-C-003, ADR-001 |
| A11Y-T-001 | axe-core | escaneo en Entrar, Inicio del socio y Panel del encargado | WCAG 2.2 AA |

## 8. Política de regresión

| Disparador | Se ejecuta |
|---|---|
| cada commit | `npm test` (unitario + integración afectada) y `npm run lint` |
| cierre de FASE | integración completa + E2E Crítico con capturas y vídeos (`npx playwright test`) |
| tras despliegue | sin `staging_url`: sin smoke-deploy |
| candidata a entrega | todo + seguridad SEC-T-* |

## 9. Entradas para sdd-plan-architect

| ID | Requisito (≤140) | Lo necesita | Refs |
|---|---|---|---|
| R-1 | Reloj único inyectable ("hoy" y bloqueo/sesión) | D-T-001/002 | ADR-002 |
| R-2 | Almacén con punto de fallo inyectable y escrituras atómicas serializadas | D-T-003, INT-T-001 | ADR-005 |
| R-3 | Capa de dominio separada de la interfaz para probarla sin navegador | Unitario, integración | INV-* |
| R-4 | Operaciones con código de error estable y mensaje literal | oráculos, `Se ve:` | ADR-004 |
| R-5 | Datos de prueba sembrables (socios por rol, material, reservas, multas) sin pasar por la interfaz | E2E | D-T-004 |
| R-6 | Tests en `tests/` y E2E en `tests/e2e/fase-N-*.spec.js` con `captura`/`narrar` del arnés | E2E | D-T-E2E |
| R-7 | Cortar FASEs por viaje: Acceso (UC-001..004), Reservas (005..007), Préstamo y multas (008..012), Inventario y consultas (013..016) | §5 | WF-001/002 |

## 10. Métricas

| Métrica | Valor |
|---|---|
| Matrices / casos | 0 / 0 (pendientes, GAP-008) |
| E2E Smoke / Crítico / Completo | 3 / 14 / 4 |
| Escenarios PERF | 0 (exento) |
| Huecos | 9 |
| Criterios visuales (con AC) | 61 planificados, 61 cubiertos por escenario |
