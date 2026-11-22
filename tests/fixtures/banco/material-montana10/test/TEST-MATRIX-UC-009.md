# Test Matrix: UC-009 — Ver entregas y devoluciones
> Refs: UC-009, API-003-05, BDD-UC-009 (AC-009-01..07), INV-LOA-401, INV-RES-007, INV-ACC-008, RN-001, RN-008, RN-009, RN-022
> Techniques: EP, BVA, decision table, read-only (no replay rows: exempt D-T-008) · Default level: integration · Conventions: TEST-PLAN.md §3
## Inputs
| Input | Type | Valid classes | Invalid classes | Boundaries |
|---|---|---|---|---|
| sesión | rol | encargado, junta | socio; sin sesión; caducada | — |
| hasta (Prestada) | Fecha | >= hoy (prestado); == hoy (vuelve hoy) | < hoy (con retraso) | hoy-1, hoy, hoy+1 |
| desde/hasta (Reservada) | Fecha | desde <= hoy <= hasta (entregar hoy) | desde > hoy; hasta < hoy (No recogida) | desde=hoy-1/hoy/hoy+1; hasta=hoy-1/hoy |
## Cases
`Type`: happy · error · boundary · state · derived. Hoy = 2026-12-07.
| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|---|---|---|---|---|
| T01 | Encargado; Piolet 2 de Lucía hasta 12-07, Casco 1 de Pablo hasta 12-09 | "Vuelve hoy: Piolet 2 · Lucía"; "Prestado: Casco 1 · Pablo · hasta 2026-12-09" | happy | AC-009-01 |
| T02 | Encargado; Cuerda 1 de Marta Prestada hasta 12-05 | "Con retraso: Cuerda 1 · Marta · 2 días" (diasRetraso=2, RN-009) | happy | AC-009-02 |
| T03 | Encargado; reserva Piolet de Lucía con desde 12-07 | "Entregar hoy: Piolet · Lucía" | happy | AC-009-03 |
| T04 | Encargado; ningún material Prestado | "No hay material prestado"; listas vacías | boundary | AC-009-04 |
| T05 | Junta ana@club.es; Casco 1 de Pablo hasta 12-09 | Ve "Prestado: Casco 1 · Pablo · hasta 2026-12-09"; acciones=false, sin botones entregar/devolver | happy | AC-009-05 |
| T06 | Socio lucia@club.es abre la pantalla | `E_SIN_PERMISO` "No tienes permiso para ver esta pantalla"; sin listas | error | AC-009-06 |
| T07 | Reservada de Lucía con hasta 12-06 | No aparece en "Entregar hoy"; estado sin cambios hasta ser No recogida | state | AC-009-07 |
| T08 | Prestada hasta == hoy (12-07) | En vuelveHoy; no en conRetraso | boundary | AC-009-01 |
| T09 | Prestada hasta 12-06 (hoy-1) | En conRetraso con 1 día; no en vuelveHoy | boundary | AC-009-02 |
| T10 | Prestada hasta 12-08 (hoy+1) | Solo prestado; no vuelveHoy ni conRetraso | boundary | AC-009-01 |
| T11 | Reservada desde 12-08 (hoy+1) | No en entregarHoy | boundary | AC-009-03 |
| T12 | Reservada desde 12-06 (anterior) y hasta 12-07 | En entregarHoy (desde <= hoy <= hasta, RN-022) | derived | RN-022 |
| T13 | Reservada hasta == hoy (12-07) | En entregarHoy; no es No recogida (hoy no posterior a hasta) | boundary | AC-009-07 |
| T14 | Reservada hasta 12-06: tras abrir pantalla, consultar estado | Sigue Reservada (la lectura no la transiciona); no ocupa unidades (RN-008) | derived | INV-RES-007 |
| T15 | Encargado: snapshot de reservas antes y después de abrir | Idénticos; ninguna reserva cambia (lectura pura) | derived | INV-LOA-401 |
| T16 | Sin sesión | `E_NO_AUTENTICADO` "Entrar"; sin listas | derived | INV-ACC-008 |
| T17 | Sesión caducada | `E_SESION_CADUCADA` "Tu sesión ha caducado"; sin listas | derived | INV-ACC-008 |
| T18 | Rol decisión: encargado / junta / socio | encargado: listas + acciones=true; junta: listas, acciones=false; socio: `E_SIN_PERMISO` | derived | INV-ACC-008 |
| T19 | Encargado con listas: botones | Botones entregar y devolver visibles solo para encargado | derived | INV-LOA-401 |
## Findings for sdd-spec-auditor
| ID | Observation (≤120 chars) | Suggested action |
|---|---|---|
| F-009-01 | Paso 4: vuelve hoy también está en prestado; AC-009-01 no dice si se duplica | Aclarar duplicado |
| F-009-02 | Sin sesión/caducada: API-003-05 no lista E_NO_AUTENTICADO | Añadir a Errors |
| F-009-03 | Sin mensaje de vacío para entregar hoy, vuelve hoy ni retraso | Definir textos |
| F-009-04 | AC-009-03 solo desde==hoy; RN-022 incluye desde<hoy; sin AC | Añadir AC |
