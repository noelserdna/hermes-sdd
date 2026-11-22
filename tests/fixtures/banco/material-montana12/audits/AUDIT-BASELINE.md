# Audit Baseline — material-montana12

> **Audit:** AUDIT-v1.0 · **Date:** 2026-11-22 · **Specs:** `spec/` (docs de requisitos v1.0) · **Docs audited:** 58 · **Mode:** fanout · **Cycles:** 1 Discovery → 2 Fix (parcial)
> **Gate:** **CONDITIONAL PASS** — 0 P0, 2 P1 abiertos (CON-001, CON-002; con pregunta), 13 P2
> **Findings:** 24 abiertos · P0 0 · P1 2 · P2 13 · P3 9 · resueltos en el fix 1 (DOM-001/UC-001/NFR-002 en un grupo + DOM-012) · batched 6 · cross-validated 3 · excluded by baseline 0
> **Delta vs none (first audit):** new 24 · persistent 0 · regression 0 · resolved since 0
> **Top categories:** CAT-03 (9), CAT-05 (8), CAT-06 (8)

## Gate detail

| Check | Result |
|---|---|
| 3C Completeness (SC01–SC05) | PASS 5/5 (14/14 REQ cubiertos; sin TBD/NC; DERIVED-SPECS avisa de 9 Tier 1 pendientes de REQ → INC-004) |
| 3C Correctness (SR01–SR05) | PASS (SR04: ver CON-004 en P3) |
| 3C Coherence (SH01–SH05) | WARN: SH01 → SEM-001; SH02 → SEM-002 |
| Spec defect density | 0.03 (P0+P1)/doc PASS |
| Traceability coverage | 100% PASS |
| Orphan rate | 0% PASS |
| Clarification density | 0/doc PASS |
| Audit pass rate | 97% PASS |
| Cross-reference validity | 100% (UC, WF, ADR, INV, REQ resuelven) PASS |

## Findings P0–P2

### CON-001: Baja repetida: UC-006 dice «sin error», RN-027 exige error — P1 · CAT-05 · new
- **Where:** `spec/use-cases/UC-006-baja-socio.md:46` · `:50` · `spec/tests/BDD-UC-006.md:42`
- **What:** E4 declara efecto «sin cambios» y código `—`; RN-027 pide `E_SOCIO_NO_ENCONTRADO` para baja repetida.
- **Why:** Dos resultados para la misma acción; API-001-06 y AC-006-07 no fijan cuál.
- **Fix:** Pregunta Q-spec-auditor-002. Alinear UC-006 E4, API-001-06 y AC-006-07 con la respuesta.

### CON-002: Límite de caducidad de sesión: «> 30 min» frente a «30 min» — P1 · CAT-05 · new · [CROSS-VALIDATED]
- **Where:** `spec/domain/05-INVARIANTS.md:11` · `spec/tests/BDD-UC-001.md:31` · `spec/tests/PROPERTY-TESTS.md:11`
- **What:** INV-SOC-005 mantiene viva la sesión con exactamente 30 min; AC-001-06 pide verla caducada con 30 min.
- **Why:** Test y propiedad dan resultados contrarios en el borde.
- **Fix:** Pregunta Q-spec-auditor-001; luego alinear INV-SOC-005, AC-001-06, PROP-005 y usar `SESSION_IDLE_MINUTES`.

### SIL-001: `E_ALMACEN_NO_DISPONIBLE` falta en los contratos de escritura 002–004 — P2 · CAT-03 · new
- **Where:** `spec/contracts/API-prestamos.md:16` · `API-material.md:16` · `API-multas.md:17` · `API-cuentas.md:40`
- **What:** El catálogo (VO-010) lo asigna a todas las escrituras; solo API-001 lo lista; sin BDD de fallo de almacén.
- **Why:** REQ-NF-002: fallo sin cambios parciales indefinido en reservar/devolver.
- **Fix:** Añadirlo a las tablas Errors de API-002/003/004 y un escenario BDD.

### SIL-002: Reserva o tipo inexistente sin error en cancelar, reservar y retirar — P2 · CAT-03 · new · [CROSS-VALIDATED]
- **Where:** `spec/contracts/API-prestamos.md:18` · `spec/use-cases/UC-009-cancelar-reserva.md:43` · `UC-007:44` · `UC-016:41`
- **What:** UC-010/011 tienen `E_RESERVA_NO_ENCONTRADA`; UC-009, UC-007 (tipo) y UC-016 no.
- **Why:** Id inexistente vs ajena (INV-SEC-001) indeterminado.
- **Fix:** Decidir código único y añadir filas de error y escenario en BDD-UC-009.

### SIL-003: Dos reservas simultáneas de las últimas unidades — P2 · CAT-03 · new
- **Where:** `spec/domain/05-INVARIANTS.md:19` · `spec/tests/PROPERTY-TESTS.md:16` · `ADR-001`
- **What:** INV-RES-004 exige libres ≥ 0 pero ningún texto fija el resultado de dos envíos concurrentes.
- **Why:** Sobreventa posible; PROP-010 solo cubre secuencias.
- **Fix:** Fijar que el segundo recibe `E_SIN_UNIDADES` (comprobar y escribir de forma atómica) y añadir escenario.

