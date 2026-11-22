# BDD-UC-010 — Consultar historial

> Refs: UC-010; REQ-F-010; INV-LOA-402; INV-ACC-008. Convention: se invoca API-003-06 con la sesión indicada; "sin cambios" = no se modifica ninguna reserva ni multa.

Feature: Historial — As a junta I want ver préstamos y multas de un socio so that controlo el uso del material

Background:
  Given hay sesión vigente

Scenario: AC-010-01 — historial con multa [REQ-F-010 AC1]
  Given Lucía tomó "Piolet 2" del 2026-12-05 al 2026-12-07 y tiene una multa de 2 € pagada
  When "ana@club.es" (junta) elige a Lucía en Historial
  Then ve "Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta"
  And ve "Multa de 2 € · Pagada"

Scenario: AC-010-02 — sin historial [REQ-F-010 AC2]
  Given Pablo no tiene préstamos
  When la junta elige a Pablo
  Then ve "Sin préstamos ni multas"

Scenario: AC-010-03 — solo lectura [REQ-F-010 AC3]
  Given la junta con un socio elegido
  When mira Historial
  Then no hay botón para editar, cancelar ni marcar nada

Scenario: AC-010-04 — socio sin permiso [REQ-F-010 AC4]
  Given el socio "lucia@club.es"
  When abre Historial directamente
  Then error `E_SIN_PERMISO` y ve "No tienes permiso para ver esta pantalla"

Scenario: AC-010-05 — encargado consulta (RN-012)
  Given Lucía con un préstamo Devuelto
  When el encargado elige a Lucía en Historial
  Then ve su préstamo, sin cambios

Scenario: AC-010-06 — socio elegido inexistente (E2)
  When la junta elige un socio que no existe
  Then error `E_SOCIO_NO_ENCONTRADO` y no se muestra historial
