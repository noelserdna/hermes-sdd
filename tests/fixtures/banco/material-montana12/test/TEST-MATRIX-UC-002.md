# Test Matrix: UC-002 — Salir

> Refs: UC-002, API-001-02, API-001-08, BDD-UC-002 (AC-002-01..03), INV-SOC-005, INV-SEC-001, RN-003, RN-020
> Techniques: EP, decision table, replay · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| sesión | sesión actual | abierta (socio, encargado, junta) | ya cerrada; caducada; inexistente | — |
| navegación | acción | pulsar "Salir"; volver atrás tras salir | — | — |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | sesión abierta; expand: enum(socio, encargado, junta) | formulario "Entrar" · sesión invalidada en el servidor | happy | AC-002-01, RN-003 |
| T02 | tras Salir, reutilizar el identificador de sesión anterior | formulario "Entrar" · sin datos privados | derived | RN-003, RN-020 |
| T03 | tras Salir, volver atrás con el navegador | "Entrar" · sin reserva, multa ni nombre de socio en pantalla | state | AC-002-02, INV-SEC-001 |
| T04 | sesión ya invalidada, vuelve atrás y abre página privada | formulario "Entrar" · sin cambios | state | AC-002-02, RN-020 |
| T05 | sesión ya cerrada, pulsa "Salir" otra vez | formulario "Entrar" · sin cambios | replay | AC-002-03, D-T-007 |
| T06 | sin sesión, pulsa "Salir" | formulario "Entrar" · sin error ni cambios | replay | AC-002-03 |
| T07 | sesión caducada por inactividad, pulsa "Salir" | formulario "Entrar" · sin error | derived | INV-SOC-005, AC-002-03 |
| T08 | almacén no disponible al salir | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · la sesión sigue abierta hasta caducar | error | UC-002 Postconditions, D-T-002 |
| T09 | dos pestañas con la misma sesión; "Salir" en una, acción privada en la otra | formulario "Entrar" en ambas · sin datos | race | RN-003, RN-020 |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-002-01 | Mensaje mostrado de E_ALMACEN_NO_DISPONIBLE al salir (Failure) no tiene AC propio | Añadir AC-002-04 en BDD-UC-002 |
