# BDD-UC-007 — Pagar multa

> Refs: UC-007; REQ-F-007; INV-LOA-005; INV-RES-005; INV-ACC-008. Convention: el Encargado opera en Multas; "reservar" es la operación de Reservar.

Feature: Pagar multa — As an Encargado I want to mark a multa as paid so that the Socio can reserve again

Scenario: AC-007-01 — pago desbloquea [REQ-F-007 AC1]
  Given Pablo has a multa of 6 € pendiente
  When the encargado marks it paid
  Then the user sees "Multa de 6 € · Pablo · Pagada" in Multas and Pablo can reserve

Scenario: AC-007-02 — otra multa pendiente [REQ-F-007 AC2]
  Given Lucía has two multas pendientes (2 € and 4 €)
  When the encargado marks the 2 € one paid
  Then Lucía still sees "Multa pendiente: 4 €" in Mis reservas and cannot reserve

Scenario: AC-007-03 — repetición [REQ-F-007 AC3]
  Given the multa is already paid
  When marked paid again
  Then it stays "Pagada" once, with the same paid date

Scenario: AC-007-04 — sin permiso [REQ-F-007 AC4]
  Given the socio "lucia@club.es"
  When she opens Multas directly
  Then error `E_SIN_PERMISO` "No tienes permiso para ver esta pantalla"

Scenario: AC-007-05 — multa inexistente
  When the encargado pays a multa that does not exist
  Then error `E_MULTA_NO_ENCONTRADA` and no multa changes
