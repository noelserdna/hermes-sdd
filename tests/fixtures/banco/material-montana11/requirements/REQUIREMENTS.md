# Requirements Document

> **Project:** material-montana11
> **Version:** 1.0
> **Last updated:** 2026-11-21
> **Status:** Approved
> **Approved by:** Andres Leon (Cliente), 2026-11-21
> **Ejemplos revisados por:** Andres Leon (Cliente), 2026-11-21
> **Customer needs:** [CUSTOMER-NEEDS.md](CUSTOMER-NEEDS.md)

## Functional Requirements

### REQ-F-001: Entrar con correo y contraseña
- **Statement:** WHEN a member submits a registered email and its password THE system SHALL open a session and show the home screen of their role (socio, encargado or junta)
- **Para el cliente:** Cada socio entra con su correo y su contraseña. Tras 5 fallos seguidos la cuenta se bloquea 15 minutos, la sesión caduca sola tras 30 minutos sin actividad y se puede salir en cualquier momento.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-002
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Sin identificar al socio no se pueden asignar reservas ni proteger datos personales.
- **Acceptance criteria:**
  - GIVEN the socio "lucia@club.test" with password "Cumbre2026" WHEN she submits them on the login form THEN the user sees the heading "Material disponible"
    - Se ve: "Material disponible" en Inicio del socio
  - GIVEN the encargado "marta@club.test" WHEN she submits her correct credentials THEN the user sees the heading "Panel del encargado"
    - Se ve: "Panel del encargado" en Inicio del encargado
  - GIVEN "lucia@club.test" WHEN she submits the wrong password "x" THEN the user sees "Correo o contraseña incorrectos"
    - Se ve: "Correo o contraseña incorrectos" en Entrar
  - GIVEN "lucia@club.test" with 4 failed attempts in a row WHEN she fails a 5th time THEN the user sees "Cuenta bloqueada durante 15 minutos" and a 6th attempt with the correct password 10 minutes later is also rejected
    - Se ve: "Cuenta bloqueada durante 15 minutos" en Entrar
  - GIVEN "lucia@club.test" was blocked 15 minutes ago WHEN she submits the correct password THEN the user sees the heading "Material disponible"
    - Se ve: "Material disponible" en Inicio del socio
  - GIVEN a session with no activity for 30 minutes WHEN the member opens any screen THEN the user sees the login form with "Sesión caducada, vuelve a entrar"
    - Se ve: "Sesión caducada, vuelve a entrar" en Entrar
  - GIVEN a signed-in member WHEN she presses "Salir" THEN the user sees the login form and going back to a member screen shows the login form again
    - Se ve: "Entrar" en Entrar
  - GIVEN an anonymous visitor WHEN they open the address of "Mis reservas" THEN the user sees the login form
    - Se ve: "Entrar" en Entrar
  - GIVEN a deactivated member "pablo@club.test" WHEN he submits his correct password THEN the user sees "Correo o contraseña incorrectos"
    - Se ve: "Correo o contraseña incorrectos" en Entrar
- **Dependencies:** REQ-F-002

### REQ-F-002: Gestionar las cuentas de socios
- **Statement:** WHEN the encargado creates, resets or deactivates a member account THE system SHALL apply the change and show the updated member list
- **Para el cliente:** El encargado da de alta a los socios, restablece la contraseña a quien la olvida y da de baja a quien deja el club. La contraseña tiene al menos 8 caracteres.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-002
- **Origin:** method
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Sin alta de socios nadie puede entrar; contraseña olvidada y baja son casos inevitables de una cuenta.
- **Acceptance criteria:**
  - GIVEN the encargado WHEN he creates the member "Pablo Ruiz", "pablo@club.test", password "Nieve2026" THEN the user sees "Pablo Ruiz" in the list of socios
    - Se ve: "Pablo Ruiz" en Socios
  - GIVEN the encargado WHEN he creates a member with password "corta1" (6 characters) THEN the user sees "La contraseña debe tener al menos 8 caracteres" and no member is created
    - Se ve: "La contraseña debe tener al menos 8 caracteres" en Socios
  - GIVEN "pablo@club.test" already exists WHEN the encargado creates another member with the same email THEN the user sees "Ya existe un socio con ese correo" and the list keeps a single "pablo@club.test"
    - Se ve: "Ya existe un socio con ese correo" en Socios
  - GIVEN the member "Lucía Gil" forgot her password WHEN the encargado sets the new password "Hielo2026x" THEN she can sign in with it and no longer with the old one
    - Se ve: "Contraseña restablecida" en Socios
  - GIVEN "Pablo Ruiz" has 1 future reservation of "Casco 2" WHEN the encargado deactivates him THEN the user sees "Pablo Ruiz" marked "Baja" and the reservation is cancelled, freeing the unit
    - Se ve: "Baja" en Socios
  - GIVEN "Pablo Ruiz" has a lent unit not yet returned WHEN the encargado tries to deactivate him THEN the user sees "No se puede dar de baja: tiene material sin devolver" and he stays active
    - Se ve: "No se puede dar de baja: tiene material sin devolver" en Socios
  - GIVEN a socio session WHEN the socio opens the address of "Socios" THEN the user sees "Acceso no permitido"
    - Se ve: "Acceso no permitido" en Socios