### CON-003: Reenvío de «cambiar contraseña» choca con RN-025 — P2 · CAT-05 · new
- **Where:** `spec/use-cases/UC-004-cambiar-contrasena.md:43` · `:46`
- **What:** E3: «se guarda la última enviada»; RN-025: el Activo no cambia su contraseña.
- **Why:** Tras el primer envío la cuenta es Activa.
- **Fix:** Definir el reenvío con cuenta Activa (rechazo con código o sin efecto).

### CON-004: PROP-023 y PROP-016 contradicen contrato y BDD — P2 · CAT-05 · new · parcial
- **Where:** `spec/tests/PROPERTY-TESTS.md:29` (PROP-023: «segundo tipo igual se rechaza»; contrato suma al existente, RN-017)
- **What:** PROP-016 ya corregido (cerrados, RN-033); PROP-023 sigue contradiciendo `addUnits` y AC-015-01.
- **Why:** La propiedad fallaría contra una implementación correcta.
- **Fix:** Reformular PROP-023: mismo nombre con otra capitalización suma al tipo existente.

### AMB-001: Rol no permitido con dos códigos posibles — P2 · CAT-01 · new · [CROSS-VALIDATED]
- **Where:** `spec/tests/BDD-UC-007.md:61` · `BDD-UC-015.md:29` · `BDD-UC-016.md:33` · `spec/contracts/API-multas.md:16`
- **What:** «E_PAGINA_PROHIBIDA o E_ACCESO_DENEGADO»; los contratos mezclan ambos sin regla.
- **Why:** Escenario no verificable.
- **Fix:** Regla única (acción enviada = ACCESO_DENEGADO; abrir página = PAGINA_PROHIBIDA) aplicada a cada operación.

### SIL-004: Orden de validación y errores simultáneos sin definir — P2 · CAT-03 · new
- **Where:** `spec/contracts/API-prestamos.md:16` · `API-cuentas.md:21` · `spec/CLARIFICATIONS.md:25` (RN-010) · `UC-007:32`
- **What:** Varios errores a la vez (`reserve`, `removeMember`); RN-034 añade validaciones sin paso ni orden; RN-010 sin INV.
- **Why:** Error devuelto indeterminado.
- **Fix:** Fijar precedencia y citarla en INV; añadir filas en UC-007/UC-017.

### SIL-005: Bloqueo de cuenta: intentos durante el bloqueo y reset por restablecimiento — P2 · CAT-03 · new
- **Where:** `spec/domain/05-INVARIANTS.md:10` · `spec/nfr/SECURITY.md:11` · `UC-005-restablecer-contrasena.md:24`
- **What:** No dice si un intento bloqueado suma o prorroga, ni si restablecer levanta el bloqueo.
- **Why:** Comportamiento indefinido en INV-SOC-004.
- **Fix:** Fijar ambos y añadir escenario.

### INC-001: Contratos y matriz sin casos de rol cruzado ni errores propios — P2 · CAT-06 · new
- **Where:** `spec/contracts/API-cuentas.md:18,23` · `PERMISSIONS-MATRIX.md:9` · `spec/tests/BDD-UC-002.md:20` · `BDD-UC-019.md:24`
- **What:** changePassword/authorize sin error de sesión Activa o provisional; UC-002 y UC-019 sin escenario de error; códigos de contrato sin BDD (E_SOCIO_DATOS_INVALIDOS, E_FECHA_INVALIDA…).
- **Why:** Cobertura BDD incompleta de errores declarados.
- **Fix:** Añadir los escenarios y filas indicados.

### INC-002: Reglas del dominio incompletas — P2 · CAT-06 · new
- **Where:** `spec/domain/04-STATES.md:45` · `spec/domain/05-INVARIANTS.md:22,23`
- **What:** SM-003 sin «restablecer» desde Provisional ni estado inicial de encargado/junta; INV-RES-008 sin `E_NO_RECOGIDA` como violation error (VO-010 sí).
- **Why:** Máquina e invariantes no coinciden con RN-027 y UC-010.
- **Fix:** Añadir transición y el código a INV-RES-008.

### INV-001: Retención de multas y atomicidad sin invariante — P2 · CAT-07 · new
- **Where:** `spec/domain/05-INVARIANTS.md:26` · `spec/CLARIFICATIONS.md:36` · `UC-019:25` · `UC-006:32`
- **What:** RN-021/RN-033 (multas Pagadas) y la atomicidad de depuración y baja sin INV propio; varias RN (RN-010…) sin INV.
- **Why:** Reglas no verificables como invariante.
- **Fix:** Crear INV-MUL de retención y un INV de atomicidad; citarlos en UC-019/UC-006.

