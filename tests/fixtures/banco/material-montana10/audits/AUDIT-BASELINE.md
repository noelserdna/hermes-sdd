# Audit Baseline — material-montana10

> **Audit:** AUDIT-v1.0 · **Date:** 2026-11-21 · **Specs:** `spec/` (f717a74) · **Docs audited:** 34 · **Mode:** fanout · **Cycles:** 1 Discovery → 2 Fix (parcial)
> **Gate:** **CONDITIONAL PASS** — 0 P0, 0 P1 abiertos (3 P1 corregidos en Mode Fix), 9 P2 abiertos
> **Findings:** 22 · P0 0 · P1 3 (resueltos) · P2 9 · P3 10 (1 resuelto) · batched 4 · cross-validated 1 · excluded by baseline 0
> **Delta vs none (first audit):** new 22 · persistent 0 · regression 0 · resolved since 4
> **Top categories:** CAT-03 (3), CAT-05 (7), CAT-07 (1)

## Gate detail

| Check | Result |
|---|---|
| 3C Completeness (SC01–SC05) | PASS 5/5 (tras corregir la referencia rota NC-401 en UC-009) |
| 3C Correctness (SR01–SR05) | PASS tras Mode Fix (SR01, SR05 fallaban por CON-001..003; SR03 → INV-001 es de cobertura, no de referencia) |
| 3C Coherence (SH01–SH05) | WARN: SH04 → SEM-002; SH02 → SEM-003 |
| Spec defect density | 0.12 (P0+P1 de Discovery)/doc (target < 2) PASS |
| Traceability coverage | 100% (REQ-F-001..010, REQ-NF-001) PASS |
| Orphan rate | 0% PASS |
| Clarification density | 0/doc (0 marcadores abiertos) PASS |
| Audit pass rate | 88% (30/34 sin P0/P1 en Discovery) FAIL (corregidos: 100%) |
| Cross-reference validity | 99% (NC-401, `design/OPERATION-MAPPING.md`) FAIL → NC-401 corregido; INC-001 abierto |

## Findings P0–P2

### CON-001: UC-009 paso 6 contradice RN-022 y cita NC-401 inexistente — P1 · CAT-05 · new — RESOLVED (commit 7125c0f)
### CON-002: Matriz: junta sin API-001-06 pese a RN-023 — P1 · CAT-05 · new — RESOLVED (7125c0f)
### CON-003: Matriz da API-004-03 al socio; el contrato es solo encargado — P1 · CAT-05 · new — RESOLVED (7125c0f; UC-003 nunca lee inventario, se quita de la fila socio. Supuesto: si la pantalla Reservar debe mostrar disponibilidad, hay que abrir un REQ)
### CON-005: Matriz da API-003-07 (sistema) al encargado — P3 · CAT-05 · new — RESOLVED (7125c0f)

### CON-004: INV-ACC-008 «toda operación» vs UC-001 «no aplica» a API-001-01 — P2 · CAT-05 · new
- **Where:** `spec/use-cases/UC-001-entrar-y-salir.md:22` · `spec/domain/05-INVARIANTS.md:14`
- **What:** La precondición dice que INV-ACC-008 no aplica a entrar, pero la invariante no tiene excepción y UC-001 la cita en Refs.
- **Why:** La matriz sí exceptúa API-001-01 (`PERMISSIONS-MATRIX.md:3`); la invariante es la divergente.
- **Fix:** Acotar INV-ACC-008 a «toda operación salvo API-001-01» y ajustar su columna de UC.

### SIL-001: Operaciones restringidas por rol sin `E_SIN_PERMISO` — P2 · CAT-03 · new
- **Where:** `spec/contracts/API-prestamos.md:16-17` · `spec/contracts/API-reservas.md:17-18`
- **What:** API-003-01/02 (encargado), API-002-02/03 (socio) no listan error de rol ni figuran en el catálogo de `E_SIN_PERMISO`; API-002-03 usa `E_SIN_PERMISO_CANCELAR` solo para dueño.
- **Why:** La matriz restringe esas operaciones; sin error definido el rol equivocado queda sin comportamiento.
- **Fix:** Añadir `E_SIN_PERMISO` (o decidir que el rol se comprueba en la pantalla) a esas filas y al catálogo.

