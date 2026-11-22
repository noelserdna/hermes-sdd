# BDD-UC-011 — Recibir devolución

> Refs: UC-011; REQ-F-005; INV-MUL-001; INV-MUL-004; INV-RES-009. Convention: el encargado actúa en Panel del encargado; "sin cambios" = reserva y multas intactas.

Feature: Recibir devolución — As an encargado I want marcar la devolución so that se cierre el préstamo y se cobre el retraso

Background:
  Given el encargado ha entrado
  And Lucía Gil tiene 2 × Casco prestados hasta el 2026-12-07

Scenario: AC-011-01 — a tiempo [REQ-F-005 AC3]
  When el encargado marca la devolución el 2026-12-07
  Then ve "Devuelto a tiempo" en Panel del encargado
  And no existe ninguna multa
  And Lucía ve "No tienes multas" en Mis multas

Scenario: AC-011-02 — 3 días de retraso [REQ-F-005 AC4]
  When el encargado marca la devolución el 2026-12-10
  Then ve "Devuelto con 3 días de retraso: multa de 6 €" en Panel del encargado

Scenario: AC-011-03 — 1 día de retraso [REQ-F-005 AC5]
  When se devuelve el 2026-12-08
  Then ve "Devuelto con 1 día de retraso: multa de 2 €" en Panel del encargado

Scenario: AC-011-04 — replay [REQ-F-005 AC6]
  Given la devolución se marcó el 2026-12-10 con multa de 6 €
  When se envía "Devolver" otra vez
  Then ve "Ya estaba devuelta" en Panel del encargado
  And ve una sola fila "Lucía Gil — Multa de 6 € — Pendiente" en Multas, no repetida ni con otro importe

Scenario: AC-011-05 — no entregada
  Given la reserva está Reservada
  When el encargado pulsa "Devolver"
  Then error `E_NO_PRESTADA`, sin cambios y sin multa

Scenario: AC-011-06 — reserva inexistente
  When el encargado devuelve una reserva que no existe
  Then error `E_RESERVA_NO_ENCONTRADA`, sin cambios

Scenario: AC-011-07 — rol no permitido
  When un socio o la junta intenta devolver
  Then error `E_ACCESO_DENEGADO`, sin cambios
