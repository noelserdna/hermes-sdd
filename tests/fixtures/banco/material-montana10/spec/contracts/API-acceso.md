# API-acceso

| Field | Value |
|---|---|
| Module | API-001 |
| Style | operations |
| Auth | sesión vigente (INV-ACC-008); roles en `PERMISSIONS-MATRIX.md` |
| Refs | REQ-F-001, REQ-F-002, REQ-NF-001; UC-001, UC-002; WF-002; ADR-002 |
| Errors | catálogo en `domain/03-VALUE-OBJECTS.md` (VO-010) |
| Transport | ver `design/OPERATION-MAPPING.md` |

## Operations

| ID | Operation | Actor | Input (VO) | Effect / post (INV) | Domain errors | UC |
|---|---|---|---|---|---|---|
| API-001-01 | iniciarSesion | cualquier cuenta | correo: Correo (VO-002), contrasena | una sola sesión y fallos a 0; o suma un fallo y el quinto bloquea (INV-ACC-004, INV-ACC-101, RN-005) | `E_CREDENCIALES_INVALIDAS`, `E_CUENTA_BLOQUEADA` | UC-001 |
| API-001-02 | cerrarSesion | cualquier cuenta | — | sesión cerrada al momento (INV-ACC-102) | `E_NO_AUTENTICADO` | UC-001 |
| API-001-03 | crearSocio | encargado | nombre, correo: Correo (VO-002), contrasena | cuenta Activa rol socio, solo hash (INV-ACC-001..003) | `E_SIN_PERMISO`, `E_CORREO_DUPLICADO`, `E_CONTRASENA_CORTA`, `E_DATOS_SOCIO_INVALIDOS` | UC-002 |
| API-001-04 | darDeBajaSocio | encargado | cuentaId | cuenta en Baja; repetir no cambia nada (INV-ACC-006, INV-ACC-007) | `E_SIN_PERMISO`, `E_BAJA_SOCIO_BLOQUEADA` | UC-002 |
| API-001-05 | restablecerContrasena | encargado | cuentaId, contrasena | hash sustituido (INV-ACC-002, INV-ACC-103) | `E_SIN_PERMISO`, `E_CONTRASENA_CORTA` | UC-002 |
| API-001-06 | listarSocios | encargado; junta solo como selector de Historial (RN-023) | — | nombre, correo y estado de cada socio, sin hash; sin cambios | `E_SIN_PERMISO` | UC-002, UC-010 |

## Errors

| Code | Operations | Condition | Message (VO) |
|---|---|---|---|
| `E_CREDENCIALES_INVALIDAS` | 01 | correo desconocido, cuenta en Baja o contraseña mala | VO-010 |
| `E_CUENTA_BLOQUEADA` | 01 | `LOGIN_MAX_FAILURES` fallos seguidos y bloqueo vigente | VO-010 |
| `E_NO_AUTENTICADO` | 02 y todas las demás | sin sesión: se muestra Entrar | VO-010 |
| `E_SESION_CADUCADA` | todas | `SESSION_IDLE_HOURS` sin actividad | VO-010 |
| `E_SIN_PERMISO` | 03, 04, 05, 06 | rol no permitido | VO-010 |
| `E_CORREO_DUPLICADO` | 03 | correo ya existente (RN-014) | VO-010 |
| `E_CONTRASENA_CORTA` | 03, 05 | menos de `PASSWORD_MIN_LENGTH` caracteres | VO-010 |
| `E_DATOS_SOCIO_INVALIDOS` | 03 | nombre vacío o correo sin formato (RN-021) | VO-010 |
| `E_BAJA_SOCIO_BLOQUEADA` | 04 | préstamo Prestado o multa Pendiente (RN-010) | VO-010 |
| `E_ALMACEN_NO_DISPONIBLE` | todas | el almacén no puede leerse o escribirse; sin cambios | VO-010 |
