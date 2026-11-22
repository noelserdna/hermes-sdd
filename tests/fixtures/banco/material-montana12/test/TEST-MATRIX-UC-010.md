# Test Matrix: UC-010 — Entregar reserva

> Refs: UC-010, API-002-04, BDD-UC-010 (AC-010-01..07), INV-RES-005, INV-RES-007, INV-RES-008, INV-RES-009, INV-SEC-003, RN-012, RN-013, RN-029, ADR-002, ADR-005, SM-001
> Techniques: EP, BVA, decision table, state transition, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| reservationId | VO-001 | existente | inexistente | — |
| estado de la reserva | SM-001 | Reservada | Prestada (replay), Cancelada, Devuelta | — |
| hoy vs fechas | Day (VO-005) | startDate ≤ hoy ≤ endDate | hoy < startDate; endDate < hoy | hoy = startDate, hoy = endDate, startDate−1, endDate+1 |
| rol | sesión | encargado | socio, junta | — |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Reservada 2×Casco 12-05..12-07; hoy = startDate | ok · "Entregado: 2 × Casco a Lucía Gil"; fila "Prestada" · Prestada, `deliveredOn`=hoy | happy | AC-010-01 |
| T02 | expand: BVA(hoy=endDate, hoy entre ambos) | ok · Prestada, `deliveredOn`=hoy | boundary | INV-RES-007, RN-013 |
| T03 | T01 y se envía "Entregar" otra vez | `E_YA_ENTREGADA` · "Ya estaba entregada" · Prestada, una sola fila de préstamo | replay | AC-010-02, INV-RES-009 |
| T04 | expand: BVA(hoy=startDate−1; reserva 12-10, hoy 12-05) | `E_ANTES_DE_INICIO` · "No se puede entregar antes de la fecha de inicio" · sigue Reservada | boundary | AC-010-03, INV-RES-007 |
| T05 | expand: BVA(hoy=endDate+1; hoy 12-08) sin entregar | `E_NO_RECOGIDA` · "No recogida" · sin cambios, unidades libres, sin multa | boundary | AC-010-04, INV-RES-008 |
| T06 | reservationId inexistente | `E_RESERVA_NO_ENCONTRADA` · "La reserva no existe" · sin cambios | error | AC-010-05 |
| T07 | expand: enum(socio, junta) intenta entregar | `E_ACCESO_DENEGADO` · "Acceso denegado", sin datos de la reserva · sin cambios | error | AC-010-06, INV-SEC-003 |
| T08 | expand: enum(Cancelada, Devuelta) con hoy en rango | `E_RESERVA_NO_ENTREGABLE` · "Solo se puede entregar una reserva pendiente" · sin cambios | error | AC-010-07 |
| T09 | almacén falla al guardar la entrega | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · sigue Reservada, sin `deliveredOn` | error | D-T-002, UC-010 Refs |
| T10 | tras T01, la disponibilidad de ese material en 12-05..12-07 | mismas unidades ocupadas que antes de entregar | derived | INV-RES-005 |
| T11 | dos encargados entregan a la vez la misma Reservada | uno ok; el otro `E_YA_ENTREGADA` · una sola fila de préstamo, un `deliveredOn` | race | AC-010-02, INV-RES-009 |
| T12 | Cancelada con hoy < startDate (dos reglas a la vez) | undefined in spec | error | — |
| T13 | Prestada ya entregada y hoy > endDate; se envía "Entregar" | undefined in spec | replay | — |
| T14 | No recogida con endDate < hoy ≤ `NOT_COLLECTED_VISIBLE_DAYS` días | fila "No recogida" sin botón "Entregar"; `E_NO_RECOGIDA` si se fuerza | derived | RN-029, AC-010-04 |

## State Transitions

| SM | From | Event / guard | To | Postcondition (≤ 80 chars) | Cases |
|----|------|---------------|----|----------------------------|-------|
| SM-001 | Reservada | entregar; startDate ≤ hoy ≤ endDate | Prestada | `deliveredOn`=hoy; mismas unidades ocupadas | T01, T02, T10 |
| SM-001 | Reservada | entregar; hoy < startDate | Reservada | sin cambios | T04 |
| SM-001 | Reservada | entregar; endDate < hoy | Reservada | sin cambios; No recogida, unidades libres | T05, T14 |
| SM-001 | Prestada | entregar (replay) | Prestada | sin cambios; una fila | T03, T11 |
| SM-001 | Cancelada/Devuelta | entregar | igual | sin cambios | T08 |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-010-01 | Precedencia entre E_RESERVA_NO_ENTREGABLE y E_ANTES_DE_INICIO/E_NO_RECOGIDA (Cancelada fuera de fechas) no fijada (CON-005) | Fijar orden de comprobación en UC-010 paso 3 |
| F-010-02 | Replay sobre Prestada con endDate < hoy: ¿`E_YA_ENTREGADA`? El paso 3 no dice el orden (CON-005, GAP-007) | Documentar precedencia E_YA_* |
| F-010-03 | AC-010-04 usa "abre la reserva" (no entrega) y cita `E_NO_RECOGIDA`; el replay AC-010-02 no cita código | Reescribir AC con "pulsa Entregar" y `E_YA_ENTREGADA` |
