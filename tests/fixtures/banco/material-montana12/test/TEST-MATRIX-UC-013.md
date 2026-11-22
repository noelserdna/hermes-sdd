# Test Matrix: UC-013 — Marcar multa pagada

> Refs: UC-013, API-004-02, BDD-UC-013 (AC-013-01..05), INV-MUL-002, INV-MUL-003, INV-SEC-003, RN-012, RN-016, ADR-005, SM-002
> Techniques: EP, BVA, decision table, state transition, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| rol de sesión | role | encargado | socio, junta, sin sesión | — |
| fineId (VO-001) | id | multa Pendiente | inexistente; ya Pagada | — |
| multas Pendientes del socio | count | 1 (la pagada); ≥2 | — | 1 / 2 |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | socio con 1 multa Pendiente (ej. 6 €); encargado paga | ok · "Multa pagada", `paidOn` = hoy, `memberBlocked=false` · multa Pagada; el socio reserva | happy | AC-013-01, INV-MUL-003 |
| T02 | multa recién pagada; se envía "Marcar pagada" otra vez | `E_MULTA_YA_PAGADA` · "La multa ya estaba pagada" · sigue Pagada, una sola fila, `paidOn` intacto | replay | AC-013-02, ADR-005 |
| T03 | socio con 2 Pendientes; paga la más reciente | ok · "Multa pagada", `memberBlocked=true` · bloqueo cita la más antigua | boundary | AC-013-03, RN-016 |
| T04 | fineId inexistente | `E_MULTA_NO_ENCONTRADA` · "La multa no existe" · sin cambios | error | AC-013-04 |
| T05 | sesión de socio o junta (expand: enum(socio, junta)) | `E_ACCESO_DENEGADO` · "Acceso denegado" · multa sigue Pendiente | error | AC-013-05, INV-SEC-003 |
| T06 | dos encargados pagan la misma multa a la vez | uno ok; el otro `E_MULTA_YA_PAGADA` · una sola multa Pagada, un solo `paidOn` | race | AC-013-02, INV-MUL-003 |
| T07 | socio con 2 Pendientes; se pagan ambas en orden | tras la 1ª sigue bloqueado; tras la 2ª `memberBlocked=false` · reserva posible | derived | AC-013-03, INV-MUL-002, RN-016 |
| T08 | almacén caído al pagar (D-T-002) | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · multa Pendiente, bloqueo intacto | error | D-T-002, UC-013 Failure |
| T09 | pagar multa de un socio con reservas ya hechas | ok · las reservas existentes no cambian | derived | INV-MUL-002 |
| T10 | sin sesión | muestra Entrar · multa sin cambios | derived | RN-020 |

## State Transitions

| SM | From | Event / guard | To | Postcondition (≤ 80 chars) | Cases |
|----|------|---------------|----|----------------------------|-------|
| SM-002 | Pendiente | marcar pagada, encargado | Pagada | `paidOn` guardado; bloqueo según pendientes restantes | T01, T03, T07 |
| SM-002 | Pagada | marcar pagada (replay) | Pagada | sin cambios; `E_MULTA_YA_PAGADA` | T02, T06 |
| SM-002 | Pendiente | marcar pagada, rol no permitido o fallo almacén | Pendiente | sin cambios | T05, T08 |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-013-01 | API-004-02 no lista `E_ALMACEN_NO_DISPONIBLE`, aunque UC-013 y D-T-002 lo exigen | Añadirlo a Errors de API-004-02 |
