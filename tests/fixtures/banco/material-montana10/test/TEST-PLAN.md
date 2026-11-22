# Test Plan — material-montana10

> Spec v1.0 · audit gate CONDITIONAL · Project type: WEB-APP (sin `ux/`: localizadores por rol y nombre desde los textos de REQ)
> Companion files: TEST-MATRIX-UC-001..010.md (10), E2E-SCENARIOS.md. PERF-SCENARIOS.md no se escribe: ningún REQ-NF habla de velocidad o carga (`route.artifacts.perf-scenarios.make=false`).

## 1. Strategy Summary

| Dimension | Target | Current | Source |
|-----------|--------|---------|--------|
| UC main + exception flows with BDD | 100% | 100% (10/10 UC, 85 escenarios) | spec/tests/ |
| Invariants with property tests | 100% de INV-* | 0% (no existe PROPERTY-TESTS.md; ver GAP-001) | domain/05-INVARIANTS.md |
| Contract operations (API-NNN-NN) with contract tests | 100% | 100% planificado (22 operaciones en matrices) | spec/contracts/ |
| Quantified NFRs with a scenario | 100% | 100% (LIM-001..005 por matrices; sin NFR de rendimiento) | spec/nfr/ |
| Applicable security controls | 100% | 100% (SEC-001..007 en §7 y matrices) | nfr/SECURITY.md |
| User-facing WF-* with E2E | 100% | 100% (WF-001, WF-002) | spec/workflows/ |
| REQ-F criteria with a capturing E2E | 100% de los visibles | 100% (ver E2E-SCENARIOS) | requirements/ |

## 2. Test Levels

| Level | Scope (spec elements) | Technique | Framework / runner | Coverage target | Runs on |
|-------|----------------------|-----------|--------------------|-----------------|---------|
| Unit | INV-*, VO-*, lógica pura (fechas, multa, disponibilidad) | ejemplos + propiedades | Vitest (`npm test`, maxWorkers 2) | 90% líneas del dominio | cada commit |
| Integration | UC-001..010, API-001..004, SM-001..004, persistencia compartida | BDD Given/When/Then; contract tests por operación | Vitest; almacén en memoria/fichero temporal por test | 100% flujos principales, 85% excepciones | cada commit |
| E2E | WF-001, WF-002 y cada criterio REQ-F visible | escenarios Smoke / Critical / Full | Playwright (`npx playwright test`), contexto aislado por test, axe-core | 100% WF de usuario | PR / main / nightly |
| Performance | — | — | — | exento: sin NFR cuantificado de velocidad | — |
| Security | SEC-001..007, INV-ACC-003/008/009 | lista ASVS, error guessing de roles | Vitest (integración) | 100% de los controles aplicables | release candidate |

## 3. Design Decisions

| ID | Decision | Applies to | Refs |
|----|----------|------------|------|
| D-T-001 | Reloj inyectado: cada test fija "hoy" (p. ej. 2026-12-01) y la hora; nunca `Date.now()` real; zona Europe/Madrid | todos | ADR-001, RN-001 |
| D-T-002 | Cada test crea su propio almacén vacío y su fixture; sin estado compartido ni orden entre tests | integración, E2E | ADR-002, REQ-C-003 |
| D-T-003 | Fallo del almacén simulado con inyección de fallo: `E_ALMACEN_NO_DISPONIBLE`, sin cambios de estado | operaciones de escritura | VO-010 |
| D-T-004 | Esperado = código de error de dominio + mensaje literal del catálogo VO-010 + estado observable; no HTTP | matrices | VO-010 |
| D-T-005 | Cuentas de fixture: socia lucia@club.es/Cumbre2026, socio pablo@club.es/Arista2026, junta ana@club.es, encargado, marta@club.es | matrices, E2E | REQ-F-001 |
| D-T-006 | Race (reserva de la última unidad, altas simultáneas, doble envío): dos llamadas concurrentes sobre un solo fixture; una gana | filas `race` | AC-003-10, AC-002-09, AC-001-09 |
| D-T-007 | Replay: mismo input repetido. Definido en AC-001-09, AC-002-10/11, AC-003-02, AC-004-04, AC-005-02, AC-006-04, AC-007-03, AC-008-02/05; add de unidades no es idempotente por diseño | operaciones de escritura | INV-RES-008, INV-STK-003 |
| D-T-008 | Exentas de fila `replay`: lecturas puras (API-001-06, API-002-02, API-003-04..06, API-004-03) y cerrarSesion (AC-001-13) | matrices | INV-LOA-401/402 |
| D-T-009 | Precedencia de errores: sesión (`E_NO_AUTENTICADO`/`E_SESION_CADUCADA`) > permiso de rol > validación > estado | operaciones | INV-ACC-008 |
| D-T-010 | Limpieza diaria y "No recogida" se prueban invocando API-003-08 y API-003-07 con el reloj movido | UC-005, UC-006 | LIM-004, LIM-005 |
| D-T-E2E | Cada criterio REQ-F visible: E2E desde la ruta del usuario (Entrar), asserta su texto `Se ve`, captura `evidencias/FASE-{N}/{AC id}.png` con `captura(page, testInfo, id, { ve })`; un vídeo por WF | E2E | § Visual Evidence |
| D-T-E2E2 | E2E con reloj controlado por un parámetro de arranque de pruebas del servidor (fecha fija); las tablas de fixtures se siembran por la capa de datos, no por la UI | E2E | ADR-001 |
| D-T-NAME | Los tests llevan el id del escenario en el nombre (`AC-003-01 …`, `E2E-WF-001-01 AC-003-01 …`) | todos | Test Naming |

