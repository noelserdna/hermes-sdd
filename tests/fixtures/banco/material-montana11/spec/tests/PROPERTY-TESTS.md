# Pruebas de propiedades

> Una fila por invariante de `domain/05-INVARIANTS.md` donde una propiedad general aporta más que un ejemplo.

| ID | Invariante | Propiedad |
|---|---|---|
| PROP-001 | INV-RES-001 | para cualquier secuencia de reservas y cancelaciones, ninguna unidad tiene dos reservas Reservada o Entregado con días en común |
| PROP-002 | INV-RES-004 | toda reserva aceptada cumple `fin − inicio + 1 ≤ RESERVATION_MAX_DAYS` |
| PROP-003 | INV-RES-002, INV-RES-003 | toda reserva aceptada cumple `hoy ≤ inicio ≤ fin` |
| PROP-004 | INV-FIN-001 | importe de la multa = `FINE_PER_DAY_EUR` × días de retraso, y 0 multas si `devueltaEl ≤ fin` |
| PROP-005 | INV-FIN-002, INV-LOA-003 | repetir una devolución n veces deja una sola multa y la primera fecha |
| PROP-006 | INV-RES-005 | con alguna multa Pendiente toda reserva nueva se rechaza; con todas Pagadas se admite |
| PROP-007 | INV-ACC-004 | n fallos seguidos < `LOGIN_MAX_FAILURES` no bloquean; el siguiente sí durante `LOCK_MINUTES` |
| PROP-008 | INV-STK-003, INV-STK-004 | dar de baja una unidad n veces equivale a una vez; nunca con reserva Entregado |
| PROP-009 | INV-SEC-001 | para cualquier par de socios, ninguna lectura de uno devuelve datos del otro |
| PROP-010 | INV-ACC-001 | no existen dos cuentas con el mismo correo ignorando mayúsculas |
