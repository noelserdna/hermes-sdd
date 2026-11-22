# NFR — Límites y retención

> Refs: REQ-NF-001, REQ-F-001..008; los números viven en VALUE-REGISTRY.md.

| ID | Límite | Objetivo | Punto de fallo | Comprobación | Refs |
|---|---|---|---|---|---|
| LIM-001 | Duración de una reserva | `RESERVA_MAX_DAYS` | más días | `E_RESERVA_MUY_LARGA` | INV-RES-001 |
| LIM-002 | Longitud mínima de contraseña | `PASSWORD_MIN_LENGTH` | menos caracteres | `E_CONTRASENA_CORTA` | INV-ACC-002 |
| LIM-003 | Antelación mínima para cancelar | `CANCEL_MIN_DAYS_BEFORE` | cancelar el mismo día de `desde` | `E_CANCELACION_TARDIA` | INV-RES-006 |
| LIM-004 | Retención de préstamos y multas | `RETENTION_YEARS` desde el cierre | registro cerrado más antiguo | limpieza diaria (API-003-08); test con devolución 2024-11-01 borrada y 2025-01-10 conservada | REQ-NF-001, INV-LOA-006, RN-013 |
| LIM-005 | Multa pendiente nunca se borra | 0 borrados de multas Pendientes | multa Pendiente borrada | test de limpieza | INV-LOA-006 |
