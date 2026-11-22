# BDD-UC-009 — Registrar devolución

> Refs: UC-009; REQ-F-005; REQ-F-006; INV-LOA-003; INV-FIN-001. Convention: "sin cambios" = estado, fechas y multas intactos.

Feature: Registrar devolución — As an encargado I want marcar lo devuelto so that la unidad quede libre

Background:
  Given una sesión de encargado

Scenario: AC-009-01 — devolver en plazo [REQ-F-005 AC2]
  Given un "Piolet" Entregado con fin 2026-12-07
  When el encargado marca "Devolver" el 2026-12-07
  Then Préstamos muestra el estado "Devuelto"
  And la unidad queda libre

Scenario: AC-009-02 — devolución tardía crea la multa
  Given un "Casco" Entregado de "pablo" con fin 2026-12-07
  When el encargado marca "Devolver" el 2026-12-10
  Then Préstamos muestra "Devuelto" y existe una multa Pendiente (ver AC-010-01)

Scenario: AC-009-03 — repetir la devolución [REQ-F-005 AC5]
  Given un "Piolet" Devuelto el 2026-12-07
  When se envía "Devolver" de nuevo el 2026-12-08
  Then Préstamos muestra "Devuelto" con la fecha 2026-12-07
  And no se crea una segunda multa

Scenario: AC-009-04 — socio sin acceso
  Given una sesión de socio
  When el socio intenta devolver
  Then error `E_ACCESO_NO_PERMITIDO` y se ve "Acceso no permitido"

Scenario: AC-009-05 — reserva inexistente
  When el encargado devuelve una reserva que no existe
  Then error `E_RESERVA_NO_ENCONTRADA` y sin cambios

Scenario: AC-009-06 — reserva no entregada
  Given una reserva Reservada
  When el encargado marca "Devolver"
  Then error `E_ESTADO_INVALIDO` y sin cambios

Scenario: AC-009-07 — fallo del almacén
  Given el almacén no responde y un préstamo con retraso
  When el encargado marca "Devolver"
  Then error `E_ALMACEN_NO_DISPONIBLE`, sigue Entregado y sin multa
