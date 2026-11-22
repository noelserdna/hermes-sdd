# Test Matrix: UC-012 — Ver mis multas

> Refs: UC-012, API-004-01, BDD-UC-012 (AC-012-01..04), INV-SEC-001, INV-MUL-001, INV-MUL-002, RN-016, RN-020, RN-030, SM-002
> Techniques: EP, BVA, decision table, replay (exenta, D-T-008) · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| sesión (rol) | session | socio | encargado, junta, sin sesión | — |
| multas de la cuenta | count × FINE_STATUS | 0; ≥1 Pendiente; ≥1 Pagada; mezcla | — | 0 / 1 / varias |
| multas de otras cuentas | count | 0; ≥1 | — | 0 / ≥1 (INV-SEC-001) |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | socio con 1 multa Pendiente (ej. 6 €) | ok · "Multa de 6 € — Pendiente" · sin cambios | happy | AC-012-01 |
| T02 | socio sin multas y nadie más con multas | ok · "No tienes multas" · sin cambios | boundary | AC-012-02 |
| T03 | socio sin multas; otro socio con 1 Pendiente | ok · "No tienes multas", ninguna fila del otro · sin cambios | state | AC-012-03, INV-SEC-001 |
| T04 | sesión de encargado | `E_PAGINA_PROHIBIDA` · "No tienes permiso para ver esta página" · ninguna multa visible | error | AC-012-04, RN-030 |
| T05 | sesión de junta (expand: enum(encargado, junta)) | `E_PAGINA_PROHIBIDA` · mensaje del catálogo · ninguna multa | error | AC-012-04, RN-030 |
| T06 | socio con Pendiente + Pagada | ok · una fila por multa con importe y estado correctos · sin cambios | derived | AC-012-01, RN-016, SM-002 |
| T07 | socio con multas propias y de otros | ok · solo las de la cuenta de sesión; ninguna de otro · sin cambios | derived | AC-012-03, INV-SEC-001 |
| T08 | sin sesión | muestra Entrar, ninguna multa · sin cambios | derived | RN-020 |
| T09 | almacén caído al leer | `undefined in spec` (mensaje de lectura no definido) | error | — |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-012-01 | UC-012 cita `E_ALMACEN_NO_DISPONIBLE` pero API-004-01 no lo lista y su mensaje es de guardado | Definir error y mensaje de lectura, o quitar la cita |
