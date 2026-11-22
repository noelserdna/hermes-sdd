# BDD-UC-005 — Restablecer contraseña de socio

> Refs: UC-005; REQ-F-002; INV-SOC-002, INV-SOC-102, INV-SEC-003. Convention: Marta ("marta@club.test") olvidó su contraseña.

Feature: Restablecer contraseña — Como encargado quiero dar otra provisional a un socio

Scenario: AC-005-01 — provisional guardada [REQ-F-002 AC5]
  When el encargado fija "Otra12345" para Marta
  Then ve "Contraseña provisional guardada para Marta Ruiz" en Socios

Scenario: AC-005-02 — entra con la nueva [REQ-F-002 AC5]
  When Marta entra con "marta@club.test" y "Otra12345"
  Then ve "Elige una contraseña nueva" en Cambiar contraseña

Scenario: AC-005-03 — la antigua ya no vale [REQ-F-002 AC5]
  When Marta entra con "marta@club.test" y su contraseña antigua
  Then error `E_CREDENCIALES` y ve "Correo o contraseña incorrectos" en Entrar

Scenario: AC-005-04 — contraseña corta
  When el encargado fija "corta" para Marta
  Then error `E_CONTRASENA_CORTA` y la contraseña no cambia

Scenario: AC-005-05 — no es encargado
  Given un socio con sesión
  When intenta restablecer la contraseña de Marta
  Then error `E_ACCESO_DENEGADO` y no cambia nada

Scenario: AC-005-06 — replay
  Given el encargado ya fijó "Otra12345"
  When lo repite
  Then Marta entra con "Otra12345" y no hay duplicados
