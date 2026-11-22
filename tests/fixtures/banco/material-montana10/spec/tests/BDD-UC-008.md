# BDD-UC-008 — Gestionar inventario

> Refs: UC-008; REQ-F-008; INV-STK-001..004. "n unidades" cuenta solo Activas; "sin cambios" = el inventario no cambia.

Feature: Inventario — As an encargado I want añadir y dar de baja unidades so that las unidades libres son reales

Scenario: AC-008-01 — añadir [REQ-F-008 AC1]
  Given 3 unidades "Piolet"
  When el encargado añade 2 unidades de "Piolet"
  Then ve en Inventario "Piolet · 5 unidades"

Scenario: AC-008-02 — añadir de nuevo [REQ-F-008 AC2]
  Given se añadieron 2 unidades de "Piolet" sobre 3
  When se envía el mismo formulario otra vez
  Then hay 7 unidades y ve "Añadidas 2 unidades de Piolet" cada vez

Scenario: AC-008-03 — baja [REQ-F-008 AC3]
  Given "Casco 3" está libre
  When el encargado la da de baja
  Then ve "Casco 3 · De baja" y "Casco · 2 unidades"; no se puede reservar

Scenario: AC-008-04 — prestada [REQ-F-008 AC4]
  Given "Casco 1" está prestada a Pablo
  When el encargado la da de baja
  Then `E_BAJA_UNIDAD_PRESTADA`: "No se puede dar de baja: está prestada"; sigue Activa

Scenario: AC-008-05 — baja repetida [REQ-F-008 AC5]
  Given una unidad ya "De baja"
  When se da de baja otra vez
  Then sigue "De baja" una sola vez; sin cambios

Scenario: AC-008-06 — sin permiso [REQ-F-008 AC6]
  When "pablo@club.es" abre la pantalla Inventario directamente
  Then `E_SIN_PERMISO`: "No tienes permiso para ver esta pantalla"

Scenario: AC-008-07 — tipo inválido
  When el encargado añade unidades de "Mochila"
  Then `E_TIPO_INVALIDO`; sin cambios

Scenario: AC-008-08 — cantidad inválida
  When el encargado añade 0 unidades de "Casco"
  Then `E_CANTIDAD_INVALIDA`; sin cambios

Scenario: AC-008-09 — unidad inexistente
  When el encargado da de baja una unidad que no existe
  Then `E_UNIDAD_NO_ENCONTRADA`; sin cambios
