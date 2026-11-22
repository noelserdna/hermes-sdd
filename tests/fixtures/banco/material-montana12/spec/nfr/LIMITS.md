# NFR — Limits

> Refs: REQ-NF-003; RN-001, RN-002, RN-004, RN-010, RN-014, RN-021; values by name from VALUE-REGISTRY.md.

| ID | Metric / Control | Target | Fail point | Measurement / Enforcement | Refs |
|---|---|---|---|---|---|
| SPEC-LIM-001 | `LOGIN_MAX_FAILURES` | fallos seguidos antes del bloqueo de cuenta | el siguiente intento entra o no bloquea | API-001-01 → `E_CUENTA_BLOQUEADA` | INV-SOC-004, UC-001 |
| SPEC-LIM-002 | `LOGIN_LOCK_MINUTES` | duración del bloqueo de cuenta | entra antes de acabar el bloqueo | API-001-01 → `E_CUENTA_BLOQUEADA` | INV-SOC-004, UC-001 |
| SPEC-LIM-003 | `SESSION_IDLE_MINUTES` | inactividad máxima de la sesión | sesión viva pasado el límite | API-001-08 renueva y comprueba la actividad | INV-SOC-005, UC-001, UC-002 |
| SPEC-LIM-004 | `PASSWORD_MIN_LENGTH` | longitud mínima de contraseña | contraseña más corta aceptada | API-001-03, 04, 05 → `E_CONTRASENA_CORTA` | INV-SOC-002, UC-003..005 |
| SPEC-LIM-005 | `MAX_RESERVATION_DAYS` | duración máxima de una reserva | reserva más larga aceptada | API-002-01 → `E_MAX_DIAS` | INV-RES-002, UC-007 |
| SPEC-LIM-006 | `MAX_UNITS_PER_RESERVATION` | unidades máximas por tipo y reserva | más unidades aceptadas | API-002-01 → `E_MAX_UNIDADES` | INV-RES-003, UC-007 |
| SPEC-LIM-007 | `FINE_PER_DAY_EUR` | importe de la multa por día de retraso | importe distinto de días × tarifa | API-002-05 al devolver | INV-MUL-001, UC-011 |
| SPEC-LIM-008 | `RETENTION_YEARS` | antigüedad máxima del historial de préstamos, reservas y multas | 0 registros cerrados más antiguos tras la depuración (RN-033: las deudas no se borran) | API-002-07 al arrancar y cada día; test con fechas de REQ-NF-003 | REQ-NF-003, INV-RES-011, UC-019, RN-021 |
