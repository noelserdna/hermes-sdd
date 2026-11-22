# Requirements Document

> **Project:** material-montana12
> **Version:** 1.0
> **Last updated:** 2026-11-22
> **Status:** Approved
> **Approved by:** Andres Leon (Cliente), 2026-11-22
> **Ejemplos revisados por:** Andres Leon (Cliente), 2026-11-22
> **Customer needs:** [CUSTOMER-NEEDS.md](CUSTOMER-NEEDS.md)

Roles: **socio**, **encargado** (del material) y **junta** (solo consulta). Un «día» es un día natural; las fechas de una reserva son de inicio y fin, ambas incluidas.

## Functional Requirements

### REQ-F-001: Entrar y salir
- **Statement:** WHEN a user submits a registered email and its password THE system SHALL open a session and show the home of their role
- **Para el cliente:** Entras con tu correo y tu contraseña y ves tu página según seas socio, encargado o junta. Puedes salir cuando quieras.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-001
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Todo lo demás depende de saber quién es cada persona y qué rol tiene.
- **Acceptance criteria:**
  - GIVEN socio "lucia@club.test" with password "Cumbre2026!" WHEN she enters both in the login form THEN the user sees "Hola, Lucía" in the page "Mis reservas"
    - Se ve: "Hola, {nombre}" en Mis reservas
  - GIVEN encargado "pablo@club.test" with password "Piolet2026!" WHEN he enters both THEN the user sees "Hola, Pablo" in the page "Panel del encargado"
    - Se ve: "Hola, {nombre}" en Panel del encargado
  - GIVEN "lucia@club.test" WHEN she enters a wrong password THEN the user sees "Correo o contraseña incorrectos"
    - Se ve: "Correo o contraseña incorrectos" en Entrar
  - GIVEN "lucia@club.test" failed 5 times in a row WHEN she enters the right password 1 minute later THEN the user sees "Cuenta bloqueada. Vuelve a intentarlo en 15 minutos"
    - Se ve: "Cuenta bloqueada. Vuelve a intentarlo en 15 minutos" en Entrar
  - GIVEN "lucia@club.test" was blocked 15 minutes ago WHEN she enters the right password THEN the user sees "Hola, Lucía"
    - Se ve: "Hola, {nombre}" en Mis reservas
  - GIVEN a session with 30 minutes without activity WHEN the user opens any page THEN the user sees the form "Entrar"
    - Se ve: "Entrar" en Entrar
  - GIVEN a logged-in user WHEN they press "Salir" THEN the user sees the form "Entrar" and going back does not show private data
    - Se ve: "Entrar" en Entrar
    - Se ve: "Entrar" en Entrar al volver atrás con el navegador, sin ninguna reserva, multa ni nombre de socio en pantalla
  - GIVEN an unauthenticated visitor WHEN they open "/mis-reservas" THEN the user sees the form "Entrar"
    - Se ve: "Entrar" en Entrar
- **Dependencies:** None

