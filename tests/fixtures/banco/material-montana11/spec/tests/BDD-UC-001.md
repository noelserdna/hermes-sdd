# BDD-UC-001 — Entrar con correo y contraseña

> Refs: UC-001; REQ-F-001; INV-ACC-004, INV-ACC-006. Convention: "sin cambios" = el almacén conserva sesiones y contador como estaban.

Feature: Entrar — Como socio quiero entrar con mi correo para reservar material

Background:
  Given el socio "lucia@club.test" con contraseña "Cumbre2026" y el encargado "marta@club.test"

Scenario: AC-001-01 — Socio entra [REQ-F-001 AC1]
  When Lucía envía "lucia@club.test" y "Cumbre2026"
  Then el usuario ve el título "Material disponible"

Scenario: AC-001-02 — Encargado entra [REQ-F-001 AC2]
  When Marta envía sus credenciales correctas
  Then el usuario ve el título "Panel del encargado"

Scenario: AC-001-03 — Junta entra
  When una cuenta junta envía sus credenciales correctas
  Then se abre sesión y el usuario ve el título "Historial del socio" (RN-012)

Scenario: AC-001-04 — Bloqueo cumplido [REQ-F-001 AC5]
  Given "lucia@club.test" se bloqueó hace 15 minutos
  When envía la contraseña correcta
  Then el usuario ve el título "Material disponible"

Scenario: AC-001-05 — Datos vacíos
  When envía el correo vacío
  Then error `E_DATOS_INVALIDOS` y el contador de fallos queda sin cambios

Scenario: AC-001-06 — Contraseña errónea [REQ-F-001 AC3]
  When Lucía envía la contraseña "x"
  Then error `E_CREDENCIALES_INVALIDAS`
  And el usuario ve "Correo o contraseña incorrectos"

Scenario: AC-001-07 — Quinto fallo bloquea [REQ-F-001 AC4]
  Given Lucía lleva 4 fallos seguidos
  When falla por 5.ª vez y, 10 minutos después, envía la contraseña correcta
  Then error `E_CUENTA_BLOQUEADA` en ambos envíos
  And el usuario ve "Cuenta bloqueada durante 15 minutos"

Scenario: AC-001-08 — Cuenta en Baja [REQ-F-001 AC9]
  Given el socio "pablo@club.test" está en Baja
  When envía su contraseña correcta
  Then error `E_CREDENCIALES_INVALIDAS` y ve "Correo o contraseña incorrectos"

Scenario: AC-001-09 — Almacén caído
  Given el almacén no está disponible
  When Lucía envía sus credenciales correctas
  Then error `E_ALMACEN_NO_DISPONIBLE` y no se abre sesión

Scenario: AC-001-10 — Mismo envío repetido
  Given Lucía ya entró
  When envía otra vez las mismas credenciales
  Then se abre otra sesión y los fallos siguen a 0
