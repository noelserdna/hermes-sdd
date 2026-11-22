# BDD-UC-003 — Dar de alta socio

> Refs: UC-003; REQ-F-002; INV-SOC-001, INV-SOC-002, INV-SEC-003. Convention: "sin cambios" = la lista de Socios no gana filas.

Feature: Alta de socio — Como encargado quiero dar de alta a un socio para que pueda entrar

Scenario: AC-003-01 — alta correcta [REQ-F-002 AC1]
  Given el encargado en "Socios"
  When registra "Marta Ruiz", "marta@club.test", contraseña "Provisional1"
  Then ve "Socio creado: Marta Ruiz" y "Marta Ruiz — Activo" en Socios

Scenario: AC-003-02 — correo repetido y replay [REQ-F-002 AC2]
  Given "Marta Ruiz" existe
  When el encargado registra "marta@club.test" otra vez
  Then error `E_SOCIO_DUPLICADO` y ve "Ya existe un socio con ese correo" en Socios
  And ve una sola fila "Marta Ruiz — Activo"

Scenario: AC-003-03 — contraseña corta [REQ-F-002 AC3]
  When la contraseña provisional es "corta"
  Then error `E_CONTRASENA_CORTA` y ve "La contraseña debe tener al menos 8 caracteres" en Socios

Scenario: AC-003-04 — no es encargado
  Given un socio con sesión
  When envía un alta
  Then error `E_ACCESO_DENEGADO` y no se crea ninguna cuenta
