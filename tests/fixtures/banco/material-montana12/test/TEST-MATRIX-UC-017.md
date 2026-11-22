# Test Matrix: UC-017 — Ver panel del encargado

> Refs: UC-017, API-002-06, BDD-UC-017 (AC-017-01..09), INV-RES-007, INV-RES-008, INV-MUL-004, INV-SEC-003, RN-015, RN-018, RN-020, RN-022, RN-029, RN-032, ADR-002, ADR-004
> Techniques: EP, BVA, decision table · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| date | Day? (VO-005) | omitida (hoy), fecha elegida | vacía, no válida | — |
| rol | sesión | encargado | socio, junta, sin sesión | — |
| Reservada vs hoy | fechas | startDate ≤ hoy ≤ endDate (Por entregar) | endDate < hoy (No recogida) | hoy = startDate, hoy = endDate, endDate+1, `NOT_COLLECTED_VISIBLE_DAYS` |
| Prestada vs hoy | fechas | endDate ≥ hoy | endDate < hoy (retraso) | endDate = hoy, retraso 1 y 3 días |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Prestada 2×Casco hasta 12-07; abre 12-05 | "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07" | happy | AC-017-01 |
| T02 | abre 12-07 (endDate = hoy) | "Vuelven hoy" + la fila del préstamo; sin retraso | boundary | AC-017-02, RN-018 |
| T03 | elige 2026-12-07 el 12-05 | "Vuelven el 2026-12-07" + la fila del préstamo | happy | AC-017-03 |
| T04 | no hay préstamos | "No hay material prestado" | boundary | AC-017-04 |
| T05 | Reservada desde 12-05; abre 12-05 (hoy = startDate) | "Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05" y botón "Entregar" | boundary | AC-017-05, INV-RES-007 |
| T06 | Reservada con startDate < hoy ≤ endDate | aparece en Por entregar con "Entregar" | derived | RN-018, INV-RES-007 |
| T07 | expand: enum(socio, junta) abre "/panel" | `E_PAGINA_PROHIBIDA` · "No tienes permiso para ver esta página" · sin datos del panel | error | AC-017-06, AC-017-07 |
| T08 | sin sesión abre "/panel" | formulario Entrar; sin datos del panel | error | RN-020 |
| T09 | Prestada hasta 12-07, sin devolver; abre 12-10 | "Retraso: 3 días" junto al préstamo; Lucía ve "No tienes multas"; sin multa creada | boundary | AC-017-08, INV-MUL-004, ADR-004 |
| T10 | abre 12-08 (retraso 1) | "Retraso: 1 día" | boundary | AC-017-09, RN-015 |
| T11 | Prestada con endDate = hoy | sin marca "Retraso" | boundary | INV-MUL-004, RN-018 |
| T12 | expand: enum(vacía, no válida) en el selector | `E_FECHA_INVALIDA` · "Elige una fecha válida" · el panel sigue con la lista de hoy | error | RN-032 |
| T13 | Reservada con endDate < hoy dentro de `NOT_COLLECTED_VISIBLE_DAYS` | fila "No recogida" sin botón "Entregar"; unidades libres | derived | RN-029, INV-RES-008, ADR-002 |
| T14 | Reservada con endDate < hoy − `NOT_COLLECTED_VISIBLE_DAYS` | undefined in spec | boundary | — |
| T15 | fecha elegida ≠ hoy: ¿"Por entregar" y "Retraso" usan hoy o la fecha elegida? | undefined in spec | boundary | — |
| T16 | almacén no disponible al abrir el panel | undefined in spec | error | — |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-017-01 | Con fecha elegida ≠ hoy, Por entregar y Retraso: ¿referencia hoy o la fecha? UC-017 paso 4a solo agrupa (SIL-006) | Definir la referencia de cada lista |
| F-017-02 | `NOT_COLLECTED_VISIBLE_DAYS`: no fija si el día 7 tras el fin aún se lista (RN-029) | Fijar borde inclusivo o exclusivo |
| F-017-03 | UC-017 cita `E_ALMACEN_NO_DISPONIBLE` sin fila de excepción para la lectura | Añadir fila o quitar la cita |
