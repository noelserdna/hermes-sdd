# Guion de la demo — FASE-1

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## UC-005 — Reservar material

Flujo principal:
1. Socio: abre Reservar y elige tipo de material, inicio y fin.
2. Sistema: calcula las unidades libres del rango y las muestra, p. ej. "2 libres" (API-002-01, RN-001).
3. Socio: envía la reserva.
4. Sistema: valida tipo (INV-STK-001), `inicio` ≥ hoy (INV-RES-002, RN-002), `fin` ≥ `inicio` (INV-RES-003) y duración ≤ `RESERVATION_MAX_DAYS` (INV-RES-004).
5. Sistema: comprueba que el socio no tiene multa Pendiente (INV-RES-005).
6. Sistema: asigna la unidad libre de menor número y guarda la reserva de forma atómica y serializada (INV-RES-001, ADR-005).
7. Sistema: muestra M_RESERVA_CREADA.

Extensiones:
- 6a. Otra reserva termina el día anterior a `inicio` → no hay solape y la reserva se crea. (AC-005-02)
- 5a. Socio sin multas → no queda bloqueado y la reserva se crea. (AC-005-03)

Criterios:
- AC-005-01: Reservar material para unas fechas. En Reservar se ve «Reserva creada: {material}, {inicio} a {fin}».
  El criterio pide: the user sees "Reserva creada: Piolet, 2026-12-05 a 2026-12-07" and "Piolet" shows "2 libres" for those dates
- AC-005-04: Reservar material para unas fechas. En Reservar se ve «No hay unidades libres esas fechas».
  El criterio pide: the user sees "No hay unidades libres esas fechas" and no reservation is created
- AC-005-02: Reservar material para unas fechas. En Reservar se ve «Reserva creada: {material}, {inicio} a {fin}».
  El criterio pide: the reservation is created (the days do not overlap)
- AC-005-05: Reservar material para unas fechas. En Reservar se ve «No se puede reservar en fechas pasadas».
  El criterio pide: the user sees "No se puede reservar en fechas pasadas"
- AC-005-06: Reservar material para unas fechas. En Reservar se ve «La fecha de fin no puede ser anterior a la de inicio».
  El criterio pide: the user sees "La fecha de fin no puede ser anterior a la de inicio"
- AC-005-07: Reservar material para unas fechas. En Reservar se ve «La reserva no puede superar 14 días».
  El criterio pide: the user sees "La reserva no puede superar 14 días"
- AC-005-08: Reservar material para unas fechas. En Reservar se ve «Tienes una multa pendiente: no puedes reservar hasta pagarla».
  El criterio pide: the user sees "Tienes una multa pendiente: no puedes reservar hasta pagarla" and no reservation is created
- AC-005-03: Reservar material para unas fechas. En Reservar se ve «Reserva creada: {material}, {inicio} a {fin}».
  El criterio pide: the reservation is created (a socio without fines is not blocked)
- AC-005-14: Reservar material para unas fechas. En Mis reservas se ve «Piolet».
  El criterio pide: "Mis reservas" still shows a single "Piolet" for those dates or the message "No hay unidades libres esas fechas" when no unit is left, and never two reservations of one unit for the same days

## UC-006 — Ver mis reservas

Flujo principal:
1. Socio: abre Mis reservas.
2. Sistema: aplica el paso de día a las reservas vencidas (RN-004).
3. Sistema: filtra por dueño y devuelve sus reservas con su estado (INV-SEC-001).
4. Sistema: muestra la lista.

Extensiones:
- 3a. El socio no tiene reservas → se muestra "No tienes reservas". (AC-006-02)

Criterios:
- AC-006-01: Ver y cancelar mis reservas. En Mis reservas se ve «Piolet».
  El criterio pide: the user sees "Piolet" and does not see "Casco"
- AC-006-02: Ver y cancelar mis reservas. En Mis reservas se ve «No tienes reservas».
  El criterio pide: the user sees "No tienes reservas"

## UC-007 — Cancelar reserva

Flujo principal:
1. Socio: cancela una reserva en Mis reservas.
2. Sistema: comprueba que la reserva existe y es del socio (INV-SEC-001).
3. Sistema: si ya está Cancelada, no cambia nada (INV-RES-007).
4. Sistema: comprueba estado Reservada e `inicio` > hoy (INV-RES-006, RN-002).
5. Sistema: guarda la cancelación de forma atómica y serializada (ADR-005).
6. Sistema: muestra M_RESERVA_CANCELADA y estado "Cancelada".

Criterios:
- AC-007-01: Ver y cancelar mis reservas. En Mis reservas se ve «Reserva cancelada».
  El criterio pide: the user sees "Reserva cancelada" and the reservation shows state "Cancelada"
- AC-007-02: Ver y cancelar mis reservas. En Mis reservas se ve «Solo se puede cancelar hasta el día antes».
  El criterio pide: the user sees "Solo se puede cancelar hasta el día antes" and the reservation stays
- AC-007-03: Ver y cancelar mis reservas. En Mis reservas se ve «Cancelada».
  El criterio pide: the reservation stays "Cancelada" and nothing else changes

## UC-013 — Añadir material

Flujo principal:
1. Encargado: abre Inventario (API-004-01).
2. System: muestra cada tipo con "{tipo}: {n} unidades" y sus unidades, también las "De baja".
3. Encargado: elige un tipo e indica la cantidad (API-004-02).
4. System: valida tipo (INV-STK-001) y cantidad (INV-STK-002).
5. System: crea las unidades con los números siguientes del tipo, de forma atómica (INV-SEC-003).
6. System: muestra Inventario con el recuento nuevo.

Extensiones:
- 2a. Un tipo sin unidades → se muestra con 0 unidades. (AC-013-02)

Criterios:
