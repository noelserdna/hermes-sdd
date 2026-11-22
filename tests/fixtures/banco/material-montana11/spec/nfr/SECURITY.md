# NFR — Seguridad

| ID | Objetivo | Medida | Refs |
|---|---|---|---|
| SPEC-SEC-001 | 0 respuestas con datos de otro socio para una sesión de socio | cada lectura filtra por dueño; con rol socio, datos ajenos → `E_ACCESO_NO_PERMITIDO` | REQ-NF-001, INV-SEC-001 |
| SPEC-SEC-002 | Sin sesión ninguna operación devuelve datos | toda operación salvo API-001-01 → `E_NO_AUTENTICADO` | REQ-NF-001, INV-ACC-007 |
| SPEC-SEC-003 | 0 contraseñas legibles en el almacén | solo hash con sal | INV-ACC-003, ADR-003 |
| SPEC-SEC-004 | Bloqueo y caducidad | `LOGIN_MAX_FAILURES`, `LOCK_MINUTES`, `SESSION_IDLE_MINUTES` | INV-ACC-004, INV-ACC-005 |
| SPEC-SEC-005 | La junta no cambia nada | ninguna escritura admite el rol junta | INV-SEC-002 |
| SPEC-SEC-006 | Los registros y mensajes de error no contienen contraseñas ni su hash | revisión de mensajes VO-010 | INV-ACC-003 |
