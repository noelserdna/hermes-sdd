# Guion de la demo — FASE-0

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## WF-002 — Sesión de una cuenta

1. entrar
2. bloqueo tras fallos
3. caducidad por inactividad
4. salir

Navegación:
- 1: Entrar · cualquier cuenta · dirección de la web · envía correo y contraseña
- 4: Mis reservas (o la pantalla inicial del rol) · cualquier cuenta · botón Salir · pulsa Salir y vuelve a Entrar

## UC-001 — Entrar y salir

Flujo principal:
1. Cuenta: abre Entrar y envía correo y contraseña (WF-002 step 1).
2. System: normaliza el correo (RN-014) y busca una cuenta Activa (INV-ACC-006).
3. System: comprueba que no está bloqueada (INV-ACC-004, WF-002 step 2).
4. System: verifica la contraseña; el acierto reinicia el contador (RN-005).
5. System: crea la sesión, una sola por envío repetido (INV-ACC-101).
6. System: muestra la pantalla inicial de su rol con "Hola, {nombre}" (RN-015).
7. System: cada operación renueva la actividad; pasado `SESSION_IDLE_HOURS` la sesión caduca (RN-006, WF-002 step 3).
8. Cuenta: pulsa "Salir" (WF-002 step 4).
9. System: cierra la sesión y muestra Entrar (INV-ACC-102). (AC-001-07)

Extensiones:
- 4a. Fallo número `LOGIN_MAX_FAILURES` → la cuenta se bloquea `LOGIN_LOCK_MINUTES` (RN-005). (AC-001-11)
- 6a. Encargado o Junta → su pantalla inicial según RN-015. (AC-001-12)
- 3a. Bloqueo ya cumplido → se entra con normalidad. (AC-001-05)

Criterios:
- AC-001-01: Entrar, salir y proteger la sesión. En Mis reservas se ve «Hola, {nombre}».
  El criterio pide: the user sees "Hola, Lucía" in Mis reservas
- AC-001-02: Entrar, salir y proteger la sesión. En Mis reservas se ve «Hola, {nombre}».
  El criterio pide: the user sees "Hola, Pablo" in Mis reservas
- AC-001-03: Entrar, salir y proteger la sesión. En Entrar se ve «Correo o contraseña incorrectos».
  El criterio pide: the user sees "Correo o contraseña incorrectos" and stays in Entrar
- AC-001-04: Entrar, salir y proteger la sesión. En Entrar se ve «Cuenta bloqueada. Inténtalo de nuevo en 15 minutos».
  El criterio pide: the user sees "Cuenta bloqueada. Inténtalo de nuevo en 15 minutos" and no session starts
- AC-001-05: Entrar, salir y proteger la sesión. En Mis reservas se ve «Hola, {nombre}».
  El criterio pide: the user sees "Hola, Lucía" in Mis reservas
- AC-001-06: Entrar, salir y proteger la sesión. En Entrar se ve «Tu sesión ha caducado».
  El criterio pide: the user sees the Entrar form with "Tu sesión ha caducado"
- AC-001-07: Entrar, salir y proteger la sesión. En Entrar se ve «Entrar».
  El criterio pide: the user sees the Entrar form and going back to Mis reservas asks to enter again
- AC-001-08: Entrar, salir y proteger la sesión. En Entrar se ve «Entrar».
  El criterio pide: the user sees the Entrar form
- AC-001-09: Entrar, salir y proteger la sesión. En Mis reservas se ve «Hola, {nombre}».
  El criterio pide: there is one single session and the user sees "Hola, Lucía"

## UC-003 — Reservar material

Flujo principal:
1. Socio: abre Reservar, elige tipo, desde y hasta, y envía.
2. System: comprueba rol y tipo (INV-ACC-008, INV-STK-004).
3. System: valida fechas en el orden de RN-017: pasado, orden, duración (INV-RES-002, INV-RES-003, INV-RES-001).
4. System: comprueba que no tiene multa Pendiente (INV-RES-005, RN-007).
5. System: si ya tiene una Reservada idéntica, la devuelve sin crear otra (RN-004, INV-RES-008).
6. System: en una sola operación indivisible por tipo, comprueba unidades libres cada día y crea la reserva (RN-002, RN-018, INV-RES-004).
7. System: muestra Mis reservas con la confirmación.

Extensiones:
- 6a. Las unidades ocupadas no coinciden en los mismos días del rango → se crea la reserva. (AC-003-04)

