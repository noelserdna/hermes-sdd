# BDD-UC-005 — Entregar reserva

> Refs: UC-005; REQ-F-005; INV-LOA-001; INV-LOA-002; INV-LOA-301. Convention: el Encargado opera en Entregas y devoluciones; "sin cambios" = estado y unidad intactos.

Feature: Entregar reserva — As an Encargado I want to deliver a reservation so that the club knows which unit each Socio has

Scenario: AC-005-01 — entrega con unidad [REQ-F-005 AC1]
  Given today is 2026-12-05 and Lucía has a reserva of "Piolet" from 2026-12-05
  When the encargado marks it delivered with unit "Piolet 2"
  Then the user sees "Piolet 2 · Lucía · Prestada" in Entregas y devoluciones

Scenario: AC-005-02 — repetición [REQ-F-005 AC2]
  Given the same reserva is already "Prestada"
  When delivered again
  Then there is still one "Piolet 2 · Lucía · Prestada" and no second unit is assigned

Scenario: AC-005-03 — entrega anticipada [REQ-F-005 AC3]
  Given today is 2026-12-04 and the reserva starts 2026-12-05
  When the encargado marks it delivered
  Then error `E_ENTREGA_ANTICIPADA` "Aún no es la fecha de entrega" and it stays "Reservada"

Scenario: AC-005-04 — no recogida [REQ-F-005 AC4]
  Given a reserva 2026-12-05..2026-12-07 never delivered
  When the date becomes 2026-12-08
  Then the user sees "No recogida" for it in Entregas y devoluciones and its units are free, without multa

Scenario: AC-005-05 — reserva inexistente
  When the encargado delivers a reserva that does not exist
  Then error `E_RESERVA_NO_ENCONTRADA` and nothing changes

Scenario: AC-005-06 — reserva no entregable
  Given a reserva "Cancelada"
  When the encargado marks it delivered
  Then error `E_RESERVA_NO_ENTREGABLE` and it stays "Cancelada"

Scenario: AC-005-07 — unidad ya ocupada
  Given "Piolet 2" is "Prestada" to another reserva
  When the encargado delivers a second reserva with "Piolet 2"
  Then error `E_UNIDAD_NO_DISPONIBLE` and the reserva stays "Reservada"