## 4. Gaps

| Gap ID | Type | Spec element | Missing (≤ 100 chars) | Priority |
|--------|------|--------------|------------------------|----------|
| GAP-001 | MISSING-PROPERTY-TEST | INV-ACC-001..103, INV-RES-*, INV-LOA-*, INV-STK-* | No hay `spec/tests/PROPERTY-TESTS.md`; se cubren con filas de matriz y unit con ejemplos | Medium |
| GAP-002 | MISSING-NFR-TEST | REQ-NF-001 AC1/AC2 | Sin escenario de usuario: se cubre con SEC-T-001 y LIM-004 (integración) | Low |
| GAP-003 | NO-DECISION | RN-011 | Valor prudente adoptado en DERIVED-SPECS pendiente de revisar en puerta; sus filas llevan `E_UNIDAD_NO_DISPONIBLE` | Medium |
| GAP-004 | MISSING-E2E | REQ-F-003 AC2, REQ-F-004 AC4, REQ-F-005 AC2, REQ-F-006 AC4, REQ-F-007 AC3, REQ-F-008 AC5, REQ-F-010 AC3 | Criterios `No visible:`: sin captura; se prueban en integración (filas replay) | Low |
| GAP-005 | INCOMPLETE-BDD | UC-001..010 | Escenarios sin etiqueta REQ (p. ej. AC-003-11/12) cubren excepciones sin criterio REQ propio; mantener id AC | Low |
| GAP-006 | MISSING-BDD-EXCEPTION | UC-001, UC-003, UC-005, UC-008, UC-002 | Campos vacíos (correo, contraseña, fechas, unidad, cantidad, alta) sin error definido; E2E V01/V02 no se implementan | Medium |

Hallazgos de las matrices para sdd-spec-auditor (ver cada `## Findings`): UC-001 F01..F03 (5.º fallo, campos vacíos, renovación de sesión); UC-002 F01..F05 (baja con reserva en curso vs INV-ACC-007, alta sobre correo en Baja, ids inexistentes); UC-003 F-003-01; UC-004 F-004-01..03; UC-005 F-005-01..03; UC-006 F-006-01..04; UC-007 F-007-01..02; UC-008 F01..F04; UC-009 F-009-01..04; UC-010 F-010-01..04. Filas `undefined in spec` (MISSING-REPLAY-SPEC): UC-005 T10 (repetir con otra unidad), UC-006 T16, UC-002 T04/T15/T17/T18/T22/T23, UC-001 T09/T24, UC-008 T02/T06/T13/T16, UC-003 T27, UC-004 T20, UC-006 T15/T17, UC-007 T14, UC-010 T17/T18.

## 5. Targets by Use Case

