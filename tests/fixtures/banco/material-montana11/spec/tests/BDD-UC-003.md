# BDD-UC-003 — Crear socio y listar socios

> Refs: UC-003; REQ-F-002; INV-ACC-001, INV-ACC-002. Convention: "sin cambios" = la lista de Socios queda igual.

Feature: Alta de socios — Como encargado quiero dar de alta socios para que puedan entrar

Background:
  Given sesión del encargado "marta@club.test"

Scenario: AC-003-01 — Alta de socio [REQ-F-002 AC1]
  When crea "Pablo Ruiz", "pablo@club.test", contraseña "Nieve2026"
  Then el usuario ve "Pablo Ruiz" en Socios

Scenario: AC-003-02 — Socio en Baja en la lista
  Given "Pablo Ruiz" está en Baja
  When abre Socios
  Then ve "Pablo Ruiz" marcado "Baja"

Scenario: AC-003-03 — Datos vacíos
  When envía el alta sin nombre
  Then error `E_DATOS_INVALIDOS` y la lista queda sin cambios

Scenario: AC-003-04 — Contraseña corta [REQ-F-002 AC2]
  When crea un socio con contraseña "corta1"
  Then error `E_CONTRASENA_CORTA`
  And el usuario ve "La contraseña debe tener al menos 8 caracteres" y no se crea el socio

Scenario: AC-003-05 — Correo repetido [REQ-F-002 AC3]
  Given "pablo@club.test" ya existe
  When crea otro socio con ese correo
  Then error `E_CORREO_DUPLICADO`
  And el usuario ve "Ya existe un socio con ese correo" y un solo "pablo@club.test"

Scenario: AC-003-06 — Socio no autorizado [REQ-F-002 AC7]
  Given sesión de un socio
  When abre Socios
  Then error `E_ACCESO_NO_PERMITIDO` y el usuario ve "Acceso no permitido"

Scenario: AC-003-07 — Almacén caído
  Given el almacén no está disponible
  When el encargado crea un socio válido
  Then error `E_ALMACEN_NO_DISPONIBLE` y no se crea la cuenta
