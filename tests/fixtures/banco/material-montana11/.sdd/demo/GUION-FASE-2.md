# Guion de la demo — FASE-2

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## UC-008 — Entregar material

Flujo principal:
1. Encargado: abre Préstamos.
2. System: aplica No recogida a las Reservada con `inicio` < hoy (RN-004, API-003-03) y lista reservas y préstamos (API-003-04).
3. Encargado: marca "Entregar" sobre una reserva Reservada.
4. System: comprueba que existe, que está Reservada y que hoy = `inicio` (RN-003, INV-LOA-001).
5. System: pasa la reserva a Entregado y anota `entregadaEl` en una escritura atómica (INV-SEC-003, ADR-005).
6. System: Préstamos muestra el nuevo estado.

Extensiones:
- 2a. Hay reservas con `inicio` < hoy sin entregar → se muestran como No recogida y la unidad queda libre para reservar. (AC-008-02)

Criterios:
- AC-008-01: Entregar y marcar la devolución. En Préstamos se ve «Entregado».
  El criterio pide: the user sees the reservation "Piolet" with state "Entregado"
- AC-008-03: Entregar y marcar la devolución. En Préstamos se ve «No se puede entregar antes de la fecha de inicio».
  El criterio pide: the user sees "No se puede entregar antes de la fecha de inicio"
- AC-008-02: Entregar y marcar la devolución. En Préstamos se ve «No recogida».
  El criterio pide: the user sees its state "No recogida" and the unit is free for new reservations
- AC-008-04: Entregar y marcar la devolución. En Préstamos se ve «Acceso no permitido».
  El criterio pide: the user sees "Acceso no permitido"

## UC-009 — Registrar devolución

Flujo principal:
1. Encargado: marca "Devolver" sobre un préstamo en Préstamos.
2. System: comprueba rol, existencia y estado Entregado (INV-LOA-003).
3. System: anota `devueltaEl` = hoy y pasa a Devuelto.
4. System: si `devueltaEl` > `fin`, invoca UC-010 en la misma escritura atómica (INV-FIN-001, ADR-005).
5. System: Préstamos muestra "Devuelto".

Extensiones:
- 4a. Hay retraso → se crea la multa Pendiente (UC-010, AC-010-01). (AC-010-01, AC-009-02)

Criterios:
- AC-009-01: Entregar y marcar la devolución. En Préstamos se ve «Devuelto».
  El criterio pide: the user sees state "Devuelto" and the unit is free again
- AC-009-03: Entregar y marcar la devolución. En Préstamos se ve «Devuelto».
  El criterio pide: the state stays "Devuelto" with the first return date and no second fine is created

## UC-010 — Aplicar multa por retraso

Flujo principal:
1. System: calcula días = `devueltaEl` − `fin`, naturales (RN-009, INV-FIN-001).
2. System: si días > 0, crea la multa Pendiente con importe `FINE_PER_DAY_EUR` × días (INV-FIN-001).
3. System: comprueba que la reserva no tiene ya multa (INV-FIN-002).
4. System: el socio queda bloqueado para reservar mientras exista una multa Pendiente (INV-RES-005, INV-FIN-004); el rechazo se especifica en UC-005.

Extensiones:
- 1a. `devueltaEl` ≤ `fin` → no se crea multa. (AC-010-02)
- 1b. Un solo día de retraso → importe de 1 × `FINE_PER_DAY_EUR`. (AC-010-03)
- 4a. El socio intenta reservar → `E_MULTA_PENDIENTE` y sus reservas existentes se conservan. (AC-010-04)

Criterios:
