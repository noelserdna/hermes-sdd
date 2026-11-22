# BDD-UC-007 — Cancelar reserva

> Refs: UC-007; REQ-F-004; INV-RES-006, INV-RES-007. "Sin cambios" = la reserva conserva su estado.

Feature: Cancelar reserva — As a socio I want cancelar mi reserva so that libero la unidad para otros

Scenario: AC-007-01 — cancelar a tiempo [REQ-F-004 AC2]
  Given hoy es 2026-12-04 y "lucia" tiene "Piolet" desde 2026-12-05
  When la cancela
  Then ve "Reserva cancelada"
  And la reserva muestra estado "Cancelada"

Scenario: AC-007-02 — cancelación tardía [REQ-F-004 AC3]
  Given hoy es 2026-12-05 y "lucia" tiene "Piolet" desde 2026-12-05
  When intenta cancelarla
  Then error `E_CANCELACION_TARDIA`: "Solo se puede cancelar hasta el día antes"
  And sigue Reservada

Scenario: AC-007-03 — cancelación repetida [REQ-F-004 AC5]
  Given "lucia" ya canceló una reserva
  When envía la misma cancelación
  Then Mis reservas muestra "Cancelada"
  And no cambia nada más

Scenario: AC-007-04 — reserva ajena
  When "lucia" cancela una reserva de "pablo"
  Then error `E_RESERVA_NO_ENCONTRADA`; sin cambios

Scenario: AC-007-05 — estado no cancelable
  Given la reserva está Entregado
  When "lucia" la cancela
  Then error `E_ESTADO_INVALIDO`; sin cambios

Scenario: AC-007-06 — almacén caído
  When "lucia" cancela y el almacén falla
  Then error `E_ALMACEN_NO_DISPONIBLE`; sin cambios
