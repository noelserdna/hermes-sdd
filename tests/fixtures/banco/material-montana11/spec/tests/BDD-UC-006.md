# BDD-UC-006 — Ver mis reservas

> Refs: UC-006; REQ-F-004; INV-SEC-001.

Feature: Ver mis reservas — As a socio I want ver mis reservas so that controlo lo que he pedido

Scenario: AC-006-01 — solo las propias [REQ-F-004 AC1]
  Given "lucia" tiene "Piolet" 2026-12-05 a 2026-12-07 y "pablo" "Casco" 2026-12-06 a 2026-12-07
  When "lucia" abre "Mis reservas"
  Then ve "Piolet"
  And no ve "Casco"

Scenario: AC-006-02 — sin reservas [REQ-F-004 AC4]
  Given "lucia" no tiene reservas
  When abre "Mis reservas"
  Then ve "No tienes reservas"

Scenario: AC-006-03 — sin sesión
  When un visitante sin sesión abre "Mis reservas"
  Then error `E_NO_AUTENTICADO` y no se lista nada

Scenario: AC-006-04 — almacén caído
  When "lucia" abre "Mis reservas" y el almacén falla
  Then error `E_ALMACEN_NO_DISPONIBLE`
