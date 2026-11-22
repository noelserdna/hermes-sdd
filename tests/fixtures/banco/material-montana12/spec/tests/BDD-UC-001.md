# BDD-UC-001 — Entrar

> Refs: UC-001; REQ-F-001; INV-SOC-004, INV-SOC-005, INV-SOC-008. Convention: "Hoy" = día del servidor (RN-022); "sin cambios" = sin sesión nueva.

Feature: Entrar — Como usuario quiero entrar con mi correo para ver mi página

Scenario: AC-001-01 — socio entra [REQ-F-001 AC1]
  Given socio "lucia@club.test" con contraseña "Cumbre2026!"
  When introduce ambos en Entrar
  Then ve "Hola, Lucía" en la página "Mis reservas"

Scenario: AC-001-02 — encargado entra [REQ-F-001 AC2]
  Given encargado "pablo@club.test" con contraseña "Piolet2026!"
  When introduce ambos en Entrar
  Then ve "Hola, Pablo" en la página "Panel del encargado"

Scenario: AC-001-03 — contraseña errónea [REQ-F-001 AC3]
  When "lucia@club.test" introduce una contraseña incorrecta
  Then error `E_CREDENCIALES` y ve "Correo o contraseña incorrectos" en Entrar

Scenario: AC-001-04 — bloqueo tras fallos [REQ-F-001 AC4]
  Given "lucia@club.test" falló 5 veces seguidas
  When 1 minuto después introduce la contraseña correcta
  Then error `E_CUENTA_BLOQUEADA` y ve "Cuenta bloqueada. Vuelve a intentarlo en 15 minutos" en Entrar

Scenario: AC-001-05 — fin del bloqueo [REQ-F-001 AC5]
  Given "lucia@club.test" fue bloqueada hace 15 minutos
  When introduce la contraseña correcta
  Then ve "Hola, Lucía" en la página "Mis reservas"

Scenario: AC-001-06 — sesión caducada [REQ-F-001 AC6]
  Given una sesión con 30 minutos sin actividad
  When abre cualquier página
  Then ve el formulario "Entrar"

Scenario: AC-001-07 — visitante sin sesión [REQ-F-001 AC8]
  When abre "/mis-reservas" sin sesión
  Then ve el formulario "Entrar"

Scenario: AC-001-08 — página no permitida
  Given socio con sesión
  When abre una página del encargado
  Then error `E_PAGINA_PROHIBIDA` sin datos de otros socios

Scenario: AC-001-09 — replay de entrada
  Given "lucia@club.test" con sesión abierta
  When envía de nuevo correo y contraseña correctos
  Then ve "Hola, Lucía" y no se duplica ningún dato
