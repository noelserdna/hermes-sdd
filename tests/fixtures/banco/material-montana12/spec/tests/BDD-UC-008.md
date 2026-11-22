# BDD-UC-008 — Ver mis reservas

> Refs: UC-008; REQ-F-004; INV-RES-006, INV-RES-010. Convention: hoy = 2026-12-04 salvo indicación.

Feature: Mis reservas — As a socio I want ver mis reservas so that sé cuáles puedo cancelar

Scenario: AC-008-01 — solo las mías [REQ-F-004 AC1]
  Given Lucía tiene 2 × Casco 2026-12-05..2026-12-07 y Pablo Sanz tiene "1 × Tienda del 2026-12-06 al 2026-12-08 — Reservada"
  When Lucía abre "Mis reservas"
  Then ve una sola fila "2 × Casco del 2026-12-05 al 2026-12-07 — Reservada"
  And no ve "1 × Tienda del 2026-12-06 al 2026-12-08 — Reservada"
  And pedir una reserva ajena da `E_ACCESO_DENEGADO` sin datos

Scenario: AC-008-02 — empieza hoy [REQ-F-004 AC4]
  Given hoy es 2026-12-05 y la reserva de Lucía empieza 2026-12-05
  When Lucía abre "Mis reservas"
  Then la fila muestra "No se puede cancelar: empieza hoy" (`E_EMPIEZA_HOY`)
  And la fila no tiene botón "Cancelar"

Scenario: AC-008-03 — socio nuevo [REQ-F-004 AC5]
  Given una socia nueva sin reservas
  When abre "Mis reservas"
  Then ve "Aún no tienes reservas"

Scenario: AC-008-04 — otro socio con reservas [REQ-F-004 AC6]
  Given Pablo Sanz no tiene reservas y Lucía tiene una
  When Pablo Sanz abre "Mis reservas"
  Then ve "Aún no tienes reservas"

Scenario: AC-008-05 — rol no permitido
  When el encargado abre "Mis reservas"
  Then error `E_PAGINA_PROHIBIDA` y no se muestra ninguna reserva
