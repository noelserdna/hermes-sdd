# Requirements Document

> **Project:** material-montana10
> **Version:** 1.0
> **Last updated:** 2026-11-21
> **Status:** Approved
> **Approved by:** Andres Leon (Cliente), 2026-11-21
> **Ejemplos revisados por:** Andres Leon (Cliente), 2026-11-21
> **Customer needs:** [CUSTOMER-NEEDS.md](CUSTOMER-NEEDS.md)

Roles: **socio**, **encargado** (del material) y **junta** (solo consulta). Fechas de una reserva: de «desde» a «hasta», ambas incluidas; el material se devuelve como tarde el día «hasta».

## Functional Requirements

### REQ-F-001: Entrar, salir y proteger la sesión
- **Statement:** WHEN a user submits a correo and a contraseña that match an active account THE system SHALL start a session for that user and show the screen of their role
- **Para el cliente:** Cada persona entra con su correo y su contraseña y ve lo que le toca según sea socio, encargado o junta. Tras 5 fallos seguidos la cuenta espera 15 minutos, y la sesión se cierra sola tras 8 horas sin uso.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-002, N-011
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Sin entrar no se sabe quién reserva ni quién puede ver datos personales.
- **Acceptance criteria:**
  - GIVEN the socio "lucia@club.es" with contraseña "Cumbre2026" WHEN she submits those data in Entrar THEN the user sees "Hola, Lucía" in Mis reservas
    - Se ve: "Hola, {nombre}" en Mis reservas
  - GIVEN the socio "pablo@club.es" with contraseña "Arista2026" WHEN he submits those data in Entrar THEN the user sees "Hola, Pablo" in Mis reservas
    - Se ve: "Hola, {nombre}" en Mis reservas
  - GIVEN "lucia@club.es" WHEN she submits the contraseña "mala" THEN the user sees "Correo o contraseña incorrectos" and stays in Entrar
    - Se ve: "Correo o contraseña incorrectos" en Entrar
  - GIVEN "lucia@club.es" failed 5 times in a row WHEN she submits the right contraseña within 15 minutes THEN the user sees "Cuenta bloqueada. Inténtalo de nuevo en 15 minutos" and no session starts
    - Se ve: "Cuenta bloqueada. Inténtalo de nuevo en 15 minutos" en Entrar
  - GIVEN "lucia@club.es" was blocked 15 minutes ago WHEN she submits the right contraseña THEN the user sees "Hola, Lucía" in Mis reservas
    - Se ve: "Hola, {nombre}" en Mis reservas
  - GIVEN a session of "lucia@club.es" with 8 hours without activity WHEN she opens any screen THEN the user sees the Entrar form with "Tu sesión ha caducado"
    - Se ve: "Tu sesión ha caducado" en Entrar
  - GIVEN "lucia@club.es" is inside the app WHEN she presses "Salir" THEN the user sees the Entrar form and going back to Mis reservas asks to enter again
    - Se ve: "Entrar" en Entrar
  - GIVEN nobody has entered WHEN the address of Mis reservas is opened THEN the user sees the Entrar form
    - Se ve: "Entrar" en Entrar
  - GIVEN "lucia@club.es" sends the same correct form twice (double click) WHEN both arrive THEN there is one single session and the user sees "Hola, Lucía"
    - Se ve: "Hola, {nombre}" en Mis reservas
- **Dependencies:** None

