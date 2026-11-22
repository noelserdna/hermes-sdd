# Test Matrix: UC-014 — Ver todas las multas

> Refs: UC-014, API-004-03, BDD-UC-014 (AC-014-01..02), INV-SEC-003, INV-MUL-001, RN-020, RN-031, SM-002
> Techniques: EP, BVA, decision table, replay (exenta, D-T-008) · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| sesión (rol) | session | encargado | socio, junta, sin sesión | — |
| multas en el sistema | count × FINE_STATUS | 0; Pendientes; Pagadas; mezcla de varios socios | — | 0 / 1 / varias |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Pablo con Pendiente (ej. 6 €), Lucía con Pagada (ej. 2 €) | ok · "Pablo Sanz — Multa de 6 € — Pendiente" y "Lucía Gil — Multa de 2 € — Pagada" · sin cambios | happy | AC-014-01 |
| T02 | sesión de socio o junta (expand: enum(socio, junta)) | `E_PAGINA_PROHIBIDA` · "No tienes permiso para ver esta página" · ninguna multa visible | error | AC-014-02, INV-SEC-003 |
| T03 | no existe ninguna multa | ok · "No hay multas" · sin cambios | boundary | RN-031 |
| T04 | un socio con varias multas | ok · una fila por multa, sin agrupar ni repetir | derived | AC-014-01, INV-MUL-001 |
| T05 | sin sesión | muestra Entrar · ninguna multa | derived | RN-020 |
| T06 | almacén caído al leer | `undefined in spec` (error de lectura no definido) | error | — |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-014-01 | UC-014 cita `E_ALMACEN_NO_DISPONIBLE` pero API-004-03 no lo lista y su mensaje es de guardado | Definir error y mensaje de lectura, o quitar la cita |