- **Dependencies:** None

### REQ-F-003: Reservar material para unas fechas
- **Statement:** WHEN a socio without pending fine requests a material item for a start and an end date and a unit is free on every day of that range THE system SHALL create the reservation and show it in the socio's reservations
- **Para el cliente:** El socio elige material y fechas y reserva si queda alguna unidad libre todos esos días. No se puede reservar con fechas pasadas, ni más de 14 días seguidos, ni con una multa sin pagar.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-003, N-006
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Es el objetivo central de la web; evita prestar más unidades de las que hay.
- **Acceptance criteria:**
  - GIVEN there are 3 "Piolet" units, all free, and today is 2026-11-21 WHEN "lucia" reserves "Piolet" from 2026-12-05 to 2026-12-07 THEN the user sees "Reserva creada: Piolet, 2026-12-05 a 2026-12-07" and "Piolet" shows "2 libres" for those dates
    - Se ve: "Reserva creada: {material}, {inicio} a {fin}" en Reservar
  - GIVEN "Tienda" has 1 unit already reserved 2026-12-06 to 2026-12-08 WHEN "pablo" reserves "Tienda" from 2026-12-07 to 2026-12-09 THEN the user sees "No hay unidades libres esas fechas" and no reservation is created
    - Se ve: "No hay unidades libres esas fechas" en Reservar
  - GIVEN the same "Tienda" reservation ends 2026-12-08 WHEN "pablo" reserves it from 2026-12-09 to 2026-12-10 THEN the reservation is created (the days do not overlap)
    - Se ve: "Reserva creada: {material}, {inicio} a {fin}" en Reservar
  - GIVEN today is 2026-11-21 WHEN "lucia" reserves "Casco" from 2026-11-20 to 2026-11-22 THEN the user sees "No se puede reservar en fechas pasadas"
    - Se ve: "No se puede reservar en fechas pasadas" en Reservar
  - GIVEN an end date before the start date, 2026-12-10 and 2026-12-08, WHEN "lucia" submits THEN the user sees "La fecha de fin no puede ser anterior a la de inicio"
    - Se ve: "La fecha de fin no puede ser anterior a la de inicio" en Reservar
  - GIVEN a range of 15 days WHEN "lucia" reserves "Cuerda" from 2026-12-01 to 2026-12-15 THEN the user sees "La reserva no puede superar 14 días"
    - Se ve: "La reserva no puede superar 14 días" en Reservar
  - GIVEN "pablo" has an unpaid fine of 4 € WHEN he reserves "Casco" for 2026-12-05 to 2026-12-06 THEN the user sees "Tienes una multa pendiente: no puedes reservar hasta pagarla" and no reservation is created
    - Se ve: "Tienes una multa pendiente: no puedes reservar hasta pagarla" en Reservar
  - GIVEN "lucia" without fines WHEN she reserves "Casco" for 2026-12-05 to 2026-12-06 THEN the reservation is created (a socio without fines is not blocked)
    - Se ve: "Reserva creada: {material}, {inicio} a {fin}" en Reservar
  - GIVEN "lucia" just reserved "Piolet" from 2026-12-05 to 2026-12-07 WHEN the same form is submitted again THEN "Mis reservas" still shows a single "Piolet" for those dates or the message "No hay unidades libres esas fechas" when no unit is left, and never two reservations of one unit for the same days
    - Se ve: "Piolet" en Mis reservas
- **Dependencies:** REQ-F-001, REQ-F-008

