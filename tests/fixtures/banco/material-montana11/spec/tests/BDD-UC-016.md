# BDD-UC-016 — Consultar historial de un socio

> Refs: UC-016; REQ-F-010; INV-SEC-001, INV-SEC-002. Convention: la junta solo lee; "nada cambia" = ningún dato se modifica.

Feature: Historial del socio — Como junta quiero ver el historial de cualquier socio para supervisar el uso del material

Background:
  Given una sesión de junta

Scenario: AC-016-01 — multa pendiente [REQ-F-010 AC1]
  Given "Lucía Gil" devolvió "Piolet 1" el 2026-12-07 y "Pablo Ruiz" tiene una multa de 6,00 €
  When la junta abre el historial de "Pablo Ruiz"
  Then el usuario ve "Multa 6,00 € Pendiente"
  And no ve los préstamos de "Lucía Gil"

Scenario: AC-016-02 — préstamo devuelto [REQ-F-010 AC2]
  When la junta abre el historial de "Lucía Gil"
  Then el usuario ve "Piolet 1" con "Devuelto"

Scenario: AC-016-03 — socio sin historial [REQ-F-010 AC3]
  Given un socio sin préstamos ni multas
  When la junta abre su historial
  Then el usuario ve "Sin préstamos ni multas"

Scenario: AC-016-04 — pantallas del encargado [REQ-F-010 AC4]
  When la junta abre la dirección de "Entregar", "Inventario" o "Reservar"
  Then error `E_ACCESO_NO_PERMITIDO` y el usuario ve "Acceso no permitido"
  And las pantallas de la junta no tienen botón que cambie datos

Scenario: AC-016-05 — rol socio
  Given una sesión de socio
  When el socio pide el historial de "Pablo Ruiz"
  Then error `E_ACCESO_NO_PERMITIDO` y no se muestra ningún historial

Scenario: AC-016-06 — socio inexistente
  When la junta pide el historial de un socio que no existe
  Then error `E_SOCIO_NO_ENCONTRADO` y no se muestra historial

Scenario: AC-016-07 — fallo del almacén
  Given el almacén no responde
  When la junta abre el historial de "Pablo Ruiz"
  Then error `E_ALMACEN_NO_DISPONIBLE` y no se muestra historial
