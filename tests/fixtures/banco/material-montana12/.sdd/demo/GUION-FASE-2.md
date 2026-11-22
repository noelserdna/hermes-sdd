# Guion de la demo — FASE-2

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## UC-007 — Reservar material

Flujo principal:
1. Socio: abre "Reservar"; el sistema autoriza (API-001-08) y ofrece solo tipos con unidades > 0 (API-003-03, INV-MAT-003).
2. Socio: elige tipo, cantidad, fecha de inicio y de fin, y envía.
3. System: comprueba que no hay multa pendiente (INV-MUL-002, RN-016; WF-001 paso 7 al pagarla).
4. System: valida en orden fecha pasada, fin anterior, `MAX_RESERVATION_DAYS`, `MAX_UNITS_PER_RESERVATION` (RN-010, INV-RES-001..003).
5. System: calcula libres por día desde las reservas (ADR-001, RN-009, INV-RES-004).
6. System: crea la reserva Reservada (WF-001 paso 1) y muestra "Mis reservas".

Extensiones:
- 1a. Tipo con 0 unidades → no se ofrece. (AC-007-10)
- 3a. Multa ya pagada (WF-001 paso 7) → sigue en 4.

Criterios:

## UC-010 — Entregar reserva

Flujo principal:
1. Encargado: pulsa "Entregar" en una reserva.
2. System: comprueba rol (API-001-08) y que la reserva existe.
3. System: comprueba estado y fechas contra `hoy` (RN-013, RN-022, INV-RES-007).
4. System: pasa la reserva a Prestada y guarda `deliveredOn` (WF-001 step 3).
5. System: muestra el aviso de entrega y el estado "Prestada" en Panel del encargado.

Extensiones:
- 3a. Ya Prestada (envío repetido) → no cambia; sigue una sola fila de préstamo. (AC-010-02)

Criterios:
- AC-010-01: Entregar y recibir el material. En Panel del encargado se ve «Entregado: {cantidad} × {material} a {nombre}» y «2 × Casco del 2026-12-05 al 2026-12-07 — Prestada».
  El criterio pide: the user sees "Entregado: 2 × Casco a Lucía Gil" and its state "Prestada"
- AC-010-02: Entregar y recibir el material. En Panel del encargado se ve «Ya estaba entregada» y «Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07».
  El criterio pide: the user sees "Ya estaba entregada" and the loan is still one
- AC-010-04: Entregar y recibir el material. sus unidades quedan libres: las fechas ya han pasado y ninguna pantalla permite reservar fechas pasadas ("La fecha de inicio no puede ser pasada"), así que solo lo refleja el cálculo de disponibilidad del fichero de datos
  El criterio pide: the user sees "No recogida" and its units are free
- AC-010-03: Entregar y recibir el material. En Panel del encargado se ve «No se puede entregar antes de la fecha de inicio».
  El criterio pide: the user sees "No se puede entregar antes de la fecha de inicio"

## UC-011 — Recibir devolución

Flujo principal:
1. Encargado: pulsa "Devolver" en un préstamo.
2. System: comprueba rol y que la reserva existe (API-001-08).
3. System: comprueba que está Prestada (SM-001).
4. System: calcula el retraso `returnedOn − endDate` (RN-014, INV-MUL-004, RN-022) y guarda la devolución (WF-001 step 4).
5. System: si retraso > 0, crea la multa Pendiente en la misma operación (WF-001 step 5, ADR-004, INV-MUL-001).
6. System: muestra en Panel del encargado "Devuelto a tiempo" o el aviso de retraso y multa, con "día"/"días" según RN-015.

Extensiones:
- 4a. Retraso 0 → no se crea multa; el socio no ve ninguna. (AC-011-01)
- 4b. Retraso de 1 día → singular. (AC-011-03)

Criterios:
- AC-011-01: Entregar y recibir el material. En Panel del encargado se ve «Devuelto a tiempo» y «No tienes multas».
  El criterio pide: the user sees "Devuelto a tiempo" and no fine exists
