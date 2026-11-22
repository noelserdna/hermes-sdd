# Test Matrix: UC-016 — Retirar unidades rotas

> Refs: UC-016, API-003-02, BDD-UC-016 (AC-016-01..05), INV-MAT-001, INV-MAT-002, INV-RES-004, INV-RES-005, INV-SEC-003, RN-012, RN-017, RN-020, RN-022
> Techniques: EP, BVA, decision table, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| itemId | ItemId (VO-001) | tipo existente | inexistente (sin definir) | — |
| quantity | Quantity (VO-006) | entero ≥ 1 y ≤ total y ≤ libres cada día | 0, negativo, decimal; > total; > libres algún día | 0 / 1; n = total; n = libres; n = libres + 1 |
| ocupadas | reservas Reservada/Prestada (INV-RES-005) | ninguna; futuras; Prestada vencida | — | día de hoy; último día futuro |
| rol | sesión | encargado | socio, junta | — |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | "Cuerda" 6 sin reservas; retira 1 | OK · "Cuerda: 5 unidades" · total 5 | happy | AC-016-01 |
| T02 | "Tienda" 2, ambas reservadas 2026-12-06; retira 1 | `E_BAJA_UNIDADES_NECESARIAS` · "No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06" · total 2 | error | AC-016-02, INV-MAT-002 |
| T03 | "Cuerda" 1; retira 1 y repite la misma baja (stock 0) | 2.º: `E_BAJA_UNIDADES_INSUFICIENTES` · "No hay tantas unidades para dar de baja" · total 0 | replay | AC-016-03, RN-012 |
| T04 | expand: BVA(quantity: 0, -1, 1.5, "abc") | `E_CANTIDAD_INVALIDA` · "La cantidad debe ser un número entero de 1 o más" · sin cambios | error | AC-016-04, RN-017 |
| T05 | expand: enum(socio, junta) retira 1 Cuerda | `E_PAGINA_PROHIBIDA` o `E_ACCESO_DENEGADO` · sin cambios | error | AC-016-05, RN-020, INV-SEC-003 |
| T06 | "Cuerda" 6 sin reservas; retira 6 (n = total) | OK · "Cuerda: 0 unidades" · no reservable | boundary | INV-MAT-001, INV-MAT-003 |
| T07 | "Cuerda" 6; retira 7 (n = total + 1) | `E_BAJA_UNIDADES_INSUFICIENTES` · sin cambios | boundary | AC-016-03, INV-MAT-001 |
| T08 | "Tienda" 3, 2 reservadas un día futuro; retira 1 (= libres) | OK · total 2 | boundary | INV-MAT-002 |
| T09 | Igual que T08; retira 2 (libres + 1) | `E_BAJA_UNIDADES_NECESARIAS` · cita ese día · total 3 | boundary | AC-016-02, INV-MAT-002 |
| T10 | Reservas en dos días futuros que fallan; retira n | `E_BAJA_UNIDADES_NECESARIAS` · cita el primer día (el más cercano) | derived | UC-016 E4, RN-017 |
| T11 | Reserva solo hoy (2026-11-22) ocupa todas; retira 1 | `E_BAJA_UNIDADES_NECESARIAS` · día 2026-11-22 · sin cambios | boundary | INV-MAT-002, RN-022 |
| T12 | Reserva Cancelada, Devuelta o No recogida (ocupa 0); retira todas | OK · total 0 | derived | INV-RES-005 |
| T13 | Préstamo Prestado vencido ocupa todas; retira 1 | `E_BAJA_UNIDADES_NECESARIAS` · sin cambios | derived | INV-RES-005, INV-MAT-002 |
| T14 | "Tienda" 2, 1 libre; baja 1 y reserva de la última libre a la vez | Una sola gana: baja OK y reserva `E_SIN_UNIDADES`, o `E_BAJA_UNIDADES_NECESARIAS` y reserva OK; nunca total − n < ocupadas | race | AC-016-02, INV-RES-004 |
| T15 | Baja repetida con stock restante (6 → 5 → 4) | Cada envío resta otra vez · total 4; sin aviso | replay | UC-016 E3, RN-012 |
| T16 | quantity 0 y quantity > total a la vez | `E_CANTIDAD_INVALIDA` (validación paso 2 antes del paso 3) | error | UC-016 flujo 2-3, RN-017 |
| T17 | itemId inexistente; retira 1 | undefined in spec · sin cambios | error | — |
| T18 | Almacén caído (D-T-002); retira 1 | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · sin cambios | error | D-T-002 |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-016-01 | itemId inexistente: ningún error definido en API-003-02 ni en UC-016 | Añadir excepción y código |
| F-016-02 | AC-016-03 solo cubre stock 0; con stock restante la baja repetida resta (E3) sin AC | Añadir AC para baja repetida con stock |
| F-016-03 | Alcance de "cada día desde hoy": ¿hasta qué día futuro se comprueba? Sin tope en INV-MAT-002 | Fijar horizonte o "todas las reservas vivas" |
