# BDD-UC-010 — Entregar reserva

> Refs: UC-010; REQ-F-005; INV-RES-007; INV-RES-008; INV-RES-009. Convention: el encargado actúa en Panel del encargado; "sin cambios" = estado y fechas de la reserva intactos.

Feature: Entregar reserva — As an encargado I want entregar el material so that el préstamo quede registrado

Background:
  Given el encargado ha entrado
  And Lucía Gil tiene 2 × Casco reservados del 2026-12-05 al 2026-12-07

Scenario: AC-010-01 — entrega en fecha [REQ-F-005 AC1]
  Given hoy es 2026-12-05
  When el encargado pulsa "Entregar"
  Then ve "Entregado: 2 × Casco a Lucía Gil"
  And ve "2 × Casco del 2026-12-05 al 2026-12-07 — Prestada" en Panel del encargado

Scenario: AC-010-02 — replay [REQ-F-005 AC2]
  Given la reserva acaba de entregarse
  When se envía "Entregar" otra vez
  Then ve "Ya estaba entregada" en Panel del encargado
  And ve una sola fila "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07", no repetida

Scenario: AC-010-03 — antes de inicio [REQ-F-005 AC8]
  Given una reserva del 2026-12-10 y hoy es 2026-12-05
  When el encargado pulsa "Entregar"
  Then ve "No se puede entregar antes de la fecha de inicio" en Panel del encargado
  And error `E_ANTES_DE_INICIO` y la reserva sigue Reservada

Scenario: AC-010-04 — no recogida [REQ-F-005 AC7]
  Given nunca se entregó y hoy es 2026-12-08
  When el encargado abre la reserva
  Then ve "No recogida" en Panel del encargado
  And error `E_NO_RECOGIDA`; sus unidades están libres, sin multa

Scenario: AC-010-05 — reserva inexistente
  When el encargado entrega una reserva que no existe
  Then error `E_RESERVA_NO_ENCONTRADA`, sin cambios

Scenario: AC-010-06 — rol no permitido
  When un socio o la junta intenta entregar
  Then error `E_ACCESO_DENEGADO`, sin cambios

Scenario: AC-010-07 — Cancelada o Devuelta
  Given la reserva está Cancelada
  When el encargado pulsa "Entregar"
  Then error `E_RESERVA_NO_ENTREGABLE`, sin cambios