- AC-011-02: Entregar y recibir el material. En Panel del encargado (ejemplo con datos: "Devuelto con 3 días de retraso: multa de 6 €") se ve «Devuelto con {días} días de retraso: multa de {importe} €».
  El criterio pide: the user sees "Devuelto con 3 días de retraso: multa de 6 €"
- AC-011-03: Entregar y recibir el material. En Panel del encargado (ejemplo con datos: "Devuelto con 1 día de retraso: multa de 2 €") se ve «Devuelto con {días} día de retraso: multa de {importe} €».
  El criterio pide: the user sees "Devuelto con 1 día de retraso: multa de 2 €"
- AC-011-04: Entregar y recibir el material. En Panel del encargado se ve «Ya estaba devuelta», «{nombre} — Multa de {importe} € — {estado}» y «Lucía Gil — Multa de 6 € — Pendiente».
  El criterio pide: the user sees "Ya estaba devuelta" and the fine is still 1 of 6 €

## UC-017 — Ver panel del encargado

Flujo principal:
1. Encargado: abre "Panel del encargado" y, si quiere, elige una fecha.
2. System: comprueba la sesión y el rol (API-001-08, RN-020).
3. System: lista las Reservadas con inicio ≤ hoy ≤ fin como "Por entregar" con el botón "Entregar" (RN-018, INV-RES-007).
4. System: lista los Prestados; los de fin = hoy salen bajo "Vuelven hoy"; con fecha elegida, bajo "Vuelven el {fecha}" (RN-018).
5. System: marca "Retraso" en los Prestados con fin anterior a hoy, en "día"/"días" (RN-015, INV-MUL-004).
6. System: sin préstamos, muestra el aviso de lista vacía.

Extensiones:
- 4a. Fecha elegida distinta de hoy → agrupa por esa fecha. (AC-017-03)
- 5a. Retraso de 1 día → singular. (AC-017-09)

Criterios:
- AC-017-08: Entregar y recibir el material. En Panel del encargado (ejemplo con datos: "Retraso: 3 días") se ve «Retraso: {días} días» y «No tienes multas».
  El criterio pide: the user sees "Retraso: 3 días" next to the loan and the fine is not created until the return is marked
- AC-017-09: Entregar y recibir el material. En Panel del encargado (ejemplo con datos: "Retraso: 1 día") se ve «Retraso: {días} día».
  El criterio pide: the user sees "Retraso: 1 día"
- AC-017-01: Qué hay prestado y qué vuelve cada día. En Panel del encargado se ve «Prestado: {cantidad} × {material} — {nombre} — vuelve el {fecha}».
  El criterio pide: the user sees "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07"
- AC-017-02: Qué hay prestado y qué vuelve cada día. En Panel del encargado se ve «Vuelven hoy» y «Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07».
  El criterio pide: the user sees it under "Vuelven hoy"
- AC-017-03: Qué hay prestado y qué vuelve cada día. En Panel del encargado se ve «Vuelven el {fecha}» y «Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07».
  El criterio pide: the user sees "Vuelven el 2026-12-07" with that loan
- AC-017-04: Qué hay prestado y qué vuelve cada día. En Panel del encargado se ve «No hay material prestado».
  El criterio pide: the user sees "No hay material prestado"
- AC-017-05: Qué hay prestado y qué vuelve cada día. En Panel del encargado se ve «Por entregar: {cantidad} × {material} — {nombre} — desde el {fecha}» y «Entregar».
  El criterio pide: the user sees "Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05" and the button "Entregar"
- AC-017-06: Qué hay prestado y qué vuelve cada día. En Panel del encargado se ve «No tienes permiso para ver esta página».
  El criterio pide: the user sees "No tienes permiso para ver esta página"
- AC-017-07: Qué hay prestado y qué vuelve cada día. En Panel del encargado se ve «No tienes permiso para ver esta página».
  El criterio pide: the user sees "No tienes permiso para ver esta página"
