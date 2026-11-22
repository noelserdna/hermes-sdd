# NFR — Security

> Refs: REQ-NF-001, REQ-NF-003; PERMISSIONS-MATRIX; RN-020; values by name from VALUE-REGISTRY.md.

| ID | Metric / Control | Target | Fail point | Measurement / Enforcement | Refs |
|---|---|---|---|---|---|
| SPEC-SEC-001 | Aislamiento del socio: solo ve y cambia lo suyo | 0 datos de otro socio en cualquier respuesta | 1 dato ajeno | API → `E_ACCESO_DENEGADO`; test con dos socios | INV-SEC-001, INV-RES-010 |
| SPEC-SEC-002 | Junta solo consulta | 0 operaciones de gestión aceptadas | 1 cambio hecho por la junta | API → `E_ACCESO_DENEGADO`; test de entregar y marcar pagada | INV-SEC-002, UC-018 |
| SPEC-SEC-003 | Gestión solo del encargado, también al abrir páginas | 100 % de operaciones de gestión rechazadas a otros roles | 1 operación aceptada | API-001-08 → `E_PAGINA_PROHIBIDA` / `E_ACCESO_DENEGADO` | INV-SEC-003, RN-020 |
| SPEC-SEC-004 | Contraseñas cifradas con sal | 0 contraseñas en claro en datos guardados | 1 contraseña legible | Test: leer el registro guardado | INV-SOC-003, REQ-NF-001 |
| SPEC-SEC-005 | Bloqueo de cuenta por fallos seguidos | `LOGIN_MAX_FAILURES`, `LOGIN_LOCK_MINUTES` | acierto aceptado durante el bloqueo | API-001-01 → `E_CUENTA_BLOQUEADA` | INV-SOC-004, RN-001 |
| SPEC-SEC-006 | Caducidad de sesión y cierre en servidor | `SESSION_IDLE_MINUTES`; salir invalida la sesión | sesión usable tras caducar o salir | API-001-02, 08 | INV-SOC-005, RN-002, RN-003 |
| SPEC-SEC-007 | Minimización de datos personales | solo nombre, correo, contraseña cifrada, rol, indicadores de acceso e historial | 1 campo personal extra | Test: leer el registro de un socio | INV-SOC-009, REQ-NF-003 |
