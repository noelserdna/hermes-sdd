# Property Tests

> Refs: 05-INVARIANTS.md; values by name from VALUE-REGISTRY.md.

| ID | INV | Generator / property |
|---|---|---|
| PROP-001 | INV-SOC-001 | correos con distinta capitalización: el segundo alta se rechaza siempre |
| PROP-002 | INV-SOC-002 | contraseñas de longitud aleatoria: aceptada si y solo si ≥ `PASSWORD_MIN_LENGTH` |
| PROP-003 | INV-SOC-003 | contraseñas aleatorias: el registro guardado no las contiene en claro |
| PROP-004 | INV-SOC-004 | secuencias de aciertos y fallos: bloqueo solo tras `LOGIN_MAX_FAILURES` fallos seguidos |
| PROP-005 | INV-SOC-005 | intervalos de inactividad aleatorios: sesión viva si y solo si ≤ `SESSION_IDLE_MINUTES` |
| PROP-006 | INV-SOC-007 | socios con préstamos y multas aleatorios: baja aceptada solo con cero de ambos |
| PROP-007 | INV-RES-001 | pares de días aleatorios: aceptados si y solo si hoy ≤ inicio ≤ fin |
| PROP-008 | INV-RES-002 | duraciones aleatorias: aceptada si y solo si ≤ `MAX_RESERVATION_DAYS` |
| PROP-009 | INV-RES-003 | cantidades enteras aleatorias: aceptada si y solo si entre 1 y `MAX_UNITS_PER_RESERVATION` |
| PROP-010 | INV-RES-004 | secuencias aleatorias de reservar, cancelar y devolver: libres por día nunca negativas |
| PROP-011 | INV-RES-005 | estados aleatorios de reservas: ocupan unidades solo Reservada y Prestada |
| PROP-012 | INV-RES-006 | hoy e inicio aleatorios: cancelar aceptado si y solo si hoy < inicio |
| PROP-013 | INV-RES-007 | hoy, inicio y fin aleatorios: entregar aceptado si y solo si inicio ≤ hoy ≤ fin |
| PROP-014 | INV-RES-009 | cancelar, entregar y devolver repetidos n veces: estado igual que tras la primera |
| PROP-015 | INV-RES-010 | pares de socios aleatorios: nadie ve ni cancela reservas ajenas |
| PROP-016 | INV-RES-011 | fechas de fin aleatorias: tras depurar no queda ningún registro cerrado anterior a hoy − `RETENTION_YEARS` |
| PROP-017 | INV-MUL-001 | retrasos aleatorios: multa única de `FINE_PER_DAY_EUR` × días si > 0; ninguna si 0 |
| PROP-018 | INV-MUL-002 | multas aleatorias: reservar rechazado si y solo si hay alguna Pendiente |
| PROP-019 | INV-MUL-003 | pagar repetido: mismo estado; bloqueo levantado al quedar cero Pendiente |
| PROP-020 | INV-MUL-004 | fin, devolución y hoy aleatorios: retraso natural igual a la diferencia de días |
| PROP-021 | INV-MAT-001 | altas y bajas aleatorias de unidades: total nunca negativo |
| PROP-022 | INV-MAT-002 | bajas aleatorias con reservas: aceptada si y solo si total − n ≥ ocupadas cada día |
| PROP-023 | INV-MAT-004 | nombres con capitalización aleatoria: segundo tipo igual se rechaza |
| PROP-024 | INV-SEC-001..003 | rol, operación y dueño aleatorios: permitido solo según PERMISSIONS-MATRIX, sin cambios si se rechaza |