### REQ-F-002: Dar de alta, dar de baja y restablecer contraseña de socios
- **Statement:** WHEN the encargado submits the name, correo and an initial contraseña of a new socio THE system SHALL create the account, and WHEN the encargado asks to deactivate or reset an account THE system SHALL apply it
- **Para el cliente:** El encargado da de alta a los socios con su correo y una contraseña inicial (mínimo 8 caracteres), da de baja a quien deja el club y restablece la contraseña a quien la olvida.
- **Category:** Functional
- **Priority:** Should have
- **Needs:** N-002, N-011
- **Origin:** method
- **Verification:** test
- **Source:** intent/INT-001.md (sin altas nadie podría entrar)
- **Rationale:** El encargo no dice quién crea las cuentas; sin ello la web no funciona.
- **Acceptance criteria:**
  - GIVEN the encargado in Socios WHEN he creates "Marta Ruiz", "marta@club.es", contraseña "Glaciar2026" THEN the user sees "Marta Ruiz" in the list of Socios and Marta can enter
    - Se ve: "Marta Ruiz" en Socios
  - GIVEN "marta@club.es" already exists WHEN the encargado creates another with that correo THEN the user sees "Ya existe un socio con ese correo" and the list keeps one "Marta Ruiz"
    - Se ve: "Ya existe un socio con ese correo" en Socios
  - GIVEN the encargado in Socios WHEN he creates a socio with contraseña "corta" (5 characters) THEN the user sees "La contraseña debe tener al menos 8 caracteres" and no account is created
    - Se ve: "La contraseña debe tener al menos 8 caracteres" en Socios
  - GIVEN "pablo@club.es" has no reserva en curso ni multa pendiente WHEN the encargado deactivates him THEN the user sees "Pablo" with "Baja" in Socios and Pablo cannot enter
    - Se ve: "{nombre}" con "Baja" en Socios
  - GIVEN "lucia@club.es" has the material "Casco 2" lent out WHEN the encargado deactivates her THEN the user sees "No se puede dar de baja: tiene material prestado o multas pendientes" and her account stays active
    - Se ve: "No se puede dar de baja: tiene material prestado o multas pendientes" en Socios
  - GIVEN "marta@club.es" forgot her contraseña WHEN the encargado sets "Nieve2026" THEN Marta enters with it and the old one no longer works
    - Se ve: "Contraseña restablecida" en Socios
  - GIVEN the socio "lucia@club.es" WHEN she opens Socios by address THEN the user sees "No tienes permiso para ver esta pantalla"
    - Se ve: "No tienes permiso para ver esta pantalla" en Socios
- **Dependencies:** REQ-F-001

### REQ-F-003: Reservar material para unas fechas
- **Statement:** WHEN a socio without multas pendientes chooses a tipo de material and dates desde–hasta THE system SHALL create the reserva if at least one unit of that tipo is free every day of the range
- **Para el cliente:** Un socio reserva un tipo de material para unas fechas solo si queda alguna unidad libre todos esos días. No se reserva en el pasado, ni por más de 14 días, y quien debe una multa no puede reservar.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-003, N-006
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Es el núcleo del préstamo; el límite de 14 días evita acaparar material.
- **Acceptance criteria:**
  - GIVEN there are 3 "Piolet" units and none reserved on 2026-12-05..2026-12-07 WHEN "lucia@club.es" reserves "Piolet" for those dates THEN the user sees "Reserva creada: Piolet del 2026-12-05 al 2026-12-07" in Mis reservas
    - Se ve: "Reserva creada: {material} del {desde} al {hasta}" en Mis reservas
  - GIVEN the same reserva exists WHEN the same form is submitted again THEN Mis reservas still has one reserva of "Piolet" for those dates
    - No visible: se ve en la lista; el criterio comprueba que sigue habiendo una sola fila
  - GIVEN 2 "Tienda" units both reserved on 2026-12-05..2026-12-07 WHEN "pablo@club.es" reserves "Tienda" for 2026-12-06 THEN the user sees "No quedan unidades libres de Tienda esas fechas" and no reserva is created
    - Se ve: "No quedan unidades libres de {material} esas fechas" en Reservar
  - GIVEN 2 "Tienda" units, one reserved on 2026-12-05..2026-12-06 WHEN "pablo@club.es" reserves "Tienda" for 2026-12-07..2026-12-08 THEN the reserva is created (the units are free those days)
    - Se ve: "Reserva creada: {material} del {desde} al {hasta}" en Mis reservas
  - GIVEN today is 2026-12-01 WHEN a socio reserves "Casco" from 2026-11-30 THEN the user sees "Las fechas no pueden estar en el pasado" and no reserva is created
    - Se ve: "Las fechas no pueden estar en el pasado" en Reservar
  - GIVEN a socio WHEN he reserves "Cuerda" from 2026-12-10 to 2026-12-09 THEN the user sees "La fecha final no puede ser anterior a la inicial"
    - Se ve: "La fecha final no puede ser anterior a la inicial" en Reservar
  - GIVEN a socio WHEN he reserves "Cuerda" from 2026-12-10 to 2026-12-25 (16 days) THEN the user sees "Máximo 14 días por reserva" and no reserva is created
    - Se ve: "Máximo 14 días por reserva" en Reservar
  - GIVEN "lucia@club.es" has a multa pendiente of 4 € WHEN she reserves "Casco" THEN the user sees "Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar" and no reserva is created
    - Se ve: "Tienes una multa pendiente de {importe} €. Págala al encargado para poder reservar" en Reservar
  - GIVEN "pablo@club.es" has a multa pendiente of 2 € WHEN he reserves "Casco" THEN the user sees "Tienes una multa pendiente de 2 €. Págala al encargado para poder reservar"
    - Se ve: "Tienes una multa pendiente de {importe} €. Págala al encargado para poder reservar" en Reservar
  - GIVEN the last free "Crampones" unit and two socios submit at once for the same dates WHEN both arrive THEN only one reserva is created and the other user sees "No quedan unidades libres de Crampones esas fechas"
    - Se ve: "No quedan unidades libres de {material} esas fechas" en Reservar
