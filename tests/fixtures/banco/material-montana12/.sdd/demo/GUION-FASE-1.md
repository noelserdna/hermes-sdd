# Guion de la demo — FASE-1

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
- AC-007-01: Reservar material. En Mis reservas se ve «Reserva creada: {cantidad} × {material} del {inicio} al {fin}».
  El criterio pide: the user sees "Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07" in "Mis reservas"
- AC-007-02: Reservar material. En Reservar se ve «No hay unidades libres: solo queda {libres} de {material} el {día}» y «Aún no tienes reservas».
  El criterio pide: the user sees "No hay unidades libres: solo queda 1 de Tienda el 2026-12-06" and no reservation is created
- AC-007-03: Reservar material. En Reservar se ve «No hay unidades libres: solo queda {libres} de {material} el {día}» y «2 × Linterna del 2026-12-05 al 2026-12-07 — Reservada».
  El criterio pide: the user sees "No hay unidades libres: solo queda 1 de Linterna el 2026-12-05" and Lucía still has one reservation of 2
- AC-007-04: Reservar material. En Reservar se ve «La fecha de inicio no puede ser pasada».
  El criterio pide: the user sees "La fecha de inicio no puede ser pasada"
- AC-007-05: Reservar material. En Reservar se ve «La fecha de fin no puede ser anterior a la de inicio».
  El criterio pide: the user sees "La fecha de fin no puede ser anterior a la de inicio"
- AC-007-06: Reservar material. En Reservar se ve «Máximo 14 días por reserva».
  El criterio pide: the user sees "Máximo 14 días por reserva"
- AC-007-07: Reservar material. En Reservar se ve «Máximo 5 unidades por reserva».
  El criterio pide: the user sees "Máximo 5 unidades por reserva"
- AC-007-08: Reservar material. En Reservar se ve «No puedes reservar hasta pagar tu multa de {importe} €» y «Aún no tienes reservas».
  El criterio pide: the user sees "No puedes reservar hasta pagar tu multa de 6 €" and no reservation is created
- AC-007-09: Reservar material. En Reservar se ve «No puedes reservar hasta pagar tu multa de {importe} €».
  El criterio pide: the user sees "No puedes reservar hasta pagar tu multa de 2 €"

## UC-008 — Ver mis reservas

Flujo principal:
1. Socio: abre "Mis reservas".
2. System: autoriza el rol (API-001-08, RN-020).
3. System: lee las reservas con `accountId` = sesión (INV-RES-010).
4. System: muestra cada una con cantidad, material, fechas y estado (ADR-002 para «No recogida»).
5. System: ofrece "Cancelar" solo si hoy < inicio (INV-RES-006, RN-011); si no, muestra el motivo en la fila.

Extensiones:
- 4a. La reserva empieza hoy → fila con `E_EMPIEZA_HOY` y sin botón "Cancelar". (AC-008-02)
- 4b. Sin reservas → texto "Aún no tienes reservas". (AC-008-03, AC-008-04)

Criterios:
- AC-008-01: Mis reservas y cancelar. En Mis reservas se ve «{cantidad} × {material} del {inicio} al {fin} — {estado}».
  El criterio pide: the user sees "2 × Casco del 2026-12-05 al 2026-12-07 — Reservada" and no reservation of other members
- AC-008-02: Mis reservas y cancelar. En Mis reservas, en la fila de esa reserva y sin botón "Cancelar" se ve «No se puede cancelar: empieza hoy».
  El criterio pide: the user sees "No se puede cancelar: empieza hoy" and no "Cancelar" button
- AC-008-03: Mis reservas y cancelar. En Mis reservas se ve «Aún no tienes reservas».
  El criterio pide: the user sees "Aún no tienes reservas"
- AC-008-04: Mis reservas y cancelar. En Mis reservas se ve «Aún no tienes reservas».
  El criterio pide: the user sees "Aún no tienes reservas"

## UC-009 — Cancelar reserva

Flujo principal:
1. Socio: pulsa "Cancelar" en una reserva (WF-001 paso 2).
2. System: autoriza y comprueba que la reserva es suya (API-001-08, INV-RES-010).
3. System: comprueba que no estaba ya Cancelada (INV-RES-009).
4. System: comprueba hoy < inicio (INV-RES-006, RN-011).
5. System: pasa a Cancelada y libera las unidades una sola vez (SM-001, RN-012).
6. System: muestra "Mis reservas" con el aviso de éxito.

Criterios:
- AC-009-01: Mis reservas y cancelar. En Mis reservas se ve «Reserva cancelada», «2 × Casco del 2026-12-05 al 2026-12-07 — Cancelada» y «Reserva creada: {cantidad} × {material} del {inicio} al {fin}».
  El criterio pide: the user sees "Reserva cancelada", its state "Cancelada" and its units become free
- AC-009-02: Mis reservas y cancelar. En Mis reservas se ve «La reserva ya estaba cancelada» y «No hay unidades libres: solo queda 1 de Casco el 2026-12-05».
  El criterio pide: the user sees "La reserva ya estaba cancelada" and the units are not freed twice
