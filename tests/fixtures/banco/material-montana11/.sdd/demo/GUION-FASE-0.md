# Guion de la demo — FASE-0

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## WF-002 — Sesión de acceso

1. Entrar (UC-001) (UC-001)
2. Operar con sesión (UC-002) (UC-002)
3. Caducidad (UC-002) (UC-002)
4. Salir (UC-002) (UC-002)
5. Gestionar cuentas (UC-003, UC-004) (UC-003)

Navegación:
- 1: Entrar · cualquiera · dirección de la web · envía correo y contraseña
- 2: Inicio del socio / Inicio del encargado / Historial del socio · por rol · tras entrar · usa el menú (RN-012)
- 4: Entrar · cualquiera · botón "Salir" · vuelve al formulario
- 5: Socios · encargado · menú del Panel del encargado · crea, restablece o da de baja

## UC-001 — Entrar con correo y contraseña

Flujo principal:
1. Socio: envía correo y contraseña.
2. System: comprueba que ambos datos vienen informados.
3. System: rechaza si la cuenta está bloqueada, incluso con contraseña correcta (INV-ACC-004).
4. System: verifica contraseña y estado Activa (INV-ACC-006); si falla, suma un fallo y, al llegar a `LOGIN_MAX_FAILURES`, bloquea `LOCK_MINUTES` (INV-ACC-004, SM-004).
5. System: pone los fallos a 0 y abre la sesión (INV-SEC-003).
6. System: muestra el inicio del rol: "Inicio del socio".

Extensiones:
- 6a. Rol encargado → "Inicio del encargado". (AC-001-02)
- 6b. Rol junta → inicio de la junta. (AC-001-03)
- 3a. Bloqueo ya cumplido `LOCK_MINUTES` → sigue en 4 con fallos a 0. (AC-001-04)

Criterios:
- AC-001-01: Entrar con correo y contraseña. En Inicio del socio se ve «Material disponible».
  El criterio pide: the user sees the heading "Material disponible"
- AC-001-02: Entrar con correo y contraseña. En Inicio del encargado se ve «Panel del encargado».
  El criterio pide: the user sees the heading "Panel del encargado"
- AC-001-06: Entrar con correo y contraseña. En Entrar se ve «Correo o contraseña incorrectos».
  El criterio pide: the user sees "Correo o contraseña incorrectos"
- AC-001-07: Entrar con correo y contraseña. En Entrar se ve «Cuenta bloqueada durante 15 minutos».
  El criterio pide: the user sees "Cuenta bloqueada durante 15 minutos" and a 6th attempt with the correct password 10 minutes later is also rejected
- AC-001-04: Entrar con correo y contraseña. En Inicio del socio se ve «Material disponible».
  El criterio pide: the user sees the heading "Material disponible"
- AC-001-08: Entrar con correo y contraseña. En Entrar se ve «Correo o contraseña incorrectos».
  El criterio pide: the user sees "Correo o contraseña incorrectos"

## UC-002 — Mantener y cerrar la sesión

Flujo principal:
1. Socio: abre cualquier pantalla.
2. System: comprueba la sesión (API-001-03) frente a `SESSION_IDLE_MINUTES` sin actividad (INV-ACC-005).
3. System: renueva la última actividad y muestra la pantalla (INV-SEC-003).
4. Socio: pulsa "Salir".
5. System: cierra la sesión (API-001-02) y muestra el formulario Entrar.

Extensiones:
- 5a. Volver a una pantalla de socio tras "Salir" → Entrar (E1). (AC-002-02)
- 3a. Actividad dentro del plazo → la caducidad se cuenta desde la última actividad. (AC-002-04)

Criterios:
- AC-002-05: Entrar con correo y contraseña. En Entrar se ve «Sesión caducada, vuelve a entrar».
  El criterio pide: the user sees the login form with "Sesión caducada, vuelve a entrar"
- AC-002-01: Entrar con correo y contraseña. En Entrar se ve «Entrar».
  El criterio pide: the user sees the login form and going back to a member screen shows the login form again
- AC-002-03: Entrar con correo y contraseña. En Entrar se ve «Entrar».
  El criterio pide: the user sees the login form

## UC-003 — Crear socio y listar socios

Flujo principal:
1. Encargado: abre Socios.
2. System: lista nombre, correo y estado de cada socio (API-001-05, INV-SEC-001).
3. Encargado: envía nombre, correo y contraseña.
4. System: valida que los tres datos vienen informados.
5. System: valida la contraseña mínima (INV-ACC-002) y la unicidad del correo (INV-ACC-001).
6. System: guarda la cuenta de forma atómica (INV-SEC-003) y muestra la lista actualizada.

Extensiones:
- 2a. Un socio dado de baja → aparece marcado "Baja". (AC-003-02)

Criterios:
