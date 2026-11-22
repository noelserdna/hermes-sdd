# BDD-UC-013 — Marcar multa pagada

> Refs: UC-013; REQ-F-006; INV-MUL-002; INV-MUL-003. Convention: el encargado actúa en la página Multas; "sin cambios" = multas y bloqueo intactos.

Feature: Marcar multa pagada — As an encargado I want registrar el pago so that el socio pueda reservar de nuevo

Background:
  Given el encargado ha entrado

Scenario: AC-013-01 — pago levanta el bloqueo [REQ-F-006 AC2]
  Given Pablo Sanz tiene una multa pendiente de 6 €
  When el encargado pulsa "Marcar pagada"
  Then ve "Multa pagada" en Multas
  And Pablo reserva 1 × Tienda del 2026-12-10 al 2026-12-11 y ve "Reserva creada: 1 × Tienda del 2026-12-10 al 2026-12-11" en Mis reservas
  And no ve "No puedes reservar hasta pagar tu multa de 6 €" en Reservar

Scenario: AC-013-02 — replay [REQ-F-006 AC3]
  Given la multa de 6 € de Pablo Sanz acaba de pagarse
  When se envía "Marcar pagada" otra vez
  Then ve "La multa ya estaba pagada" en Multas
  And ve "Pablo Sanz — Multa de 6 € — Pagada" en Multas
  And ve una sola fila "Pablo Sanz — Multa de 6 € — Pagada", no repetida

Scenario: AC-013-03 — otra multa pendiente [REQ-F-006 AC4]
  Given Pablo Sanz tiene 2 multas pendientes de 2 € y 4 €
  When el encargado paga la de 4 €
  Then ve "Multa pagada" en Multas
  And Pablo ve "No puedes reservar hasta pagar tu multa de 2 €" en Reservar

Scenario: AC-013-04 — multa inexistente
  When el encargado paga una multa que no existe
  Then error `E_MULTA_NO_ENCONTRADA`, sin cambios

Scenario: AC-013-05 — rol no permitido
  When un socio o la junta intenta marcar una multa pagada
  Then error `E_ACCESO_DENEGADO`, la multa sigue Pendiente
