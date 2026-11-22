# Guion de la demo — FASE-3

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## WF-001 — Ciclo del préstamo

1. Entrar (UC-001) (UC-001)
2. Reservar (UC-005) (UC-005)
3. Ver o cancelar (UC-006, UC-007) (UC-006)
4. Entregar o No recogida (UC-008) (UC-008)
5. Devolver (UC-009) (UC-009)
6. Multa por retraso (UC-010) (UC-010)
7. Pagar multa (UC-012) (UC-012)
8. Volver a reservar (UC-005) (UC-005)

Navegación:
- 1: Entrar · cualquiera · dirección de la web · escribe correo y contraseña
- 2: Reservar · socio · menú del Inicio del socio · elige material y fechas
- 3: Mis reservas · socio · menú del Inicio del socio · consulta y cancela
- 4: Préstamos · encargado · menú del Panel del encargado · marca Entregar
- 5: Préstamos · encargado · menú del Panel del encargado · marca Devolver
- 6: Multas · encargado · menú del Panel del encargado · ve la multa creada
- 7: Multas · encargado · menú del Panel del encargado · marca Pagada
- 8: Mis multas · socio · menú del Inicio del socio · consulta sus multas

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
- AC-010-01: Multa por devolución tardía y bloqueo. En Multas se ve «{importe} €».
  El criterio pide: the user sees the fine "6,00 €" for "Pablo Ruiz" with state "Pendiente"
- AC-010-02: Multa por devolución tardía y bloqueo. En Multas se ve «Sin multas».
  El criterio pide: no fine is created
- AC-010-03: Multa por devolución tardía y bloqueo. En Multas se ve «{importe} €».
  El criterio pide: the fine is "2,00 €"
- AC-010-04: Multa por devolución tardía y bloqueo. En Reservar se ve «Tienes una multa pendiente: no puedes reservar hasta pagarla».
  El criterio pide: the reservation is rejected (see REQ-F-003) and his other existing reservations stay

## UC-011 — Ver mis multas

Flujo principal:
1. Socio: abre Mis multas.
2. System: obtiene las multas cuyo dueño es el socio de la sesión (INV-SEC-001).
3. System: muestra cada importe con su estado.

Extensiones:
- 2a. Otros socios tienen multas → no aparecen. (AC-011-02)

Criterios:
- AC-011-01: Multa por devolución tardía y bloqueo. En Mis multas se ve «{importe} €».
  El criterio pide: the user sees "6,00 €" and "Pendiente"

## UC-012 — Marcar multa pagada

Flujo principal:
1. Encargado: abre Multas.
2. System: lista todas las multas con socio, importe y estado (API-003-07).
3. Encargado: marca "Pagada" sobre una multa Pendiente.
4. System: comprueba rol y existencia (INV-ACC-007).
5. System: pasa la multa a Pagada y anota `pagadaEl` en una escritura atómica (INV-SEC-003, ADR-005).
6. System: Multas muestra "Pagada"; el socio sin otra multa Pendiente ya puede reservar (UC-005).

Extensiones:
- 5a. El socio tiene otra multa Pendiente → sigue bloqueado para reservar (INV-RES-005). (AC-012-02)

Criterios:
- AC-012-02: Multa por devolución tardía y bloqueo. En Reservar se ve «Tienes una multa pendiente: no puedes reservar hasta pagarla».
  El criterio pide: he is still blocked
- AC-012-01: Marcar la multa como pagada. En Multas se ve «Pagada».
  El criterio pide: the user sees the fine with state "Pagada" and "pablo" can reserve "Casco"
- AC-012-03: Marcar la multa como pagada. En Multas se ve «Pagada».
  El criterio pide: it stays "Pagada" with the first payment date
- AC-012-04: Marcar la multa como pagada. En Multas se ve «Acceso no permitido».
  El criterio pide: the user sees "Acceso no permitido"
