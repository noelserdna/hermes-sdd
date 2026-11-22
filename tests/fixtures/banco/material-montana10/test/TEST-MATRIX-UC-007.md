# Test Matrix: UC-007 — Pagar multa
> Refs: UC-007, API-003-03, API-003-04, BDD-UC-007 (AC-007-01..05), INV-LOA-005, INV-RES-005, INV-ACC-008, SM-002
> Techniques: EP, decision table, state transition, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs
| Input | Type | Valid classes | Invalid classes | Boundaries |
|---|---|---|---|---|
| multaId | number | multa Pendiente; ya Pagada (replay) | inexistente (999, 0, -1); no numérico | — |
| rol | Rol | encargado | socio, junta, sin sesión | — |
| otras multas del socio | conjunto | ninguna Pendiente; otra Pendiente | — | 1 vs 2 Pendientes |

## Cases
| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|---|---|---|---|---|
| T01 | Pablo con multa 6 € Pendiente; pagar | Pagada, pagadaEl = hoy; "Multa de 6 € · Pablo · Pagada" en Multas | happy | AC-007-01, INV-LOA-005 |
| T02 | tras T01, Pablo reserva | la reserva se crea (sin `E_MULTA_PENDIENTE`) | happy | AC-007-01, INV-RES-005 |
| T03 | Lucía con 2 € y 4 € Pendientes; pagar la de 2 € | 2 € Pagada; sigue "Multa pendiente: 4 €" en Mis reservas | happy | AC-007-02, INV-RES-005 |
| T04 | tras T03, Lucía reserva | `E_MULTA_PENDIENTE` "Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar" | error | AC-007-02, INV-RES-005 |
| T05 | multa ya Pagada; pagar otro día | sigue Pagada una vez; misma pagadaEl | replay | AC-007-03, INV-LOA-005 |
| T06 | dos pagos concurrentes de la misma multa Pendiente | una sola Pagada; una pagadaEl | race | AC-007-03, INV-LOA-005 |
| T07 | socio "lucia@club.es" abre Multas (listarMultas) | `E_SIN_PERMISO` "No tienes permiso para ver esta pantalla"; no se lista nada | error | AC-007-04, INV-ACC-008 |
| T08 | socio intenta pagar (expand: junta abre y paga) | `E_SIN_PERMISO` "No tienes permiso para ver esta pantalla"; multa sigue Pendiente | error | AC-007-04, INV-ACC-008 |
| T09 | multaId inexistente (expand: 0, -1) | `E_MULTA_NO_ENCONTRADA` "No se encontró esa multa"; no cambia ninguna multa | error | AC-007-05 |
| T10 | encargado abre Multas con multas de varios socios | lista todas, Pendientes y Pagadas; sin cambios | happy | AC-007-01, API-003-04 |
| T11 | sin sesión o sesión caducada, pagar (expand: listar) | `E_NO_AUTENTICADO` / `E_SESION_CADUCADA`; sin cambios | derived | INV-ACC-008 |
| T12 | socio paga multaId inexistente | `E_SIN_PERMISO` (el permiso precede a la validación); sin cambios | derived | INV-ACC-008, D-T-009 |
| T13 | fallo del almacén al pagar | `E_ALMACEN_NO_DISPONIBLE` "No se pudo completar la operación. Inténtalo de nuevo"; sigue Pendiente | derived | INV-LOA-005, D-T-003 |
| T14 | multaId no numérico ("abc") | undefined in spec | error | — |

## State Transitions
| SM | From | Event / guard | To | Postcondition (≤80 chars) | Cases |
|---|---|---|---|---|---|
| SM-002 | Pendiente | pagar (rol encargado) | Pagada | pagadaEl fijada una vez | T01, T03 |
| SM-002 | Pagada | pagar de nuevo | Pagada | sin cambios; misma pagadaEl | T05, T06 |
| SM-002 | Pendiente | pagar (rol no permitido) | Pendiente | sin cambios | T07, T08, T12 |

## Findings for sdd-spec-auditor
| ID | Observation (≤120 chars) | Suggested action |
|---|---|---|
| F-007-01 | multaId no numérico o mal formado: sin código de error en el catálogo | Definir validación o tratarlo como no encontrada |
| F-007-02 | API-003-03/04 listan `E_SIN_PERMISO` pero `E_NO_AUTENTICADO` y `E_SESION_CADUCADA` solo en catálogo global | Confirmar que aplica a todas |
