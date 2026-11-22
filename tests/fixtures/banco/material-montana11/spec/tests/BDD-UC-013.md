# BDD-UC-013 — Añadir material

> Refs: UC-013; REQ-F-008; INV-STK-001, INV-STK-002, INV-SEC-003. Convention: "sin cambios" = el recuento de Inventario no varía.

Feature: Añadir material — Como encargado quiero añadir unidades para que se puedan reservar

Background:
  Given una sesión de encargado y los tipos Piolet, Crampones, Casco, Cuerda y Tienda

Scenario: AC-013-01 — añadir 2 de Crampones [REQ-F-008 AC1]
  Given Crampones no tiene unidades
  When el encargado añade 2 unidades de "Crampones"
  Then el usuario ve "Crampones: 2 unidades" en Inventario
  And las unidades son "Crampones 1" y "Crampones 2"

Scenario: AC-013-02 — tipo sin unidades
  When el encargado abre Inventario
  Then el usuario ve "Tienda: 0 unidades"

Scenario: AC-013-03 — cantidad 0 [REQ-F-008 AC6]
  When el encargado añade 0 unidades de "Casco"
  Then error `E_CANTIDAD_INVALIDA` y el usuario ve "La cantidad debe ser al menos 1"
  And el recuento de Casco no cambia

Scenario: AC-013-04 — tipo no válido
  When el encargado añade 1 unidad del tipo "Mochila"
  Then error `E_MATERIAL_INVALIDO` y no se crea ninguna unidad

Scenario: AC-013-05 — datos ausentes
  When el encargado envía sin cantidad
  Then error `E_DATOS_INVALIDOS` y el inventario no cambia

Scenario: AC-013-06 — socio o junta [REQ-F-008 AC7]
  Given una sesión de socio
  When el socio abre la dirección de "Inventario"
  Then error `E_ACCESO_NO_PERMITIDO` y el usuario ve "Acceso no permitido"

Scenario: AC-013-07 — fallo del almacén
  Given el almacén no responde
  When el encargado añade 1 unidad de "Cuerda"
  Then error `E_ALMACEN_NO_DISPONIBLE` y el recuento de Cuerda no cambia

Scenario: AC-013-08 — replay del mismo envío (RN-016)
  Given "Crampones" tiene 2 unidades
  When el encargado añade 2 unidades de "Crampones" dos veces
  Then el usuario ve "Crampones: 6 unidades"