### REQ-F-002: Alta, baja y contraseña de los socios
- **Statement:** WHEN the encargado registers a member with name, email and a temporary password of at least 8 characters THE system SHALL create the account, and WHEN the encargado removes a member without open loans or fines THE system SHALL disable the account
- **Para el cliente:** El encargado da de alta a los socios (con una contraseña provisional que el socio cambia al entrar), puede darles una contraseña nueva si la olvidan y los da de baja. No se puede dar de baja a quien tiene material sin devolver o multas sin pagar.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-001
- **Origin:** method
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Sin cuentas creadas nadie puede entrar; la petición no dice quién las da de alta.
- **Acceptance criteria:**
  - GIVEN the encargado in "Socios" WHEN he registers "Marta Ruiz", "marta@club.test", password "Provisional1" THEN the user sees "Socio creado: Marta Ruiz" and "Marta Ruiz" in the list
    - Se ve: "Socio creado: {nombre}" y "Marta Ruiz — Activo" en Socios
  - GIVEN "Marta Ruiz" exists WHEN the encargado registers "marta@club.test" again THEN the user sees "Ya existe un socio con ese correo" and the list has one "Marta Ruiz"
    - Se ve: "Ya existe un socio con ese correo" en Socios
    - Se ve: una sola fila "Marta Ruiz — Activo" en la lista de Socios (no aparece repetida tras el segundo intento)
  - GIVEN the form WHEN the temporary password is "corta" THEN the user sees "La contraseña debe tener al menos 8 caracteres"
    - Se ve: "La contraseña debe tener al menos 8 caracteres" en Socios
  - GIVEN Marta enters with her temporary password WHEN she logs in THEN the user sees "Elige una contraseña nueva" and she cannot continue until she sets one of at least 8 characters
    - Se ve: "Elige una contraseña nueva" en Cambiar contraseña
    - Se ve: "Elige una contraseña nueva" en Cambiar contraseña cuando Marta intenta abrir "/mis-reservas" sin haberla cambiado
    - Se ve: "La contraseña debe tener al menos 8 caracteres" en Cambiar contraseña cuando Marta envía "corta"
  - GIVEN Marta forgot her password WHEN the encargado sets "Otra12345" for her THEN the user sees "Contraseña provisional guardada para Marta Ruiz" and Marta can enter with "Otra12345" and no longer with her old password
    - Se ve: "Contraseña provisional guardada para {nombre}" en Socios
    - Se ve: "Elige una contraseña nueva" en Cambiar contraseña cuando Marta entra con "marta@club.test" y "Otra12345"
    - Se ve: "Correo o contraseña incorrectos" en Entrar cuando Marta entra con "marta@club.test" y su contraseña antigua
  - GIVEN Marta has no open loans and no pending fines WHEN the encargado removes her THEN the user sees "Socio dado de baja: Marta Ruiz" and she can no longer log in
    - Se ve: "Socio dado de baja: {nombre}" en Socios
    - Se ve: "Correo o contraseña incorrectos" en Entrar cuando Marta intenta entrar con su correo y su contraseña después de la baja
  - GIVEN Lucía has 1 loan not yet returned WHEN the encargado removes her THEN the user sees "No se puede dar de baja: tiene material sin devolver" and her account stays active
    - Se ve: "No se puede dar de baja: tiene material sin devolver" y "Lucía Gil — Activo" en Socios
    - Se ve: "Hola, {nombre}" en Mis reservas cuando Lucía entra después con su correo y su contraseña (ejemplo con datos: "Hola, Lucía")
  - GIVEN Pablo has a pending fine of 4 € WHEN the encargado removes him THEN the user sees "No se puede dar de baja: tiene multas sin pagar"
    - Se ve: "No se puede dar de baja: tiene multas sin pagar" en Socios
  - GIVEN Marta has 1 future reservation WHEN the encargado removes her THEN the user sees "Socio dado de baja: Marta Ruiz", her reservation is cancelled and its units become free
    - Se ve: "Socio dado de baja: {nombre}" en Socios
    - Se ve: "Reserva creada: {cantidad} × {material} del {inicio} al {fin}" en Mis reservas cuando Lucía reserva las mismas unidades y fechas que tenía Marta (ejemplo con datos: "Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07")
    - No visible: la reserva de Marta queda en estado "Cancelada": solo se guarda en el fichero de datos, porque Marta ya no puede entrar y ninguna pantalla muestra reservas de un socio dado de baja
- **Dependencies:** REQ-F-001

