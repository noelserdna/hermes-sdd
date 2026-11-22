# Audit Baseline — material-montana11

> **Audit:** AUDIT-v1.0 · **Date:** 2026-11-21 · **Specs:** `spec/` (c9e3376) · **Docs audited:** 55 · **Mode:** fanout · **Cycles:** 1 Discovery → 2 Fix (parcial)
> **Gate:** **FAIL** — 0 P0, 0 P1, 14 P2 abiertos; 3C Corrección falla (SR02, SR05) → CON-001, CON-002, SIL-003
> **Findings:** 28 (5 resueltos, 23 abiertos) · P0 0 · P1 0 · P2 14 · P3 9 · batched 6 · cross-validated 7 · excluded by baseline 0
> **Delta vs none (first audit):** new 28 · persistent 0 · regression 0 · resolved since 5
> **Top categories:** CAT-03 (5), CAT-07 (3), CAT-05 (3)

## Gate detail

| Check | Result |
|---|---|
| 3C Completeness (SC01–SC05) | PASS 5/5 (14/14 REQ trazados; sin marcadores TBD/NC; UC-001 "Open questions" corregido) |
| 3C Correctness (SR01–SR05) | FAIL: SR02 → CON-002, CON-003; SR05 → CON-001, SIL-003 |
| 3C Coherence (SH01–SH05) | WARN: SH04 → CON-005; SH05 → INC-005 |
| Spec defect density | 0 (P0+P1)/doc (target < 2) PASS |
| Traceability coverage | 100% (100%) PASS |
| Orphan rate | 0% (0%) PASS |
| Clarification density | 0/doc (0) PASS |
| Audit pass rate | 100% (> 90%) PASS |
| Cross-reference validity | 100% (100%) PASS |

Aviso: P2 > 10. Un hallazgo del auditor de NFR (PERMISSIONS-MATRIX inexistente) era falso: el fichero existe y se descartó.

## Findings P0–P2

### CON-001: Matriz da API-003-03/05 al encargado, los contratos dicen "sistema" — P2 · CAT-05 · new
- **Where:** `spec/contracts/PERMISSIONS-MATRIX.md:7` · `spec/contracts/API-prestamos.md:18`, `:20`
- **What:** La matriz asigna 03 y 05 al encargado; los contratos nombran actor "sistema", que no tiene fila.
- **Why:** SR05 no se cumple y no queda definido qué rol puede dispararlas ni qué error recibe otro rol.
- **Fix:** Pregunta Q-spec-auditor-001 (clase C).

### CON-002: SPEC-SEC-005 prohíbe escrituras de la junta, pero las de sesión la admiten — P2 · CAT-05 · new
- **Where:** `spec/nfr/SECURITY.md:9` · `spec/contracts/API-acceso.md:19` · `spec/domain/05-INVARIANTS.md` (INV-SEC-002)
- **What:** comprobarSesion y cerrarSesion escriben (renuevan/cierran sesión) y admiten "cualquiera".
- **Why:** La norma y el contrato dicen cosas distintas para el rol junta.
- **Fix:** Pregunta Q-spec-auditor-002 (clase C).

### CON-003: UC-006 dice "no cambia ningún dato" pero aplica el paso de día — P2 · CAT-05 · new
- **Where:** `spec/use-cases/UC-006-ver-mis-reservas.md:24`, `:29` · `spec/domain/04-STATES.md:18`
- **What:** La poscondición de solo lectura choca con el paso 2, que pasa reservas a No recogida (RN-004). Igual en el listado de UC-008.
- **Why:** AC y poscondición no pueden cumplirse a la vez.
- **Fix:** Precisar: solo se escribe la transición perezosa Reservada → No recogida.

### SIL-001: Paso de día no se aplica antes de calcular libres en UC-005 — P2 · CAT-03 · new
- **Where:** `spec/use-cases/UC-005-reservar-material.md:31` · `UC-007…:36` · `UC-016…:46` · `spec/CLARIFICATIONS.md:18`
- **What:** RN-004 aplica el paso de día "al leer o escribir", pero UC-005/007/016 no lo citan.
- **Why:** Una reserva vencida sigue ocupando la unidad (INV-RES-001) y puede dar un E_SIN_UNIDADES falso.
- **Fix:** Añadir el paso de día como primer paso de esos UC y a la columna UC de INV-LOA-002.

### SIL-002: E_NO_AUTENTICADO / E_SESION_CADUCADA ausentes en la mayoría de operaciones — P2 · CAT-03 · new
- **Where:** `spec/contracts/API-reservas.md:25` · `API-prestamos.md:31` · `API-inventario.md:20` · `spec/domain/05-INVARIANTS.md:13`
- **What:** Solo algunas operaciones listan esos errores; INV-ACC-007 los exige en todas las que piden sesión.
- **Why:** Sin lista por operación, ni contrato ni BDD cubren la sesión ausente o caducada.
- **Fix:** Declarar una vez que aplican a toda operación salvo API-001-01 y añadir un BDD por módulo.

