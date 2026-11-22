# BDD-UC-001 — Entrar y salir

> Refs: UC-001; REQ-F-001; INV-ACC-004, INV-ACC-005, INV-ACC-101.

Feature: Entrar y salir

Scenario: AC-001-01 — entrar como socia [REQ-F-001 AC1]
  When el socio "lucia@club.es" envía "Cumbre2026" en Entrar
  Then ve "Hola, Lucía" en Mis reservas

Scenario: AC-001-02 — entrar como socio [REQ-F-001 AC2]
  When el socio "pablo@club.es" envía "Arista2026" en Entrar
  Then ve "Hola, Pablo" en Mis reservas

Scenario: AC-001-03 — contraseña incorrecta [REQ-F-001 AC3]
  When "lucia@club.es" envía la contraseña "mala"
  Then error `E_CREDENCIALES_INVALIDAS`, ve "Correo o contraseña incorrectos" y sigue en Entrar

Scenario: AC-001-04 — cuenta bloqueada [REQ-F-001 AC4]
  Given `LOGIN_MAX_FAILURES` fallos seguidos de "lucia@club.es"
  When envía la contraseña correcta dentro de `LOGIN_LOCK_MINUTES`
  Then error `E_CUENTA_BLOQUEADA`, ve "Cuenta bloqueada. Inténtalo de nuevo en 15 minutos" y no hay sesión

Scenario: AC-001-05 — bloqueo cumplido [REQ-F-001 AC5]
  Given "lucia@club.es" se bloqueó hace 15 minutos
  When envía la contraseña correcta
  Then ve "Hola, Lucía" en Mis reservas

Scenario: AC-001-06 — sesión caducada [REQ-F-001 AC6]
  Given una sesión de "lucia@club.es" con `SESSION_IDLE_HOURS` sin actividad
  When abre cualquier pantalla
  Then error `E_SESION_CADUCADA` y ve Entrar con "Tu sesión ha caducado"

Scenario: AC-001-07 — salir [REQ-F-001 AC7]
  When "lucia@club.es", dentro, pulsa "Salir"
  Then ve el formulario "Entrar" y volver a Mis reservas pide entrar

Scenario: AC-001-08 — sin sesión [REQ-F-001 AC8]
  When nadie ha entrado y se abre Mis reservas directamente
  Then error `E_NO_AUTENTICADO` y ve el formulario "Entrar"

Scenario: AC-001-09 — doble envío [REQ-F-001 AC9]
  When "lucia@club.es" envía dos veces el mismo formulario correcto
  Then hay una sola sesión y ve "Hola, Lucía"

Scenario: AC-001-10 — correo desconocido o en Baja
  When envía un correo desconocido o de una cuenta en Baja
  Then error `E_CREDENCIALES_INVALIDAS` y el contador no cambia

Scenario: AC-001-11 — fallo que bloquea
  Given 4 fallos seguidos
  When envía otra contraseña incorrecta
  Then queda bloqueada `LOGIN_LOCK_MINUTES`

Scenario: AC-001-12 — pantalla inicial por rol
  When entran un encargado y una cuenta de la junta
  Then ven Entregas y devoluciones, e Historial

Scenario: AC-001-13 — salir sin sesión
  When se repite "Salir" sin sesión
  Then ve el formulario "Entrar"