### REQ-F-003: Reservar material
- **Statement:** WHEN a socio without pending fines chooses an item type, a quantity and start and end dates with enough free units on every day of the range THE system SHALL create the reservation
- **Para el cliente:** El socio elige material, cantidad y fechas y lo reserva si quedan unidades libres todos esos días. Si no quedan, se lo dice.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-002
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Es el uso principal de la web.
- **Acceptance criteria:**
  - GIVEN "Casco" has 6 units and none reserved on 2026-12-05..2026-12-07 WHEN Lucía reserves 2 cascos for those dates THEN the user sees "Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07" in "Mis reservas"
    - Se ve: "Reserva creada: {cantidad} × {material} del {inicio} al {fin}" en Mis reservas
  - GIVEN "Tienda" has 2 units and Lucía reserved 1 for 2026-12-05..2026-12-07 WHEN Pablo reserves 2 tiendas for 2026-12-06..2026-12-08 THEN the user sees "No hay unidades libres: solo queda 1 de Tienda el 2026-12-06" and no reservation is created
    - Se ve: "No hay unidades libres: solo queda {libres} de {material} el {día}" en Reservar
    - Se ve: "Aún no tienes reservas" en Mis reservas cuando Pablo (sin reservas antes) la abre después
  - GIVEN "Linterna" has 3 units and Lucía just reserved 2 for 2026-12-05..2026-12-07 WHEN the same form is submitted again THEN the user sees "No hay unidades libres: solo queda 1 de Linterna el 2026-12-05" and Lucía still has one reservation of 2
    - Se ve: "No hay unidades libres: solo queda {libres} de {material} el {día}" en Reservar
    - Se ve: una sola fila "2 × Linterna del 2026-12-05 al 2026-12-07 — Reservada" en Mis reservas (no aparece una segunda)
  - GIVEN today is 2026-11-22 WHEN a socio picks the start date 2026-11-21 THEN the user sees "La fecha de inicio no puede ser pasada"
    - Se ve: "La fecha de inicio no puede ser pasada" en Reservar
  - GIVEN the form WHEN the end date 2026-12-01 is before the start 2026-12-05 THEN the user sees "La fecha de fin no puede ser anterior a la de inicio"
    - Se ve: "La fecha de fin no puede ser anterior a la de inicio" en Reservar
  - GIVEN the form WHEN a socio asks for 15 days (2026-12-01..2026-12-15) THEN the user sees "Máximo 14 días por reserva"
    - Se ve: "Máximo 14 días por reserva" en Reservar
  - GIVEN the form WHEN a socio asks for 6 units of one type THEN the user sees "Máximo 5 unidades por reserva"
    - Se ve: "Máximo 5 unidades por reserva" en Reservar
  - GIVEN Pablo has a pending fine of 6 € WHEN he tries to reserve THEN the user sees "No puedes reservar hasta pagar tu multa de 6 €" and no reservation is created
    - Se ve: "No puedes reservar hasta pagar tu multa de {importe} €" en Reservar (ejemplo con datos: "No puedes reservar hasta pagar tu multa de 6 €")
    - Se ve: "Aún no tienes reservas" en Mis reservas cuando Pablo (sin reservas antes) la abre después
  - GIVEN Lucía has a pending fine of 2 € WHEN she tries to reserve THEN the user sees "No puedes reservar hasta pagar tu multa de 2 €"
    - Se ve: "No puedes reservar hasta pagar tu multa de {importe} €" en Reservar (ejemplo con datos: "No puedes reservar hasta pagar tu multa de 2 €")
- **Dependencies:** REQ-F-001, REQ-F-007

### REQ-F-004: Mis reservas y cancelar
- **Statement:** WHEN a socio opens "Mis reservas" THE system SHALL list their own reservations with state, and WHEN they cancel one whose start date is after today THE system SHALL cancel it and free its units
- **Para el cliente:** El socio ve sus reservas y las puede cancelar hasta el día antes de que empiecen.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-003
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Dejar libres las unidades que no se van a usar.
- **Acceptance criteria:**
  - GIVEN Lucía has 2 × Casco 2026-12-05..2026-12-07 and no one else has reservations WHEN she opens "Mis reservas" THEN the user sees "2 × Casco del 2026-12-05 al 2026-12-07 — Reservada" and no reservation of other members
    - Se ve: "{cantidad} × {material} del {inicio} al {fin} — {estado}" en Mis reservas (ejemplo con datos: "2 × Casco del 2026-12-05 al 2026-12-07 — Reservada")
    - Se ve: una sola fila en Mis reservas, la de Lucía, sin la reserva "1 × Tienda del 2026-12-06 al 2026-12-08 — Reservada" que tiene Pablo
  - GIVEN today is 2026-12-04 and her reservation starts 2026-12-05 WHEN Lucía presses "Cancelar" THEN the user sees "Reserva cancelada", its state "Cancelada" and its units become free
    - Se ve: "Reserva cancelada" y "2 × Casco del 2026-12-05 al 2026-12-07 — Cancelada" en Mis reservas
    - Se ve: "Reserva creada: {cantidad} × {material} del {inicio} al {fin}" en Mis reservas cuando Pablo reserva 5 × Casco esas fechas, con "Casco" de 6 unidades (ejemplo con datos: "Reserva creada: 5 × Casco del 2026-12-05 al 2026-12-07")
  - GIVEN the reservation was just cancelled WHEN "Cancelar" is submitted again THEN the user sees "La reserva ya estaba cancelada" and the units are not freed twice
    - Se ve: "La reserva ya estaba cancelada" en Mis reservas
    - Se ve: "No hay unidades libres: solo queda 1 de Casco el 2026-12-05" en Reservar cuando después Pablo pide 5 × Casco y luego otros 2 × Casco esas fechas, con "Casco" de 6 unidades (si se hubieran liberado dos veces, aceptaría los 2)
  - GIVEN today is 2026-12-05 and her reservation starts 2026-12-05 WHEN she looks at it THEN the user sees "No se puede cancelar: empieza hoy" and no "Cancelar" button
    - Se ve: "No se puede cancelar: empieza hoy" en Mis reservas, en la fila de esa reserva y sin botón "Cancelar"
  - GIVEN a new socio without reservations WHEN she opens "Mis reservas" THEN the user sees "Aún no tienes reservas"
    - Se ve: "Aún no tienes reservas" en Mis reservas
  - GIVEN Pablo is a socio with no reservations while Lucía has one WHEN he opens "Mis reservas" THEN the user sees "Aún no tienes reservas"
    - Se ve: "Aún no tienes reservas" en Mis reservas
