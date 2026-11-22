# BDD-UC-018 — Consultar historial de un socio

> Refs: UC-018; REQ-F-009; INV-SEC-001, INV-SEC-002. Convention: la junta tiene sesión y está en "Historial del socio".

Feature: Historial del socio — Como junta quiero ver el historial de un socio para controlar el material

Scenario: AC-018-01 — historial con multa pagada [REQ-F-009 AC1]
  Given Lucía devolvió 2 × Casco del 2026-12-05 al 2026-12-07 el 2026-12-09 y pagó su multa de 4 €
  When la junta busca "lucia"
  Then ve "2 × Casco del 2026-12-05 al 2026-12-07 — devuelto el 2026-12-09" y "Multa de 4 € — Pagada" en Historial del socio

Scenario: AC-018-02 — sin préstamos [REQ-F-009 AC2]
  Given un socio sin préstamos ni multas
  When la junta abre su historial
  Then ve "Sin préstamos ni multas" en Historial del socio

Scenario: AC-018-03 — sin coincidencias [REQ-F-009 AC3]
  When la junta busca "zzz"
  Then error `E_BUSQUEDA_VACIA` y ve "Ningún socio coincide" en Historial del socio

Scenario: AC-018-04 — solo lectura [REQ-F-009 AC4]
  When la junta ve un historial
  Then ve "Historial del socio" sin ningún botón "Entregar", "Devolver", "Marcar pagada" ni "Cancelar"

Scenario: AC-018-05 — varios resultados
  Given dos socios cuyo nombre contiene "ma"
  When la junta busca "MA"
  Then ve una lista para elegir uno

Scenario: AC-018-06 — rol no permitido
  Given un socio con sesión
  When busca el historial de otro socio
  Then error `E_ACCESO_DENEGADO` sin datos de ningún socio