### SIL-003: E_ACCESO_NO_PERMITIDO falta en API-002-01/03 y la fila 04 no coincide con la tabla — P2 · CAT-03 · new
- **Where:** `spec/contracts/API-reservas.md:16`, `:18`, `:19`, `:36` · `spec/contracts/PERMISSIONS-MATRIX.md:6`
- **What:** El error de rol solo figura en 02 y 04; 01 y 03 son solo-socio y no lo listan. 01/03 tampoco listan E_DATOS_INVALIDOS.
- **Why:** Un encargado o la junta llamando a 01/03 no tiene resultado definido.
- **Fix:** Extender el error a 01–04 y alinear fila y tabla.

### SIL-004: RN-013 y RN-014 no están en UC-004 ni en SM-004 — P2 · CAT-03 · new
- **Where:** `spec/use-cases/UC-004-restablecer-contrasena-y-baja.md:35` · `spec/domain/04-STATES.md:47`
- **What:** Ya existen INV-ACC-008/009, pero el UC no tiene poscondición, paso ni fila de error para invalidar sesiones ni para restablecer una cuenta en Baja.
- **Why:** Sin ello el UC y su BDD no verifican la regla.
- **Fix:** Añadir poscondición, paso y error citando INV-ACC-008/009; añadir AC y BDD.

### SIL-005: Zona horaria y formato de instantes sin fijar — P2 · CAT-03 · new
- **Where:** `spec/adr/ADR-002-reloj-y-dias-completos.md:23` · `spec/domain/02-ENTITIES.md:11`
- **What:** "Hoy" usa la zona del servidor; bloqueadaHasta y ultimaActividad no tienen formato.
- **Why:** Entrega, no recogida y cierre de cancelación dependen del día.
- **Fix:** Fijar la zona del club en VALUE-REGISTRY y el formato del instante en un VO.

### INV-002: Reglas decididas sin INV — P2 · CAT-07 · new · batched
- **Where:** `spec/CLARIFICATIONS.md:19` (RN-007), `:25` (RN-008), `:30` (RN-016) · `spec/domain/04-STATES.md:13`, `:47` · `spec/use-cases/UC-005…:54`
- **What:** Sin INV: RN-007, RN-008, la baja de socio que cancela sus reservas, la primera escritura confirmada gana, RN-016. UC-014 E4 cita INV-LOA-001 y no corresponde; SM-001 cita INV-STK-005 para baja de socio.
- **Why:** Reglas verificables sin id ni validación.
- **Fix:** Crear un INV por regla y corregir las citas.

### INV-003: Retención de 2 años sin INV y RN-010 pendiente — P2 · CAT-07 · new
- **Where:** `spec/nfr/LIMITS.md:7` · `spec/VALUE-REGISTRY.md:13` · `spec/CLARIFICATIONS.md:24`
- **What:** "Última actividad de la cuenta" no está definida y la purga no está especificada.
- **Why:** Un límite sin INV ni evento que lo dispare no se puede probar.
- **Fix:** Definir el evento y el campo, o marcar el límite como declarado y no aplicado; resolver RN-010 (Tier 1, requisito).

### ADR-001: Credencial de sesión y formato de ids sin ADR — P2 · CAT-09 · new
- **Where:** `spec/domain/02-ENTITIES.md:28` · `spec/adr/ADR-001-almacen-unico-compartido.md:12`
- **What:** Sesion.id es texto y el resto de ids son número; ningún ADR dice cómo se genera ni cómo lo guarda el cliente.
- **Why:** Decisión material de autenticación e identificadores.
- **Fix:** Añadir ADR o declarar que lo decide el diseño técnico.

### AMB-001: AC-005-14 no separa "sin unidad" de la repetición idéntica — P2 · CAT-01 · new
- **Where:** `spec/tests/BDD-UC-005.md:70` · `spec/contracts/API-reservas.md:17` · `spec/CLARIFICATIONS.md:25`
- **What:** Con la última unidad cogida por esa misma reserva, el resultado puede ser la existente o E_SIN_UNIDADES.
- **Why:** INV-RES-008 (nuevo) da precedencia a la repetición; el AC no lo refleja.
- **Fix:** Dividir en dos escenarios.

### AMB-002: "El volumen del club lo permite" sin cifra — P2 · CAT-01 · new
- **Where:** `spec/adr/ADR-005-escrituras-atomicas.md:22` · `spec/nfr/LIMITS.md`
- **What:** La decisión de serializar se apoya en un volumen no definido.
- **Why:** No hay límite que probar.
- **Fix:** Añadir el volumen esperado a LIMITS o declarar que no hay NFR de rendimiento.

### INC-001: Códigos de error de contrato sin escenario BDD — P2 · CAT-06 · new · batched
- **Where:** `spec/tests/BDD-UC-005.md` · `BDD-UC-007.md` · `BDD-UC-004.md:36` · `BDD-UC-006.md` · `BDD-UC-009.md`
- **What:** Sin BDD: E_ACCESO_NO_PERMITIDO en API-002-04, 001-06, 003-06; E_SOCIO_NO_ENCONTRADO en 001-07; E_NO_AUTENTICADO en reservar, cancelar y ops del encargado; errores de consultarDisponibilidad.
- **Why:** Cada UC tiene feliz y error, pero no cada código.
- **Fix:** Añadir un escenario por código o declarar la omisión.