- **Dependencies:** REQ-F-003

### REQ-F-005: Entregar y recibir el material
- **Statement:** WHEN the encargado marks a reservation as delivered on or after its start date THE system SHALL record the loan, and WHEN he marks it as returned THE system SHALL close the loan, free the units and create a fine of 2 € per day late
- **Para el cliente:** El encargado marca lo que entrega y lo que le devuelven. Si algo vuelve tarde, la multa de 2 € por cada día de retraso se crea sola.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-004, N-005
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** El préstamo real empieza y acaba en la mano del encargado.
- **Acceptance criteria:**
  - GIVEN today is 2026-12-05 and Lucía has 2 × Casco reserved from 2026-12-05 WHEN the encargado presses "Entregar" THEN the user sees "Entregado: 2 × Casco a Lucía Gil" and its state "Prestada"
    - Se ve: "Entregado: {cantidad} × {material} a {nombre}" y "2 × Casco del 2026-12-05 al 2026-12-07 — Prestada" en Panel del encargado
  - GIVEN the reservation was just delivered WHEN "Entregar" is submitted again THEN the user sees "Ya estaba entregada" and the loan is still one
    - Se ve: "Ya estaba entregada" en Panel del encargado
    - Se ve: una sola fila "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07" en Panel del encargado (no aparece repetida)
  - GIVEN the loan ends 2026-12-07 WHEN the encargado marks the return on 2026-12-07 THEN the user sees "Devuelto a tiempo" and no fine exists
    - Se ve: "Devuelto a tiempo" en Panel del encargado
    - Se ve: "No tienes multas" en Mis multas cuando Lucía la abre después
  - GIVEN the loan ends 2026-12-07 WHEN the encargado marks the return on 2026-12-10 THEN the user sees "Devuelto con 3 días de retraso: multa de 6 €"
    - Se ve: "Devuelto con {días} días de retraso: multa de {importe} €" en Panel del encargado (ejemplo con datos: "Devuelto con 3 días de retraso: multa de 6 €")
  - GIVEN the loan ends 2026-12-07 WHEN it is returned on 2026-12-08 THEN the user sees "Devuelto con 1 día de retraso: multa de 2 €"
    - Se ve: "Devuelto con {días} día de retraso: multa de {importe} €" en Panel del encargado (ejemplo con datos: "Devuelto con 1 día de retraso: multa de 2 €")
  - GIVEN the return was just marked with a fine of 6 € WHEN "Devolver" is submitted again THEN the user sees "Ya estaba devuelta" and the fine is still 1 of 6 €
    - Se ve: "Ya estaba devuelta" en Panel del encargado
    - Se ve: "{nombre} — Multa de {importe} € — {estado}" en Multas (ejemplo con datos: "Lucía Gil — Multa de 6 € — Pendiente")
    - Se ve: una sola fila "Lucía Gil — Multa de 6 € — Pendiente" en Multas (no aparece repetida ni con otro importe)
  - GIVEN the reservation ended 2026-12-07 and was never delivered WHEN the encargado opens it on 2026-12-08 THEN the user sees "No recogida" and its units are free
    - Se ve: "No recogida" en Panel del encargado
    - No visible: sus unidades quedan libres: las fechas ya han pasado y ninguna pantalla permite reservar fechas pasadas ("La fecha de inicio no puede ser pasada"), así que solo lo refleja el cálculo de disponibilidad del fichero de datos
  - GIVEN a reservation from 2026-12-10 WHEN the encargado presses "Entregar" on 2026-12-05 THEN the user sees "No se puede entregar antes de la fecha de inicio"
    - Se ve: "No se puede entregar antes de la fecha de inicio" en Panel del encargado
  - GIVEN a loan of 2 × Casco that ended 2026-12-07 and was not returned WHEN the encargado opens "Panel del encargado" on 2026-12-10 THEN the user sees "Retraso: 3 días" next to the loan and the fine is not created until the return is marked
    - Se ve: "Retraso: {días} días" en Panel del encargado (ejemplo con datos: "Retraso: 3 días")
    - Se ve: "No tienes multas" en Mis multas cuando Lucía la abre antes de que el encargado marque la devolución
  - GIVEN a loan that ended 2026-12-07 and was not returned WHEN the encargado opens "Panel del encargado" on 2026-12-08 THEN the user sees "Retraso: 1 día"
    - Se ve: "Retraso: {días} día" en Panel del encargado (ejemplo con datos: "Retraso: 1 día")
