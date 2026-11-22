# Guion de la demo — FASE-4

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## WF-001 — Ciclo de un préstamo

1. Reservar (UC-007) (UC-007)
2. Cancelar, opcional (UC-009) (UC-009)
3. Entregar (UC-010) (UC-010)
4. Devolver (UC-011) (UC-011)
5. Multa por retraso (UC-011) (UC-011)
6. Pagar la multa (UC-013) (UC-013)
7. Se levanta el bloqueo (UC-013, UC-007) (UC-013)

Navegación:
- 1: Reservar · socio · entrada «Reservar» del menú · elige material, cantidad y fechas y envía
- 2: Mis reservas · socio · entrada «Mis reservas» · pulsa «Cancelar» en la fila
- 3: Panel del encargado · encargado · página de inicio tras entrar · pulsa «Entregar» en «Por entregar»
- 4: Panel del encargado · encargado · página de inicio · marca la devolución del préstamo
- 5: Multas · encargado · entrada «Multas» · ve la multa creada
- 6: Multas · encargado · entrada «Multas» · pulsa «Marcar pagada»
- 7: Mis multas · socio · entrada «Mis multas» · comprueba que no tiene multas pendientes

## UC-012 — Ver mis multas

Flujo principal:
1. Socio: abre "Mis multas".
2. System: comprueba la sesión y el rol (API-001-08, RN-020).
3. System: lee las multas de su cuenta, solo las suyas (INV-SEC-001).
4. System: muestra una fila por multa con importe y estado, o "No tienes multas".

Extensiones:
- 3a. La cuenta no tiene multas, aunque otro socio sí → mensaje de lista vacía. (AC-012-02, AC-012-03)

Criterios:
- AC-012-01: Multas y bloqueo hasta pagarlas. En Mis multas se ve «Multa de {importe} € — {estado}».
  El criterio pide: the user sees "Multa de 6 € — Pendiente"
- AC-012-02: Multas y bloqueo hasta pagarlas. En Mis multas se ve «No tienes multas».
  El criterio pide: the user sees "No tienes multas"
- AC-012-03: Multas y bloqueo hasta pagarlas. En Mis multas se ve «No tienes multas».
  El criterio pide: the user sees "No tienes multas"

## UC-013 — Marcar multa pagada

Flujo principal:
1. Encargado: pulsa "Marcar pagada" en una multa.
2. System: comprueba rol y que la multa existe (API-001-08).
3. System: comprueba que está Pendiente (SM-002).
4. System: la marca Pagada y guarda `paidOn` (WF-001 step 6).
5. System: recalcula el bloqueo del socio (WF-001 step 7, INV-MUL-002).
6. System: muestra "Multa pagada" en Multas.

Extensiones:
- 5a. Quedan otras multas Pendientes del socio → el bloqueo sigue y cita la más antigua (RN-016). (AC-013-03)

Criterios:
- AC-013-01: Multas y bloqueo hasta pagarlas. En Multas se ve «Multa pagada» y «Reserva creada: {cantidad} × {material} del {inicio} al {fin}».
  El criterio pide: the user sees "Multa pagada" and Pablo can reserve again
- AC-013-02: Multas y bloqueo hasta pagarlas. En Multas (ejemplo con datos: "Pablo Sanz — Multa de 6 € — Pagada") se ve «La multa ya estaba pagada», «{nombre} — Multa de {importe} € — Pagada» y «Pablo Sanz — Multa de 6 € — Pagada».
  El criterio pide: the user sees "La multa ya estaba pagada" and the fine stays "Pagada", still one fine of 6 €
- AC-013-03: Multas y bloqueo hasta pagarlas. En Multas se ve «Multa pagada» y «No puedes reservar hasta pagar tu multa de {importe} €».
  El criterio pide: the user sees "Multa pagada" and Pablo still sees "No puedes reservar hasta pagar tu multa de 2 €"

## UC-014 — Ver todas las multas

Flujo principal:
1. Encargado: abre "Multas".
2. System: comprueba la sesión y el rol (API-001-08, RN-020).
3. System: lee todas las multas con el nombre de su socio.
4. System: muestra una fila por multa con nombre, importe y estado.

Criterios:
- AC-014-01: Multas y bloqueo hasta pagarlas. En Multas (ejemplo con datos: "Pablo Sanz — Multa de 6 € — Pendiente") se ve «{nombre} — Multa de {importe} € — {estado}» y «{nombre} — Multa de {importe} € — {estado}».
  El criterio pide: the user sees "Pablo Sanz — Multa de 6 € — Pendiente" and "Lucía Gil — Multa de 2 € — Pagada"
