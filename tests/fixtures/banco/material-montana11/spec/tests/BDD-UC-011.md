# BDD-UC-011 — Ver mis multas

> Refs: UC-011; REQ-F-006; INV-SEC-001. Convention: solo lectura.

Feature: Ver mis multas — As a socio I want ver mis multas so that sepa por qué no puedo reservar

Background:
  Given una sesión de socio "pablo"

Scenario: AC-011-01 — multa pendiente visible [REQ-F-006 AC6]
  Given "pablo" tiene una multa Pendiente de 6,00 €
  When abre Mis multas
  Then Mis multas muestra "6,00 €" y "Pendiente"

Scenario: AC-011-02 — solo las propias (INV-SEC-001)
  Given "lucia" tiene una multa Pendiente de 2,00 € y "pablo" tiene la de 6,00 €
  When "pablo" abre Mis multas
  Then Mis multas muestra "6,00 €" y no muestra "2,00 €"

Scenario: AC-011-03 — fallo del almacén
  Given el almacén no responde
  When "pablo" abre Mis multas
  Then error `E_ALMACEN_NO_DISPONIBLE` y no se muestra ninguna multa
