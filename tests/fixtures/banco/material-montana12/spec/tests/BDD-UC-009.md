# BDD-UC-009 — Cancelar reserva

> Refs: UC-009; REQ-F-004; INV-RES-005, INV-RES-006, INV-RES-009, INV-RES-010. Convention: "sin cambios" = estado y unidades libres iguales.

Feature: Cancelar reserva — As a socio I want cancelar una reserva so that otros usan sus unidades

Background:
  Given "Casco" tiene 6 unidades y Lucía tiene 2 × Casco 2026-12-05..2026-12-07

Scenario: AC-009-01 — cancelar y liberar [REQ-F-004 AC2]
  Given hoy es 2026-12-04
  When Lucía pulsa "Cancelar"
  Then ve "Reserva cancelada" y "2 × Casco del 2026-12-05 al 2026-12-07 — Cancelada" en "Mis reservas"
  And Pablo Sanz reserva 5 × Casco esas fechas y ve "Reserva creada: 5 × Casco del 2026-12-05 al 2026-12-07"

Scenario: AC-009-02 — cancelar otra vez [REQ-F-004 AC3]
  Given Lucía ya canceló la reserva y Pablo Sanz reservó 5 × Casco esas fechas
  When se envía "Cancelar" otra vez
  Then error `E_YA_CANCELADA`: "La reserva ya estaba cancelada" en "Mis reservas"
  And Pablo Sanz pide 2 × Casco y ve "No hay unidades libres: solo queda 1 de Casco el 2026-12-05"

Scenario: AC-009-03 — empieza hoy
  Given hoy es 2026-12-05
  When Lucía envía "Cancelar"
  Then error `E_EMPIEZA_HOY` y la reserva sigue Reservada

Scenario: AC-009-04 — ya empezada
  Given hoy es 2026-12-06 y la reserva sigue Reservada
  When Lucía envía "Cancelar"
  Then error `E_YA_EMPEZADA` y la reserva sigue Reservada

Scenario: AC-009-05 — reserva ajena
  When Pablo Sanz envía "Cancelar" sobre la reserva de Lucía
  Then error `E_ACCESO_DENEGADO` sin datos de Lucía y la reserva sigue Reservada
