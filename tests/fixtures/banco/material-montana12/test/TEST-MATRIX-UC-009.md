# Test Matrix: UC-009 — Cancelar reserva

> Refs: UC-009, API-002-03, BDD-UC-009 (AC-009-01..05), INV-RES-004..006, INV-RES-009, INV-RES-010, RN-011, RN-012, ADR-005, SM-001
> Techniques: EP, BVA, decision table, state transition, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| reservationId | VO-001 | reserva propia Reservada | ajena; ya Cancelada; inexistente | — |
| hoy vs startDate | Day | hoy < inicio | hoy = inicio; hoy > inicio | inicio = hoy−1, hoy, hoy+1 |
| estado | SM-001 | Reservada | Cancelada, Prestada, Devuelta | — |
| rol | ROLES | socio dueño | otro socio, encargado, junta | — |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Casco 6 uds; Lucía 2 × Casco 12-05..07; hoy 2026-12-04; cancela | ok · `Cancelada`, "Reserva cancelada"; Pablo reserva 5 × Casco esas fechas ok | happy | AC-009-01, INV-RES-005 |
| T02 | Cancelada y Pablo reservó 5; Lucía cancela otra vez | `E_YA_CANCELADA` · "La reserva ya estaba cancelada" · sin cambios | replay | AC-009-02, INV-RES-009 |
| T03 | Tras T02, Pablo pide 2 × Casco | `E_SIN_UNIDADES` · "solo queda 1 de Casco el 2026-12-05"; unidades no liberadas dos veces | replay | AC-009-02, ADR-005 |
| T04 | Hoy 2026-12-05 = inicio | `E_EMPIEZA_HOY` · "No se puede cancelar: empieza hoy" · sigue `Reservada` | boundary | AC-009-03, INV-RES-006 |
| T05 | Hoy 2026-12-06, inicio 12-05, Reservada | `E_YA_EMPEZADA` · "No se puede cancelar: ya ha empezado" · sigue `Reservada` | boundary | AC-009-04 |
| T06 | Hoy = inicio−1 | ok · `Cancelada` | boundary | INV-RES-006, RN-011 |
| T07 | Pablo cancela la reserva de Lucía | `E_ACCESO_DENEGADO` · "Acceso denegado" · sigue `Reservada`, sin datos | error | AC-009-05, INV-RES-010 |
| T08 | Encargado o junta envía Cancelar | `E_ACCESO_DENEGADO` · sin cambios | error | UC-009 E1, RN-020 |
| T09 | Reserva Prestada con inicio pasado | `E_YA_EMPEZADA` · sin cambios | state | UC-009 E4 |
| T10 | Encargado entrega la reserva a la vez que el socio cancela | una gana; si entrega primero: `E_YA_EMPEZADA`, sigue `Prestada` | race | UC-009 E4, INV-RES-006 |
| T11 | Dos Cancelar simultáneos de la misma reserva | uno ok; otro `E_YA_CANCELADA`; unidades liberadas una vez | race | AC-009-02, INV-RES-009 |
| T12 | Almacén falla al guardar | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · sigue `Reservada` | error | D-T-002 |
| T13 | Reserva Devuelta, o Reservada con fin pasado (No recogida) | `undefined in spec` | state | — |

## State Transitions

| SM | From | Event / guard | To | Postcondition (≤ 80 chars) | Cases |
|----|------|---------------|----|----------------------------|-------|
| SM-001 | Reservada | cancelar, hoy < inicio, dueño | Cancelada | unidades libres todos sus días | T01, T06 |
| SM-001 | Reservada | cancelar, hoy ≥ inicio | Reservada | sin cambios | T04, T05 |
| SM-001 | Cancelada | cancelar de nuevo | Cancelada | sin cambios, aviso | T02, T11 |
| SM-001 | Prestada | cancelar | Prestada | sin cambios | T09, T10 |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-009-01 | Cancelar Devuelta o No recogida (inicio pasado): E4 habla de "sin entregar"; resultado no fijado | Añadir fila o AC |
| F-009-02 | Precedencia E_YA_CANCELADA (paso 3) vs E_ACCESO_DENEGADO si ajena y cancelada no fijada con AC | Añadir AC |