- **Dependencies:** REQ-F-001, REQ-F-008

### REQ-F-004: Ver y cancelar mis reservas
- **Statement:** WHEN a socio opens Mis reservas THE system SHALL list their reservas and multas, and WHEN he cancels a reserva before its fecha desde THE system SHALL cancel it and free its units
- **Para el cliente:** El socio ve sus reservas, su estado y sus multas, y puede cancelar una hasta el día antes de que empiece.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-004, N-011
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** El socio necesita saber qué tiene y poder liberarlo a tiempo.
- **Acceptance criteria:**
  - GIVEN "lucia@club.es" has a reserva of "Piolet" 2026-12-05..2026-12-07 WHEN she opens Mis reservas THEN the user sees "Piolet · 2026-12-05 a 2026-12-07 · Reservada"
    - Se ve: "{material} · {desde} a {hasta} · {estado}" en Mis reservas
  - GIVEN "pablo@club.es" has no reservas WHEN he opens Mis reservas THEN the user sees "No tienes reservas" and none of Lucía's
    - Se ve: "No tienes reservas" en Mis reservas
  - GIVEN today is 2026-12-04 and the reserva starts 2026-12-05 WHEN Lucía cancels it THEN the user sees "Piolet · 2026-12-05 a 2026-12-07 · Cancelada" and the unit is free again
    - Se ve: "{material} · {desde} a {hasta} · Cancelada" en Mis reservas
  - GIVEN the reserva is already cancelled WHEN the cancel is sent again THEN it stays "Cancelada" once, with no other change
    - No visible: la lista sigue mostrando una sola fila cancelada
  - GIVEN today is 2026-12-05 and the reserva starts 2026-12-05 WHEN Lucía cancels it THEN the user sees "Solo se puede cancelar hasta el día antes" and the reserva stays "Reservada"
    - Se ve: "Solo se puede cancelar hasta el día antes" en Mis reservas
  - GIVEN "lucia@club.es" owes a multa of 4 € WHEN she opens Mis reservas THEN the user sees "Multa pendiente: 4 €"
    - Se ve: "Multa pendiente: {importe} €" en Mis reservas
  - GIVEN a reserva of Lucía WHEN "pablo@club.es" tries to cancel it THEN the user sees "No tienes permiso para cancelar esta reserva" and it stays "Reservada"
    - Se ve: "No tienes permiso para cancelar esta reserva" en Mis reservas
- **Dependencies:** REQ-F-003

