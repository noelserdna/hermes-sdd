# BDD-UC-002 — Mantener y cerrar la sesión

> Refs: UC-002; REQ-F-001; INV-ACC-005. Convention: el reloj del sistema se fija en cada Given (ADR-002).

Feature: Sesión — Como socio quiero salir y que la sesión caduque para proteger mi cuenta

Background:
  Given el socio "lucia@club.test" con sesión abierta

Scenario: AC-002-01 — Salir [REQ-F-001 AC7]
  When Lucía pulsa "Salir"
  Then el usuario ve el formulario "Entrar"

Scenario: AC-002-02 — Volver tras salir [REQ-F-001 AC7]
  Given Lucía pulsó "Salir"
  When abre una pantalla de socio
  Then error `E_NO_AUTENTICADO` y el usuario ve "Entrar"

Scenario: AC-002-03 — Visitante anónimo [REQ-F-001 AC8]
  Given un visitante anónimo
  When abre "Mis reservas"
  Then error `E_NO_AUTENTICADO` y el usuario ve "Entrar"

Scenario: AC-002-04 — Actividad renueva
  Given Lucía operó hace 20 minutos
  When abre una pantalla 20 minutos después
  Then la pantalla se muestra y la caducidad cuenta desde ahora

Scenario: AC-002-05 — Sesión caducada [REQ-F-001 AC6]
  Given Lucía no tiene actividad desde hace 30 minutos y 1 segundo
  When abre cualquier pantalla
  Then error `E_SESION_CADUCADA`
  And el usuario ve "Sesión caducada, vuelve a entrar"

Scenario: AC-002-06 — Almacén caído
  Given el almacén no está disponible
  When Lucía abre una pantalla
  Then error `E_ALMACEN_NO_DISPONIBLE` y la actividad no se renueva

Scenario: AC-002-07 — Salir repetido
  Given Lucía ya salió
  When repite "Salir"
  Then error `E_NO_AUTENTICADO` y el usuario ve "Entrar"
