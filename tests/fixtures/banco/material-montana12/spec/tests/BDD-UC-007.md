# BDD-UC-007 — Reservar material

> Refs: UC-007; REQ-F-003; REQ-F-007; INV-RES-001..004, INV-MUL-002, INV-MAT-003. Convention: hoy = 2026-11-22; "sin cambios" = ninguna reserva nueva.

Feature: Reservar material — As a socio I want reservar unidades so that tengo el material esos días

Background:
  Given Lucía y Pablo Sanz son socios con sesión abierta

Scenario: AC-007-01 — reserva creada [REQ-F-003 AC1]
  Given "Casco" tiene 6 unidades y ninguna reservada del 2026-12-05 al 2026-12-07
  When Lucía reserva 2 de Casco del 2026-12-05 al 2026-12-07
  Then ve "Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07" en "Mis reservas"

Scenario: AC-007-02 — sin unidades [REQ-F-003 AC2]
  Given "Tienda" tiene 2 unidades y Lucía reservó 1 del 2026-12-05 al 2026-12-07
  When Pablo Sanz reserva 2 de Tienda del 2026-12-06 al 2026-12-08
  Then error `E_SIN_UNIDADES`: "No hay unidades libres: solo queda 1 de Tienda el 2026-12-06"
  And Pablo Sanz ve "Aún no tienes reservas" en "Mis reservas"

Scenario: AC-007-03 — mismo formulario repetido [REQ-F-003 AC3]
  Given "Linterna" tiene 3 unidades y Lucía reservó 2 del 2026-12-05 al 2026-12-07
  When se envía otra vez el mismo formulario
  Then error `E_SIN_UNIDADES`: "No hay unidades libres: solo queda 1 de Linterna el 2026-12-05"
  And "Mis reservas" muestra una sola fila "2 × Linterna del 2026-12-05 al 2026-12-07 — Reservada"

Scenario: AC-007-04 — fecha pasada [REQ-F-003 AC4]
  When Lucía elige inicio 2026-11-21
  Then error `E_FECHA_PASADA`: "La fecha de inicio no puede ser pasada"

Scenario: AC-007-05 — fin anterior [REQ-F-003 AC5]
  When Lucía elige inicio 2026-12-05 y fin 2026-12-01
  Then error `E_FECHA_FIN_ANTERIOR`: "La fecha de fin no puede ser anterior a la de inicio"

Scenario: AC-007-06 — demasiados días [REQ-F-003 AC6]
  When Lucía pide del 2026-12-01 al 2026-12-15
  Then error `E_MAX_DIAS`: "Máximo 14 días por reserva"

Scenario: AC-007-07 — demasiadas unidades [REQ-F-003 AC7]
  When Lucía pide 6 unidades de un tipo
  Then error `E_MAX_UNIDADES`: "Máximo 5 unidades por reserva"

Scenario: AC-007-08 — multa pendiente de Pablo [REQ-F-003 AC8]
  Given Pablo Sanz tiene una multa pendiente de 6 € y ninguna reserva
  When intenta reservar
  Then error `E_MULTA_PENDIENTE`: "No puedes reservar hasta pagar tu multa de 6 €"
  And ve "Aún no tienes reservas" en "Mis reservas"

Scenario: AC-007-09 — multa pendiente de Lucía [REQ-F-003 AC9]
  Given Lucía tiene una multa pendiente de 2 €
  When intenta reservar
  Then error `E_MULTA_PENDIENTE`: "No puedes reservar hasta pagar tu multa de 2 €"

Scenario: AC-007-10 — tipos ofrecidos [REQ-F-007 AC6]
  Given "Casco" tiene 6 unidades y "Cuerda" 0
  When un socio abre "Reservar"
  Then la lista de tipos muestra "Casco" y no ofrece "Cuerda"

Scenario: AC-007-11 — rol no permitido
  When el encargado intenta reservar
  Then error `E_PAGINA_PROHIBIDA` o `E_ACCESO_DENEGADO` y sin cambios
