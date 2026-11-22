# Test Plan — material-montana12

> Spec v1.0 · audit gate CONDITIONAL (2 P1 abiertos: CON-001, CON-002) · Project type: WEB-APP (sin ux/: localizadores por rol y nombre; contratos `Style: operations`)
> Companion files: TEST-MATRIX-UC-001..019.md (19), PERF-SCENARIOS.md, E2E-SCENARIOS.md

## 1. Strategy Summary

| Dimension | Target | Current | Source |
|-----------|--------|---------|--------|
| UC con BDD (19 UC, 110 escenarios AC) | 100% | 100% | spec/tests/ |
| Invariantes con prueba de propiedad (INV-SEC-001..003 juntas en PROP-024) | 100% | 33 de 35 INV (INV-SOC-009, INV-SOC-101/102, INV-RES-008, INV-MAT-003 sin PROP) | domain/05-INVARIANTS.md |
| Operaciones de contrato (API-001..004, 22 ops) con caso de matriz | 100% | 100% planificado | spec/contracts/ |
| NFR cuantificados con escenario | 100% | 100% planificado (SPEC-PERF-001..003) | spec/nfr/ |
| Controles de seguridad SPEC-SEC-001..007 | 100% | 100% planificado | nfr/SECURITY.md |
| WF-* de cara al usuario con E2E | 100% | 100% planificado (WF-001, WF-002) | spec/workflows/ |
| Criterios REQ-F con E2E capturado | 100% | 100% planificado | requirements/ |

## 2. Test Levels

| Level | Scope | Technique | Framework / runner | Coverage target | Runs on |
|-------|-------|-----------|--------------------|-----------------|---------|
| Unit | INV-*, VO-*, PROP-001..024 | propiedades + ejemplos | Vitest (maxWorkers 2) | 100% dominio | cada commit |
| Integration | flujos UC, operaciones API-*, persistencia | BDD Given/When/Then, matrices | Vitest; reloj y almacén inyectables | 100% flujos principales, 100% filas de excepción | cada commit |
| E2E | WF-001, WF-002 + criterios REQ-F | Smoke / Critical / Full | Playwright (chromium); contextos aislados; axe-core | 100% WF y criterios | PR / main / nightly |
| Performance | SPEC-PERF-001..003 | medición de visibilidad, persistencia | Vitest + Playwright | cada objetivo | FASE completa |
| Security | SPEC-SEC-001..007, PERMISSIONS-MATRIX | matriz rol × operación, inspección del almacén | Vitest | controles aplicables | release candidate |

## 3. Design Decisions

| ID | Decision | Applies to | Refs |
|----|----------|------------|------|
| D-T-001 | «Hoy» y la hora vienen de un reloj inyectable; zona Europe/Madrid; los tests fijan hoy = 2026-11-22 | todos | RN-022 |
| D-T-002 | Almacén inyectable con fallo simulado: `E_ALMACEN_NO_DISPONIBLE` sin cambios en toda escritura | integración, E2E | WF-001/002 Error scenarios |
| D-T-003 | Cada test crea sus propios socios, material y reservas (único por test); sin orden ni estado compartido | todos | — |
| D-T-004 | Expected = código de error de dominio + mensaje del catálogo + estado; nunca HTTP ni rutas (`Style: operations`) | matrices, E2E | contratos |
| D-T-005 | Límites por nombre del VALUE-REGISTRY (`MAX_RESERVATION_DAYS`…); los tests no repiten el número salvo en el ejemplo | matrices | VALUE-REGISTRY |
| D-T-006 | Orden de validación de UC-007 (fecha pasada, fin anterior, días, unidades, disponibilidad) se comprueba con entradas que rompen dos reglas a la vez | UC-007 | UC-007 paso 4 |
| D-T-007 | Replay: cancelar, entregar, devolver, pagar, salir y baja repetida devuelven aviso «ya estaba…» sin cambios; fila `replay` por cada una | UC-002, 006, 009, 010, 011, 013 | INV-RES-009, ADR-005 |
| D-T-008 | Exentas de fila replay las lecturas (UC-008, 012, 014, 017, 018) y UC-019 (depurar dos veces = mismo estado) se cubre con una fila | lecturas | ADR-005 |
| D-T-009 | Contraseñas: el test lee el almacén guardado y comprueba que no contiene la contraseña en claro | UC-003..005 | INV-SOC-003, SPEC-SEC-004 |
| D-T-010 | Captura y vídeo por Playwright con el helper de `tests/e2e/fixtures/evidence.js` (`captura(page, testInfo, id, { ve })`) | E2E | § Visual Evidence |
| D-T-011 | Reinicio del servidor simulado reiniciando el proceso/almacén en el test, no por señal del sistema | SPEC-PERF-003 | SPEC-PERF-003 |
| D-T-E2E | Cada criterio REQ-F: E2E desde la ruta del usuario, afirma su texto «Se ve», captura `evidencias/FASE-{N}/{AC id}.png`; un vídeo por WF | E2E | § Visual Evidence |

