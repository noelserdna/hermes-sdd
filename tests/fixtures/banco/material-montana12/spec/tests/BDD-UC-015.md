# BDD-UC-015 — Añadir unidades de material

> Refs: UC-015; REQ-F-007; INV-MAT-001, INV-MAT-004. Convention: "sin cambios" = totales de "Material" iguales.

Feature: Añadir unidades — As an encargado I want añadir unidades so that el inventario sea cierto

Background:
  Given el encargado tiene sesión abierta

Scenario: AC-015-01 — añadir a un tipo [REQ-F-007 AC1]
  Given "Cuerda" tiene 4 unidades
  When añade 2 unidades de Cuerda
  Then ve "Cuerda: 6 unidades" en "Material"

Scenario: AC-015-02 — tipo nuevo [REQ-F-007 AC2]
  When añade "Mosquetón" con 10 unidades
  Then ve "Mosquetón: 10 unidades" en "Material"

Scenario: AC-015-03 — cantidad inválida
  When añade 0 unidades de Cuerda
  Then error `E_CANTIDAD_INVALIDA` y sin cambios

Scenario: AC-015-04 — nombre vacío
  When añade un nombre vacío con 3 unidades
  Then error `E_NOMBRE_VACIO` y sin cambios

Scenario: AC-015-05 — rol no permitido
  When un socio intenta añadir 2 unidades de Cuerda
  Then error `E_PAGINA_PROHIBIDA` o `E_ACCESO_DENEGADO` y sin cambios

Scenario: AC-015-06 — mismo envío repetido [replay, RN-035]
  Given "Cuerda" tiene 4 unidades y el encargado acaba de añadir 2 (6 unidades)
  When se envía otra vez el mismo alta de 2 unidades
  Then el usuario ve "Cuerda: 8 unidades" en "Material"
