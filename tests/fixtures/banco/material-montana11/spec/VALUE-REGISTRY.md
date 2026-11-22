# Registro de valores

> Fuente canónica de cada valor usado en 2 o más documentos. Los demás documentos citan el **nombre**.

| Nombre | Valor | Unidad | Categoría | Fuente | Usado en |
|---|---|---|---|---|---|
| `PASSWORD_MIN_LENGTH` | 8 | caracteres | límite | REQ-F-002 | INV-ACC-002, VO-010 |
| `LOGIN_MAX_FAILURES` | 5 | fallos seguidos | seguridad | REQ-F-001 | INV-ACC-004, SM-004 |
| `LOCK_MINUTES` | 15 | min | seguridad | REQ-F-001 | INV-ACC-004, SM-004, VO-010 |
| `SESSION_IDLE_MINUTES` | 30 | min | seguridad | REQ-F-001 | INV-ACC-005 |
| `RESERVATION_MAX_DAYS` | 14 | días seguidos | límite | REQ-F-003 | INV-RES-004, VO-010 |
| `FINE_PER_DAY_EUR` | 2 | € por día | negocio | REQ-F-006 | INV-FIN-001 |
| `RETENTION_YEARS` | 2 | años desde la última actividad | retención | RN-010 | nfr/LIMITS |
| `MATERIAL_TYPES` | Piolet, Crampones, Casco, Cuerda, Tienda | enum | enum | REQ-F-008 | VO-004, INV-STK-001 |
| `RESERVATION_STATES` | Reservada, Entregado, Devuelto, Cancelada, No recogida | enum | enum | SM-001 | VO-006 |
| `FINE_STATES` | Pendiente, Pagada | enum | enum | SM-002 | VO-007 |
| `ROLES` | socio, encargado, junta | enum | enum | REQ-F-001 | VO-005, PERMISSIONS-MATRIX |
