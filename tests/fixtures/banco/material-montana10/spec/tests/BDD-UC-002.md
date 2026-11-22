# BDD-UC-002 — Gestionar socios

> Refs: UC-002; REQ-F-002; INV-ACC-001, INV-ACC-002, INV-ACC-007, INV-ACC-103. Convention: API-001-03..06 como Encargado.

Feature: Gestionar socios — Como Encargado quiero mantener cuentas para que los socios entren

Scenario: AC-002-01 — alta [REQ-F-002 AC1]
  When el encargado en Socios crea "Marta Ruiz", "marta@club.es", contraseña "Glaciar2026"
  Then ve "Marta Ruiz" en la lista de Socios y Marta puede entrar

Scenario: AC-002-02 — correo duplicado [REQ-F-002 AC2]
  Given "marta@club.es" ya existe
  When el encargado crea otro con ese correo
  Then error `E_CORREO_DUPLICADO`, ve "Ya existe un socio con ese correo" y la lista mantiene un solo "Marta Ruiz"

Scenario: AC-002-03 — contraseña corta [REQ-F-002 AC3]
  When el encargado crea un socio con contraseña "corta" (5 caracteres)
  Then error `E_CONTRASENA_CORTA`, ve "La contraseña debe tener al menos 8 caracteres" y no se crea cuenta

Scenario: AC-002-04 — baja [REQ-F-002 AC4]
  Given "pablo@club.es" sin reserva en curso ni multa pendiente
  When el encargado lo da de baja
  Then ve "Pablo" con "Baja" en Socios y Pablo no puede entrar

Scenario: AC-002-05 — baja bloqueada [REQ-F-002 AC5]
  Given "lucia@club.es" tiene el material "Casco 2" prestado
  When el encargado la da de baja
  Then error `E_BAJA_SOCIO_BLOQUEADA`, ve "No se puede dar de baja: tiene material prestado o multas pendientes" y su cuenta sigue Activa

Scenario: AC-002-06 — restablecer [REQ-F-002 AC6]
  Given "marta@club.es" olvidó su contraseña
  When el encargado fija "Nieve2026"
  Then ve "Contraseña restablecida", Marta entra con ella y la antigua ya no vale

Scenario: AC-002-07 — sin permiso [REQ-F-002 AC7]
  When el socio "lucia@club.es" abre Socios directamente
  Then error `E_SIN_PERMISO` y ve "No tienes permiso para ver esta pantalla"

Scenario: AC-002-08 — restablecer con contraseña corta
  When el encargado fija "corta" a "marta@club.es"
  Then error `E_CONTRASENA_CORTA` y la contraseña vigente no cambia

Scenario: AC-002-09 — altas simultáneas
  When dos altas con "marta@club.es" llegan a la vez
  Then una crea la cuenta y la otra da `E_CORREO_DUPLICADO`

Scenario: AC-002-10 — baja repetida
  When el encargado repite la baja de "pablo@club.es"
  Then sigue en "Baja" sin cambios

Scenario: AC-002-11 — restablecer repetido
  When el encargado repite "Nieve2026" a "marta@club.es"
  Then "Contraseña restablecida" y Marta sigue entrando con ella

Scenario: AC-002-12 — datos del socio inválidos (RN-021)
  When el encargado crea un socio con nombre vacío o correo "marta"
  Then error `E_DATOS_SOCIO_INVALIDOS` y no se crea cuenta