### REQ-F-004: Ver y cancelar mis reservas
- **Statement:** WHEN a socio opens their reservations THE system SHALL list only their own reservations, and WHEN the socio cancels one whose start date is after today THE system SHALL cancel it and free the unit
- **Para el cliente:** Cada socio ve sus reservas y puede cancelarlas hasta el día antes del inicio.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-004
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** El socio necesita controlar sus reservas; cancelar a tiempo libera unidades para otros.
- **Acceptance criteria:**
  - GIVEN "lucia" has "Piolet" 2026-12-05 to 2026-12-07 and "pablo" has "Casco" 2026-12-06 to 2026-12-07 WHEN "lucia" opens "Mis reservas" THEN the user sees "Piolet" and does not see "Casco"
    - Se ve: "Piolet" en Mis reservas
  - GIVEN today is 2026-12-04 and "lucia" has "Piolet" starting 2026-12-05 WHEN she cancels it THEN the user sees "Reserva cancelada" and the reservation shows state "Cancelada"
    - Se ve: "Reserva cancelada" en Mis reservas
  - GIVEN today is 2026-12-05 and "lucia" has "Piolet" starting 2026-12-05 WHEN she tries to cancel it THEN the user sees "Solo se puede cancelar hasta el día antes" and the reservation stays
    - Se ve: "Solo se puede cancelar hasta el día antes" en Mis reservas
  - GIVEN "lucia" has no reservations WHEN she opens "Mis reservas" THEN the user sees "No tienes reservas"
    - Se ve: "No tienes reservas" en Mis reservas
  - GIVEN "lucia" already cancelled a reservation WHEN the same cancel is sent again THEN the reservation stays "Cancelada" and nothing else changes
    - Se ve: "Cancelada" en Mis reservas
- **Dependencies:** REQ-F-003

### REQ-F-005: Entregar y marcar la devolución
- **Statement:** WHEN the encargado marks a reservation as delivered or as returned THE system SHALL record the state and the date, and show it in the list of loans
- **Para el cliente:** El encargado entrega lo reservado y, cuando vuelve, marca la devolución. Una reserva que no se recoge el día de inicio queda como «No recogida» y libera la unidad.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-005
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** El estado real del material (en el almacén o fuera) depende de lo que registra el encargado.
- **Acceptance criteria:**
  - GIVEN today is 2026-12-05 and "lucia" has a "Piolet" reservation starting 2026-12-05 WHEN the encargado marks "Entregar" THEN the user sees the reservation "Piolet" with state "Entregado"
    - Se ve: "Entregado" en Préstamos
  - GIVEN a delivered "Piolet" due 2026-12-07 WHEN the encargado marks "Devolver" on 2026-12-07 THEN the user sees state "Devuelto" and the unit is free again
    - Se ve: "Devuelto" en Préstamos
  - GIVEN a reservation starting 2026-12-05 WHEN the encargado tries to deliver it on 2026-12-04 THEN the user sees "No se puede entregar antes de la fecha de inicio"
    - Se ve: "No se puede entregar antes de la fecha de inicio" en Préstamos
  - GIVEN a reservation never delivered, start 2026-12-05 WHEN 2026-12-06 arrives THEN the user sees its state "No recogida" and the unit is free for new reservations
    - Se ve: "No recogida" en Préstamos
  - GIVEN a delivered unit already marked "Devuelto" WHEN "Devolver" is sent again THEN the state stays "Devuelto" with the first return date and no second fine is created
    - Se ve: "Devuelto" en Préstamos
  - GIVEN a socio session WHEN the socio opens the address of "Préstamos" THEN the user sees "Acceso no permitido"
    - Se ve: "Acceso no permitido" en Préstamos
- **Dependencies:** REQ-F-003