### SIL-002: Baja/restablecer sin cuenta inexistente, no socio ni sesión abierta — P2 · CAT-03 · new
- **Where:** `spec/use-cases/UC-002-gestionar-socios.md:40` · `spec/contracts/API-acceso.md:19-20`
- **What:** API-001-04/05 no tienen error de `cuentaId` desconocido o no socio; no se dice si una sesión abierta de una cuenta dada de baja sigue valiendo ni si se restablece una cuenta en Baja.
- **Why:** Todas las demás operaciones con id tienen `E_*_NO_ENCONTRAD*`; INV-ACC-006 solo cubre el inicio de sesión.
- **Fix:** Pregunta al dueño: efecto de la baja sobre sesiones abiertas y restablecer en Baja; añadir error de cuenta no encontrada + BDD.

### INV-001: Reglas RN sin invariante formal (RN-004, 011, 017, 019, 020, 021, parte de 005/014) — P2 · CAT-07 · new
- **Where:** `spec/CLARIFICATIONS.md:19,26,33,35,36` · `spec/domain/05-INVARIANTS.md:7,51,66,73-74`
- **What:** Validaciones de nombre/correo, orden de comprobación al reservar y baja con reservas solo existen en prosa; INV-STK-003/004 e INV-LOA-002 tienen Error «—» aunque VO-010 les asigna error.
- **Why:** Sin INV no hay validación trazable; `03-VALUE-OBJECTS.md:39-43` cita invariantes sin su error.
- **Fix:** Crear/ampliar INV-ACC (datos de socio), INV-RES (orden RN-017), rellenar columna Error.

### SIL-003: Escenarios BDD ausentes — P2 · CAT-03 · new
- **Where:** `spec/tests/BDD-UC-004.md` · `BDD-UC-005.md` · `BDD-UC-006.md` · `spec/contracts/API-prestamos.md:23,30`
- **What:** Sin escenario de rol equivocado en UC-004/005/006; ninguno para `E_ALMACEN_NO_DISPONIBLE`; ninguno para API-003-08 (purga, multa Pendiente conservada, repetición).
- **Why:** Comportamiento destructivo y errores declarados sin aceptación.
- **Fix:** Añadir esos escenarios.

### AMB-001: UC-001 4a no dice qué error devuelve el intento que bloquea — P2 · CAT-01 · new
- **Where:** `spec/use-cases/UC-001-entrar-y-salir.md:41` · `spec/domain/05-INVARIANTS.md:10`
- **What:** E1 da `E_CREDENCIALES_INVALIDAS` a todo fallo; 4a bloquea sin indicar el código de ese intento.
- **Why:** Comportamiento del intento N sin definir.
- **Fix:** Fijar el código del intento N y que el bloqueo rige desde el siguiente.

### AMB-002: Test de retención sin «hoy» de referencia — P2 · CAT-01 · new
- **Where:** `spec/nfr/LIMITS.md:10` · `spec/adr/ADR-001-reloj-en-fecha-natural.md`
- **What:** Cita borrados de 2024-11-01 y 2025-01-10 sin fecha actual.
- **Why:** Con `RETENTION_YEARS` = 2 el resultado depende del reloj; no reproducible.
- **Fix:** Declarar el «hoy» del escenario y el resultado por registro.

### AMB-003: MNT-001 menciona una «lista de control» inexistente — P2 · CAT-01 · new
- **Where:** `spec/nfr/MAINTAINABILITY.md:7`
- **What:** La comprobación depende de una lista no definida en ningún documento.
- **Why:** Criterio no verificable.
- **Fix:** Definir la lista o reformular el criterio.

### ADR-001: Decisiones materiales sin ADR (sesión, hash de contraseña, servidor) — P2 · CAT-09 · new
- **Where:** `spec/adr/ADR-002-almacen-compartido-y-reserva-indivisible.md:12` · `spec/nfr/SECURITY.md:10`
- **What:** ADR-002 exige almacén en servidor; sesión (SEC-004) y almacenamiento de contraseñas no tienen ADR.
- **Why:** Decisiones de autenticación sin registro; probablemente propias de la etapa de diseño técnico.
- **Fix:** Escribir el ADR o dejar constancia de que se decide en `sdd-tech-designer`.

## Findings P3

