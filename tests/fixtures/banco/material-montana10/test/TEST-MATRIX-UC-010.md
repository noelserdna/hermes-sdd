# Test Matrix: UC-010 — Consultar historial
> Refs: UC-010, API-003-06, API-001-06, BDD-UC-010 (AC-010-01..06), INV-LOA-402, INV-ACC-008, RN-012, RN-016, RN-023, RN-024
> Techniques: EP, BVA, decision table, read-only (no replay rows: exempt D-T-008) · Default level: integration · Conventions: TEST-PLAN.md §3
## Inputs
| Input | Type | Valid classes | Invalid classes | Boundaries |
|---|---|---|---|---|
| sesión | rol | junta, encargado | socio; sin sesión; caducada | — |
| socioId | number (ENT-001) | socio existente con/sin historial | inexistente; no numérico | 0 / 1 reserva; 0 / 1 multa |
| estado reserva | VO-005 | Reservada, Prestada, Devuelta, Cancelada, No recogida | — | todos los estados |
| multa.estado | enum | Pendiente, Pagada | — | — |
## Cases
`Type`: happy · error · boundary · state · derived.
| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|---|---|---|---|---|
| T01 | Junta ana@club.es elige a Lucía: Piolet 2 del 12-05 al 12-07 Devuelta, multa 2 € Pagada | "Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta"; "Multa de 2 € · Pagada" | happy | AC-010-01 |
| T02 | Junta elige a Pablo sin préstamos ni multas | "Sin préstamos ni multas"; listas vacías | boundary | AC-010-02 |
| T03 | Junta con socio elegido | Sin botón editar, cancelar ni marcar; sin acciones | happy | AC-010-03 |
| T04 | Socio lucia@club.es abre Historial | `E_SIN_PERMISO` "No tienes permiso para ver esta pantalla"; sin historial | error | AC-010-04 |
| T05 | Encargado elige a Lucía con préstamo Devuelto | Ve el préstamo; sin cambios | happy | AC-010-05 |
| T06 | Junta elige socioId inexistente | `E_SOCIO_NO_ENCONTRADO` "El socio elegido no existe"; sin historial; puede elegir otro | error | AC-010-06 |
| T07 | Antes/después de consultar: snapshot de reservas y multas | Idénticos; nada cambia | derived | INV-LOA-402 |
| T08 | Socio con una reserva de cada estado (5) | Aparecen las 5 con su estado, no solo cerradas | boundary | RN-012 |
| T09 | Socio con multa Pendiente y otra Pagada | Ambas listadas con su estado | derived | RN-012 |
| T10 | Reserva sin unidad asignada (unidad null) | Se muestra el tipo de material, p. ej. "Piolet" | derived | RN-024 |
| T11 | Socio con 1 reserva y 0 multas | Lista la reserva; sin mensaje de vacío | boundary | AC-010-02 |
| T12 | Sin sesión | `E_NO_AUTENTICADO` "Entrar"; sin historial | derived | INV-ACC-008 |
| T13 | Sesión caducada | `E_SESION_CADUCADA` "Tu sesión ha caducado" | derived | INV-ACC-008 |
| T14 | Rol decisión: encargado / junta / socio | encargado y junta: historial sin acciones; socio: `E_SIN_PERMISO` | derived | INV-ACC-008 |
| T15 | Junta pide API-001-06 como selector | Lista nombre y correo, sin hash; no accede a Socios | derived | RN-023 |
| T16 | Socio pide API-001-06 | `E_SIN_PERMISO` | derived | RN-023 |
| T17 | socioId no numérico (p. ej. "abc") | undefined in spec | error | — |
| T18 | Historial de socio con datos > RETENTION_YEARS | undefined in spec | boundary | — |
| T19 | Precedencia: socio con socioId inexistente | `E_SIN_PERMISO` antes que `E_SOCIO_NO_ENCONTRADO` | derived | INV-ACC-008 |
## Findings for sdd-spec-auditor
| ID | Observation (≤120 chars) | Suggested action |
|---|---|---|
| F-010-01 | socioId no numérico: error no definido | Definir error |
| F-010-02 | Historial con RETENTION_YEARS (RN-013) sin criterio | Definir si se oculta |
| F-010-03 | Sin sesión: API-003-06 no lista E_NO_AUTENTICADO | Añadir a Errors |
| F-010-04 | Sin AC de orden del historial ni de multa Pendiente | Añadir AC |