### REQ-F-005: Entregar lo reservado
- **Statement:** WHEN the encargado marks a reserva as delivered on or after its fecha desde THE system SHALL change its estado to "Prestada" and assign a unit
- **Para el cliente:** El encargado entrega el material reservado y lo marca como prestado. Lo que no se recoge el último día de la reserva pasa a «No recogida» y las unidades quedan libres.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-005
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Hay que saber qué unidad tiene cada socio; lo no recogido no debe bloquear unidades.
- **Acceptance criteria:**
  - GIVEN today is 2026-12-05 and Lucía has a reserva of "Piolet" from 2026-12-05 WHEN the encargado marks it delivered with unit "Piolet 2" THEN the user sees "Piolet 2 · Lucía · Prestada" in Entregas y devoluciones
    - Se ve: "{unidad} · {socio} · Prestada" en Entregas y devoluciones
  - GIVEN the same reserva is already "Prestada" WHEN delivered again THEN there is still one "Piolet 2 · Lucía · Prestada" and no second unit is assigned
    - No visible: la lista sigue con una sola fila prestada
  - GIVEN today is 2026-12-04 and the reserva starts 2026-12-05 WHEN the encargado marks it delivered THEN the user sees "Aún no es la fecha de entrega" and it stays "Reservada"
    - Se ve: "Aún no es la fecha de entrega" en Entregas y devoluciones
  - GIVEN a reserva 2026-12-05..2026-12-07 never delivered WHEN the date becomes 2026-12-08 THEN the user sees "No recogida" for it in Entregas y devoluciones and its units are free
    - Se ve: "{material} · {socio} · No recogida" en Entregas y devoluciones
- **Dependencies:** REQ-F-003

### REQ-F-006: Marcar la devolución y poner la multa
- **Statement:** WHEN the encargado marks a loan as returned after its fecha hasta THE system SHALL create a multa of 2 euros per day late
- **Para el cliente:** El encargado marca lo devuelto. Si es tarde, el socio recibe una multa de 2 € por cada día de retraso y no puede reservar hasta pagarla.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-005, N-006
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Cierra el préstamo y aplica la multa pedida.
- **Acceptance criteria:**
  - GIVEN "Piolet 2" lent to Lucía until 2026-12-07 WHEN the encargado marks it returned on 2026-12-07 THEN the user sees "Piolet 2 · Lucía · Devuelta" and no multa exists
    - Se ve: "{unidad} · {socio} · Devuelta" en Entregas y devoluciones
  - GIVEN "Casco 1" lent to Pablo until 2026-12-07 WHEN it is returned on 2026-12-10 THEN the user sees "Multa de 6 € a Pablo (3 días de retraso)"
    - Se ve: "Multa de {importe} € a {socio} ({n} días de retraso)" en Entregas y devoluciones
  - GIVEN "Cuerda 1" lent to Lucía until 2026-12-07 WHEN it is returned on 2026-12-08 THEN the user sees "Multa de 2 € a Lucía (1 días de retraso)" and Lucía sees "Multa pendiente: 2 €" in Mis reservas
    - Se ve: "Multa de {importe} € a {socio} ({n} días de retraso)" en Entregas y devoluciones
  - GIVEN "Casco 1" is already "Devuelta" WHEN the return is marked again THEN there is still one multa of 6 € for Pablo
    - No visible: la lista de multas sigue con una sola de 6 €
  - GIVEN a loan not delivered (reserva "Reservada") WHEN the encargado marks it returned THEN the user sees "Esa reserva no está prestada"
    - Se ve: "Esa reserva no está prestada" en Entregas y devoluciones
- **Dependencies:** REQ-F-005

