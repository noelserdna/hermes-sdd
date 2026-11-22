# Test Matrix: UC-019 — Depurar historial antiguo

> Refs: UC-019, API-002-07, BDD-UC-019 (AC-019-01..03), INV-RES-011, RN-021, RN-022, RN-033
> Techniques: EP, BVA, decision table, replay · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| today | Day (VO-005) | 2026-11-22 (reloj inyectado) | — | límite = hoy − `RETENTION_YEARS` años = 2023-11-22 |
| endDate (reserva/préstamo cerrado) | Day | anterior al límite; posterior | — | límite − 1 día; límite; límite + 1 día |
| estado | SM reserva / multa | Devuelta, Cancelada, No recogida; multa Pagada | vivos: Reservada, Prestada; multa Pendiente | — |
| creación de multa | Day | anterior al límite; posterior | — | límite − 1 día; límite |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Préstamos cerrados con endDate 2023-11-01 y 2025-01-10 | Borra el de 2023-11-01 · el de 2025-01-10 sigue · `deletedReservations` 1 | happy | AC-019-01, INV-RES-011 |
| T02 | Préstamo cerrado con endDate 2023-11-22 (= límite) | Se conserva · recuentos 0 | boundary | AC-019-02 |
| T03 | Cerrado con endDate 2023-11-21 (límite − 1 día) | Se borra · `deletedReservations` 1 | boundary | AC-019-01, INV-RES-011 |
| T04 | Segunda ejecución el mismo día tras T01 | Recuentos 0 · datos sin cambios | replay | AC-019-03 |
| T05 | expand: enum(Devuelta, Cancelada, No recogida) con endDate 2023-01-01 | Se borra cada una | derived | INV-RES-011, RN-033 |
| T06 | expand: enum(Reservada, Prestada) con endDate 2023-01-01 (sin cerrar) | No se borra · recuento 0 | derived | RN-033, INV-RES-011 |
| T07 | Multa Pagada creada 2023-11-21 | Se borra · `deletedFines` 1 | derived | RN-021, RN-033 |
| T08 | Multa Pagada creada 2023-11-22 (= límite) | undefined in spec (borde de multas; extensión 3a solo cita endDate) | boundary | — |
| T09 | Multa Pendiente creada 2022-01-01 | No se borra · `deletedFines` 0 | derived | RN-033 |
| T10 | Multa Pagada de un préstamo no borrado | undefined in spec (¿se borra la multa suelta?) | derived | — |
| T11 | Sin registros antiguos | `deletedReservations` 0 · `deletedFines` 0 · sin cambios | derived | UC-019 flujo 5 |
| T12 | Mezcla: 2 cerradas antiguas, 1 viva antigua, 1 multa Pagada antigua, 1 reciente | Recuentos 2 y 1 · el resto intacto | derived | UC-019 postcondición |
| T13 | today = 2028-02-29, endDate 2025-02-28 y 2025-03-01 | Límite 2025-02-28 (hoy − 3 años) · el primero se conserva; resto según borde (sin definir) | boundary | — |
| T14 | Almacén caído (D-T-002) durante la depuración | Error `E_ALMACEN_NO_DISPONIBLE` · nada borrado a medias · reintento en la siguiente ejecución | error | UC-019 postcondición fallo, D-T-002 |
| T15 | Depuración y cancelación/devolución de un registro a la vez | undefined in spec | race | — |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-019-01 | Borde de multas (creación = límite) no fijado; solo AC-019-02 cubre endDate | Añadir AC para multa en el límite |
| F-019-02 | Multa Pagada cuyo préstamo sigue vivo/reciente: sin regla de dependencia | Aclarar si la multa se depura sola |
| F-019-03 | Depuración vs escritura concurrente del mismo registro: sin regla | Añadir regla o declarar no aplicable |
| F-019-04 | Fallo del almacén sin AC ni código en la tabla de excepciones (solo postcondición) | Añadir fila E2 y AC |
| F-019-05 | Aritmética "hoy − 3 años" para 29-feb sin definir | Fijar regla de calendario |
