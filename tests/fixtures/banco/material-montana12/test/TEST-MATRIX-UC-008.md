# Test Matrix: UC-008 — Ver mis reservas

> Refs: UC-008, API-002-02, BDD-UC-008 (AC-008-01..05), INV-RES-005, INV-RES-006, INV-RES-010, RN-011, RN-020, ADR-002, SM-001
> Techniques: EP, BVA, decision table · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| sesión | cuenta | socio con sesión | encargado, junta | — |
| reservas de la cuenta | lista | 0, 1, varias; cualquier estado de RESERVATION_STATUS | reserva de otra cuenta | 0 reservas |
| hoy vs startDate | Day | hoy < inicio (cancelable) | hoy = inicio; hoy > inicio | inicio = hoy−1, hoy, hoy+1 |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Lucía 2 × Casco 12-05..07; Pablo 1 × Tienda; Lucía abre (hoy 2026-12-04) | una fila "2 × Casco del 2026-12-05 al 2026-12-07 — Reservada" con Cancelar; sin la de Pablo | happy | AC-008-01, INV-RES-010 |
| T02 | Lucía pide una reserva de Pablo | `E_ACCESO_DENEGADO` · "Acceso denegado" · sin datos ajenos | error | AC-008-01, INV-SEC-001 |
| T03 | Hoy 2026-12-05, reserva empieza 12-05 | fila "No se puede cancelar: empieza hoy" (`E_EMPIEZA_HOY`) sin botón Cancelar | boundary | AC-008-02, INV-RES-006 |
| T04 | Hoy 2026-12-04, inicio 12-05 | botón Cancelar presente | boundary | INV-RES-006, RN-011 |
| T05 | Hoy 2026-12-06, inicio 12-05, Reservada | sin botón Cancelar; motivo en la fila | derived | INV-RES-006, RN-011 |
| T06 | Socia nueva sin reservas | "Aún no tienes reservas" | boundary | AC-008-03 |
| T07 | Pablo sin reservas, Lucía con una | "Aún no tienes reservas" para Pablo | boundary | AC-008-04, INV-RES-010 |
| T08 | expand: enum(Reservada, Prestada, Devuelta, Cancelada) | cada fila muestra su estado; Cancelar solo si Reservada y hoy < inicio | state | INV-RES-006, SM-001 |
| T09 | Reservada con fin anterior a hoy (No recogida) | fila con estado «No recogida» | derived | ADR-002, INV-RES-008 |
| T10 | Encargado o junta abre Mis reservas | `E_PAGINA_PROHIBIDA` · "No tienes permiso para ver esta página" · sin lista | error | AC-008-05, RN-020 |
| T11 | Abrir y recargar Mis reservas | sin cambios de estado ni de unidades | derived | API-002-02, INV-RES-010 |
| T12 | Almacén no disponible al leer | `undefined in spec` | error | — |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-008-01 | UC-008 cita E_ALMACEN_NO_DISPONIBLE pero sin fila de excepción; D-T-002 solo cubre escrituras | Fijar resultado de lectura |
| F-008-02 | AC-008-01 "pedir una reserva ajena": API-002-02 no tiene entrada reservationId | Aclarar operación |
| F-008-03 | Texto de motivo en fila para inicio pasado (hoy > inicio) no definido; solo AC-008-02 (hoy) | Añadir AC |
