# Test Matrix: UC-007 — Reservar material

> Refs: UC-007, API-002-01, API-003-03, BDD-UC-007 (AC-007-01..11), INV-RES-001..005, INV-MUL-002, INV-MAT-003, RN-009, RN-010, RN-012, RN-034, SM-001
> Techniques: EP, BVA, decision table, state transition, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| itemId | VO-001 | tipo con unidades > 0 | tipo con 0 unidades (no ofrecido) | total 0 / 1 |
| quantity | VO-006 | entero 1..`MAX_UNITS_PER_RESERVATION` | > máximo; 0, negativo, no entero | 0, 1, máx, máx+1 |
| startDate | Day | hoy ≤ inicio | anterior a hoy; vacía o no válida | hoy−1, hoy |
| endDate | Day | inicio ≤ fin, duración ≤ `MAX_RESERVATION_DAYS` | fin < inicio; duración > máximo; vacía | fin=inicio, duración máx, máx+1 |
| multas del socio | estado | ninguna Pendiente; Pagada | alguna Pendiente | 1 Pendiente, 0 tras pagar |
| rol | ROLES | socio | encargado, junta | — |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Casco 6 uds libres; socio reserva 2, 2026-12-05..07 | ok · `Reservada` · "Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07" en Mis reservas | happy | AC-007-01 |
| T02 | Tienda 2 uds, 1 reservada 12-05..07; otro socio pide 2, 12-06..08 | `E_SIN_UNIDADES` · "solo queda 1 de Tienda el 2026-12-06" · sin reserva | error | AC-007-02, RN-009 |
| T03 | Linterna 3 uds, socio ya reservó 2; mismo formulario otra vez | `E_SIN_UNIDADES` · "solo queda 1 de Linterna el 2026-12-05" · una sola fila | replay | AC-007-03, RN-012 |
| T04 | Mismo formulario repetido cuando caben ambas | ok · segunda reserva distinta; `Reservada` ambas | replay | UC-007 E8, RN-012 |
| T05 | Inicio 2026-11-21 (hoy 2026-11-22) | `E_FECHA_PASADA` · "La fecha de inicio no puede ser pasada" · sin reserva | error | AC-007-04, INV-RES-001 |
| T06 | Inicio = hoy 2026-11-22 | ok · `Reservada` | boundary | INV-RES-001 |
| T07 | Inicio 12-05, fin 12-01 | `E_FECHA_FIN_ANTERIOR` · "La fecha de fin no puede ser anterior a la de inicio" | error | AC-007-05 |
| T08 | expand: BVA(duración 1, máx 14 ok; 15 falla) | 14 días ok; 15 `E_MAX_DIAS` · "Máximo 14 días por reserva" | boundary | AC-007-06, INV-RES-002 |
| T09 | expand: BVA(quantity 1, 5 ok; 6 falla) | 6 `E_MAX_UNIDADES` · "Máximo 5 unidades por reserva"; 1 y 5 ok | boundary | AC-007-07, INV-RES-003 |
| T10 | expand: enum(quantity 0, -1, 1.5) | `E_CANTIDAD_INVALIDA` · "La cantidad debe ser un número entero de 1 o más" | error | RN-034 |
| T11 | expand: enum(fecha vacía, no válida) | `E_FECHA_INVALIDA` · "Elige una fecha válida" | error | RN-034 |
| T12 | Inicio pasado y fin anterior a inicio a la vez | `E_FECHA_PASADA` (precede) | error | UC-007 paso 4, D-T-006 |
| T13 | Duración > máx y cantidad 6 a la vez | `E_MAX_DIAS` precede a `E_MAX_UNIDADES` | error | UC-007 paso 4, D-T-006 |
| T14 | Cantidad 6 y sin unidades libres | `E_MAX_UNIDADES` precede a `E_SIN_UNIDADES` | error | UC-007 paso 4-5, D-T-006 |
| T15 | Multa Pendiente 6 EUR, sin reservas | `E_MULTA_PENDIENTE` · "No puedes reservar hasta pagar tu multa de 6 €" · "Aún no tienes reservas" | error | AC-007-08, INV-MUL-002 |
| T16 | Multa Pendiente 2 EUR | `E_MULTA_PENDIENTE` · "...multa de 2 €" | error | AC-007-09 |
| T17 | Multa Pendiente y fecha pasada | `E_MULTA_PENDIENTE` precede a validación de fechas | error | UC-007 paso 3, RN-016 |
| T18 | Multa pagada (ya no hay Pendientes) | ok · `Reservada` | derived | UC-007 ext. 3a, INV-MUL-003 |
| T19 | Multa Pendiente; reservas previas del socio | reservas previas siguen `Reservada` | derived | INV-MUL-002 |
| T20 | Casco 6 uds y Cuerda 0; abrir Reservar | lista con Casco, sin Cuerda | boundary | AC-007-10, INV-MAT-003 |
| T21 | Faltan unidades solo un día intermedio | `E_SIN_UNIDADES` · cita el primer día con falta | error | AC-007-02, INV-RES-004 |
| T22 | Reservas Cancelada/Devuelta del rango | no ocupan: reserva ok | derived | INV-RES-005 |
| T23 | Dos socios reservan la última unidad a la vez | uno ok; otro `E_SIN_UNIDADES`; nunca sobreventa | race | UC-007 E7, INV-RES-004 |
| T24 | Rol encargado/junta abre o envía Reservar | `E_PAGINA_PROHIBIDA` / `E_ACCESO_DENEGADO` · sin reserva | error | AC-007-11, RN-020 |
| T25 | Almacén falla al guardar | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · sin reserva | error | D-T-002 |

## State Transitions

| SM | From | Event / guard | To | Postcondition (≤ 80 chars) | Cases |
|----|------|---------------|----|----------------------------|-------|
| SM-001 | (inicial) | reservar; sin multa, fechas y unidades válidas | Reservada | unidades apartadas cada día | T01, T06, T18 |
| SM-001 | (ninguna) | reservar con guarda fallida | — | ninguna reserva creada | T02, T05, T15, T23 |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-007-01 | RN-034 (`E_CANTIDAD_INVALIDA`, `E_FECHA_INVALIDA`) sin AC y PENDING REQ; orden respecto a paso 4 no fijado | Añadir AC y orden |
| F-007-02 | UC-007 E8 con espacio libre crea segunda reserva sin AC propio | Añadir AC |
