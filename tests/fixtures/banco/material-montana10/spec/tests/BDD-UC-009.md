# BDD-UC-009 — Ver entregas y devoluciones

> Refs: UC-009; REQ-F-009; INV-LOA-401; INV-RES-007; INV-ACC-008. Convention: se invoca API-003-05 con la sesión indicada; "sin cambios" = ninguna reserva cambia de estado.

Feature: Entregas y devoluciones — As an encargado I want ver lo prestado y lo que vuelve so that organizo el día

Background:
  Given Hoy es 2026-12-07 y hay sesión vigente

Scenario: AC-009-01 — prestado y vuelve hoy [REQ-F-009 AC1]
  Given "Piolet 2" prestado a Lucía hasta 2026-12-07 y "Casco 1" prestado a Pablo hasta 2026-12-09
  When el encargado abre Entregas y devoluciones
  Then ve "Vuelve hoy: Piolet 2 · Lucía"
  And ve "Prestado: Casco 1 · Pablo · hasta 2026-12-09"

Scenario: AC-009-02 — con retraso [REQ-F-009 AC2]
  Given "Cuerda 1" prestada a Marta hasta 2026-12-05
  When el encargado abre Entregas y devoluciones
  Then ve "Con retraso: Cuerda 1 · Marta · 2 días"

Scenario: AC-009-03 — entregar hoy [REQ-F-009 AC3]
  Given una reserva de Piolet de Lucía con desde 2026-12-07
  When el encargado abre Entregas y devoluciones
  Then ve "Entregar hoy: Piolet · Lucía"

Scenario: AC-009-04 — nada prestado [REQ-F-009 AC4]
  Given no hay material prestado
  When el encargado abre Entregas y devoluciones
  Then ve "No hay material prestado"

Scenario: AC-009-05 — junta solo lectura [REQ-F-009 AC5]
  Given "Casco 1" prestado a Pablo hasta 2026-12-09 y la junta "ana@club.es"
  When ana@club.es abre Entregas y devoluciones
  Then ve "Prestado: Casco 1 · Pablo · hasta 2026-12-09"
  And no hay botones de entregar ni de devolver

Scenario: AC-009-06 — socio sin permiso (E1)
  Given el socio "lucia@club.es"
  When abre Entregas y devoluciones directamente
  Then error `E_SIN_PERMISO` y ve "No tienes permiso para ver esta pantalla"

Scenario: AC-009-07 — reserva no recogida (RN-008)
  Given una reserva Reservada de Lucía con hasta 2026-12-06
  When el encargado abre Entregas y devoluciones
  Then no aparece en "Entregar hoy" y sigue sin cambios hasta ser No recogida