## 4. Gaps

| Gap ID | Type | Spec element | Missing (≤ 100 chars) | Priority |
|--------|------|--------------|------------------------|----------|
| GAP-001 | SPEC-CONFLICT | INV-SOC-005 / AC-001-06 | Borde 30 min: viva o caducada (Q-spec-auditor-001, CON-002); la fila queda `undefined in spec` | High |
| GAP-002 | SPEC-CONFLICT | UC-006 E4 / RN-027 | Baja repetida: aviso o `E_SOCIO_NO_ENCONTRADO` (Q-spec-auditor-002, CON-001); fila `undefined in spec` | High |
| GAP-003 | MISSING-PROPERTY-TEST | INV-SOC-009, INV-SOC-101, INV-SOC-102 | Sin PROP; se cubren con filas de matriz UC-003/005/006 | Medium |
| GAP-004 | MISSING-PROPERTY-TEST | INV-RES-008, INV-MAT-003 | Sin PROP; filas de matriz UC-010 y UC-007/015 | Medium |
| GAP-005 | MISSING-NFR-TEST | SPEC-MNT-001..004 | Sin escenario PERF (no son de velocidad): MNT-T-001..004 en §7 | Low |
| GAP-006 | MISSING-REPLAY-SPEC | UC-005 T13, UC-004 T13/T15, UC-006 T17 | Restablecer sobre Provisional, changePassword de Activo, envíos y bajas simultáneas sin resultado | Medium |
| GAP-007 | AUDIT-OPEN | SIL-006, CON-005 | Panel «hoy» vs fecha elegida; precedencia E_YA_* vs E_NO_PRESTADA: filas marcadas en matrices UC-010/011/017 | Medium |

Los hallazgos de las matrices (sección «Findings») se consolidan en la tabla de §10 al terminar.

## 5. Targets by Use Case

Orden por dependencias; los grupos G1..G6 sirven a `sdd-plan-architect` (1 recorrido de usuario = 1-3 UC).