### ADR-001: Almacén, hash de contraseñas y sesión sin ADR — P2 · CAT-09 · new
- **Where:** `spec/nfr/SECURITY.md:10` · `spec/domain/05-INVARIANTS.md:9` · `spec/nfr/PERFORMANCE.md:8`
- **What:** Decisiones materiales dadas por hechas; los 5 ADR cubren solo dominio.
- **Why:** Sin registro de alternativas.
- **Fix:** ADR de almacén, hash+sal y sesión, o registrarlos como supuestos.

### INC-004: 9 especificaciones Tier 1 pendientes de REQ (umbral ≤ 3) — P2 · CAT-06 · new
- **Where:** `spec/DERIVED-SPECS.md:6` · `:21-29`
- **What:** RN-023, 024, 025, 027, 029, 031, 032, 034 y textos de error sin REQ aprobado.
- **Why:** Alerta FAIL en la propia métrica; los requisitos ya están aprobados, así que se tratan como supuestos.
- **Fix:** Decisión humana (puerta de requisitos): `sdd-req-change` o aceptar como supuestos.

## Findings P3

| ID | Cat | Where | What | Fix |
|---|---|---|---|---|
| SEM-001 | CAT-04 | `01-GLOSSARY.md:19` | «Baja» con dos sentidos (cuenta, unidades) | Término distinto para unidades |
| SEM-002 | CAT-04 | `SECURITY.md:10` · `INV:9` | «cifradas» frente a «hash con sal» | Unificar a hash con sal |
| SEM-003 | CAT-04 | `01-GLOSSARY.md:10` | «Unidad» usa «ejemplar», prohibido | Redefinir sin «ejemplar» |
| SEM-004 | CAT-04 | `CLARIFICATIONS.md:33` | «Prestado»/«Prestada»/«Préstamo» sin etiqueta fijada | Fijar etiqueta en glosario |
| SEM-005 | CAT-04 | `INV-SOC-*` · `UC-003:24` | «socio» aplicado a toda cuenta; Provisional listada «Activo» | Aclarar alcance y estado mostrado |
| EVO-001 | CAT-08 | `03-VALUE-OBJECTS.md:20,23,30` · `BDD-UC-007:37` | Literales (15 min, 8, 14, 5) en vez de nombres del registro | Citar nombres o plantillas |
| INC-003 | CAT-06 | `LIMITS.md:14` | `NOT_COLLECTED_VISIBLE_DAYS` sin fila LIM | Añadir SPEC-LIM |
| SIL-006 | CAT-03 | `UC-017:34` · `UC-018:16` · `UC-008:35` · `WF-001:15` | Panel «hoy» vs fecha elegida; consulta vacía; motivo sin Cancelar; ramas replay en WF | Definir cada caso |
| CON-005 | CAT-05 | `UC-010:46` · `UC-011:46` | Precedencia E_YA_* frente a E_NO_PRESTADA no explícita; AC-010-04, replay sin código en BDD; «Pablo» doble rol | Documentar precedencia y citar códigos |

## Coverage

| Document | P0 | P1 | P2 | P3 | IDs |
|---|---|---|---|---|---|
| use-cases/UC-006-baja-socio.md | 0 | 1 | 0 | 0 | CON-001 |
| domain/05-INVARIANTS.md | 0 | 1 | 4 | 0 | CON-002, SIL-003, SIL-005, INC-002, INV-001 |
| tests/BDD-UC-001.md, PROPERTY-TESTS.md | 0 | 1 | 1 | 0 | CON-002, CON-004 |
| contracts/API-*.md, PERMISSIONS-MATRIX.md | 0 | 0 | 4 | 0 | SIL-001, SIL-002, SIL-004, INC-001 |
| use-cases/UC-004, UC-007, UC-009, UC-016 | 0 | 0 | 3 | 1 | CON-003, SIL-002, SIL-004 |
| nfr/SECURITY.md, LIMITS.md | 0 | 0 | 1 | 2 | ADR-001, SEM-002, INC-003 |
| DERIVED-SPECS.md | 0 | 0 | 1 | 0 | INC-004 |
| Clean (rest) | 0 | 0 | 0 | 0 | resto de 58 documentos |

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
| DOM-001/UC-001/NFR-002 | Depuración borraba también lo vivo frente a RN-033 | commit 35a750d (INV-RES-011, UC-019, LIM-008, PROP-016) | AUDIT-v1.0 |
| DOM-012 | Nota de rango INV-xxx-1NN..3NN incorrecta | commit 35a750d | AUDIT-v1.0 |

## Fix cycle (AUDIT-v1.0)
- Fixed 4 grupos (depuración RN-033 en 5 documentos; nota de rango) · skipped el resto: decisión del contrato abierta
- Preguntas: Q-spec-auditor-001 (CON-002), Q-spec-auditor-002 (CON-001)
- Documents modified: 5 · commits: 1 · tag: —

## History

| Audit | Date | Docs | Total | P0 | P1 | P2 | P3 | Gate | Mode | Report chars |
|---|---|---|---|---|---|---|---|---|---|---|
| AUDIT-v1.0 | 2026-11-22 | 58 | 24 | 0 | 2 | 13 | 9 | CONDITIONAL | fanout | 11540 |
