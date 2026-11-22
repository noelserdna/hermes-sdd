# Matriz de permisos

| Rol | Operaciones | Regla por fila |
|---|---|---|
| anónimo | API-001-01 | solo entrar (INV-ACC-007) |
| socio | API-001-02, API-001-03, API-002-01..04, API-003-06 | solo lo propio (INV-SEC-001) |
| encargado | API-001-02..07, API-003-01..05, API-003-07..09, API-004-01..03 | todos los socios |
| junta | API-001-02, API-001-03, API-003-10 | solo lectura (INV-SEC-002) |
