# BDD-UC-004 — Ver y cancelar mis reservas

> Refs: UC-004; REQ-F-004; INV-RES-006, INV-RES-008, INV-ACC-009. "Sin cambios" = la reserva conserva su estado.

Feature: Mis reservas — As a socio I want ver y cancelar mis reservas so that libero material a tiempo

Scenario: AC-004-01 — lista [REQ-F-004 AC1]
  Given "lucia@club.es" tiene una reserva de "Piolet" 2026-12-05..2026-12-07
  When abre Mis reservas
  Then ve "Piolet · 2026-12-05 a 2026-12-07 · Reservada"

Scenario: AC-004-02 — sin reservas [REQ-F-004 AC2]
  Given "pablo@club.es" no tiene reservas
  When abre Mis reservas
  Then ve "No tienes reservas" y ninguna de Lucía

Scenario: AC-004-03 — cancelar [REQ-F-004 AC3]
  Given hoy es 2026-12-04 y la reserva empieza 2026-12-05
  When Lucía la cancela
  Then ve "Piolet · 2026-12-05 a 2026-12-07 · Cancelada" y la unidad queda libre

Scenario: AC-004-04 — repetición [REQ-F-004 AC4]
  Given la reserva ya está Cancelada
  When se cancela de nuevo
  Then sigue "Cancelada" una sola vez, sin otro cambio

Scenario: AC-004-05 — cancelación tardía [REQ-F-004 AC5]
  Given hoy es 2026-12-05 y la reserva empieza 2026-12-05
  When Lucía la cancela
  Then `E_CANCELACION_TARDIA`: "Solo se puede cancelar hasta el día antes"; sigue "Reservada"

Scenario: AC-004-06 — multa pendiente [REQ-F-004 AC6]
  Given "lucia@club.es" debe una multa de 4 €
  When abre Mis reservas
  Then ve "Multa pendiente: 4 €"

Scenario: AC-004-07 — reserva ajena [REQ-F-004 AC7]
  Given una reserva de Lucía
  When "pablo@club.es" intenta cancelarla
  Then `E_SIN_PERMISO_CANCELAR`: "No tienes permiso para cancelar esta reserva"; sigue "Reservada"

Scenario: AC-004-08 — reserva inexistente
  When cancela una reserva que no existe
  Then `E_RESERVA_NO_ENCONTRADA`; sin cambios
