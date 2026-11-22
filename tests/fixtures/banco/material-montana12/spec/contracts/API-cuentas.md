# API-cuentas

| Field | Value |
|---|---|
| Module | API-001 |
| Style | operations |
| Auth | sesión del usuario (RN-002); `login` sin sesión; con contraseña provisional solo -02 y -03 (INV-SOC-006) |
| Refs | REQ-F-001, REQ-F-002, REQ-F-009, REQ-NF-001; UC-001..006, UC-018; INV-SOC-001..009, INV-SOC-101..102, INV-SEC-001..003; ADR-003 |
| Errors | catálogo en `domain/03-VALUE-OBJECTS.md` § Error catalog |
| Transport | ver `design/OPERATION-MAPPING.md` |

## Operations

| ID | Operation | Actor | Input (VO) | Effect / post (INV) | Domain errors | UC |
|---|---|---|---|---|---|---|
| API-001-01 | login | anónimo | email (VO-002), password | sesión abierta y fallos a cero; o suma un fallo (INV-SOC-004, INV-SOC-008) | `E_CREDENCIALES`, `E_CUENTA_BLOQUEADA`, `E_ALMACEN_NO_DISPONIBLE` | UC-001 |
| API-001-02 | logout | cualquiera | — | sesión invalidada en servidor; repetir no cambia nada (RN-003) | `E_ALMACEN_NO_DISPONIBLE` | UC-002 |
| API-001-03 | changePassword | sesión con provisional | password (VO-003) | contraseña cifrada guardada; cuenta Provisional → Activa (INV-SOC-002, INV-SOC-003) | `E_CONTRASENA_CORTA`, `E_ALMACEN_NO_DISPONIBLE` | UC-004 |
| API-001-04 | registerMember | encargado | name, email (VO-002), password (VO-003) | cuenta socio Provisional (INV-SOC-001, 002, 003, 009) | `E_ACCESO_DENEGADO`, `E_CONTRASENA_CORTA`, `E_SOCIO_DUPLICADO`, `E_SOCIO_DATOS_INVALIDOS`, `E_ALMACEN_NO_DISPONIBLE` | UC-003 |
| API-001-05 | resetMemberPassword | encargado | accountId (VO-001), password | nueva provisional cifrada; la anterior no vale (INV-SOC-102) | `E_ACCESO_DENEGADO`, `E_CONTRASENA_CORTA`, `E_SOCIO_NO_ENCONTRADO`, `E_ALMACEN_NO_DISPONIBLE` | UC-005 |
| API-001-06 | removeMember | encargado | accountId (VO-001) | cuenta Baja y reservas Reservada canceladas en una operación; sesiones cerradas (INV-SOC-007, INV-SOC-101, RN-026) | `E_ACCESO_DENEGADO`, `E_BAJA_PRESTAMOS`, `E_BAJA_MULTAS`, `E_SOCIO_NO_ENCONTRADO`, `E_ALMACEN_NO_DISPONIBLE` | UC-006 |
| API-001-07 | getMemberHistory | junta | query, accountId? | préstamos y multas del socio; solo lectura (INV-SEC-002) | `E_ACCESO_DENEGADO`, `E_PAGINA_PROHIBIDA`, `E_BUSQUEDA_VACIA`, `E_ALMACEN_NO_DISPONIBLE` | UC-018 |
| API-001-08 | authorize | sistema | sesión, rol o página | permite; sin sesión muestra Entrar; si no, rechaza (RN-020); renueva caducidad (INV-SOC-005) | `E_ACCESO_DENEGADO`, `E_PAGINA_PROHIBIDA` | UC-001 |

## Errors

| Code | Operations | Condition | Message (VO) |
|---|---|---|---|
| `E_CREDENCIALES` | 01 | correo o contraseña no válidos, o cuenta de baja | VO-010 |
| `E_CUENTA_BLOQUEADA` | 01 | bloqueo vigente (INV-SOC-004) | VO-010 |
| `E_CONTRASENA_CORTA` | 03, 04, 05 | contraseña por debajo de `PASSWORD_MIN_LENGTH` | VO-010 |
| `E_SOCIO_DUPLICADO` | 04 | correo ya registrado (INV-SOC-001) | VO-010 |
| `E_SOCIO_DATOS_INVALIDOS` | 04 | nombre vacío o correo mal formado | VO-010 |
| `E_SOCIO_NO_ENCONTRADO` | 05, 06 | cuenta inexistente o de baja | VO-010 |
| `E_BAJA_PRESTAMOS` | 06 | material sin devolver | VO-010 |
| `E_BAJA_MULTAS` | 06 | multas pendientes | VO-010 |
| `E_BUSQUEDA_VACIA` | 07 | ningún socio coincide | VO-010 |
| `E_ACCESO_DENEGADO` | 04, 05, 06, 07, 08 | operación fuera del rol | VO-010 |
| `E_PAGINA_PROHIBIDA` | 07, 08 | página fuera del rol | VO-010 |
| `E_ALMACEN_NO_DISPONIBLE` | 01..07 | el almacén no puede leerse o escribirse | VO-010 |

## Requirement-mandated transport

| URL / mechanic | REQ | Operations |
|---|---|---|
| `/mis-reservas` sin sesión muestra el formulario Entrar | REQ-F-001 | 08 |
