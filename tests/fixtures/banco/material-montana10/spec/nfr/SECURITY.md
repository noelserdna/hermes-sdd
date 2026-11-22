# NFR — Seguridad

> Refs: REQ-NF-001, REQ-F-001, REQ-F-002, REQ-C-003; valores por nombre de VALUE-REGISTRY.md.

| ID | Control | Objetivo | Punto de fallo | Comprobación | Refs |
|---|---|---|---|---|---|
| SEC-001 | Almacén de contraseñas | solo hash con sal; 0 contraseñas en claro en los datos guardados | cualquier contraseña legible | test: crear "Marta" y buscar "Glaciar2026" en los datos guardados | REQ-NF-001, INV-ACC-003 |
| SEC-002 | Contraseña visible | nunca se muestra ni se devuelve en ninguna salida | cualquier salida con contraseña | test sobre las salidas de API-001-* | INV-ACC-003 |
| SEC-003 | Bloqueo por fallos | `LOGIN_MAX_FAILURES` fallos → bloqueo `LOGIN_LOCK_MINUTES` | acierto durante el bloqueo | UC-001 AC de bloqueo | INV-ACC-004, RN-005 |
| SEC-004 | Caducidad de sesión | `SESSION_IDLE_HOURS` sin actividad | sesión válida tras ese tiempo | UC-001 AC de caducidad | INV-ACC-005, RN-006 |
| SEC-005 | Autorización por rol | cada operación según `contracts/PERMISSIONS-MATRIX.md` | acceso de un rol no permitido | un test por pantalla restringida | INV-ACC-008, INV-ACC-009 |
| SEC-006 | Datos mínimos | solo nombre, correo, préstamos y multas | cualquier otro dato personal | revisión de entidades ENT-001..005 | REQ-NF-001 |
| SEC-007 | Mensaje de acceso | mismo error para correo desconocido y contraseña mala | revelar si el correo existe | UC-001 AC de credenciales | RN-005 |
