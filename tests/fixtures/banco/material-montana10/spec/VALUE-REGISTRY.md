# Registro de valores

> Fuente única de cada valor usado en 2 o más documentos. El resto cita el **nombre**.

| Nombre | Valor | Unidad | Clase | Fuente | Usado en |
|---|---|---|---|---|---|
| `LOGIN_MAX_FAILURES` | 5 | fallos seguidos | límite | REQ-F-001 | INV-ACC-004, UC-001 |
| `LOGIN_LOCK_MINUTES` | 15 | min | límite | REQ-F-001 | INV-ACC-004, UC-001 |
| `SESSION_IDLE_HOURS` | 8 | h sin uso | límite | REQ-F-001 | INV-ACC-005, UC-001 |
| `PASSWORD_MIN_LENGTH` | 8 | caracteres | límite | REQ-F-002 | INV-ACC-002, UC-002 |
| `RESERVA_MAX_DAYS` | 14 | días | límite | REQ-F-003 | INV-RES-001, UC-003 |
| `CANCEL_MIN_DAYS_BEFORE` | 1 | días antes de `desde` | límite | REQ-F-004 | INV-RES-006, UC-004 |
| `FINE_PER_DAY_EUR` | 2 | € por día | límite | REQ-F-006 | INV-LOA-004, UC-006 |
| `RETENTION_YEARS` | 2 | años | límite | REQ-NF-001 | INV-LOA-006, RN-013 |
| `TIPOS_MATERIAL` | Piolet, Crampones, Casco, Cuerda, Tienda | enum | enum | VO-004 | INV-STK-004, UC-003, UC-008 |
| `ESTADOS_RESERVA` | Reservada, Prestada, Devuelta, Cancelada, No recogida | enum | enum | VO-005 | SM-001, UC-004..UC-006 |
| `ZONA_HORARIA` | Europe/Madrid | zona | configuración | RN-001 | ADR-001, UC-003 |
