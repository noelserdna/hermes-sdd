# Permissions Matrix

> Refs: REQ-NF-001; INV-SEC-001..003; RN-020. Sin sesión: solo API-001-01 (Entrar). Con contraseña provisional: solo API-001-02 y API-001-03 (INV-SOC-006).

| Role | Operations | Row-level rule |
|---|---|---|
| socio | API-001-02, -03; API-002-01..03; API-003-03 (tipos reservables); API-004-01 | solo sus propias reservas y multas (INV-SEC-001) |
| encargado | API-001-02, -03, -04, -05, -06; API-002-04..06; API-003-01..03; API-004-02, -03 | gestiona todo salvo reservar; no usa API-002-01 (RN-010) |
| junta | API-001-02, -03, -07 | solo lectura (INV-SEC-002) |
| sistema | API-002-07 | depuración (UC-019) |