- **Dependencies:** REQ-F-003

### REQ-F-006: Multas y bloqueo hasta pagarlas
- **Statement:** WHEN the encargado marks a fine as paid THE system SHALL lift the reservation block of that socio if no other fine is pending, and WHILE a socio has a pending fine THE system SHALL show it to them
- **Para el cliente:** El socio ve sus multas y no puede reservar mientras deba alguna. Cuando el encargado la marca como pagada, vuelve a poder reservar.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-005, N-006
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** La multa solo sirve si bloquea y se puede levantar.
- **Acceptance criteria:**
  - GIVEN Pablo has a pending fine of 6 € WHEN he opens "Mis multas" THEN the user sees "Multa de 6 € — Pendiente"
    - Se ve: "Multa de {importe} € — {estado}" en Mis multas
  - GIVEN Pablo has a pending fine of 6 € WHEN the encargado presses "Marcar pagada" THEN the user sees "Multa pagada" and Pablo can reserve again
    - Se ve: "Multa pagada" en Multas
    - Se ve: "Reserva creada: {cantidad} × {material} del {inicio} al {fin}" en Mis reservas cuando Pablo reserva después, sin "No puedes reservar hasta pagar tu multa de {importe} €" en Reservar (ejemplo con datos: "Reserva creada: 1 × Tienda del 2026-12-10 al 2026-12-11")
  - GIVEN the fine was just paid WHEN "Marcar pagada" is submitted again THEN the user sees "La multa ya estaba pagada" and the fine stays "Pagada", still one fine of 6 €
    - Se ve: "La multa ya estaba pagada" y "{nombre} — Multa de {importe} € — Pagada" en Multas (ejemplo con datos: "Pablo Sanz — Multa de 6 € — Pagada")
    - Se ve: una sola fila "Pablo Sanz — Multa de 6 € — Pagada" en Multas (no aparece repetida)
  - GIVEN Pablo has 2 pending fines of 2 € and 4 € WHEN the encargado pays the one of 4 € THEN the user sees "Multa pagada" and Pablo still sees "No puedes reservar hasta pagar tu multa de 2 €"
    - Se ve: "Multa pagada" en Multas
    - Se ve: "No puedes reservar hasta pagar tu multa de {importe} €" en Reservar (ejemplo con datos: "No puedes reservar hasta pagar tu multa de 2 €")
  - GIVEN Lucía has no fines WHEN she opens "Mis multas" THEN the user sees "No tienes multas"
    - Se ve: "No tienes multas" en Mis multas
  - GIVEN Marta has no fines while Pablo has one WHEN she opens "Mis multas" THEN the user sees "No tienes multas"
    - Se ve: "No tienes multas" en Mis multas
  - GIVEN Pablo has a pending fine of 6 € and Lucía has a paid fine of 2 € WHEN the encargado opens the list "Multas" THEN the user sees "Pablo Sanz — Multa de 6 € — Pendiente" and "Lucía Gil — Multa de 2 € — Pagada"
    - Se ve: "{nombre} — Multa de {importe} € — {estado}" en Multas (ejemplo con datos: "Pablo Sanz — Multa de 6 € — Pendiente")
    - Se ve: "{nombre} — Multa de {importe} € — {estado}" en Multas (ejemplo con datos: "Lucía Gil — Multa de 2 € — Pagada")
- **Dependencies:** REQ-F-005