| Grp | UC | REQs | Scenarios (AC ids) | Unit | Integration | E2E | Perf |
|-----|----|------|--------------------|------|-------------|-----|------|
| G1 | UC-001 | REQ-F-001 | AC-001-01..09 | PROP-004, 005 | TEST-MATRIX-UC-001 | E2E-WF-002, E2E-ACC-01 | PERF-003 |
| G1 | UC-002 | REQ-F-001 | AC-002-01..03 | — | TEST-MATRIX-UC-002 | E2E-ACC-02 | — |
| G2 | UC-003 | REQ-F-002 | AC-003-01..04 | PROP-001..003 | TEST-MATRIX-UC-003 | E2E-WF-002 | — |
| G2 | UC-004 | REQ-F-001, 002 | AC-004-01..06 | PROP-002 | TEST-MATRIX-UC-004 | E2E-WF-002 | — |
| G2 | UC-005 | REQ-F-002 | AC-005-01..06 | PROP-002, 003 | TEST-MATRIX-UC-005 | E2E-ACC-03 | — |
| G2 | UC-006 | REQ-F-002 | AC-006-01..07 | PROP-006 | TEST-MATRIX-UC-006 | E2E-ACC-04 | — |
| G3 | UC-015 | REQ-F-007 | AC-015-01..06 | PROP-021, 023 | TEST-MATRIX-UC-015 | E2E-ACC-05 | — |
| G3 | UC-016 | REQ-F-007 | AC-016-01..05 | PROP-021, 022 | TEST-MATRIX-UC-016 | E2E-ACC-06 | — |
| G4 | UC-007 | REQ-F-003, 007 | AC-007-01..11 | PROP-007..010, 018 | TEST-MATRIX-UC-007 | E2E-WF-001 | PERF-001, 002 |
| G4 | UC-008 | REQ-F-004 | AC-008-01..05 | PROP-015 | TEST-MATRIX-UC-008 | E2E-WF-001 | PERF-002 |
| G4 | UC-009 | REQ-F-004 | AC-009-01..05 | PROP-012, 014 | TEST-MATRIX-UC-009 | E2E-WF-001 | — |
| G5 | UC-010 | REQ-F-005 | AC-010-01..07 | PROP-013, 014 | TEST-MATRIX-UC-010 | E2E-WF-001 | — |
| G5 | UC-011 | REQ-F-005, 006 | AC-011-01..07 | PROP-017, 020 | TEST-MATRIX-UC-011 | E2E-WF-001 | — |
| G5 | UC-017 | REQ-F-008, 005 | AC-017-01..09 | PROP-011 | TEST-MATRIX-UC-017 | E2E-WF-001 | PERF-001 |
| G6 | UC-012 | REQ-F-006 | AC-012-01..04 | PROP-024 | TEST-MATRIX-UC-012 | E2E-WF-001 | — |
| G6 | UC-013 | REQ-F-006 | AC-013-01..05 | PROP-018, 019 | TEST-MATRIX-UC-013 | E2E-WF-001 | — |
| G6 | UC-014 | REQ-F-006 | AC-014-01..02 | PROP-024 | TEST-MATRIX-UC-014 | E2E-WF-001 | — |
| G6 | UC-018 | REQ-F-009 | AC-018-01..06 | PROP-024 | TEST-MATRIX-UC-018 | E2E-ACC-07 | — |
| G6 | UC-019 | REQ-NF-003 | AC-019-01..03 | PROP-016 | TEST-MATRIX-UC-019 | — (sin pantalla) | — |

## 6. Traceability REQ → tests

| REQ | UC / WF | Matrix rows | E2E | Perf / Sec |
|-----|---------|-------------|-----|------------|
| REQ-F-001 | UC-001, 002, 004 · WF-002 | MATRIX-UC-001, 002, 004 | E2E-WF-002-01, E2E-ACC-01, 02 | SEC-T-002 |
| REQ-F-002 | UC-003..006 · WF-002 | MATRIX-UC-003..006 | E2E-WF-002-01, E2E-ACC-03, 04 | SEC-T-001 |
| REQ-F-003 | UC-007 · WF-001 | MATRIX-UC-007 | E2E-WF-001-01 | PERF-001 |
| REQ-F-004 | UC-008, 009 · WF-001 | MATRIX-UC-008, 009 | E2E-WF-001-01, 02 | — |
| REQ-F-005 | UC-010, 011, 017 · WF-001 | MATRIX-UC-010, 011, 017 | E2E-WF-001-01, 03 | — |
| REQ-F-006 | UC-011..014 · WF-001 | MATRIX-UC-012..014 | E2E-WF-001-01 | — |
| REQ-F-007 | UC-015, 016 | MATRIX-UC-015, 016 | E2E-ACC-05, 06 | — |
| REQ-F-008 | UC-017 | MATRIX-UC-017 | E2E-WF-001-03 | PERF-001 |
| REQ-F-009 | UC-018 | MATRIX-UC-018 | E2E-ACC-07 | SEC-T-001 |
| REQ-NF-001 | UC-001, 003, 018 | PROP-024 | E2E-SEC-01 | SEC-T-001, SEC-T-003 |
| REQ-NF-002 | UC-007, 017 | — | E2E-WF-001-01 | PERF-001, 002, 003 |
| REQ-NF-003 | UC-019 | MATRIX-UC-019 | — | SEC-T-004 |
| REQ-C-001 | — | — | — | MNT-T-001 |
| REQ-C-002 | — | — | — | MNT-T-002 |

