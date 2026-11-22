# BDD-UC-012 — Marcar multa pagada

> Refs: UC-012; REQ-F-007; REQ-F-006; INV-FIN-003; INV-RES-005. Convention: "sin cambios" = estado y fecha de pago intactos.

Feature: Marcar multa pagada — As an encargado I want anotar el pago so that el socio pueda reservar

Background:
  Given una sesión de encargado

Scenario: AC-012-01 — pagar la única multa [REQ-F-007 AC1]
  Given "pablo" tiene una multa Pendiente de 6,00 €
  When el encargado marca "Pagada"
  Then Multas muestra la multa con estado "Pagada"
  And "pablo" puede reservar "Casco"

Scenario: AC-012-02 — queda otra pendiente [REQ-F-006 AC5]
  Given "pablo" tiene 2 multas Pendiente
  When el encargado marca "Pagada" solo una
  Then al reservar, error `E_MULTA_PENDIENTE` y se ve "Tienes una multa pendiente: no puedes reservar hasta pagarla"

Scenario: AC-012-03 — repetir el pago [REQ-F-007 AC2]
  Given una multa ya "Pagada" el 2026-12-11
  When se envía "Pagada" de nuevo el 2026-12-12
  Then Multas muestra "Pagada" con la fecha 2026-12-11

Scenario: AC-012-04 — socio sin acceso [REQ-F-007 AC3]
  Given una sesión de socio
  When el socio abre Multas del encargado
  Then error `E_ACCESO_NO_PERMITIDO` y se ve "Acceso no permitido"

Scenario: AC-012-05 — multa inexistente
  When el encargado marca "Pagada" una multa que no existe
  Then error `E_MULTA_NO_ENCONTRADA` y sin cambios

Scenario: AC-012-06 — fallo del almacén
  Given el almacén no responde
  When el encargado marca "Pagada"
  Then error `E_ALMACEN_NO_DISPONIBLE` y la multa sigue "Pendiente"
