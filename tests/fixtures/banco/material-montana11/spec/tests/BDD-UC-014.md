# BDD-UC-014 — Dar de baja unidad

> Refs: UC-014; REQ-F-008; INV-STK-003, INV-STK-004, INV-STK-005, INV-SEC-003. Convention: "sin cambios" = estado de la unidad y de sus reservas intacto.

Feature: Dar de baja unidad — Como encargado quiero retirar unidades rotas para no reservarlas

Background:
  Given una sesión de encargado

Scenario: AC-014-01 — baja de Casco 3 [REQ-F-008 AC2]
  Given "Casco" tiene 4 unidades y "Casco 3" está rota
  When el encargado da de baja "Casco 3"
  Then el usuario ve "Casco: 3 unidades" en Inventario
  And "Casco 3" aparece como "De baja"

Scenario: AC-014-02 — reservas futuras canceladas [REQ-F-008 AC4]
  Given "Tienda" tiene 1 unidad con una reserva futura desde 2026-12-20
  When el encargado da de baja la unidad
  Then la reserva queda Cancelada y el usuario ve "1 reserva cancelada por la baja"

Scenario: AC-014-03 — unidad prestada [REQ-F-008 AC3]
  Given "Casco 2" está prestada ahora
  When el encargado intenta darla de baja
  Then error `E_UNIDAD_PRESTADA` y el usuario ve "No se puede dar de baja: está prestada"
  And "Casco 2" sigue en Alta

Scenario: AC-014-04 — unidad inexistente
  When el encargado da de baja "Casco 99"
  Then error `E_UNIDAD_NO_ENCONTRADA` y no cambia nada

Scenario: AC-014-05 — socio o junta
  Given una sesión de socio
  When el socio intenta dar de baja "Casco 3"
  Then error `E_ACCESO_NO_PERMITIDO` y "Casco 3" sigue en Alta

Scenario: AC-014-06 — entrega y baja a la vez
  Given "Casco 2" tiene una reserva que se entrega hoy
  When la baja y la entrega se confirman a la vez
  Then gana la primera confirmada: la baja da `E_UNIDAD_PRESTADA` o la entrega da `E_ESTADO_INVALIDO`

Scenario: AC-014-07 — baja repetida [REQ-F-008 AC5]
  Given "Casco 3" ya está "De baja" y "Casco" tiene 3 unidades
  When se envía la misma baja otra vez
  Then el usuario ve "Casco: 3 unidades"

Scenario: AC-014-08 — fallo del almacén
  Given el almacén no responde
  When el encargado da de baja "Casco 3"
  Then error `E_ALMACEN_NO_DISPONIBLE` y la unidad y sus reservas no cambian