## 7. Cross-cutting Test IDs

| ID | Object | Verifies (≤ 120 chars) | Refs |
|----|--------|-------------------------|------|
| SEC-T-001 | PERMISSIONS-MATRIX | Cada rol × operación: permitido solo lo de la matriz; socio no ve datos ajenos; junta no gestiona | SPEC-SEC-001..003, PROP-024 |
| SEC-T-002 | Login | Bloqueo tras `LOGIN_MAX_FAILURES`, caducidad de sesión, salir invalida en servidor | SPEC-SEC-005, 006 |
| SEC-T-003 | Páginas | Abrir página de gestión con otro rol da `E_PAGINA_PROHIBIDA` | SPEC-SEC-003, RN-020 |
| SEC-T-004 | Almacén | Solo nombre, correo, hash+sal, rol, indicadores e historial; ninguna contraseña legible | SPEC-SEC-004, 007, INV-SOC-009 |
| MNT-T-001 | Textos UI | Ninguna frase inglesa de la lista de control en la interfaz | SPEC-MNT-001, REQ-C-001 |
| MNT-T-002 | package.json | `type: module`, vite y vitest declarados | SPEC-MNT-002..004, REQ-C-002 |
| INT-T-001 | Reloj y almacén | Los dobles inyectados (D-T-001, D-T-002) funcionan en todos los módulos | D-T-001, D-T-002 |

## 8. Regression Policy

| Trigger | Runs |
|---------|------|
| cada commit | unit + integración afectada |
| FASE completa | integración completa + E2E Critical (capturas y vídeos) |
| post-deploy | sin `staging_url`: no aplica |
| release candidate | suite completa + performance + security |

## 9. Inputs for sdd-plan-architect

| ID | Requirement (≤ 140 chars) | Needed by | Refs |
|----|----------------------------|-----------|------|
| R-1 | Reloj inyectable (hoy en Europe/Madrid) en todo el dominio | D-T-001, PROP-007, 012, 013, 016 | RN-022 |
| R-2 | Almacén compartido en servidor con interfaz sustituible y fallo simulable | D-T-002, SPEC-PERF-002, 003 | ADR-001 |
| R-3 | Autorización central (API-001-08) llamada antes de cada operación y página | SEC-T-001, SEC-T-003 | PERMISSIONS-MATRIX |
| R-4 | Disponibilidad calculada desde las reservas, no contador guardado | PROP-010, UC-007 matriz | ADR-001, ADR-002 |
| R-5 | Datos semilla de pruebas por API (socios, material, reservas) para entrar sin pasar por la UI | E2E, D-T-003 | D-T-003 |
| R-6 | Interfaz con roles ARIA y nombres accesibles estables (sin ux/) para localizar por rol y nombre | E2E | E2E-SCENARIOS |
| R-7 | Operación de depuración invocable con fecha inyectada (UC-019) | MATRIX-UC-019 | API-002-07 |

## 10. Metrics

| Metric | Value |
|--------|-------|
| Matrices / cases | 19 / 271 (30 filas `undefined in spec`, 43 hallazgos F-NNN-NN en las matrices) |
| Replay / race rows | 22 / 14 |
| E2E scenarios Smoke / Critical / Full | 2 / 10 (+~45 variantes) / 13 |
| PERF scenarios | 3 |
| Criterios REQ-F con E2E capturado | 66 de 66 con captura; 2 `No visible` (REQ-F-002 AC9, REQ-F-005 AC7) sin captura |
| Gaps | 7 (más 30 filas `undefined in spec` para sdd-spec-auditor) |
| Chars test/ total | ver Persist (por encima del presupuesto de 65 000: 19 UC + 66 criterios visuales) |