### REQ-F-007: Inventario
- **Statement:** WHEN the encargado adds units of an item type THE system SHALL increase its stock, and WHEN he withdraws broken units that no loan or reservation needs THE system SHALL reduce it
- **Para el cliente:** El encargado añade material nuevo y da de baja las unidades rotas. Si una unidad rota hace falta para una reserva ya hecha, la web se lo avisa en lugar de dejarla sin material.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-007
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** La disponibilidad depende de que el inventario sea cierto.
- **Acceptance criteria:**
  - GIVEN "Cuerda" has 4 units WHEN the encargado adds 2 units THEN the user sees "Cuerda: 6 unidades" in "Material"
    - Se ve: "{material}: {total} unidades" en Material
  - GIVEN a new type WHEN the encargado adds "Mosquetón" with 10 units THEN the user sees "Mosquetón: 10 unidades"
    - Se ve: "{material}: {total} unidades" en Material
  - GIVEN "Cuerda" has 6 units and none lent or reserved WHEN the encargado withdraws 1 broken unit THEN the user sees "Cuerda: 5 unidades"
    - Se ve: "{material}: {total} unidades" en Material
  - GIVEN "Tienda" has 2 units, both reserved on 2026-12-06 WHEN the encargado withdraws 1 THEN the user sees "No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06" and "Tienda: 2 unidades"
    - Se ve: "No se puede dar de baja: hay {n} unidades de {material} necesarias el {día}" y "{material}: {total} unidades" en Material (ejemplo con datos: "Tienda: 2 unidades")
  - GIVEN "Cuerda" has 1 unit and none lent or reserved, and the encargado just withdrew it (stock 0) WHEN the same withdrawal is submitted again THEN the user sees "No hay tantas unidades para dar de baja" and "Cuerda: 0 unidades"
    - Se ve: "No hay tantas unidades para dar de baja" y "{material}: {total} unidades" en Material (ejemplo con datos: "Cuerda: 0 unidades")
  - GIVEN "Casco" with 6 units and "Cuerda" with 0 units WHEN a socio opens "Reservar" THEN the user sees "Casco" among the types and "Cuerda" does not offer reservation
    - Se ve: "{material}" en Reservar (ejemplo con datos: "Casco")
    - Se ve: la lista de tipos de Reservar con "Casco" y sin "Cuerda"
- **Dependencies:** REQ-F-001

### REQ-F-008: Qué hay prestado y qué vuelve cada día
- **Statement:** WHEN the encargado opens "Panel del encargado" THE system SHALL list the reservations to deliver, the loans out, the returns due today and the late ones, and WHEN he picks another date THE system SHALL list the returns due that day
- **Para el cliente:** El encargado ve de un vistazo qué material tiene que entregar, qué está fuera, qué vuelve hoy (o el día que elija) y qué está retrasado.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-008
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** Es la lista que necesita para hacer su trabajo cada día, incluida la de lo que debe entregar.
- **Acceptance criteria:**
  - GIVEN Lucía has 2 × Casco lent until 2026-12-07 WHEN the encargado opens the panel on 2026-12-05 THEN the user sees "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07"
    - Se ve: "Prestado: {cantidad} × {material} — {nombre} — vuelve el {fecha}" en Panel del encargado
  - GIVEN the same loan WHEN the encargado opens the panel on 2026-12-07 THEN the user sees it under "Vuelven hoy"
    - Se ve: "Vuelven hoy" y "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07" en Panel del encargado
  - GIVEN the same loan WHEN the encargado picks the date 2026-12-07 on 2026-12-05 THEN the user sees "Vuelven el 2026-12-07" with that loan
    - Se ve: "Vuelven el {fecha}" y "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07" en Panel del encargado
  - GIVEN no loans WHEN the encargado opens the panel THEN the user sees "No hay material prestado"
    - Se ve: "No hay material prestado" en Panel del encargado
  - GIVEN Lucía has 2 × Casco reserved from 2026-12-05 WHEN the encargado opens the panel on 2026-12-05 THEN the user sees "Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05" and the button "Entregar"
    - Se ve: "Por entregar: {cantidad} × {material} — {nombre} — desde el {fecha}" y "Entregar" en Panel del encargado
  - GIVEN a socio WHEN he opens "/panel" THEN the user sees "No tienes permiso para ver esta página"
    - Se ve: "No tienes permiso para ver esta página" en Panel del encargado
  - GIVEN a junta member WHEN she opens "/panel" THEN the user sees "No tienes permiso para ver esta página"
    - Se ve: "No tienes permiso para ver esta página" en Panel del encargado
- **Dependencies:** REQ-F-005

