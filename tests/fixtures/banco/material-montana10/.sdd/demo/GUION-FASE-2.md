# Guion de la demo — FASE-2

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## WF-001 — Ciclo de un préstamo

1. reservar (UC-003) (UC-003)
2. cancelar (UC-004) (UC-004)
3. entregar (UC-005) (UC-005)
4. marcar No recogida (UC-005) (UC-005)
5. devolver (UC-006) (UC-006)
6. poner multa (UC-006) (UC-006)
7. pagar multa (UC-007) (UC-007)

Navegación:
- 1: Reservar · Socio · menú Reservar · elige tipo y fechas
- 2: Mis reservas · Socio · menú Mis reservas · cancela una reserva
- 3: Entregas y devoluciones · Encargado · menú Entregas y devoluciones · marca entregada con su unidad
- 5: Entregas y devoluciones · Encargado · menú Entregas y devoluciones · marca devuelta
- 7: Multas · Encargado · menú Multas · marca pagada

## UC-006 — Devolver y multar

Flujo principal:
1. Encargado: marca la devolución de una reserva.
2. System: comprueba que existe y está Prestada (INV-LOA-003).
3. System: cuenta los días naturales de retraso desde `hasta` (RN-009).
4. System: pasa la reserva a Devuelta y fija `devueltaEl` (API-003-02).
5. System: si días > 0, crea una multa Pendiente en la misma operación indivisible (INV-LOA-004).
6. System: muestra "{unidad} · {socio} · Devuelta" y, si hay multa, su aviso; el Socio la ve después en Mis reservas.

Extensiones:
- 3a. Devuelta el día `hasta` o antes → no se crea multa (RN-009). (AC-006-01)

Criterios:
- AC-006-01: Marcar la devolución y poner la multa. En Entregas y devoluciones se ve «{unidad} · {socio} · Devuelta».
  El criterio pide: the user sees "Piolet 2 · Lucía · Devuelta" and no multa exists
- AC-006-02: Marcar la devolución y poner la multa. En Entregas y devoluciones se ve «Multa de {importe} € a {socio} ({n} días de retraso)».
  El criterio pide: the user sees "Multa de 6 € a Pablo (3 días de retraso)"
- AC-006-03: Marcar la devolución y poner la multa. En Entregas y devoluciones se ve «Multa de {importe} € a {socio} ({n} días de retraso)».
  El criterio pide: the user sees "Multa de 2 € a Lucía (1 días de retraso)" and Lucía sees "Multa pendiente: 2 €" in Mis reservas
- AC-006-04: Marcar la devolución y poner la multa. la lista de multas sigue con una sola de 6 €
  El criterio pide: there is still one multa of 6 € for Pablo
- AC-006-05: Marcar la devolución y poner la multa. En Entregas y devoluciones se ve «Esa reserva no está prestada».
  El criterio pide: the user sees "Esa reserva no está prestada"

## UC-007 — Pagar multa

Flujo principal:
1. Encargado: abre la pantalla Multas (API-003-04).
2. System: lista todas las multas.
3. Encargado: marca una multa como pagada.
4. System: comprueba que la multa existe.
5. System: pasa a Pagada y fija `pagadaEl` (API-003-03, SM-002).
6. System: muestra "Multa de {importe} € · {socio} · Pagada"; el bloqueo del Socio depende solo de sus otras multas Pendientes (INV-RES-005).

Extensiones:
- 6a. El Socio tiene otra multa Pendiente → sigue sin poder reservar y ve "Multa pendiente: {importe} €" en Mis reservas. (AC-007-02)

Criterios:
- AC-007-01: Marcar la multa como pagada. En Multas se ve «Multa de {importe} € · {socio} · Pagada».
  El criterio pide: the user sees "Multa de 6 € · Pablo · Pagada" in Multas and Pablo can reserve
- AC-007-02: Marcar la multa como pagada. En Mis reservas se ve «Multa pendiente: {importe} €».
  El criterio pide: Lucía still sees "Multa pendiente: 4 €" and cannot reserve
- AC-007-03: Marcar la multa como pagada. la lista de multas no cambia
  El criterio pide: it stays "Pagada" once, with the same paid date
- AC-007-04: Marcar la multa como pagada. En Multas se ve «No tienes permiso para ver esta pantalla».
  El criterio pide: the user sees "No tienes permiso para ver esta pantalla"

## UC-010 — Consultar historial

Flujo principal:
1. Junta: abre Historial y elige un socio.
2. System: comprueba sesión y rol (INV-ACC-008).
3. System: comprueba que el socio existe.
4. System: devuelve sus reservas con estado y sus multas (RN-012).
5. System: muestra el resultado sin acciones (INV-LOA-402).

Extensiones:
- 1a. Rol encargado → mismo resultado. (AC-010-05)
- 4a. Socio sin préstamos ni multas → mensaje de vacío. (AC-010-02)

Criterios:
- AC-010-01: Consultar el historial de un socio (junta). En Historial se ve «{unidad} · {desde} a {hasta} · {estado}» y «Multa de {importe} € · {estado}».
  El criterio pide: the user sees "Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta" and "Multa de 2 € · Pagada"
- AC-010-02: Consultar el historial de un socio (junta). En Historial se ve «Sin préstamos ni multas».
  El criterio pide: the user sees "Sin préstamos ni multas"
- AC-010-03: Consultar el historial de un socio (junta). ausencia de botones; lo comprueba el test sobre la pantalla
  El criterio pide: there is no button to edit, cancel or mark anything
- AC-010-04: Consultar el historial de un socio (junta). En Historial se ve «No tienes permiso para ver esta pantalla».
  El criterio pide: the user sees "No tienes permiso para ver esta pantalla"