Criterios:
- AC-003-01: Reservar material para unas fechas. En Mis reservas se ve «Reserva creada: {material} del {desde} al {hasta}».
  El criterio pide: the user sees "Reserva creada: Piolet del 2026-12-05 al 2026-12-07" in Mis reservas
- AC-003-02: Reservar material para unas fechas. se ve en la lista; el criterio comprueba que sigue habiendo una sola fila
  El criterio pide: Mis reservas still has one reserva of "Piolet" for those dates
- AC-003-03: Reservar material para unas fechas. En Reservar se ve «No quedan unidades libres de {material} esas fechas».
  El criterio pide: the user sees "No quedan unidades libres de Tienda esas fechas" and no reserva is created
- AC-003-04: Reservar material para unas fechas. En Mis reservas se ve «Reserva creada: {material} del {desde} al {hasta}».
  El criterio pide: the reserva is created (the units are free those days)
- AC-003-05: Reservar material para unas fechas. En Reservar se ve «Las fechas no pueden estar en el pasado».
  El criterio pide: the user sees "Las fechas no pueden estar en el pasado" and no reserva is created
- AC-003-06: Reservar material para unas fechas. En Reservar se ve «La fecha final no puede ser anterior a la inicial».
  El criterio pide: the user sees "La fecha final no puede ser anterior a la inicial"
- AC-003-07: Reservar material para unas fechas. En Reservar se ve «Máximo 14 días por reserva».
  El criterio pide: the user sees "Máximo 14 días por reserva" and no reserva is created
- AC-003-08: Reservar material para unas fechas. En Reservar se ve «Tienes una multa pendiente de {importe} €. Págala al encargado para poder reservar».
  El criterio pide: the user sees "Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar" and no reserva is created
- AC-003-09: Reservar material para unas fechas. En Reservar se ve «Tienes una multa pendiente de {importe} €. Págala al encargado para poder reservar».
  El criterio pide: the user sees "Tienes una multa pendiente de 2 €. Págala al encargado para poder reservar"
- AC-003-10: Reservar material para unas fechas. En Reservar se ve «No quedan unidades libres de {material} esas fechas».
  El criterio pide: only one reserva is created and the other user sees "No quedan unidades libres de Crampones esas fechas"

## UC-008 — Gestionar inventario

Flujo principal:
1. Encargado: abre Inventario.
2. System: comprueba rol y lista por tipo "{material} · {n} unidades" (solo Activas) y cada unidad (INV-ACC-008).
3. Encargado: indica tipo y cantidad y añade.
4. System: valida tipo y cantidad, crea las unidades y muestra "Añadidas {n} unidades de {material}" (INV-STK-003, INV-STK-004).
5. Encargado: marca una unidad como rota.
6. System: si ya está DeBaja, no cambia nada (INV-STK-001).
7. System: comprueba que no está Prestada (INV-STK-002) y la pasa a DeBaja; muestra "{unidad} · De baja" (RN-011).

Extensiones:
- 4a. Repetir el añadido suma otras unidades; no es idempotente por diseño. (AC-008-02)
- 7a. La unidad tiene reservas futuras → se da de baja igualmente (RN-011). (AC-008-03)

Criterios:
- AC-008-01: Gestionar el inventario. En Inventario se ve «{material} · {n} unidades».
  El criterio pide: the user sees "Piolet · 5 unidades" in Inventario
- AC-008-02: Gestionar el inventario. En Inventario se ve «Añadidas {n} unidades de {material}».
  El criterio pide: the encargado sees 7 units, because each submission adds units (the form shows "Añadidas 2 unidades de Piolet" each time)
- AC-008-03: Gestionar el inventario. En Inventario se ve «{unidad} · De baja».
  El criterio pide: the user sees "Casco 3 · De baja" and "Casco · 2 unidades" in Inventario, and it cannot be reserved
- AC-008-04: Gestionar el inventario. En Inventario se ve «No se puede dar de baja: está prestada».
  El criterio pide: the user sees "No se puede dar de baja: está prestada" and it stays active
- AC-008-05: Gestionar el inventario. el inventario no cambia
  El criterio pide: it stays "De baja" once
- AC-008-06: Gestionar el inventario. En Inventario se ve «No tienes permiso para ver esta pantalla».
  El criterio pide: the user sees "No tienes permiso para ver esta pantalla"