### REQ-F-009: Historial de un socio para la junta
- **Statement:** WHEN a junta member searches a socio by name or email THE system SHALL show that socio's loans and fines read-only
- **Para el cliente:** La junta busca a cualquier socio y ve sus préstamos y multas, sin poder cambiar nada.
- **Category:** Functional
- **Priority:** Must have
- **Needs:** N-009
- **Verification:** test
- **Source:** intent/INT-001.md
- **Rationale:** La junta supervisa pero no gestiona.
- **Acceptance criteria:**
  - GIVEN Lucía has a loan of 2 × Casco 2026-12-05..2026-12-07 returned on 2026-12-09 and a fine of 4 € paid WHEN a junta member searches "lucia" THEN the user sees "2 × Casco del 2026-12-05 al 2026-12-07 — devuelto el 2026-12-09" and "Multa de 4 € — Pagada"
    - Se ve: "{cantidad} × {material} del {inicio} al {fin} — devuelto el {fecha}" y "Multa de {importe} € — {estado}" en Historial del socio (ejemplo con datos: "Multa de 4 € — Pagada")
  - GIVEN a socio with no loans WHEN the junta opens their history THEN the user sees "Sin préstamos ni multas"
    - Se ve: "Sin préstamos ni multas" en Historial del socio
  - GIVEN the junta WHEN looking for "zzz" THEN the user sees "Ningún socio coincide"
    - Se ve: "Ningún socio coincide" en Historial del socio
  - GIVEN the junta views a history WHEN they look for any button THEN there is no "Entregar", "Devolver", "Marcar pagada" or "Cancelar"
    - Se ve: "Historial del socio" sin ningún botón "Entregar", "Devolver", "Marcar pagada" ni "Cancelar"
- **Dependencies:** REQ-F-005, REQ-F-006

## Nonfunctional Requirements

### REQ-NF-001: Cada rol solo ve y hace lo suyo
- **Statement:** THE system SHALL show a socio only their own reservations, loans, fines and personal data, and SHALL reject any request outside the role (encargado: managing; junta: read-only; socio: own data)
- **Para el cliente:** Los datos de los socios solo los ven ellos mismos, el encargado y la junta. Un socio no ve nada de otro, y la junta no puede cambiar nada.
- **Category:** Security
- **Priority:** Must have
- **Needs:** N-010
- **Verification:** test
- **Metric:** 0 datos de otro socio devueltos a un socio; 0 acciones de gestión aceptadas de la junta o de un socio
- **Acceptance criteria:**
  - GIVEN Lucía and Pablo are socios WHEN Lucía asks for Pablo's reservations or fines by id THEN the system answers "Acceso denegado" and returns no data of Pablo
  - GIVEN a junta member WHEN he sends "marcar pagada" or "entregar" THEN the system answers "Acceso denegado" and nothing changes
  - GIVEN a socio WHEN she opens the list of socios THEN the system answers "Acceso denegado"
  - GIVEN the passwords WHEN the stored data is read THEN no password appears in plain text
- **Dependencies:** REQ-F-001

### REQ-NF-002: Datos compartidos entre dispositivos
- **Statement:** THE system SHALL keep all data on a server shared by every user, so that a change made from one device is visible from another within 5 seconds of reloading
- **Para el cliente:** Lo que un socio reserva lo ve el encargado en su propio móvil u ordenador, porque todo está en un mismo sitio y no en cada navegador.
- **Category:** Availability
- **Priority:** Must have
- **Needs:** N-002, N-004
- **Origin:** method
- **Verification:** test
- **Metric:** reserva creada desde un navegador visible desde otro en una recarga
- **Acceptance criteria:**
  - GIVEN Lucía reserves 2 × Casco in one browser WHEN the encargado opens the panel from a different browser THEN he sees her reservation
  - GIVEN the server restarts WHEN a user logs in THEN the reservations made before are still there
- **Dependencies:** None

### REQ-NF-003: Datos personales y conservación
- **Statement:** THE system SHALL store only name, email, password (hashed) and the loans and fines of each socio, and SHALL delete the loans and fines older than 3 years
- **Para el cliente:** De cada socio solo se guarda el nombre, el correo y su historial de préstamos y multas, y el historial se borra pasados 3 años.
- **Category:** Security
- **Priority:** Should have
- **Needs:** N-010
- **Origin:** method
- **Verification:** test
- **Metric:** 0 campos personales distintos de nombre y correo; 0 registros con más de 3 años
- **Acceptance criteria:**
  - GIVEN a socio registered WHEN the stored record is read THEN it holds name, email and a password hash only
  - GIVEN a loan that ended 2023-11-01 and today is 2026-11-22 WHEN the cleanup runs THEN that loan is gone and a loan ended 2025-01-10 remains
- **Dependencies:** REQ-F-005

## Constraints

### REQ-C-001: Textos en español
- **Statement:** Every text of the interface SHALL be in Spanish
- **Para el cliente:** Toda la web está en español.
- **Type:** Business
- **Source:** AGENTS.md
- **Needs:** —
- **Verification:** test — los textos de la interfaz no contienen frases en inglés de una lista de control

