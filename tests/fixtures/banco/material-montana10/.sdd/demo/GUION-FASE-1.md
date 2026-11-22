# Guion de la demo — FASE-1

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## UC-004 — Ver y cancelar mis reservas

Flujo principal:
1. Socio: abre Mis reservas.
2. System: lista sus reservas con estado, evaluando No recogida al consultar (RN-008), sus multas Pendientes y, sin reservas, "No tienes reservas" (INV-ACC-009).
3. Socio: cancela una reserva.
4. System: comprueba que la reserva existe y es suya (RN-019, INV-ACC-009).
5. System: si ya está Cancelada, no cambia nada (INV-RES-008).
6. System: comprueba que está Reservada y que hoy es anterior a `desde` (INV-RES-006, `CANCEL_MIN_DAYS_BEFORE`).
7. System: la pasa a Cancelada, libera sus unidades y muestra la lista (WF-001 step 2).

Extensiones:
- 2a. El socio no tiene reservas → se muestra "No tienes reservas". (AC-004-02)
- 2b. El socio debe una multa → se muestra "Multa pendiente: {importe} €". (AC-004-06)

Criterios:
- AC-004-01: Ver y cancelar mis reservas. En Mis reservas se ve «{material} · {desde} a {hasta} · {estado}».
  El criterio pide: the user sees "Piolet · 2026-12-05 a 2026-12-07 · Reservada"
- AC-004-02: Ver y cancelar mis reservas. En Mis reservas se ve «No tienes reservas».
  El criterio pide: the user sees "No tienes reservas" and none of Lucía's
- AC-004-03: Ver y cancelar mis reservas. En Mis reservas se ve «{material} · {desde} a {hasta} · Cancelada».
  El criterio pide: the user sees "Piolet · 2026-12-05 a 2026-12-07 · Cancelada" and the unit is free again
- AC-004-04: Ver y cancelar mis reservas. la lista sigue mostrando una sola fila cancelada
  El criterio pide: it stays "Cancelada" once, with no other change
- AC-004-05: Ver y cancelar mis reservas. En Mis reservas se ve «Solo se puede cancelar hasta el día antes».
  El criterio pide: the user sees "Solo se puede cancelar hasta el día antes" and the reserva stays "Reservada"
- AC-004-06: Ver y cancelar mis reservas. En Mis reservas se ve «Multa pendiente: {importe} €».
  El criterio pide: the user sees "Multa pendiente: 4 €"
- AC-004-07: Ver y cancelar mis reservas. En Mis reservas se ve «No tienes permiso para cancelar esta reserva».
  El criterio pide: the user sees "No tienes permiso para cancelar esta reserva" and it stays "Reservada"

## UC-005 — Entregar reserva

Flujo principal:
1. Encargado: elige la reserva e indica la unidad (RN-020).
2. System: aplica RN-008 a las reservas vencidas (API-003-07, INV-RES-007).
3. System: comprueba reserva, fecha y unidad (INV-LOA-301, INV-LOA-001, INV-STK-001).
4. System: asigna la unidad y pasa la reserva a Prestada en una sola operación indivisible (API-003-01, INV-LOA-002).
5. System: muestra la fila prestada.

Extensiones:
- 2a. Reservada con hoy > `hasta` → pasa a No recogida, sin multa y con unidades libres; se muestra "No recogida". (AC-005-04)

Criterios:
- AC-005-01: Entregar lo reservado. En Entregas y devoluciones se ve «{unidad} · {socio} · Prestada».
  El criterio pide: the user sees "Piolet 2 · Lucía · Prestada" in Entregas y devoluciones
- AC-005-02: Entregar lo reservado. la lista sigue con una sola fila prestada
  El criterio pide: there is still one "Piolet 2 · Lucía · Prestada" and no second unit is assigned
- AC-005-03: Entregar lo reservado. En Entregas y devoluciones se ve «Aún no es la fecha de entrega».
  El criterio pide: the user sees "Aún no es la fecha de entrega" and it stays "Reservada"
- AC-005-04: Entregar lo reservado. En Entregas y devoluciones se ve «{material} · {socio} · No recogida».
  El criterio pide: the user sees "No recogida" for it in Entregas y devoluciones and its units are free

## UC-009 — Ver entregas y devoluciones

Flujo principal:
1. Encargado: abre Entregas y devoluciones.
2. System: comprueba sesión y rol (INV-ACC-008).
3. System: aplica RN-008 a las reservas vencidas (INV-RES-007).
4. System: lista Prestada con `hasta` ≥ hoy como prestado; con `hasta` = hoy también como vuelve hoy.
5. System: lista Prestada con `hasta` < hoy como con retraso, con días de RN-009.
6. System: lista Reservada con `desde` ≤ hoy ≤ `hasta` como entregar hoy (RN-022).
7. System: muestra botones de entregar y devolver solo al encargado (INV-LOA-401).

Extensiones:
- 1a. Rol junta → mismas listas sin botones. (AC-009-05)
- 4a. Nada prestado → mensaje de vacío. (AC-009-04)
- 3a. Reserva Reservada con `hasta` < hoy → no se lista; cuenta como No recogida. (AC-009-07)

Criterios:
- AC-009-01: Ver lo prestado y lo que vuelve cada día. En Entregas y devoluciones se ve «Vuelve hoy: {unidad} · {socio}» y «Prestado: {unidad} · {socio} · hasta {hasta}».
  El criterio pide: the user sees "Vuelve hoy: Piolet 2 · Lucía" and "Prestado: Casco 1 · Pablo · hasta 2026-12-09"
- AC-009-02: Ver lo prestado y lo que vuelve cada día. En Entregas y devoluciones se ve «Con retraso: {unidad} · {socio} · {n} días».
  El criterio pide: the user sees "Con retraso: Cuerda 1 · Marta · 2 días"
- AC-009-03: Ver lo prestado y lo que vuelve cada día. En Entregas y devoluciones se ve «Entregar hoy: {material} · {socio}».
  El criterio pide: the user sees "Entregar hoy: Piolet · Lucía"
- AC-009-04: Ver lo prestado y lo que vuelve cada día. En Entregas y devoluciones se ve «No hay material prestado».
  El criterio pide: the user sees "No hay material prestado"
- AC-009-05: Ver lo prestado y lo que vuelve cada día. En Entregas y devoluciones se ve «Prestado: {unidad} · {socio} · hasta {hasta}».
  El criterio pide: the user sees the list without delivery or return buttons