## Findings P3

| ID | Cat | Where | What | Fix |
|---|---|---|---|---|
| AMB-003 | CAT-01 | `contracts/API-acceso.md:35` | "o está en Baja (06)" no aclara la op 07 | Escribir 06 y 07 por separado |
| AMB-004 | CAT-01 | `nfr/SECURITY.md:10` | "algoritmo lento" y "revisión de mensajes" no verificables | Criterio comprobable |
| CON-005 | CAT-05 | `VALUE-REGISTRY.md:7` · `05-INVARIANTS.md:8` | Valores 8/14/15/5 repetidos como literales | Citar el nombre del registro |
| INC-002 | CAT-06 | `use-cases/UC-008…:44` | INV-SEC-002 citada para rol socio (es INV-ACC-007) | Corregir cita en UC-008/009/012/013/014 |
| INC-003 | CAT-06 | `use-cases/UC-010…:37` | Crea la multa antes de comprobar si ya existe | Reordenar pasos |
| INC-004 | CAT-06 | `use-cases/UC-011…:35` | Falta "Sin multas" (RN-015) y error de rol | Añadir extensión y error |
| INC-005 | CAT-06 | `workflows/WF-002…:25` | Numeración salta la fila 3; UC-013 E6 antes de E5 | Renumerar |
| INC-006 | CAT-06 | `VALUE-REGISTRY.md:8` | "Usado en" incompleto | Completar o redefinir |
| TRN-001 | CAT-10 | `tests/BDD-UC-013.md:35` | "abre la dirección", "botón" sin REQ | Reformular sin mecánica de UI |

## Coverage

| Document | P0 | P1 | P2 | P3 | IDs |
|---|---|---|---|---|---|
| contracts/API-reservas.md | 0 | 0 | 1 | 0 | SIL-003 |
| contracts/API-prestamos.md · PERMISSIONS-MATRIX.md | 0 | 0 | 1 | 0 | CON-001 |
| contracts/API-acceso.md · API-inventario.md | 0 | 0 | 1 | 1 | SIL-002, AMB-003 |
| nfr/SECURITY.md | 0 | 0 | 1 | 1 | CON-002, AMB-004 |
| use-cases/UC-004 · UC-005 · UC-006 | 0 | 0 | 3 | 0 | SIL-004, SIL-001, CON-003 |
| use-cases/UC-008 · 010 · 011 · WF-002 | 0 | 0 | 0 | 4 | INC-002..005 |
| domain/02-ENTITIES · ADR-001/002/005 · LIMITS | 0 | 0 | 5 | 0 | ADR-001, SIL-005, AMB-002, INV-003 |
| spec/CLARIFICATIONS.md · domain/04-STATES | 0 | 0 | 1 | 0 | INV-002 |
| tests/BDD-UC-005 · BDD-UC-013 | 0 | 0 | 2 | 1 | AMB-001, INC-001, TRN-001 |
| VALUE-REGISTRY.md | 0 | 0 | 0 | 2 | CON-005, INC-006 |
| Clean (≈ 33) | 0 | 0 | 0 | 0 | resto de UC, BDD, glosario, VO, ADR-003/004, EVENTS, README, trazabilidad |

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
| INV-001 | RN-001/011/013/014 sin INV | INV-RES-009, INV-RES-008, INV-ACC-008, INV-ACC-009 | AUDIT-v1.0 |
| CON-004 | INV-LOA-001 `hoy ≥ inicio` vs RN-003 `hoy = inicio` | `05-INVARIANTS.md` INV-LOA-001 | AUDIT-v1.0 |
| SEM-001 | "apartada" (término prohibido) en SM-001 | `04-STATES.md:7` | AUDIT-v1.0 |
| INC-007 | "Open questions" ya decidida (RN-012) en UC-001 | `UC-001:52` | AUDIT-v1.0 |
| INC-008 | Errata "el purga automática" en RN-010 | `CLARIFICATIONS.md:24` | AUDIT-v1.0 |

## Fix cycle (AUDIT-v1.0)
- Fixed 5 (INV-001, CON-004, SEM-001, INC-007, INC-008) · skipped: el resto, porque su arreglo cambiaría contratos o requiere decidir (clase C) o es trabajo extenso de BDD/UC.
- New artifacts: ninguno · Documents modified: 4 · commits: 1 · tag: —

## History

| Audit | Date | Docs | Total | P0 | P1 | P2 | P3 | Gate | Mode | Report chars |
|---|---|---|---|---|---|---|---|---|---|---|
| AUDIT-v1.0 | 2026-11-21 | 55 | 23 abiertos | 0 | 0 | 14 | 9 | FAIL | fanout | 11673 |