| ID | Cat | Where | What | Fix |
|---|---|---|---|---|
| CON-006 | CAT-05 | `spec/workflows/WF-001-ciclo-de-un-prestamo.md:17` | Paso 4 «No recogida» asignado a UC-005 síncrono; SM-001 lo hace perezoso | Alinear con RN-008, citar UC-004/005/009 |
| CON-007 | CAT-05 | `spec/tests/BDD-UC-001.md:38` | AC-001-13 vs `E_NO_AUTENTICADO` de API-001-02 en salir repetido | Decidir error o no-op idempotente |
| INC-001 | CAT-06 | `spec/contracts/API-acceso.md:10` (y 3 contratos) | Transport apunta a `design/OPERATION-MAPPING.md`, aún inexistente | Crearlo en diseño o cambiar el campo |
| INC-002 | CAT-06 | `spec/workflows/WF-001-ciclo-de-un-prestamo.md:22,32` | Navigation y Error scenarios omiten pasos 4/6 y errores | Completar tablas |
| INC-003 | CAT-06 | `spec/domain/02-ENTITIES.md:21` | Rangos INV omiten ACC-101..103, LOA-301/401/402 | Ampliar rangos |
| AMB-004 | CAT-01 | `spec/tests/BDD-UC-001.md:32` | AC-001-12 no dice qué rol ve qué pantalla | Separar por rol (RN-016) |
| SEM-001 | CAT-04 | `spec/tests/BDD-UC-005.md:8` (006, 007) | BDD en inglés; «1 días» en AC-006-03 | Pasar a español |
| SEM-002 | CAT-04 | `spec/VALUE-REGISTRY.md:8` | Valores del registro copiados como literales en otros docs | Citar el nombre o marcar como ejemplo |
| SEM-003 | CAT-04 | `spec/domain/01-GLOSSARY.md:13` | «préstamo Prestado» (RN-010, INV-ACC-007) vs estado Prestada | Escribir «reserva Prestada» |

## Coverage

| Document | P0 | P1 | P2 | P3 | IDs |
|---|---|---|---|---|---|
| use-cases/UC-009-ver-entregas-y-devoluciones.md | 0 | 0 | 0 | 0 | CON-001 (resuelto) |
| contracts/PERMISSIONS-MATRIX.md | 0 | 0 | 0 | 0 | CON-002, CON-003, CON-005 (resueltos) |
| contracts/API-acceso.md · API-prestamos.md · API-reservas.md | 0 | 0 | 2 | 1 | SIL-001, SIL-002, INC-001 |
| use-cases/UC-001 · UC-002 | 0 | 0 | 3 | 0 | CON-004, AMB-001, SIL-002 |
| domain/05-INVARIANTS · CLARIFICATIONS | 0 | 0 | 1 | 0 | INV-001 |
| tests/BDD-UC-001, 004, 005, 006, 007 | 0 | 0 | 1 | 3 | SIL-003, CON-007, AMB-004, SEM-001 |
| nfr/LIMITS · MAINTAINABILITY · adr/ADR-002 | 0 | 0 | 3 | 0 | AMB-002, AMB-003, ADR-001 |
| workflows/WF-001 · domain/01-GLOSSARY · 02-ENTITIES · VALUE-REGISTRY | 0 | 0 | 0 | 5 | CON-006, INC-002, INC-003, SEM-002, SEM-003 |
| Clean | 0 | 0 | 0 | 0 | resto (UC-003..008, 010, WF-002, 03/04, EVENTS, API-inventario, ADR-001, SECURITY, BDD-UC-002/003/008/009/010, README, matrices) |

## Baseline

### Accepted
| ID | Short description | Reason | Audit |
|---|---|---|---|

### Won't fix
| ID | Short description | Reason | Audit |
|---|---|---|---|

### Deferred
| ID | Short description | Reason | Audit | Re-evaluate on |
|---|---|---|---|---|

### Resolved (last 2 audits)
| ID | Short description | Resolved in | Audit |
|---|---|---|---|
| CON-001 | UC-009 paso 6 vs RN-022 / NC-401 | 7125c0f | AUDIT-v1.0 |
| CON-002 | Matriz: junta sin API-001-06 | 7125c0f | AUDIT-v1.0 |
| CON-003 | Matriz: socio con API-004-03 | 7125c0f | AUDIT-v1.0 |
| CON-005 | Matriz: encargado con API-003-07 | 7125c0f | AUDIT-v1.0 |

## Fix cycle (AUDIT-v1.0)
- Fixed 4 (CON-001, CON-002, CON-003, CON-005) · skipped 18 (afectan lo que se pidió o necesitan decisión: SIL-002, SIL-001, INV-001, ADR-001; el resto se deja a la persona) · open P2 9 · deferred P3 0
- New artifacts: — · Documents modified: 2 · breaking changes: 0 · commits: 1 (7125c0f) · tag: —

## History

| Audit | Date | Docs | Total | P0 | P1 | P2 | P3 | Gate | Mode | Report chars |
|---|---|---|---|---|---|---|---|---|---|---|
| AUDIT-v1.0 | 2026-11-21 | 34 | 22 | 0 | 3 | 9 | 10 | CONDITIONAL | fanout | 10300 |
