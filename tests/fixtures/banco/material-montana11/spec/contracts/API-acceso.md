# API-acceso

| Campo | Valor |
|---|---|
| Módulo | API-001 (operaciones `API-001-NN`) |
| Style | operations |
| Auth | sesión de cuenta; solo API-001-01 se admite sin sesión (INV-ACC-007) |
| Refs | REQ-F-001, REQ-F-002, REQ-NF-001; UC-001..UC-004; WF-002; ADR-003 |
| Errores | catálogo en `domain/03-VALUE-OBJECTS.md` § Catálogo de errores |
| Transporte | ver `design/OPERATION-MAPPING.md` |

## Operaciones

| ID | Operación | Actor | Entrada (VO) | Efecto / post (INV) | Errores de dominio | UC |
|---|---|---|---|---|---|---|
| API-001-01 | iniciarSesion | anónimo | correo: Correo (VO-002), contrasena | fallos a 0 y sesión abierta; o fallo sumado y bloqueo tras `LOGIN_MAX_FAILURES` (INV-ACC-004, INV-ACC-006) | `E_DATOS_INVALIDOS`, `E_CREDENCIALES_INVALIDAS`, `E_CUENTA_BLOQUEADA` | UC-001 |
| API-001-02 | cerrarSesion | cualquiera con sesión | — | sesión invalidada | `E_NO_AUTENTICADO` | UC-002 |
| API-001-03 | comprobarSesion | cualquiera | — | si es válida renueva actividad y devuelve cuenta y rol (INV-ACC-005) | `E_NO_AUTENTICADO`, `E_SESION_CADUCADA` | UC-002 |
| API-001-04 | crearSocio | encargado | nombre, correo: Correo (VO-002), contrasena: Contrasena (VO-003) | cuenta socio Activa con hash (INV-ACC-001, INV-ACC-002, INV-ACC-003); lista actualizada | `E_DATOS_INVALIDOS`, `E_CONTRASENA_CORTA`, `E_CORREO_DUPLICADO`, `E_ACCESO_NO_PERMITIDO` | UC-003 |
| API-001-05 | listarSocios | encargado | — | nombre, correo y estado de cada socio; sin cambios | `E_ACCESO_NO_PERMITIDO` | UC-003 |
| API-001-06 | restablecerContrasena | encargado | socioId, contrasena: Contrasena (VO-003) | hash nuevo; la anterior deja de valer; sesiones del socio invalidadas (RN-013, RN-014) | `E_CONTRASENA_CORTA`, `E_SOCIO_NO_ENCONTRADO`, `E_ACCESO_NO_PERMITIDO` | UC-004 |
| API-001-07 | darDeBajaSocio | encargado | socioId | cuenta en Baja y reservas Reservada canceladas en la misma escritura (INV-LOA-004, INV-SEC-003) | `E_SOCIO_NO_ENCONTRADO`, `E_SOCIO_CON_MATERIAL`, `E_ACCESO_NO_PERMITIDO` | UC-004 |

## Errores

| Código | Operaciones | Condición | Mensaje (VO) |
|---|---|---|---|
| `E_DATOS_INVALIDOS` | 01, 04 | campo vacío o mal formado | VO-010 |
| `E_CREDENCIALES_INVALIDAS` | 01 | contraseña errónea, correo inexistente o cuenta en Baja | VO-010 |
| `E_CUENTA_BLOQUEADA` | 01 | 5.º fallo o intento durante el bloqueo | VO-010 |
| `E_NO_AUTENTICADO` | 02, 03 | sin sesión | VO-010 |
| `E_SESION_CADUCADA` | 03 | inactividad superior a `SESSION_IDLE_MINUTES` | VO-010 |
| `E_CONTRASENA_CORTA` | 04, 06 | menos de `PASSWORD_MIN_LENGTH` caracteres | VO-010 |
| `E_CORREO_DUPLICADO` | 04 | correo ya registrado | VO-010 |
| `E_SOCIO_NO_ENCONTRADO` | 06, 07 | no existe o está en Baja (06) | VO-010 |
| `E_SOCIO_CON_MATERIAL` | 07 | tiene reservas Entregado | VO-010 |
| `E_ACCESO_NO_PERMITIDO` | 04..07 | rol distinto de encargado | VO-010 |
| `E_ALMACEN_NO_DISPONIBLE` | todas | el almacén no lee o no guarda | VO-010 |
