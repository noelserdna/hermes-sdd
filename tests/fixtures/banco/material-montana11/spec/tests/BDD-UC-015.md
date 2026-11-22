# BDD-UC-015 — Ver lo prestado y lo que vuelve cada día

> Refs: UC-015; REQ-F-009; INV-ACC-007; RN-009. Convention: Prestado es de solo lectura.

Feature: Ver lo prestado — Como encargado quiero ver qué material está fuera y qué vuelve cada día para organizar mi trabajo

Background:
  Given una sesión de encargado

Scenario: AC-015-01 — lista de préstamos [REQ-F-009 AC1]
  Given "Piolet 1" prestado a "Lucía Gil" hasta 2026-12-07 y "Casco 2" a "Pablo Ruiz" hasta 2026-12-08
  When el encargado abre "Prestado"
  Then el usuario ve "Piolet 1 — Lucía Gil — hasta 2026-12-07"
  And el usuario ve "Casco 2 — Pablo Ruiz — hasta 2026-12-08"

Scenario: AC-015-02 — vuelven en el día elegido [REQ-F-009 AC2]
  Given los mismos préstamos
  When el encargado elige el día 2026-12-07
  Then el usuario ve "Piolet 1" bajo "Vuelven hoy" y no ve "Casco 2"

Scenario: AC-015-03 — préstamo retrasado [REQ-F-009 AC3]
  Given "Casco 2" terminó el 2026-12-08, hoy es 2026-12-09 y no se devolvió
  When el encargado abre "Prestado"
  Then el usuario ve "Casco 2" marcado "Retrasado 1 día"

Scenario: AC-015-04 — nada prestado [REQ-F-009 AC4]
  Given no hay material prestado
  When el encargado abre "Prestado"
  Then el usuario ve "No hay material prestado"

Scenario: AC-015-05 — socio o junta
  Given una sesión de socio
  When el socio abre la dirección de "Prestado"
  Then error `E_ACCESO_NO_PERMITIDO` y el usuario ve "Acceso no permitido"

Scenario: AC-015-06 — día mal formado
  When el encargado elige el día "31-31-2026"
  Then error `E_DATOS_INVALIDOS` y se conserva la lista anterior

Scenario: AC-015-07 — fallo del almacén
  Given el almacén no responde
  When el encargado abre "Prestado"
  Then error `E_ALMACEN_NO_DISPONIBLE` y no se muestra la lista
