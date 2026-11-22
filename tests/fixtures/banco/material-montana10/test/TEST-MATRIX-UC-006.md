# Test Matrix: UC-006 — Devolver y multar
> Refs: UC-006, API-003-02, API-003-08, BDD-UC-006 (AC-006-01..06), INV-LOA-003, INV-LOA-004, INV-LOA-006, INV-RES-008, INV-ACC-008, RN-009, RN-013, LIM-004, LIM-005, SM-001, SM-002
> Techniques: EP, BVA, decision table, state transition, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs
| Input | Type | Valid classes | Invalid classes | Boundaries |
|---|---|---|---|---|
| reservaId | number | reserva Prestada | inexistente; Reservada, Cancelada, No recogida; ya Devuelta (replay) | — |
| días de retraso | entero | 0 (hasta o antes), ≥ 1 | — | 0, 1, 3 (multa = `FINE_PER_DAY_EUR` × días) |
| rol | Rol | encargado | socio, junta, sin sesión | — |
| cierre (purga) | Fecha | cierre ≤ hoy − `RETENTION_YEARS` | cierre posterior | 2024-11-01, 2025-01-10 (hoy 2026-11-21) |

## Cases
| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|---|---|---|---|---|
| T01 | "Piolet 2" a Lucía hasta 2026-12-07; devuelta 2026-12-07 (0 días) | Devuelta, devueltaEl = hoy; Piolet 2 · Lucía · Devuelta; multa null; ninguna multa | boundary | AC-006-01, INV-LOA-004 |
| T02 | "Cuerda 1" a Lucía hasta 2026-12-07; devuelta 2026-12-08 (1 día) | multa Pendiente 2 €; "Multa de 2 € a Lucía (1 días de retraso)"; Lucía ve "Multa pendiente: 2 €" | boundary | AC-006-03, INV-LOA-004 |
| T03 | "Casco 1" a Pablo hasta 2026-12-07; devuelta 2026-12-10 (3 días) | multa Pendiente 6 €; "Multa de 6 € a Pablo (3 días de retraso)" | boundary | AC-006-02, INV-LOA-004 |
| T04 | devuelta antes de `hasta` (expand: hasta-1, el mismo día de `desde`) | Devuelta sin multa | boundary | AC-006-01, RN-009 |
| T05 | "Casco 1" ya Devuelta con multa 6 €; devolver de nuevo otro día | una sola multa de 6 €; misma devueltaEl | replay | AC-006-04, INV-RES-008 |
| T06 | ya Devuelta a tiempo; devolver de nuevo | sigue sin multa; misma devueltaEl | replay | AC-006-04, INV-LOA-004 |
| T07 | dos devoluciones concurrentes de "Casco 1" con retraso 3 días | una sola multa 6 € y una devueltaEl | race | AC-006-04, INV-LOA-004 |
| T08 | reserva Reservada (expand: Cancelada, No recogida) | `E_RESERVA_NO_PRESTADA` "Esa reserva no está prestada"; sin multa ni cambios | error | AC-006-05, INV-LOA-003 |
| T09 | reservaId inexistente | `E_RESERVA_NO_ENCONTRADA` "No existe esa reserva"; nada cambia | error | AC-006-06 |
| T10 | rol socio (expand: junta, sin sesión) | `E_SIN_PERMISO` "No tienes permiso para ver esta pantalla" (sin sesión: `E_NO_AUTENTICADO`); sin cambios | derived | INV-ACC-008 |
| T11 | fallo del almacén al crear la multa | `E_ALMACEN_NO_DISPONIBLE` "No se pudo completar la operación. Inténtalo de nuevo"; sigue Prestada, sin multa | derived | INV-LOA-004, D-T-003 |
| T12 | hoy 2026-11-21; Devuelta 2024-11-01 (derived de API-003-08) | purga borra préstamo y multa Pagada | derived | LIM-004, INV-LOA-006, RN-013 |
| T13 | hoy 2026-11-21; Devuelta 2025-01-10 | se conserva | derived | LIM-004, INV-LOA-006 |
| T14 | multa Pendiente de devolución 2024-11-01 | nunca se borra (0 borrados) | derived | LIM-005, INV-LOA-006 |
| T15 | cierre exacto hace 2 años (2024-11-21) | ¿borrado o conservado? undefined in spec | boundary | — |
| T16 | ejecutar API-003-08 dos veces seguidas | undefined in spec (idempotencia no declarada) | replay | — |
| T17 | cierre de Cancelada, No recogida o multa Pagada (fecha de cierre) | undefined in spec | derived | — |

## State Transitions
| SM | From | Event / guard | To | Postcondition (≤80 chars) | Cases |
|---|---|---|---|---|---|
| SM-001 | Prestada | devolver; días = 0 | Devuelta | devueltaEl = hoy; sin multa | T01, T04 |
| SM-001 | Prestada | devolver; días ≥ 1 | Devuelta | devueltaEl = hoy; multa creada | T02, T03 |
| SM-001 | Devuelta | devolver de nuevo | Devuelta | sin cambios; una sola multa | T05, T06, T07 |
| SM-001 | Reservada, Cancelada, No recogida | devolver | sin cambio | `E_RESERVA_NO_PRESTADA` | T08 |
| SM-002 | (ninguna) | devolución con días ≥ 1 | Pendiente | importe = 2 € × días | T02, T03 |

## Findings for sdd-spec-auditor
| ID | Observation (≤120 chars) | Suggested action |
|---|---|---|
| F-006-01 | AC-006-03 exige literal "1 días de retraso" (concordancia) | Confirmar literal o pluralizar |
| F-006-02 | "más de 2 años" (API-003-08) vs "2 años después" (INV-LOA-006): el día exacto es ambiguo | Unificar regla |
| F-006-03 | Fecha de cierre no definida para Cancelada, No recogida y multa Pagada; purga repetida sin semántica | Definir cierre e idempotencia |
| F-006-04 | API-003-02 no lista `E_SIN_PERMISO` (Errors solo 03..06) pese a INV-ACC-008 | Añadirlo a 01 y 02 |
