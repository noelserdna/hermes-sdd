# Test Matrix: UC-006 — Dar de baja socio

> Refs: UC-006, API-001-06, API-002-03, BDD-UC-006 (AC-006-01..07), INV-SOC-007, INV-SOC-008, INV-SOC-101, INV-RES-005, INV-SEC-003, RN-005, RN-006, RN-012, RN-020, RN-026, RN-027, SM-001, SM-003
> Techniques: EP, decision table, state transition, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| accountId (VO-001) | AccountId | socio Activa/Provisional sin préstamos ni multas | inexistente; ya de Baja | — |
| deuda del socio | préstamos Prestada, multas Pendiente | 0 y 0 | ≥1 préstamo; ≥1 multa; ambos | 0 / 1 |
| reservas del socio | Reservada | 0, futuras, en curso | — | startDate = hoy |
| sesión | rol | encargado | socio, junta | — |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Marta sin préstamos ni multas; encargado da de baja | OK · "Socio dado de baja: Marta Ruiz" · Activa → Baja; historial y correo conservados | happy | AC-006-01, RN-005 |
| T02 | Tras T01 Marta entra con su correo y contraseña | `E_CREDENCIALES` · "Correo o contraseña incorrectos" | state | AC-006-02, INV-SOC-008 |
| T03 | Marta con sesión abierta; se da de baja; hace otra petición | sesión cerrada · formulario Entrar | state | RN-026 |
| T04 | Marta con 2 × Casco 2026-12-05..07; baja; Lucía reserva lo mismo | OK · reserva de Marta Cancelada · Lucía: "Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07" | state | AC-006-03, INV-SOC-101 |
| T05 | Reserva Reservada con startDate = hoy (sin guarda de fecha) | OK · baja y reserva Cancelada | boundary | INV-SOC-101, SM-001 |
| T06 | Socio Provisional sin deudas | OK · Provisional → Baja | state | SM-003 |
| T07 | Lucía con 1 préstamo sin devolver | `E_BAJA_PRESTAMOS` · "No se puede dar de baja: tiene material sin devolver" · "Lucía Gil — Activo"; sin cancelaciones | error | AC-006-04, INV-SOC-007 |
| T08 | Pablo con multa Pendiente de 4 € | `E_BAJA_MULTAS` · "No se puede dar de baja: tiene multas sin pagar" · cuenta activa | error | AC-006-05, INV-SOC-007 |
| T09 | Socio con préstamo sin devolver y multa Pendiente | `E_BAJA_PRESTAMOS` · sin cambios (gana préstamos) | error | RN-006 |
| T10 | Préstamo sin devolver + reservas Reservada | `E_BAJA_PRESTAMOS` · reservas siguen Reservada | error | AC-006-04 |
| T11 | Sesión de socio intenta dar de baja a Marta | `E_ACCESO_DENEGADO` · "Acceso denegado" · sin cambios | error | AC-006-06 |
| T12 | Sesión de junta intenta dar de baja | `E_ACCESO_DENEGADO` · sin cambios | error | INV-SEC-003, RN-020 |
| T13 | accountId inexistente | `E_SOCIO_NO_ENCONTRADO` · "El socio no existe o ya está de baja" · sin cambios | error | RN-027 |
| T14 | Marta ya de baja; el encargado repite la baja | `undefined in spec` (UC sin error y sin cambios; RN-027 `E_SOCIO_NO_ENCONTRADO`) | replay | — |
| T15 | Tras T14, ninguna reserva ni unidad cambia | sin cancelaciones adicionales | replay | AC-006-07 |
| T16 | Se entrega una reserva del socio durante la baja | `E_BAJA_PRESTAMOS` · cuenta activa; sin cancelaciones | race | AC-006-04, UC-006 E2 |
| T17 | Dos bajas simultáneas del mismo socio | `undefined in spec` | race | — |
| T18 | Fallo simulado del almacén en la baja | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · cuenta activa y reservas intactas | error | D-T-002, INV-SOC-007 |

## State Transitions

| SM | From | Event / guard | To | Postcondition (≤ 80 chars) | Cases |
|----|------|---------------|----|----------------------------|-------|
| SM-003 | Activa | baja, sin deudas | Baja | historial conservado; no entra | T01, T02 |
| SM-003 | Provisional | baja, sin deudas | Baja | igual que Activa | T06 |
| SM-003 | Activa | baja con préstamo o multa | Activa | sin cambios | T07-T10 |
| SM-003 | Baja | baja repetida | undefined in spec | conflicto UC-006 E4 / RN-027 | T14 |
| SM-001 | Reservada | baja del socio | Cancelada | libera unidades sin guarda de fecha | T04, T05 |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-006-01 | Baja repetida: UC-006 E4/AC-006-07 "sin error" vs RN-027 `E_SOCIO_NO_ENCONTRADO` (T14) | Decidir y alinear UC, BDD, RN y D-T-007 |
| F-006-02 | Dos bajas simultáneas del mismo socio sin resultado definido (T17) | Definir resultado, depende de F-006-01 |
