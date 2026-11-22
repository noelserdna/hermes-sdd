# Test Matrix: UC-018 — Consultar historial de un socio

> Refs: UC-018, API-001-07, BDD-UC-018 (AC-018-01..06), INV-SEC-001, INV-SEC-002, RN-019, RN-020, RN-028
> Techniques: EP, BVA, decision table, replay (exenta, D-T-008) · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| sesión (rol) | session | junta | socio, encargado, sin sesión | — |
| query | string | nombre o correo parcial, sin distinguir mayúsculas | sin coincidencia; vacía | 0 / 1 / varios resultados |
| accountId (VO-001) | id | de un resultado listado | inexistente | — |
| historial del socio | loans, fines | con préstamo y multa; sin nada | — | 0 / ≥1 |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Lucía devolvió 2 × Casco tarde y pagó su multa; junta busca "lucia" | ok · "2 × Casco del 2026-12-05 al 2026-12-07 — devuelto el 2026-12-09" y "Multa de 4 € — Pagada" · sin cambios | happy | AC-018-01 |
| T02 | socio sin préstamos ni multas | ok · "Sin préstamos ni multas" · sin cambios | boundary | AC-018-02 |
| T03 | query "zzz" | `E_BUSQUEDA_VACIA` · "Ningún socio coincide" · sin historial | error | AC-018-03 |
| T04 | historial mostrado | ok · sin botones "Entregar", "Devolver", "Marcar pagada" ni "Cancelar" | state | AC-018-04, INV-SEC-002 |
| T05 | dos socios con "ma" en el nombre; query "MA" | ok · lista para elegir; sin historial hasta elegir | boundary | AC-018-05, RN-019 |
| T06 | sesión de socio busca historial de otro (expand: enum(socio, encargado)) | `E_ACCESO_DENEGADO` · "Acceso denegado" · sin datos de ningún socio | error | AC-018-06, RN-028 |
| T07 | junta intenta operación de gestión (entregar, devolver, pagar) | `E_ACCESO_DENEGADO` · mensaje del catálogo · sin cambios | error | AC-018-06, INV-SEC-002 |
| T08 | junta abre la página siendo socio o encargado | `E_PAGINA_PROHIBIDA` · "No tienes permiso para ver esta página" · sin datos | error | AC-018-06, RN-020 |
| T09 | query por correo parcial en mayúsculas | ok · encuentra al socio | derived | AC-018-05, RN-019 |
| T10 | historial de un socio con datos de otro socio en el sistema | ok · solo préstamos y multas del elegido | derived | INV-SEC-001, AC-018-01 |
| T11 | almacén caído al buscar | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · sin cambios | error | D-T-002, API-001-07 |
| T12 | sin sesión | muestra Entrar · sin datos | derived | RN-020 |
| T13 | query vacía o solo espacios | `undefined in spec` | boundary | — |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-018-01 | Query vacía o solo espacios no tiene resultado definido (¿todos o `E_BUSQUEDA_VACIA`?) | Definir semántica en UC-018 |
| F-018-02 | `E_ALMACEN_NO_DISPONIBLE` en lectura usa mensaje "No se pudo guardar" | Mensaje de lectura propio |
