# BDD-UC-010 — Aplicar multa por retraso

> Refs: UC-010; REQ-F-006; INV-FIN-001; INV-FIN-002; INV-RES-005. Convention: la multa nace dentro de la devolución (UC-009).

Feature: Multa por retraso — As an encargado I want multar la devolución tardía so that el material vuelva a tiempo

Background:
  Given una sesión de encargado

Scenario: AC-010-01 — multa de tres días [REQ-F-006 AC1]
  Given "pablo" tiene un "Casco" con fin 2026-12-07
  When el encargado lo marca devuelto el 2026-12-10
  Then Multas muestra "6,00 €" para "Pablo Ruiz" con estado "Pendiente"

Scenario: AC-010-02 — sin retraso [REQ-F-006 AC2]
  Given un préstamo con fin 2026-12-07
  When se devuelve el 2026-12-07
  Then no se crea multa y Multas muestra "Sin multas"

Scenario: AC-010-03 — un día de retraso [REQ-F-006 AC3]
  Given un préstamo con fin 2026-12-07
  When se devuelve el 2026-12-08
  Then la multa es "2,00 €"

Scenario: AC-010-04 — bloqueo al reservar [REQ-F-006 AC4]
  Given "pablo" tiene una multa Pendiente de 6,00 € y una reserva existente
  When intenta reservar
  Then error `E_MULTA_PENDIENTE` y se ve "Tienes una multa pendiente: no puedes reservar hasta pagarla"
  And su reserva existente se conserva

Scenario: AC-010-05 — fallo del almacén
  Given el almacén no responde
  When se devuelve un préstamo con retraso
  Then error `E_ALMACEN_NO_DISPONIBLE` y no hay devolución ni multa

Scenario: AC-010-06 — multa ya creada
  Given la reserva ya tiene su multa
  When se vuelve a aplicar la multa
  Then se conserva la existente y no hay segunda