### REQ-F-007: Marcar la multa como pagada
- **Statement:** WHEN the encargado marks a multa as paid THE system SHALL change its estado to "Pagada" and allow its socio to reserve again if no other multa is pending
- **Para el cliente:** El encargado anota que el socio ha pagado y el socio vuelve a poder reservar.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-006, N-007
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Desbloquea al socio tras pagar.
- **Acceptance criteria:**
  - GIVEN Pablo has a multa of 6 € pendiente WHEN the encargado marks it paid THEN the user sees "Multa de 6 € · Pablo · Pagada" in Multas and Pablo can reserve
    - Se ve: "Multa de {importe} € · {socio} · Pagada" en Multas
  - GIVEN Lucía has two multas pendientes (2 € and 4 €) WHEN the encargado marks the 2 € one paid THEN Lucía still sees "Multa pendiente: 4 €" and cannot reserve
    - Se ve: "Multa pendiente: {importe} €" en Mis reservas
  - GIVEN the multa is already paid WHEN marked paid again THEN it stays "Pagada" once, with the same paid date
    - No visible: la lista de multas no cambia
  - GIVEN the socio "lucia@club.es" WHEN she opens Multas by address THEN the user sees "No tienes permiso para ver esta pantalla"
    - Se ve: "No tienes permiso para ver esta pantalla" en Multas
- **Dependencies:** REQ-F-006

### REQ-F-008: Gestionar el inventario
- **Statement:** WHEN the encargado adds units of a tipo de material or marks a unit as broken THE system SHALL update the inventory and the units available to reserve
- **Para el cliente:** El encargado añade material nuevo y da de baja las unidades rotas. Una unidad prestada no se puede dar de baja hasta que vuelva.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-008
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Las unidades libres dependen del inventario real.
- **Acceptance criteria:**
  - GIVEN there are 3 "Piolet" units WHEN the encargado adds 2 units of "Piolet" THEN the user sees "Piolet · 5 unidades" in Inventario
    - Se ve: "{material} · {n} unidades" en Inventario
  - GIVEN the same add form is submitted again THEN the encargado sees 7 units, because each submission adds units (the form shows "Añadidas 2 unidades de Piolet" each time)
    - Se ve: "Añadidas {n} unidades de {material}" en Inventario
  - GIVEN "Casco 3" is free WHEN the encargado marks it as broken THEN the user sees "Casco 3 · De baja" and "Casco · 2 unidades" in Inventario, and it cannot be reserved
    - Se ve: "{unidad} · De baja" en Inventario
  - GIVEN "Casco 1" is lent to Pablo WHEN the encargado marks it as broken THEN the user sees "No se puede dar de baja: está prestada" and it stays active
    - Se ve: "No se puede dar de baja: está prestada" en Inventario
  - GIVEN a unit already "De baja" WHEN marked broken again THEN it stays "De baja" once
    - No visible: el inventario no cambia
  - GIVEN the socio "pablo@club.es" WHEN he opens Inventario by address THEN the user sees "No tienes permiso para ver esta pantalla"
    - Se ve: "No tienes permiso para ver esta pantalla" en Inventario
- **Dependencies:** REQ-F-001

### REQ-F-009: Ver lo prestado y lo que vuelve cada día
- **Statement:** WHEN the encargado opens Entregas y devoluciones THE system SHALL list the units lent out, the returns expected today and the late ones
- **Para el cliente:** El encargado ve de un vistazo qué material está fuera, qué vuelve hoy, qué se retrasa y qué hay que entregar hoy.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-009, N-005
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Es la pantalla de trabajo diario del encargado.
- **Acceptance criteria:**
  - GIVEN today is 2026-12-07, "Piolet 2" lent to Lucía until 2026-12-07 and "Casco 1" lent to Pablo until 2026-12-09 WHEN the encargado opens Entregas y devoluciones THEN the user sees "Vuelve hoy: Piolet 2 · Lucía" and "Prestado: Casco 1 · Pablo · hasta 2026-12-09"
    - Se ve: "Vuelve hoy: {unidad} · {socio}", "Prestado: {unidad} · {socio} · hasta {hasta}" en Entregas y devoluciones
  - GIVEN "Cuerda 1" lent to Marta until 2026-12-05 and today is 2026-12-07 THEN the user sees "Con retraso: Cuerda 1 · Marta · 2 días"
    - Se ve: "Con retraso: {unidad} · {socio} · {n} días" en Entregas y devoluciones
  - GIVEN a reserva of Lucía starts today WHEN the encargado opens the screen THEN the user sees "Entregar hoy: Piolet · Lucía"
    - Se ve: "Entregar hoy: {material} · {socio}" en Entregas y devoluciones
  - GIVEN nothing is lent WHEN the encargado opens the screen THEN the user sees "No hay material prestado"
    - Se ve: "No hay material prestado" en Entregas y devoluciones
  - GIVEN the junta member "ana@club.es" WHEN she opens Entregas y devoluciones THEN the user sees the list without delivery or return buttons
    - Se ve: "Prestado: {unidad} · {socio} · hasta {hasta}" en Entregas y devoluciones
