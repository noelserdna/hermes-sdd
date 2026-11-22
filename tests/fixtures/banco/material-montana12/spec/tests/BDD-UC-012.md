# BDD-UC-012 — Ver mis multas

> Refs: UC-012; REQ-F-006; INV-SEC-001. Convention: el socio abre la página "Mis multas".

Feature: Ver mis multas — As a socio I want ver mis multas so that sepa qué debo antes de reservar

Scenario: AC-012-01 — multa pendiente [REQ-F-006 AC1]
  Given Pablo Sanz tiene una multa pendiente de 6 €
  When Pablo abre "Mis multas"
  Then ve "Multa de 6 € — Pendiente" en Mis multas

Scenario: AC-012-02 — sin multas [REQ-F-006 AC5]
  Given Lucía Gil no tiene multas
  When Lucía abre "Mis multas"
  Then ve "No tienes multas" en Mis multas

Scenario: AC-012-03 — la multa de otro no cuenta [REQ-F-006 AC6]
  Given Marta no tiene multas y Pablo tiene una
  When Marta abre "Mis multas"
  Then ve "No tienes multas" en Mis multas
  And no ve ninguna fila de Pablo

Scenario: AC-012-04 — rol no permitido
  Given una sesión de encargado
  When abre "Mis multas"
  Then error `E_PAGINA_PROHIBIDA` y ninguna multa visible