### REQ-F-006: Multa por devolución tardía y bloqueo
- **Statement:** WHEN the encargado marks as returned a loan after its end date THE system SHALL create an unpaid fine of 2 euros per day of delay, and WHILE a socio has an unpaid fine THE system SHALL reject their new reservations
- **Para el cliente:** Si alguien devuelve tarde, se le pone una multa de 2 € por cada día de retraso y no puede reservar más hasta que se marque como pagada.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-006
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Es la regla de disciplina que el club pidió para que el material vuelva a tiempo.
- **Acceptance criteria:**
  - GIVEN "pablo" has a "Casco" loan ending 2026-12-07 WHEN the encargado marks it returned on 2026-12-10 THEN the user sees the fine "6,00 €" for "Pablo Ruiz" with state "Pendiente"
    - Se ve: "{importe} €" en Multas
  - GIVEN a loan ending 2026-12-07 WHEN it is returned on 2026-12-07 or earlier THEN no fine is created
    - Se ve: "Sin multas" en Multas
  - GIVEN a loan ending 2026-12-07 WHEN it is returned on 2026-12-08 THEN the fine is "2,00 €"
    - Se ve: "{importe} €" en Multas
  - GIVEN "pablo" has a pending fine of 6,00 € WHEN he tries to reserve THEN the reservation is rejected (see REQ-F-003) and his other existing reservations stay
    - Se ve: "Tienes una multa pendiente: no puedes reservar hasta pagarla" en Reservar
  - GIVEN "pablo" has 2 pending fines WHEN only one is marked paid THEN he is still blocked
    - Se ve: "Tienes una multa pendiente: no puedes reservar hasta pagarla" en Reservar
  - GIVEN "pablo" has a pending fine WHEN he opens "Mis multas" THEN the user sees "6,00 €" and "Pendiente"
    - Se ve: "{importe} €" en Mis multas
- **Dependencies:** REQ-F-005

### REQ-F-007: Marcar la multa como pagada
- **Statement:** WHEN the encargado marks a pending fine as paid THE system SHALL change its state to paid, record the date, and allow the socio to reserve again if no other fine is pending
- **Para el cliente:** El encargado anota que la multa está pagada y el socio puede volver a reservar.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-007
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Es lo que desbloquea al socio sancionado.
- **Acceptance criteria:**
  - GIVEN "pablo" has one pending fine of 6,00 € WHEN the encargado marks it "Pagada" THEN the user sees the fine with state "Pagada" and "pablo" can reserve "Casco"
    - Se ve: "Pagada" en Multas
  - GIVEN a fine already "Pagada" WHEN "Pagada" is sent again THEN it stays "Pagada" with the first payment date
    - Se ve: "Pagada" en Multas
  - GIVEN a socio session WHEN the socio opens the address of "Multas" of the encargado THEN the user sees "Acceso no permitido"
    - Se ve: "Acceso no permitido" en Multas
- **Dependencies:** REQ-F-006

### REQ-F-008: Gestionar el inventario
- **Statement:** WHEN the encargado adds material or removes a broken unit THE system SHALL update the inventory and the units available for new reservations
- **Para el cliente:** El encargado añade material y da de baja las unidades rotas. Una unidad prestada en este momento no se puede dar de baja hasta que se devuelva.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-008, N-003
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** El número de unidades reales limita lo que se puede reservar.
- **Acceptance criteria:**
  - GIVEN the types are piolets, crampones, cascos, cuerdas and tiendas WHEN the encargado adds 2 units of "Crampones" THEN the user sees "Crampones: 2 unidades" in the inventory
    - Se ve: "{tipo}: {n} unidades" en Inventario
  - GIVEN "Casco" has 4 units and "Casco 3" is broken WHEN the encargado removes "Casco 3" THEN the user sees "Casco: 3 unidades" and "Casco 3" as "De baja"
    - Se ve: "{tipo}: {n} unidades" en Inventario
  - GIVEN "Casco 2" is lent now WHEN the encargado tries to remove it THEN the user sees "No se puede dar de baja: está prestada" and the unit stays
    - Se ve: "No se puede dar de baja: está prestada" en Inventario
  - GIVEN "Tienda" has 1 unit with a future reservation from 2026-12-20 WHEN the encargado removes it THEN that reservation is cancelled and the user sees "1 reserva cancelada por la baja"
    - Se ve: "{n} reserva cancelada por la baja" en Inventario
  - GIVEN a unit already "De baja" WHEN the same removal is sent again THEN the count stays the same
    - Se ve: "{tipo}: {n} unidades" en Inventario
  - GIVEN an amount of 0 units WHEN the encargado adds material THEN the user sees "La cantidad debe ser al menos 1"
    - Se ve: "La cantidad debe ser al menos 1" en Inventario
  - GIVEN a socio session WHEN the socio opens the address of "Inventario" THEN the user sees "Acceso no permitido"
    - Se ve: "Acceso no permitido" en Inventario
- **Dependencies:** None

