# BDD-UC-006 — Dar de baja socio

> Refs: UC-006; REQ-F-002; INV-SOC-007, INV-SOC-008, INV-SOC-101. Convention: "sin cambios" = cuenta activa y reservas en su estado.

Feature: Baja de socio — Como encargado quiero dar de baja a un socio sin deudas

Scenario: AC-006-01 — baja correcta [REQ-F-002 AC6]
  Given Marta Ruiz sin préstamos abiertos ni multas pendientes
  When el encargado la da de baja
  Then ve "Socio dado de baja: Marta Ruiz" en Socios

Scenario: AC-006-02 — ya no entra [REQ-F-002 AC6]
  Given Marta dada de baja
  When entra con su correo y su contraseña
  Then error `E_CREDENCIALES` y ve "Correo o contraseña incorrectos" en Entrar

Scenario: AC-006-03 — reserva futura cancelada [REQ-F-002 AC9]
  Given Marta tiene 2 × Casco del 2026-12-05 al 2026-12-07
  When el encargado la da de baja
  Then ve "Socio dado de baja: Marta Ruiz" en Socios
  And Lucía reserva lo mismo y ve "Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07" en Mis reservas

Scenario: AC-006-04 — material sin devolver [REQ-F-002 AC7]
  Given Lucía tiene 1 préstamo sin devolver
  When el encargado la da de baja
  Then error `E_BAJA_PRESTAMOS` y ve "No se puede dar de baja: tiene material sin devolver" y "Lucía Gil — Activo" en Socios
  And Lucía entra y ve "Hola, Lucía" en Mis reservas

Scenario: AC-006-05 — multa pendiente [REQ-F-002 AC8]
  Given Pablo tiene una multa pendiente de 4 €
  When el encargado lo da de baja
  Then error `E_BAJA_MULTAS` y ve "No se puede dar de baja: tiene multas sin pagar" en Socios

Scenario: AC-006-06 — no es encargado
  Given un socio con sesión
  When intenta dar de baja a Marta
  Then error `E_ACCESO_DENEGADO` y no cambia nada

Scenario: AC-006-07 — replay
  Given Marta ya está de baja
  When el encargado repite la baja
  Then no cambia nada ni se cancela nada más
