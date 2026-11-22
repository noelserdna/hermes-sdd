# BDD-UC-006 — Devolver y multar

> Refs: UC-006; REQ-F-006; INV-LOA-003; INV-LOA-004. Convention: el Encargado opera en Entregas y devoluciones; el importe sale de `FINE_PER_DAY_EUR`.

Feature: Devolver y multar — As an Encargado I want to mark returns so that late loans get a multa

Scenario: AC-006-01 — devolución a tiempo [REQ-F-006 AC1]
  Given "Piolet 2" lent to Lucía until 2026-12-07
  When the encargado marks it returned on 2026-12-07
  Then the user sees "Piolet 2 · Lucía · Devuelta" and no multa exists

Scenario: AC-006-02 — retraso de 3 días [REQ-F-006 AC2]
  Given "Casco 1" lent to Pablo until 2026-12-07
  When it is returned on 2026-12-10
  Then the user sees "Multa de 6 € a Pablo (3 días de retraso)"

Scenario: AC-006-03 — retraso de 1 día [REQ-F-006 AC3]
  Given "Cuerda 1" lent to Lucía until 2026-12-07
  When it is returned on 2026-12-08
  Then the user sees "Multa de 2 € a Lucía (1 días de retraso)"
  And Lucía sees "Multa pendiente: 2 €" in Mis reservas

Scenario: AC-006-04 — repetición [REQ-F-006 AC4]
  Given "Casco 1" is already "Devuelta"
  When the return is marked again
  Then there is still one multa of 6 € for Pablo

Scenario: AC-006-05 — no prestada [REQ-F-006 AC5]
  Given a loan not delivered (reserva "Reservada")
  When the encargado marks it returned
  Then error `E_RESERVA_NO_PRESTADA` "Esa reserva no está prestada" and no multa exists

Scenario: AC-006-06 — reserva inexistente
  When the encargado returns a reserva that does not exist
  Then error `E_RESERVA_NO_ENCONTRADA` and nothing changes