### REQ-F-009: Ver lo prestado y lo que vuelve cada día
- **Statement:** WHEN the encargado opens the loans panel THE system SHALL list the material currently lent and the returns expected on each day
- **Para el cliente:** El encargado ve qué material está fuera, de quién es y qué vuelve cada día, con los retrasos marcados.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-009
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Es la lista con la que el encargado organiza su trabajo diario.
- **Acceptance criteria:**
  - GIVEN "Piolet 1" lent to "Lucía Gil" until 2026-12-07 and "Casco 2" lent to "Pablo Ruiz" until 2026-12-08 WHEN the encargado opens "Prestado" THEN the user sees "Piolet 1 — Lucía Gil — hasta 2026-12-07" and "Casco 2 — Pablo Ruiz — hasta 2026-12-08"
    - Se ve: "{material} — {socio} — hasta {fecha}" en Prestado
  - GIVEN the same loans WHEN the encargado picks the day 2026-12-07 THEN the user sees "Piolet 1" under "Vuelven hoy" and does not see "Casco 2"
    - Se ve: "Vuelven hoy" en Prestado
  - GIVEN "Casco 2" ended 2026-12-08 and today is 2026-12-09 and not returned WHEN the encargado opens "Prestado" THEN the user sees "Casco 2" marked "Retrasado 1 día"
    - Se ve: "Retrasado {n} día" en Prestado
  - GIVEN nothing is lent WHEN the encargado opens "Prestado" THEN the user sees "No hay material prestado"
    - Se ve: "No hay material prestado" en Prestado
- **Dependencies:** REQ-F-005

### REQ-F-010: La junta consulta el historial de un socio
- **Statement:** WHEN a junta member selects a socio THE system SHALL show that socio's loan and fine history in read-only form
- **Para el cliente:** La junta solo consulta: elige a cualquier socio y ve sus préstamos y multas, sin poder cambiar nada.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-010
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** La junta supervisa el uso del material sin intervenir.
- **Acceptance criteria:**
  - GIVEN "Lucía Gil" returned "Piolet 1" on 2026-12-07 and "Pablo Ruiz" has a 6,00 € fine WHEN the junta opens the history of "Pablo Ruiz" THEN the user sees "Multa 6,00 € Pendiente" and not the loans of "Lucía Gil"
    - Se ve: "Multa {importe} € {estado}" en Historial del socio
  - GIVEN the junta opens the history of "Lucía Gil" THEN the user sees "Piolet 1" with "Devuelto"
    - Se ve: "Devuelto" en Historial del socio
  - GIVEN a socio without history WHEN the junta opens it THEN the user sees "Sin préstamos ni multas"
    - Se ve: "Sin préstamos ni multas" en Historial del socio
  - GIVEN a junta session WHEN the junta opens the address of "Entregar", "Inventario" or "Reservar" THEN the user sees "Acceso no permitido" and the junta screens have no button to change data
    - Se ve: "Acceso no permitido" en Inventario
- **Dependencies:** REQ-F-001

## Nonfunctional Requirements

### REQ-NF-001: Datos personales solo para su dueño, el encargado y la junta
- **Statement:** THE system SHALL return the data of a socio (name, email, reservations, loans, fines) only to that socio, the encargado and the junta, and SHALL store passwords hashed
- **Para el cliente:** Los datos de cada socio solo los ven él mismo, el encargado y la junta; las contraseñas nunca se guardan en claro.
- **Category:** Security
- **Priority:** Must have
- **Needs:** N-011
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Los datos son personales; es una condición explícita del cliente.
- **Metric:** 0 respuestas con datos de otro socio para una sesión de socio; 0 contraseñas legibles en el almacén de datos
- **Acceptance criteria:**
  - GIVEN session of "lucia" WHEN she requests the reservations, fines or profile of "pablo" by address THEN the response is refused (no data of "pablo")
  - GIVEN no session WHEN any data address is requested THEN the response is refused
  - GIVEN the stored data after creating "pablo" with password "Nieve2026" THEN the text "Nieve2026" appears nowhere and the stored value is a hash
  - GIVEN a socio session WHEN the socio opens the list of all socios THEN the user sees "Acceso no permitido"
- **Dependencies:** REQ-F-001

## Constraints

### REQ-C-001: Stack
- **Statement:** The project is a web application written in JavaScript (ES modules) with Vite, tested with Vitest.
- **Para el cliente:** Es una web que se usa desde el navegador, sin instalar nada.
- **Type:** Technical
- **Source:** AGENTS.md
- **Needs:** N-001
- **Verification:** test — package.json lists vite and vitest and no other UI framework