- **Dependencies:** REQ-F-005

### REQ-F-010: Consultar el historial de un socio (junta)
- **Statement:** WHEN the junta or the encargado opens Historial and chooses a socio THE system SHALL show that socio's loans and multas, read only
- **Para el cliente:** La junta busca a cualquier socio y ve todos sus préstamos y multas, sin poder cambiar nada.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-010, N-011
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** La junta controla el uso del material.
- **Acceptance criteria:**
  - GIVEN Lucía borrowed "Piolet 2" 2026-12-05..2026-12-07 and has a paid multa of 2 € WHEN "ana@club.es" (junta) chooses Lucía in Historial THEN the user sees "Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta" and "Multa de 2 € · Pagada"
    - Se ve: "{unidad} · {desde} a {hasta} · {estado}", "Multa de {importe} € · {estado}" en Historial
  - GIVEN Pablo has no loans WHEN the junta chooses Pablo THEN the user sees "Sin préstamos ni multas"
    - Se ve: "Sin préstamos ni multas" en Historial
  - GIVEN the junta WHEN she looks at Historial THEN there is no button to edit, cancel or mark anything
    - No visible: ausencia de botones; lo comprueba el test sobre la pantalla
  - GIVEN the socio "lucia@club.es" WHEN she opens Historial by address THEN the user sees "No tienes permiso para ver esta pantalla"
    - Se ve: "No tienes permiso para ver esta pantalla" en Historial
- **Dependencies:** REQ-F-006

## Nonfunctional Requirements

### REQ-NF-001: Contraseñas y datos personales
- **Statement:** THE system SHALL store contraseñas only as a salted hash, never show them, and keep each socio's name, correo, loans and multas only for the roles of REQ-F, deleting loans and multas 2 years after their closing date
- **Para el cliente:** Las contraseñas no se guardan ni se ven en claro; de cada socio solo se guarda nombre, correo, préstamos y multas, y se borran a los 2 años.
- **Category:** Security
- **Priority:** Should have
- **Needs:** N-011
- **Verification:** test
- **Metric:** 0 contraseñas en claro en los datos guardados; 0 registros de préstamo o multa con más de 2 años
- **Acceptance criteria:**
  - GIVEN Marta created with contraseña "Glaciar2026" WHEN the stored data is read THEN it does not contain "Glaciar2026"
  - GIVEN a loan returned on 2024-11-01 and today is 2026-11-21 WHEN the cleanup runs THEN that loan is gone and a loan returned on 2025-01-10 stays
- **Dependencies:** REQ-F-002

## Constraints

### REQ-C-001: Textos en español
- **Statement:** All texts of the interface SHALL be in Spanish
- **Para el cliente:** Toda la web está en español.
- **Type:** Business
- **Source:** AGENTS.md
- **Needs:** — (team/architecture source)
- **Verification:** test — comprueba que los textos de la interfaz no contienen cadenas inglesas de una lista de control

### REQ-C-002: Stack
- **Statement:** The application SHALL be built with JavaScript (ES modules), Vite and Vitest
- **Para el cliente:** Es una web normal que se abre en el navegador, sin instalar nada.
- **Type:** Technical
- **Source:** AGENTS.md
- **Needs:** — (team/architecture source)
- **Verification:** test — lee package.json

