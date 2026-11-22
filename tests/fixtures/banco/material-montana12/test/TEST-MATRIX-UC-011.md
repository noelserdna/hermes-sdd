# Test Matrix: UC-011 — Recibir devolución

> Refs: UC-011, API-002-05, BDD-UC-011 (AC-011-01..07), INV-RES-005, INV-RES-009, INV-MUL-001, INV-MUL-004, INV-SEC-003, RN-012, RN-014, RN-015, RN-022, ADR-004, ADR-005, SM-001, SM-002
> Techniques: EP, BVA, decision table, state transition, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| reservationId | VO-001 | existente | inexistente | — |
| estado | SM-001 | Prestada | Reservada, Cancelada (`E_NO_PRESTADA`), Devuelta (replay) | — |
| lateDays = returnedOn − endDate | entero | 0 (a tiempo), ≥ 1 (multa) | < 0 (devuelta antes del fin) | −1, 0, 1 |
| rol | sesión | encargado | socio, junta | — |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Prestada hasta 12-07; devolución 12-07 (lateDays 0) | ok · "Devuelto a tiempo"; sin `fine` · Devuelta, sin multa; Lucía ve "No tienes multas" | boundary | AC-011-01, RN-014 |
| T02 | devolución 12-08 (lateDays 1) | ok · "Devuelto con 1 día de retraso: multa de 2 €" · Devuelta; multa Pendiente de `FINE_PER_DAY_EUR`×1 | boundary | AC-011-03, RN-015 |
| T03 | devolución 12-10 (lateDays 3) | ok · "Devuelto con 3 días de retraso: multa de 6 €" · Devuelta; multa Pendiente 6 € | happy | AC-011-02, INV-MUL-001 |
| T04 | expand: BVA(lateDays=2, lateDays=30) importe | amountEur = `FINE_PER_DAY_EUR` × lateDays, una multa Pendiente | derived | INV-MUL-001, INV-MUL-004 |
| T05 | tras T03 se envía "Devolver" otra vez | `E_YA_DEVUELTA` · "Ya estaba devuelta" · una sola multa Pendiente de 6 €, mismo importe | replay | AC-011-04, INV-RES-009 |
| T06 | expand: enum(Reservada, Cancelada) | `E_NO_PRESTADA` · "No se puede devolver: la reserva no está entregada" · sin cambios, sin multa | error | AC-011-05 |
| T07 | reservationId inexistente | `E_RESERVA_NO_ENCONTRADA` · "La reserva no existe" · sin cambios | error | AC-011-06 |
| T08 | expand: enum(socio, junta) intenta devolver | `E_ACCESO_DENEGADO` · "Acceso denegado" · sin cambios | error | AC-011-07, INV-SEC-003 |
| T09 | almacén falla al guardar con lateDays 3 | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · sigue Prestada, sin multa | error | D-T-002, ADR-004 |
| T10 | tras T01/T03, disponibilidad del material | las unidades quedan libres desde la devolución | derived | INV-RES-005 |
| T11 | tras T03, "Multas" del encargado y "Mis multas" de Lucía | una fila "Lucía Gil — Multa de 6 € — Pendiente" | derived | INV-MUL-001, SM-002 |
| T12 | dos encargados devuelven a la vez con lateDays 3 | uno ok; el otro `E_YA_DEVUELTA` · una sola multa de 6 € | race | AC-011-04, INV-MUL-001 |
| T13 | devolución antes de endDate (lateDays < 0) | undefined in spec | boundary | — |

## State Transitions

| SM | From | Event / guard | To | Postcondition (≤ 80 chars) | Cases |
|----|------|---------------|----|----------------------------|-------|
| SM-001 | Prestada | devolver | Devuelta | `returnedOn`=hoy; unidades libres | T01, T10 |
| SM-001 | Prestada | devolver; lateDays > 0 | Devuelta | además crea la multa en la misma operación | T02, T03, T04 |
| SM-001 | Devuelta | devolver (replay) | Devuelta | sin cambios; una multa | T05, T12 |
| SM-001 | Reservada/Cancelada | devolver | igual | sin cambios; sin multa | T06 |
| SM-002 | (ninguna) | devolver con lateDays > 0 | Pendiente | multa nueva con importe fijo | T03, T11 |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-011-01 | Devolución antes de endDate (lateDays < 0): RN-014 solo fija 0 y > 0 | Definir "a tiempo" para negativos |
| F-011-02 | Precedencia E_YA_DEVUELTA vs E_NO_PRESTADA no explícita (CON-005); E3 solo cita Reservada y Cancelada | Documentar orden y estados de E3/E4 |
