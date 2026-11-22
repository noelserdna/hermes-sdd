# BDD-UC-014 — Ver todas las multas

> Refs: UC-014; REQ-F-006; INV-SEC-003. Convention: el encargado abre la página "Multas".

Feature: Ver todas las multas — As an encargado I want ver las multas de todos so that sepa quién debe

Scenario: AC-014-01 — lista con estados [REQ-F-006 AC7]
  Given Pablo Sanz tiene una multa pendiente de 6 € y Lucía Gil una pagada de 2 €
  When el encargado abre "Multas"
  Then ve "Pablo Sanz — Multa de 6 € — Pendiente"
  And ve "Lucía Gil — Multa de 2 € — Pagada"

Scenario: AC-014-02 — rol no permitido
  Given una sesión de socio o de junta
  When abre "Multas"
  Then error `E_PAGINA_PROHIBIDA` y ninguna multa visible
