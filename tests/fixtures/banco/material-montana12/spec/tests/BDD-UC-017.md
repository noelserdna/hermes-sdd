# BDD-UC-017 — Ver panel del encargado

> Refs: UC-017; REQ-F-008; REQ-F-005; INV-MUL-004; INV-SEC-003. Convention: el encargado abre "Panel del encargado".

Feature: Panel del encargado — As an encargado I want ver entregas y devoluciones so that trabaje cada día

Background:
  Given Lucía Gil tiene 2 × Casco prestados hasta el 2026-12-07

Scenario: AC-017-01 — préstamo [REQ-F-008 AC1]
  When el encargado abre el panel el 2026-12-05
  Then ve "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07"

Scenario: AC-017-02 — vuelven hoy [REQ-F-008 AC2]
  When abre el panel el 2026-12-07
  Then ve "Vuelven hoy"
  And ve "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07"

Scenario: AC-017-03 — fecha elegida [REQ-F-008 AC3]
  When elige la fecha 2026-12-07 el 2026-12-05
  Then ve "Vuelven el 2026-12-07"
  And ve "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07"

Scenario: AC-017-04 — sin préstamos [REQ-F-008 AC4]
  Given no hay préstamos
  When abre el panel
  Then ve "No hay material prestado"

Scenario: AC-017-05 — por entregar [REQ-F-008 AC5]
  Given Lucía tiene 2 × Casco reservados desde el 2026-12-05
  When abre el panel el 2026-12-05
  Then ve "Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05"
  And ve el botón "Entregar"

Scenario: AC-017-06 — socio [REQ-F-008 AC6]
  When un socio abre "/panel"
  Then ve "No tienes permiso para ver esta página" en Panel del encargado
  And error `E_PAGINA_PROHIBIDA`

Scenario: AC-017-07 — junta [REQ-F-008 AC7]
  When una persona de la junta abre "/panel"
  Then ve "No tienes permiso para ver esta página" en Panel del encargado
  And error `E_PAGINA_PROHIBIDA`

Scenario: AC-017-08 — retraso de 3 días [REQ-F-005 AC9]
  Given el préstamo terminó el 2026-12-07 y no se devolvió
  When abre el panel el 2026-12-10
  Then ve "Retraso: 3 días" junto al préstamo
  And Lucía ve "No tienes multas" en Mis multas

Scenario: AC-017-09 — retraso de 1 día [REQ-F-005 AC10]
  Given el préstamo terminó el 2026-12-07 y no se devolvió
  When abre el panel el 2026-12-08
  Then ve "Retraso: 1 día"