### REQ-C-002: Stack del proyecto
- **Statement:** The project SHALL be JavaScript (ES modules) with Vite and tests with Vitest
- **Para el cliente:** Se construye con las herramientas elegidas al crear el proyecto.
- **Type:** Technical
- **Source:** AGENTS.md
- **Needs:** — (team/architecture source)
- **Verification:** test — package.json declara vite y vitest y "type": "module"

## Supuestos

- Las cuentas las crea el encargado (con contraseña provisional que el socio cambia al entrar); la petición no dice quién las da de alta y así no hay registro abierto a cualquiera.
- Contraseña olvidada: la restablece el encargado con una provisional; evita enviar correos, que la petición no pide.
- Contraseña mínima de 8 caracteres, bloqueo de 15 minutos tras 5 fallos seguidos y sesión que caduca a los 30 minutos sin actividad: valores habituales en webs de socios.
- La junta y el encargado existen como cuentas dadas de alta fuera de la web (datos iniciales); la web solo da de alta socios.
- «Hasta el día antes» = se puede cancelar mientras hoy sea anterior a la fecha de inicio.
- Las fechas de inicio y fin de una reserva se cuentan ambas; el retraso se cuenta en días naturales después de la fecha de fin; devolver el mismo día de fin no tiene multa.
- Una reserva dura como máximo 14 días y 5 unidades por tipo: evita que una persona acapare el material; es una cifra prudente.
- Una reserva que nadie recoge antes de que acabe su fecha de fin pasa a «No recogida» y libera las unidades; no hay multa por no recogerla.
- La multa se crea al marcar la devolución, no antes; si algo no se devuelve nunca, el encargado lo ve como retraso en su panel.
- La multa pendiente impide reservar de nuevo, pero no cancela las reservas ya hechas.
- Dar de baja a un socio con material sin devolver o multas pendientes se rechaza; sus reservas futuras se cancelan al darlo de baja.
- Dar de baja unidades que hacen falta para préstamos o reservas ya hechas se rechaza para no dejar a nadie sin material.
- Solo se guarda nombre, correo, contraseña cifrada y el historial; el historial se borra a los 3 años.
- El panel del encargado también lista las reservas por entregar (sin ellas no podría pulsar «Entregar»); la lista de multas del encargado muestra todas con su estado, pendientes y pagadas.
- Un socio dado de baja que intenta entrar ve el mismo «Correo o contraseña incorrectos»: no se dice si la cuenta existió.
- El encargado también ve la lista de socios y sus multas; la junta no ve el panel del encargado ni modifica nada.
- Más del 60 % de los requisitos son Must porque casi todo lo pedido es imprescindible para que el préstamo funcione.

## Traceability

| REQ ID | Type | Priority | Source | Needs | Verification | Dependencies |
|--------|------|----------|--------|-------|--------------|--------------|
| REQ-F-001 | Functional | Must | intent/INT-001.md | N-001 | test | None |
| REQ-F-002 | Functional | Must | intent/INT-001.md | N-001 | test | REQ-F-001 |
| REQ-F-003 | Functional | Must | intent/INT-001.md | N-002 | test | REQ-F-001, REQ-F-007 |
| REQ-F-004 | Functional | Must | intent/INT-001.md | N-003 | test | REQ-F-003 |
| REQ-F-005 | Functional | Must | intent/INT-001.md | N-004, N-005 | test | REQ-F-003 |
| REQ-F-006 | Functional | Must | intent/INT-001.md | N-005, N-006 | test | REQ-F-005 |
| REQ-F-007 | Functional | Must | intent/INT-001.md | N-007 | test | REQ-F-001 |
| REQ-F-008 | Functional | Must | intent/INT-001.md | N-008 | test | REQ-F-005 |
| REQ-F-009 | Functional | Must | intent/INT-001.md | N-009 | test | REQ-F-005, REQ-F-006 |
| REQ-NF-001 | Nonfunctional | Must | intent/INT-001.md | N-010 | test | REQ-F-001 |
| REQ-NF-002 | Nonfunctional | Must | método | N-002, N-004 | test | None |
| REQ-NF-003 | Nonfunctional | Should | método | N-010 | test | REQ-F-005 |
| REQ-C-001 | Constraint | — | AGENTS.md | — | test | — |
| REQ-C-002 | Constraint | — | AGENTS.md | — | test | — |
