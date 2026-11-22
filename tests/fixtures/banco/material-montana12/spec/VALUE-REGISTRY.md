# Value Registry

> Canonical source for every value used in 2+ documents. Other documents cite the **name**.

| Name | Value | Unit | Category | Source | Used in (ids) |
|---|---|---|---|---|---|
| `LOGIN_MAX_FAILURES` | 5 | fallos seguidos | limit | RN-001 | INV-SOC-004, UC-001 |
| `LOGIN_LOCK_MINUTES` | 15 | min | limit | RN-001 | INV-SOC-004, VO-010 |
| `SESSION_IDLE_MINUTES` | 30 | min | limit | RN-002 | INV-SOC-005, UC-001 |
| `PASSWORD_MIN_LENGTH` | 8 | caracteres | limit | RN-004 | INV-SOC-002, VO-003 |
| `MAX_RESERVATION_DAYS` | 14 | días | limit | RN-010 | INV-RES-002, UC-007 |
| `MAX_UNITS_PER_RESERVATION` | 5 | unidades por tipo | limit | RN-010 | INV-RES-003, UC-007 |
| `FINE_PER_DAY_EUR` | 2 | € por día de retraso | limit | RN-014 | INV-MUL-001, UC-011 |
| `RETENTION_YEARS` | 3 | años | limit | RN-021 | INV-RES-011, UC-019 |
| `SYNC_VISIBILITY_SECONDS` | 5 | s tras recargar | performance | REQ-NF-002 | SPEC-PERF-001 |
| `ROLES` | socio, encargado, junta | enum | enum | VO-004 | INV-SEC-001..003 |
| `RESERVATION_STATUS` | Reservada, Prestada, Devuelta, Cancelada | enum | enum | VO-007 | SM-001, UC-008 |
| `FINE_STATUS` | Pendiente, Pagada | enum | enum | VO-008 | SM-002, UC-012 |
| `NOT_COLLECTED_VISIBLE_DAYS` | 7 | días tras el fin | limit | RN-029 | UC-010, UC-017 |
