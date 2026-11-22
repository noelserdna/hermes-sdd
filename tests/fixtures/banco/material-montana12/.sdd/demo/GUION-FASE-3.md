# Guion de la demo — FASE-3

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## WF-002 — Alta y primer acceso de un socio

1. Alta del socio (UC-003) (UC-003)
2. Primer acceso con la provisional (UC-001) (UC-001)
3. Cambio de contraseña (UC-004) (UC-004)
4. Primera reserva (UC-007) (UC-007)

Navegación:
- 1: Socios · encargado · entrada «Socios» · rellena nombre, correo y contraseña provisional
- 2: Entrar · socio · dirección de la web · escribe correo y provisional
- 3: Cambiar contraseña · socio · se muestra al entrar con provisional · escribe la contraseña nueva
- 4: Mis reservas · socio · tras cambiar la contraseña · abre «Reservar»

## UC-003 — Dar de alta socio

Flujo principal:
1. Encargado: envía nombre, correo y contraseña provisional en Socios.
2. Sistema: comprueba que es encargado (API-001-08, INV-SEC-003).
3. Sistema: valida la contraseña, mínimo `PASSWORD_MIN_LENGTH` (INV-SOC-002).
4. Sistema: comprueba que el correo no existe, ni entre cuentas de baja (INV-SOC-001, RN-005).
5. Sistema: crea la cuenta (INV-SOC-009) y la lista de Socios la muestra.

Extensiones:
- 5a. la cuenta nueva entra con la provisional → UC-001 y UC-004 (WF-002 pasos 2-3).

Criterios:
- AC-003-01: Alta, baja y contraseña de los socios. En Socios se ve «Socio creado: {nombre}» y «Marta Ruiz — Activo».
  El criterio pide: the user sees "Socio creado: Marta Ruiz" and "Marta Ruiz" in the list
- AC-003-02: Alta, baja y contraseña de los socios. En Socios se ve «Ya existe un socio con ese correo» y «Marta Ruiz — Activo».
  El criterio pide: the user sees "Ya existe un socio con ese correo" and the list has one "Marta Ruiz"
- AC-003-03: Alta, baja y contraseña de los socios. En Socios se ve «La contraseña debe tener al menos 8 caracteres».
  El criterio pide: the user sees "La contraseña debe tener al menos 8 caracteres"

## UC-004 — Cambiar contraseña provisional

Flujo principal:
1. Socio: entra con la provisional (UC-001); Sistema: muestra Cambiar contraseña (INV-SOC-006).
2. Sistema: toda otra página vuelve a Cambiar contraseña (API-001-08).
3. Socio: envía la contraseña nueva.
4. Sistema: valida mínimo `PASSWORD_MIN_LENGTH` (INV-SOC-002).
5. Sistema: guarda cifrada y quita `mustChangePassword` (API-001-03); muestra su página.

Extensiones:
- 2a. el socio abre otra página sin cambiarla → se muestra Cambiar contraseña. (AC-004-02)

Criterios:
- AC-004-01: Alta, baja y contraseña de los socios. En Cambiar contraseña se ve «Elige una contraseña nueva», «Elige una contraseña nueva» y «La contraseña debe tener al menos 8 caracteres».
  El criterio pide: the user sees "Elige una contraseña nueva" and she cannot continue until she sets one of at least 8 characters

## UC-005 — Restablecer contraseña de socio

Flujo principal:
1. Encargado: elige al socio en Socios e introduce la provisional.
2. Sistema: comprueba que es encargado (API-001-08).
3. Sistema: valida mínimo `PASSWORD_MIN_LENGTH` (INV-SOC-002).
4. Sistema: guarda cifrada y activa `mustChangePassword` (API-001-05); muestra "Contraseña provisional guardada para {nombre}".
5. Socio: entra con la nueva (UC-001) y la cambia (UC-004).

Extensiones:
- 5a. el socio entra con la contraseña antigua → `E_CREDENCIALES`. (AC-005-03)

Criterios:
- AC-005-01: Alta, baja y contraseña de los socios. En Socios se ve «Contraseña provisional guardada para {nombre}», «Elige una contraseña nueva» y «Correo o contraseña incorrectos».
  El criterio pide: the user sees "Contraseña provisional guardada para Marta Ruiz" and Marta can enter with "Otra12345" and no longer with her old password

## UC-006 — Dar de baja socio

Flujo principal:
1. Encargado: pide la baja del socio en Socios.
2. Sistema: comprueba que es encargado (API-001-08).
3. Sistema: comprueba que no hay préstamos sin devolver (INV-SOC-007); si además hay multas, gana este error (RN-006).
4. Sistema: comprueba que no hay multas Pendiente (INV-SOC-007).
5. Sistema: en una sola operación cancela sus reservas Reservada, sin la guarda de fecha de API-002-03 (SM-001), y pasa la cuenta a Baja (API-001-06).
6. Sistema: muestra "Socio dado de baja: {nombre}".

Extensiones:
- 6a. el socio dado de baja intenta entrar → `E_CREDENCIALES` (INV-SOC-008). (AC-006-02)
- 5a. con reservas futuras → quedan canceladas y sus unidades libres. (AC-006-03)

Criterios:
- AC-006-01: Alta, baja y contraseña de los socios. En Socios se ve «Socio dado de baja: {nombre}» y «Correo o contraseña incorrectos».
  El criterio pide: the user sees "Socio dado de baja: Marta Ruiz" and she can no longer log in
- AC-006-04: Alta, baja y contraseña de los socios. En Socios se ve «No se puede dar de baja: tiene material sin devolver», «Lucía Gil — Activo» y «Hola, {nombre}».
  El criterio pide: the user sees "No se puede dar de baja: tiene material sin devolver" and her account stays active
- AC-006-05: Alta, baja y contraseña de los socios. En Socios se ve «No se puede dar de baja: tiene multas sin pagar».
  El criterio pide: the user sees "No se puede dar de baja: tiene multas sin pagar"
- AC-006-03: Alta, baja y contraseña de los socios. la reserva de Marta queda en estado "Cancelada": solo se guarda en el fichero de datos, porque Marta ya no puede entrar y ninguna pantalla muestra reservas de un socio dado de baja
  El criterio pide: the user sees "Socio dado de baja: Marta Ruiz", her reservation is cancelled and its units become free