| UC | REQs | Scenarios (AC ids) | Unit | Integration | E2E | Perf |
|----|------|--------------------|------|-------------|-----|------|
| UC-001 | REQ-F-001 | AC-001-01..13 | INV-ACC-003..006, 101, 102 | TEST-MATRIX-UC-001 | E2E-WF-002-01, 02, IV01, EX01..04 | — |
| UC-002 | REQ-F-002, REQ-NF-001 | AC-002-01..12 | INV-ACC-001/002/003/007/103 | TEST-MATRIX-UC-002 | E2E-ADM-01 | — |
| UC-008 | REQ-F-008 | AC-008-01..09 | INV-STK-001..004 | TEST-MATRIX-UC-008 | E2E-ADM-02 | — |
| UC-003 | REQ-F-003 | AC-003-01..12 | INV-RES-001..005, 008 | TEST-MATRIX-UC-003 | E2E-WF-001-01, 03, IV*, EX01..04 | — |
| UC-004 | REQ-F-004 | AC-004-01..08 | INV-RES-006, INV-ACC-009 | TEST-MATRIX-UC-004 | E2E-WF-001-04, EX10 | — |
| UC-005 | REQ-F-005 | AC-005-01..07 | INV-LOA-001/002/301, INV-RES-007 | TEST-MATRIX-UC-005 | E2E-WF-001-01, EX05, EX06 | — |
| UC-006 | REQ-F-006 | AC-006-01..06 | INV-LOA-003/004 | TEST-MATRIX-UC-006 | E2E-WF-001-01, 02, 03, EX09 | — |
| UC-007 | REQ-F-007 | AC-007-01..05 | INV-LOA-005 | TEST-MATRIX-UC-007 | E2E-WF-001-02, 03, EX11 | — |
| UC-009 | REQ-F-009 | AC-009-01..07 | INV-LOA-401 | TEST-MATRIX-UC-009 | E2E-WF-001-01, 05, EX07, EX08 | — |
| UC-010 | REQ-F-010 | AC-010-01..06 | INV-LOA-402 | TEST-MATRIX-UC-010 | E2E-WF-001-05 | — |

## 6. Traceability REQ → tests

| REQ | UC / WF | Matrix rows | E2E | Perf / Sec |
|-----|---------|-------------|-----|------------|
| REQ-F-001 | UC-001, WF-002 | TEST-MATRIX-UC-001 | E2E-WF-002-01, 02, IV01, EX01..04, V01 | SEC-T-003, 004, 007 |
| REQ-F-002 | UC-002 | TEST-MATRIX-UC-002 | E2E-ADM-01 | SEC-T-005 |
| REQ-F-003 | UC-003, WF-001 | TEST-MATRIX-UC-003 | E2E-WF-001-01, 03, IV*, EX01..04 | — |
| REQ-F-004 | UC-004, WF-001 | TEST-MATRIX-UC-004 | E2E-WF-001-01, 03, 04, EX10 | SEC-T-005 |
| REQ-F-005 | UC-005, WF-001 | TEST-MATRIX-UC-005 | E2E-WF-001-01, EX05, EX06 | — |
| REQ-F-006 | UC-006, WF-001 | TEST-MATRIX-UC-006 | E2E-WF-001-01, 02, 03, EX09 | — |
| REQ-F-007 | UC-007, WF-001 | TEST-MATRIX-UC-007 | E2E-WF-001-02, 03, EX11 | SEC-T-005 |
| REQ-F-008 | UC-008 | TEST-MATRIX-UC-008 | E2E-ADM-02 | SEC-T-005 |
| REQ-F-009 | UC-009, WF-001 | TEST-MATRIX-UC-009 | E2E-WF-001-01, 05, EX07, EX08 | — |
| REQ-F-010 | UC-010 | TEST-MATRIX-UC-010 | E2E-WF-001-05, EX11 | SEC-T-005 |
| REQ-NF-001 | UC-002, API-003-08 | TEST-MATRIX-UC-002 (hash), UC-006 (retención) | — | SEC-T-001, SEC-T-002, LIM-T-004 |
| REQ-C-001 | — | — | E2E-WF-002-A11Y-01 | MNT-T-001 |
| REQ-C-002 | — | — | — | MNT-T-002 |
| REQ-C-003 | — | — | E2E-WF-001-06 | MNT-T-003 |

## 7. Cross-cutting Test IDs

| ID | Object | Verifies (≤ 120 chars) | Refs |
|----|--------|-------------------------|------|
| SEC-T-001 | almacén de cuentas | tras crear "Glaciar2026" el dato guardado no la contiene; solo hash con sal | SEC-001, INV-ACC-003, REQ-NF-001 AC1 |
| SEC-T-002 | salidas de API/UI | ninguna salida contiene la contraseña ni su hash | SEC-002, INV-ACC-003 |
| SEC-T-003 | iniciarSesion | 5 fallos bloquean 15 min; un acierto reinicia el contador | SEC-003, INV-ACC-004 |
| SEC-T-004 | sesión | caduca a las 8 h sin uso; Salir la invalida | SEC-004, INV-ACC-005, INV-ACC-102 |
| SEC-T-005 | todas las operaciones | recorrido de PERMISSIONS-MATRIX: cada rol contra cada operación; rol no permitido = `E_SIN_PERMISO` | SEC-005, INV-ACC-008/009 |
| SEC-T-006 | entidades ENT-001..005 | solo nombre, correo, préstamos y multas | SEC-006 |
| SEC-T-007 | iniciarSesion | mismo mensaje para correo desconocido, en Baja y contraseña mala | SEC-007, AC-001-10 |
| LIM-T-004 | purgarRegistrosAntiguos | devolución 2024-11-01 borrada y 2025-01-10 conservada (hoy 2026-11-21); multa Pendiente nunca | LIM-004, LIM-005, INV-LOA-006, REQ-NF-001 AC2 |
| MNT-T-001 | textos de la interfaz | ninguna cadena inglesa de la lista de control | MNT-001, REQ-C-001 |
| MNT-T-002 | package.json | JavaScript ESM, Vite y Vitest | MNT-002, REQ-C-002 |
| MNT-T-003 | código fuente | ningún dato de negocio en localStorage ni sessionStorage | MNT-003, REQ-C-003, ADR-002 |
| INT-T-001 | almacén compartido | lo escrito por el encargado lo lee otro cliente (dos contextos) | REQ-C-003, ADR-002 |

## 8. Regression Policy

| Trigger | Runs |
|---------|------|
| every commit | unit + integración afectada (`npm test`) |
| FASE completion | integración completa + E2E Critical con capturas y vídeos |
| post-deploy | sin `staging_url`: no aplica (`smoke-deploy` sin escenarios) |
| release candidate | suite completa + seguridad |

## 9. Inputs for sdd-plan-architect

| ID | Requirement (≤ 140 chars) | Needed by | Refs |
|----|----------------------------|-----------|------|
| R-1 | Reloj inyectable en el dominio y en el servidor de pruebas (fecha fija) | D-T-001, E2E | ADR-001 |
| R-2 | Capa de almacén compartido con inyección de fallo y creación aislada por test | D-T-002, D-T-003 | ADR-002 |
| R-3 | Operaciones de dominio separadas de la UI, invocables desde Vitest sin navegador | matrices | API-001..004 |
| R-4 | Operaciones del sistema API-003-07 (No recogida) y API-003-08 (purga) invocables a mano en tests | D-T-010 | RN-008, LIM-004 |
| R-5 | Helper `captura(page, testInfo, id, { ve })` y `video: 'on'` en Playwright; `evidencias/FASE-{N}/` | D-T-E2E | Visual Evidence |
| R-6 | Pantallas con nombre accesible igual al literal de REQ (Entrar, Mis reservas, Reservar, Socios, Inventario, Entregas y devoluciones, Multas, Historial) | E2E | REQ-F-001..010 |
| R-7 | Orden de FASEs por viaje: acceso (UC-001/002/008) → reservas (UC-003/004) → préstamos (UC-005..007, 009) → historial (UC-010) | §5 | WF-001, WF-002 |

## 10. Metrics

| Metric | Value |
|--------|-------|
| Matrices / cases | 10 / 210 (replay 18, race 14) |
| E2E scenarios Smoke / Critical / Full | 3 / 33 / 4 (visual 54/54) |
| PERF scenarios | 0 |
| Gaps | 6 |
| Chars: this file / test/ total | ver `wc -c test/*.md` |