### REQ-C-002: Textos en español
- **Statement:** Every text shown to the user is in Spanish.
- **Para el cliente:** Todo lo que se lee en la web está en español.
- **Type:** Business
- **Source:** AGENTS.md
- **Needs:** N-001
- **Verification:** test — the texts of the interface are read from the source and the Spanish messages of the criteria appear verbatim

### REQ-C-003: Datos compartidos entre dispositivos
- **Statement:** Reservations, inventory, loans, fines and accounts are stored in one place that every user reads and writes from their own device, not in each browser.
- **Para el cliente:** Lo que reserva un socio desde su móvil lo ve el encargado desde el ordenador del club.
- **Type:** Technical
- **Source:** team (several people use the app from different devices)
- **Needs:** N-005, N-009
- **Verification:** test — a second session with another account reads data written by the first

## Supuestos

- Los roles son socio, encargado y junta; el encargado da de alta, restablece contraseña y da de baja a los socios porque el encargo no dice quién lo hace.
- Contraseña mínima de 8 caracteres; tras 5 fallos seguidos la cuenta se bloquea 15 minutos (lo habitual en webs de socios).
- La sesión caduca a los 30 minutos sin actividad y se puede salir con «Salir».
- Una reserva dura como máximo 14 días seguidos para que una persona no acapare el material.
- Las fechas son días completos: la reserva ocupa la unidad desde el día de inicio hasta el día de fin, ambos incluidos; no se reserva en fechas pasadas.
- «Hasta el día antes» significa que se cancela hasta el día anterior al de inicio; el mismo día de inicio ya no.
- Una reserva no recogida el día de inicio pasa a «No recogida» al día siguiente y libera la unidad, para que el material no quede bloqueado.
- La multa se calcula al marcar la devolución: 2 € × días naturales entre la fecha de fin y la de devolución. Las multas no caducan.
- Dar de baja una unidad prestada o a un socio con material sin devolver se rechaza; si solo tienen reservas futuras, esas reservas se cancelan.
- Se registran nombre, correo, reservas, entregas, devoluciones y multas de cada socio; se conservan 2 años desde su última actividad y el historial de un socio dado de baja se mantiene para la junta durante ese plazo.
- El encargado ve y puede operar sobre todos los socios; la junta ve todo lo de los socios pero no puede cambiar nada; el socio solo ve lo suyo.
- El catálogo de tipos es el pedido: piolets, crampones, cascos, cuerdas y tiendas; cada unidad se identifica con un número («Casco 2»).
- El pago de la multa lo anota el encargado a mano; la web no cobra.

## Traceability

| REQ ID | Type | Priority | Source | Needs | Verification | Dependencies |
|--------|------|----------|--------|-------|--------------|--------------|
| REQ-F-001 | Functional | Must | intent/INT-001.md | N-002 | test | REQ-F-002 |
| REQ-F-002 | Functional | Must | intent/INT-001.md | N-002 | test | None |
| REQ-F-003 | Functional | Must | intent/INT-001.md | N-003, N-006 | test | REQ-F-001, REQ-F-008 |
| REQ-F-004 | Functional | Must | intent/INT-001.md | N-004 | test | REQ-F-003 |
| REQ-F-005 | Functional | Must | intent/INT-001.md | N-005 | test | REQ-F-003 |
| REQ-F-006 | Functional | Must | intent/INT-001.md | N-006 | test | REQ-F-005 |
| REQ-F-007 | Functional | Must | intent/INT-001.md | N-007 | test | REQ-F-006 |
| REQ-F-008 | Functional | Must | intent/INT-001.md | N-008, N-003 | test | None |
| REQ-F-009 | Functional | Must | intent/INT-001.md | N-009 | test | REQ-F-005 |
| REQ-F-010 | Functional | Must | intent/INT-001.md | N-010 | test | REQ-F-001 |
| REQ-NF-001 | Nonfunctional | Must | intent/INT-001.md | N-011 | test | REQ-F-001 |
| REQ-C-001 | Constraint | — | AGENTS.md | N-001 | test | — |
| REQ-C-002 | Constraint | — | AGENTS.md | N-001 | test | — |
| REQ-C-003 | Constraint | — | team | N-005, N-009 | test | — |
