# Test Matrix: UC-005 — Entregar reserva
> Refs: UC-005, API-003-01, API-003-07, BDD-UC-005 (AC-005-01..07), INV-LOA-001, INV-LOA-002, INV-LOA-301, INV-RES-007, INV-RES-008, INV-STK-001, INV-ACC-008, RN-008, RN-020, SM-001
> Techniques: EP, BVA, decision table, state transition, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs
| Input | Type | Valid classes | Invalid classes | Boundaries |
|---|---|---|---|---|
| reservaId | number | reserva Reservada | inexistente; Devuelta, Cancelada, No recogida | — |
| unidadId | number | Activa, del tipo, libre | inexistente; otro tipo; DeBaja; Prestada a otra | — |
| hoy vs fechas | Fecha | desde ≤ hoy ≤ hasta | hoy < desde; hoy > hasta (No recogida) | desde-1, desde, hasta, hasta+1 |
| rol | Rol | encargado | socio, junta, sin sesión | — |

## Cases
| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|---|---|---|---|---|
| T01 | hoy 2026-12-05 = desde; Lucía, Piolet; unidad "Piolet 2" libre | Prestada con unidadId; salida Piolet 2 · Lucía · Prestada; fila visible | happy | AC-005-01, INV-LOA-002 |
| T02 | hoy 2026-12-04 = desde-1 | `E_ENTREGA_ANTICIPADA` "Aún no es la fecha de entrega"; sigue Reservada | boundary | AC-005-03, INV-LOA-001 |
| T03 | hoy = hasta (2026-12-07), Reservada | Prestada (aún no es No recogida: exige hoy > hasta) | derived | INV-RES-007, RN-008 |
| T04 | Reservada 2026-12-05..07 sin entregar; hoy 2026-12-08 = hasta+1; API-003-07 | "No recogida"; unidades libres; sin multa | state | AC-005-04, INV-RES-007 |
| T05 | repetir API-003-07 el mismo día | sin cambios: una sola transición, sin multa | replay | AC-005-04, INV-RES-008 |
| T06 | hoy 2026-12-08, reserva sin entregar, se intenta entregar | `E_RESERVA_NO_ENTREGABLE` "Esa reserva no se puede entregar"; sigue No recogida | state | AC-005-04, AC-005-06 |
| T07 | reserva Cancelada (expand: Devuelta, No recogida) | `E_RESERVA_NO_ENTREGABLE` "Esa reserva no se puede entregar"; sin cambios | error | AC-005-06, INV-LOA-301 |
| T08 | reservaId inexistente | `E_RESERVA_NO_ENCONTRADA` "No existe esa reserva"; nada cambia | error | AC-005-05 |
| T09 | Prestada con "Piolet 2"; entregar otra vez con "Piolet 2" | una fila Piolet 2 · Lucía · Prestada; ninguna segunda unidad | replay | AC-005-02, INV-RES-008 |
| T10 | Prestada con "Piolet 2"; entregar otra vez con "Piolet 3" libre | conserva Piolet 2; Piolet 3 sin asignar; ¿éxito o error? undefined in spec | replay | AC-005-02 |
| T11 | "Piolet 2" Prestada a otra reserva; entregar la segunda con "Piolet 2" | `E_UNIDAD_NO_DISPONIBLE` "Esa unidad no sirve para esta reserva"; sigue Reservada | error | AC-005-07, INV-LOA-002 |
| T12 | unidad DeBaja (expand: inexistente, de otro tipo) | `E_UNIDAD_NO_DISPONIBLE` "Esa unidad no sirve para esta reserva"; sigue Reservada | error | AC-005-07, INV-STK-001 |
| T13 | dos reservas (Lucía, Pablo) del mismo tipo; entregas concurrentes con "Piolet 2" | una Prestada; la otra `E_UNIDAD_NO_DISPONIBLE`, sigue Reservada; Piolet 2 en una sola | race | AC-005-07, INV-LOA-002 |
| T14 | dos entregas concurrentes de la misma reserva con unidades distintas | una sola unidad asignada, una fila Prestada | race | AC-005-02, INV-LOA-301 |
| T15 | rol socio (expand: junta, sin sesión) | `E_SIN_PERMISO` "No tienes permiso para ver esta pantalla" (sin sesión: `E_NO_AUTENTICADO`); sin cambios | derived | INV-ACC-008 |
| T16 | fallo del almacén al asignar | `E_ALMACEN_NO_DISPONIBLE` "No se pudo completar la operación. Inténtalo de nuevo"; reserva y unidad intactas | derived | INV-RES-008, D-T-003 |
| T17 | reserva Cancelada y hoy < desde | ¿`E_RESERVA_NO_ENTREGABLE` o `E_ENTREGA_ANTICIPADA`? undefined in spec | error | — |

## State Transitions
| SM | From | Event / guard | To | Postcondition (≤80 chars) | Cases |
|---|---|---|---|---|---|
| SM-001 | Reservada | entregar; hoy ≥ desde; unidad válida | Prestada | unidadId asignada; fila Prestada | T01, T03 |
| SM-001 | Reservada | entregar; hoy < desde o unidad no válida | Reservada | sin cambios | T02, T11, T12, T13 |
| SM-001 | Reservada | API-003-07; hoy > hasta | No recogida | unidades libres, sin multa | T04, T05 |
| SM-001 | Prestada | entregar de nuevo | Prestada | misma unidad, una fila | T09, T10, T14 |
| SM-001 | Devuelta, Cancelada, No recogida | entregar | sin cambio | `E_RESERVA_NO_ENTREGABLE` | T06, T07 |

## Findings for sdd-spec-auditor
| ID | Observation (≤120 chars) | Suggested action |
|---|---|---|
| F-005-01 | Repetir entrega de una Prestada con otra unidad: ¿éxito idempotente o error? AC-005-02 no lo fija | Definir salida del replay |
| F-005-02 | Cancelada con hoy < desde: sin precedencia entre `E_RESERVA_NO_ENTREGABLE` y `E_ENTREGA_ANTICIPADA` | Fijar orden de comprobaciones |
| F-005-03 | API-003-01 no lista `E_SIN_PERMISO` ni su fila en Errors (solo 03..06), pese a INV-ACC-008 | Añadir 01 y 02 a `E_SIN_PERMISO` |
