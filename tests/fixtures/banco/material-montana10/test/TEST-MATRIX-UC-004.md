# Test Matrix: UC-004 — Ver y cancelar mis reservas
> Refs: UC-004, API-002-02, API-002-03, BDD-UC-004 (AC-004-01..08), INV-RES-006, INV-RES-007, INV-RES-008, INV-ACC-008, INV-ACC-009, RN-002, RN-008, RN-019, SM-001
> Techniques: EP, BVA, decision table, state transition, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs
| Input | Type | Valid classes | Invalid classes | Boundaries |
|---|---|---|---|---|
| reservaId | number | propia, existente | inexistente; de otro socio | id ausente |
| estado reserva | SM-001 | Reservada; Cancelada (replay) | Prestada, Devuelta, No recogida | — |
| hoy vs desde | días | hoy < desde | hoy >= desde | desde-1 / desde / desde+1 |
| multas | Multa[] | ninguna; Pendiente propia | de otro socio (no se ven) | importe literal |
| reservas del socio | lista | >= 1; vacía | — | 0 / 1 |

## Cases
| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|---|---|---|---|---|
| T01 | lucia con Piolet 12-05..12-07 abre Mis reservas | "Piolet · 2026-12-05 a 2026-12-07 · Reservada" | happy | AC-004-01 |
| T02 | pablo sin reservas; lucia tiene una | "No tienes reservas"; ninguna de Lucía | happy | AC-004-02, INV-ACC-009 |
| T03 | hoy 12-04, desde 12-05 (día antes); lucia cancela | "Piolet · 2026-12-05 a 2026-12-07 · Cancelada"; unidad libre | boundary | AC-004-03, INV-RES-006 |
| T04 | Cancelada de T03; se cancela de nuevo | sin error; sigue Cancelada una vez; sin otro cambio | replay | AC-004-04, INV-RES-008 |
| T05 | hoy 12-05 = desde (mismo día); lucia cancela | `E_CANCELACION_TARDIA` "Solo se puede cancelar hasta el día antes"; sigue Reservada | boundary | AC-004-05 |
| T06 | hoy desde+1 (en curso o pasada) | `E_CANCELACION_TARDIA`; sigue como estaba | boundary | AC-004-05 |
| T07 | lucia con multa Pendiente 4 €; abre Mis reservas | "Multa pendiente: 4 €" | happy | AC-004-06 |
| T08 | reserva de lucia; pablo la cancela | `E_SIN_PERMISO_CANCELAR` "No tienes permiso para cancelar esta reserva"; sigue Reservada | error | AC-004-07, INV-ACC-009 |
| T09 | reservaId inexistente | `E_RESERVA_NO_ENCONTRADA` "No existe esa reserva"; sin cambios | error | AC-004-08 |
| T10 | Lista de pablo con multa y reservas de lucia | solo reservas y multas de pablo | derived | INV-ACC-009 |
| T11 | Reservada con hoy > hasta al listar | se muestra "No recogida"; no ocupa unidades | state | INV-RES-007, RN-008 |
| T12 | Cancelar reserva Prestada (hoy >= desde) | `E_CANCELACION_TARDIA`; sigue Prestada | state | AC-004-05, INV-RES-006 |
| T13 | Cancelar Devuelta / No recogida | `E_CANCELACION_TARDIA`; sin cambios | state | AC-004-05, INV-RES-006 |
| T14 | Cancelada y luego pasa desde; se cancela de nuevo | sin error; sigue Cancelada (replay antes que guarda de fecha) | replay | AC-004-04, INV-RES-008 |
| T15 | Tras T03, otro socio reserva la última unidad esos días | creada (unidades liberadas) | derived | RN-002, INV-RES-006 |
| T16 | Cancelación del socio y entrega (hoy >= desde) a la vez | entrega gana o cancelación falla con `E_CANCELACION_TARDIA`; no queda Cancelada con unidad | race | AC-004-05, INV-RES-006 |
| T17 | Dos cancelaciones simultáneas de la misma reserva | una cambia a Cancelada; la otra sin error ni cambio | race | AC-004-04, INV-RES-008 |
| T18 | Fallo del almacén al cancelar | `E_ALMACEN_NO_DISPONIBLE` "No se pudo completar la operación. Inténtalo de nuevo"; sigue Reservada | error | D-T-003 |
| T19 | Sin sesión / sesión caducada (listar y cancelar) | `E_NO_AUTENTICADO` / `E_SESION_CADUCADA`; sin cambios | error | INV-ACC-008 |
| T20 | Sesión de encargado cancela o lista | undefined in spec | error | — |
| T21 | pablo cancela un id que no existe | `E_RESERVA_NO_ENCONTRADA` (existencia antes que dueño) | derived | RN-019 |
| T22 | Reservada ajena ya Cancelada; pablo la cancela | `E_SIN_PERMISO_CANCELAR` (dueño antes que replay) | derived | INV-ACC-009, RN-019 |

## State Transitions
| SM | From | Event / guard | To | Postcondition (≤80 chars) | Cases |
|---|---|---|---|---|---|
| SM-001 | Reservada | cancelar; hoy < desde; dueño | Cancelada | libera unidades | T03, T15 |
| SM-001 | Reservada | cancelar; hoy >= desde | Reservada | sin cambios; `E_CANCELACION_TARDIA` | T05, T06, T16 |
| SM-001 | Reservada | cancelar; no dueño | Reservada | sin cambios; `E_SIN_PERMISO_CANCELAR` | T08 |
| SM-001 | Cancelada | cancelar (repetir) | Cancelada | sin cambios ni duplicado | T04, T14, T17 |
| SM-001 | Reservada | listar; hoy > hasta | No recogida | derivada al consultar, sin multa | T11 |
| SM-001 | Prestada/Devuelta/No recogida | cancelar | igual | sin cambios; `E_CANCELACION_TARDIA` | T12, T13 |

## Findings for sdd-spec-auditor
| ID | Observation (≤120 chars) | Suggested action |
|---|---|---|
| F-004-01 | API-002-02/03 sin `E_SIN_PERMISO` para rol no socio (INV-ACC-008); UC-004 no lo trata | Añadir error a UC/API |
| F-004-02 | Prestada/Devuelta no tienen error propio; se asume `E_CANCELACION_TARDIA` | Confirmar en UC-004 E4 |
| F-004-03 | Orden de comprobación existencia/dueño/replay en id ajeno solo implícito (RN-019) | Explicitar precedencia |