### REQ-C-003: Datos compartidos
- **Statement:** The application SHALL keep reservas, inventory, multas and accounts in one place read by every device, never only in the browser of each user
- **Para el cliente:** Lo que hace el encargado desde su equipo lo ve cada socio desde su móvil.
- **Type:** Technical
- **Source:** intent/INT-001.md (varios usuarios con roles distintos)
- **Needs:** N-001
- **Verification:** test — lee que ningún dato de negocio se guarda en localStorage ni sessionStorage

## Supuestos

- El encargado da de alta y de baja a los socios y restablece contraseñas: el encargo no dice quién, y la junta solo consulta.
- Contraseña mínima de 8 caracteres; tras 5 fallos seguidos la cuenta se bloquea 15 minutos (lo habitual en webs de socios).
- La sesión caduca tras 8 horas sin actividad y hay un botón «Salir».
- No hay recuperación de contraseña por correo: la restablece el encargado (no se pidió envío de correos).
- Se reserva por tipo de material (p. ej. «Piolet»); el encargado asigna la unidad concreta al entregar.
- Una reserva dura como máximo 14 días, para que nadie acapare material.
- No se puede reservar en fechas pasadas ni con la fecha final anterior a la inicial.
- «Hasta el día antes» significa que el mismo día de la fecha «desde» ya no se puede cancelar.
- Lo reservado que no se recoge antes de acabar la reserva pasa a «No recogida» y libera las unidades, sin multa.
- El retraso se cuenta por días naturales después de la fecha «hasta»; la multa se calcula cuando el encargado marca la devolución (2 € × días).
- Un socio con una multa pendiente no puede reservar; las reservas que ya tenía se mantienen.
- No se da de baja a un socio con material prestado o multas pendientes, ni una unidad que está prestada.
- Se guardan nombre, correo, préstamos y multas, y los préstamos y multas se borran a los 2 años de su cierre (guardar lo mínimo).
- El encargado también ve el historial de cualquier socio, y la junta ve la pantalla de entregas y devoluciones solo para consultar.
- Un socio solo ve sus propias reservas y multas; las pantallas de otros roles le muestran «No tienes permiso».
- Las multas de un socio se ven en «Mis reservas» y todas las multas en la pantalla «Multas» del encargado.

## Traceability

| REQ ID | Type | Priority | Source | Needs | Verification | Dependencies |
|--------|------|----------|--------|-------|--------------|--------------|
| REQ-F-001 | Functional | Must | intent/INT-001.md | N-002, N-011 | test | None |
| REQ-F-002 | Functional | Should | intent/INT-001.md | N-002, N-011 | test | REQ-F-001 |
| REQ-F-003 | Functional | Must | intent/INT-001.md | N-003, N-006 | test | REQ-F-001, REQ-F-008 |
| REQ-F-004 | Functional | Must | intent/INT-001.md | N-004, N-011 | test | REQ-F-003 |
| REQ-F-005 | Functional | Must | intent/INT-001.md | N-005 | test | REQ-F-003 |
| REQ-F-006 | Functional | Must | intent/INT-001.md | N-005, N-006 | test | REQ-F-005 |
| REQ-F-007 | Functional | Must | intent/INT-001.md | N-006, N-007 | test | REQ-F-006 |
| REQ-F-008 | Functional | Must | intent/INT-001.md | N-008 | test | REQ-F-001 |
| REQ-F-009 | Functional | Must | intent/INT-001.md | N-005, N-009 | test | REQ-F-005 |
| REQ-F-010 | Functional | Must | intent/INT-001.md | N-010, N-011 | test | REQ-F-006 |
| REQ-NF-001 | Nonfunctional | Should | intent/INT-001.md | N-011 | test | REQ-F-002 |
| REQ-C-001 | Constraint | — | AGENTS.md | — | test | — |
| REQ-C-002 | Constraint | — | AGENTS.md | — | test | — |
| REQ-C-003 | Constraint | — | intent/INT-001.md | N-001 | test | — |
