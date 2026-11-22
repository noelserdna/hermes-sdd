# BDD-UC-008 — Entregar material

> Refs: UC-008; REQ-F-005; INV-LOA-001; INV-LOA-002. Convention: "sin cambios" = estado y fechas de la reserva intactos.

Feature: Entregar material — As an encargado I want entregar lo reservado so that el estado real quede registrado

Background:
  Given una sesión de encargado

Scenario: AC-008-01 — entregar el día de inicio [REQ-F-005 AC1]
  Given hoy es 2026-12-05 y "lucia" tiene una reserva "Piolet" que empieza el 2026-12-05
  When el encargado marca "Entregar"
  Then Préstamos muestra la reserva "Piolet" con estado "Entregado"

Scenario: AC-008-02 — paso de día sin recoger [REQ-F-005 AC4]
  Given una reserva Reservada con inicio 2026-12-05 sin entregar
  When llega el 2026-12-06
  Then Préstamos muestra el estado "No recogida"
  And la unidad queda libre para nuevas reservas

Scenario: AC-008-03 — entrega anticipada [REQ-F-005 AC3]
  Given una reserva con inicio 2026-12-05 y hoy es 2026-12-04
  When el encargado intenta entregarla
  Then error `E_ENTREGA_ANTICIPADA` y se ve "No se puede entregar antes de la fecha de inicio"

Scenario: AC-008-04 — socio sin acceso [REQ-F-005 AC6]
  Given una sesión de socio
  When el socio abre Préstamos
  Then error `E_ACCESO_NO_PERMITIDO` y se ve "Acceso no permitido"

Scenario: AC-008-05 — reserva inexistente
  When el encargado entrega una reserva que no existe
  Then error `E_RESERVA_NO_ENCONTRADA` y sin cambios

Scenario: AC-008-06 — ya entregada por otro encargado
  Given la reserva ya está Entregado
  When otro encargado marca "Entregar"
  Then error `E_ESTADO_INVALIDO` y se conserva la primera `entregadaEl`

Scenario: AC-008-07 — fallo del almacén
  Given el almacén no responde
  When el encargado marca "Entregar"
  Then error `E_ALMACEN_NO_DISPONIBLE` y la reserva sigue Reservada
