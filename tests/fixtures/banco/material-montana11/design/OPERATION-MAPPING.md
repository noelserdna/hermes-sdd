# Operation Mapping — material-montana11

> Stack: JavaScript (ES modules) + Vite + Vitest (Stack Profile de AGENTS.md) · Conventions: ADR-DRAFT-001 (no hay kit de convenciones para este perfil) · Contracts: spec/contracts/API-*.md (24 operations)

## Convenciones de transporte

- Cada operación pública es `/api/<operacion>` (nombre del contrato). Lecturas: `GET` con parámetros en la query. Escrituras: `POST` con cuerpo JSON y `Content-Type: application/json`.
- Respuesta de éxito `{ ok: true, datos, mensaje? }`; de error `{ ok: false, codigo, mensaje }` con el literal de VO-010 (ADR-004).
- Estado HTTP por familia: éxito 200; validaciones (`E_DATOS_INVALIDOS`, `E_FECHA_PASADA`, etc.) 422; `E_NO_AUTENTICADO`, `E_SESION_CADUCADA`, `E_CREDENCIALES_INVALIDAS` 401; `E_ACCESO_NO_PERMITIDO` 403; `*_NO_ENCONTRADA`/`*_NO_ENCONTRADO` 404; conflictos de estado (`E_ESTADO_INVALIDO`, `E_SIN_UNIDADES`, `E_ENTREGA_ANTICIPADA`, `E_CANCELACION_TARDIA`, `E_MULTA_PENDIENTE`, `E_UNIDAD_PRESTADA`, `E_SOCIO_CON_MATERIAL`) 409; `E_ALMACEN_NO_DISPONIBLE` 503. La UI se guía por `codigo`, no por el estado. El estado exacto del bloqueo de cuenta lo fija VO-010.
- Sesión: cookie `sid` HttpOnly; solo `iniciarSesion` es pública (INV-ACC-007).
- Interfaz: SPA con router por hash (`#/entrar`, `#/reservas`, `#/socios`, `#/inventario`, `#/prestamos`, `#/multas`, `#/historial`); sin recurso sin JavaScript (SPA aceptada, REQ-C-001).

## Mapping

| API-op | Idiom | Route / action | Verb | Success | Validation error | No-JS fallback | Accessible element |
|--------|-------|----------------|------|---------|------------------|----------------|--------------------|
| API-001-01 iniciarSesion | RPC JSON en plugin Vite | `/api/iniciarSesion` → `src/domain/*` vía `src/server/plugin.js` | POST | abre sesión, `Set-Cookie sid`, datos {nombre,rol} | `E_DATOS_INVALIDOS`, `E_CREDENCIALES_INVALIDAS`, bloqueo; mensaje con `role=alert` | JS required (SPA) | textbox "Correo", textbox "Contraseña", button "Entrar" |
| API-001-02 cerrarSesion | RPC JSON en plugin Vite | `/api/cerrarSesion` → `src/domain/*` vía `src/server/plugin.js` | POST | borra cookie; vuelve a la entrada | `E_NO_AUTENTICADO` | JS required (SPA) | button "Salir" |
| API-001-03 comprobarSesion | RPC JSON en plugin Vite | `/api/comprobarSesion` → `src/domain/*` vía `src/server/plugin.js` | GET | cuenta y rol; renueva actividad | `E_NO_AUTENTICADO`/`E_SESION_CADUCADA` llevan a la entrada | JS required (SPA) | — |
| API-001-04 crearSocio | RPC JSON en plugin Vite | `/api/crearSocio` → `src/domain/*` vía `src/server/plugin.js` | POST | lista de socios actualizada | `E_DATOS_INVALIDOS`, `E_CONTRASENA_CORTA`, junto al campo | JS required (SPA) | button "Crear socio" |
| API-001-05 listarSocios | RPC JSON en plugin Vite | `/api/listarSocios` → `src/domain/*` vía `src/server/plugin.js` | GET | lista nombre, correo, estado | `E_ACCESO_NO_PERMITIDO` | JS required (SPA) | table "Socios" |
| API-001-06 restablecerContrasena | RPC JSON en plugin Vite | `/api/restablecerContrasena` → `src/domain/*` vía `src/server/plugin.js` | POST | confirmación | `E_CONTRASENA_CORTA`, `E_SOCIO_NO_ENCONTRADO` | JS required (SPA) | button "Restablecer contraseña" |
| API-001-07 darDeBajaSocio | RPC JSON en plugin Vite | `/api/darDeBajaSocio` → `src/domain/*` vía `src/server/plugin.js` | POST | socio en Baja, aviso de reservas canceladas | `E_SOCIO_CON_MATERIAL`, `E_SOCIO_NO_ENCONTRADO` | JS required (SPA) | button "Dar de baja" |
| API-002-01 consultarDisponibilidad | RPC JSON en plugin Vite | `/api/consultarDisponibilidad` → `src/domain/*` vía `src/server/plugin.js` | GET | unidades libres en el rango | `E_MATERIAL_INVALIDO`, `E_DATOS_INVALIDOS` | JS required (SPA) | region "Disponibilidad" |
| API-002-02 reservarMaterial | RPC JSON en plugin Vite | `/api/reservarMaterial` → `src/domain/*` vía `src/server/plugin.js` | POST | reserva creada, `M_RESERVA_CREADA` | `E_FECHA_PASADA`, `E_FECHAS_INVERTIDAS`, `E_RESERVA_MUY_LARGA`, `E_MULTA_PENDIENTE`, `E_SIN_UNIDADES` | JS required (SPA) | button "Reservar" |
| API-002-03 listarMisReservas | RPC JSON en plugin Vite | `/api/listarMisReservas` → `src/domain/*` vía `src/server/plugin.js` | GET | lista propia (aplica No recogida) | `E_NO_AUTENTICADO` | JS required (SPA) | list "Mis reservas" |
| API-002-04 cancelarReserva | RPC JSON en plugin Vite | `/api/cancelarReserva` → `src/domain/*` vía `src/server/plugin.js` | POST | `M_RESERVA_CANCELADA` | `E_CANCELACION_TARDIA`, `E_RESERVA_NO_ENCONTRADA`, `E_ESTADO_INVALIDO` | JS required (SPA) | button "Cancelar reserva" |
| API-003-01 entregarReserva | RPC JSON en plugin Vite | `/api/entregarReserva` → `src/domain/*` vía `src/server/plugin.js` | POST | reserva Entregado | `E_ENTREGA_ANTICIPADA`, `E_ESTADO_INVALIDO`, `E_RESERVA_NO_ENCONTRADA` | JS required (SPA) | button "Entregar" |
| API-003-02 registrarDevolucion | RPC JSON en plugin Vite | `/api/registrarDevolucion` → `src/domain/*` vía `src/server/plugin.js` | POST | reserva Devuelto y, si hay retraso, multa | `E_ESTADO_INVALIDO`, `E_RESERVA_NO_ENCONTRADA` | JS required (SPA) | button "Registrar devolución" |
| API-003-03 marcarNoRecogidas | función de dominio | `aplicarNoRecogidas` en `src/domain/prestamos.js` | — | sin ruta HTTP: se invoca al inicio de cada lectura o escritura que toca reservas | — | n/a | — |
| API-003-04 listarPrestamosYReservas | RPC JSON en plugin Vite | `/api/listarPrestamosYReservas` → `src/domain/*` vía `src/server/plugin.js` | GET | lista con estado | `E_ACCESO_NO_PERMITIDO` | JS required (SPA) | table "Préstamos y reservas" |
| API-003-05 aplicarMultaPorRetraso | función de dominio | `aplicarNoRecogidas` en `src/domain/prestamos.js` | — | sin ruta HTTP: la llama registrarDevolucion en la misma escritura | — | n/a | — |
| API-003-06 listarMisMultas | RPC JSON en plugin Vite | `/api/listarMisMultas` → `src/domain/*` vía `src/server/plugin.js` | GET | multas propias | `E_NO_AUTENTICADO`, `E_ACCESO_NO_PERMITIDO` | JS required (SPA) | list "Mis multas" |
| API-003-07 listarMultas | RPC JSON en plugin Vite | `/api/listarMultas` → `src/domain/*` vía `src/server/plugin.js` | GET | todas las multas | `E_ACCESO_NO_PERMITIDO` | JS required (SPA) | table "Multas" |
| API-003-08 marcarMultaPagada | RPC JSON en plugin Vite | `/api/marcarMultaPagada` → `src/domain/*` vía `src/server/plugin.js` | POST | multa Pagada | `E_MULTA_NO_ENCONTRADA` | JS required (SPA) | button "Marcar pagada" |
| API-003-09 consultarPrestado | RPC JSON en plugin Vite | `/api/consultarPrestado` → `src/domain/*` vía `src/server/plugin.js` | GET | préstamos, retrasos y devoluciones del día (`?dia=`) | `E_DATOS_INVALIDOS` | JS required (SPA) | region "Prestado" |
| API-003-10 consultarHistorialSocio | RPC JSON en plugin Vite | `/api/consultarHistorialSocio` → `src/domain/*` vía `src/server/plugin.js` | GET | préstamos y multas del socio (`?socioId=`) | `E_SOCIO_NO_ENCONTRADO` | JS required (SPA) | table "Historial del socio" |
| API-004-01 listarInventario | RPC JSON en plugin Vite | `/api/listarInventario` → `src/domain/*` vía `src/server/plugin.js` | GET | recuento por tipo y unidades De baja | `E_ACCESO_NO_PERMITIDO` | JS required (SPA) | table "Inventario" |
| API-004-02 anadirMaterial | RPC JSON en plugin Vite | `/api/anadirMaterial` → `src/domain/*` vía `src/server/plugin.js` | POST | unidades nuevas | `E_CANTIDAD_INVALIDA`, `E_MATERIAL_INVALIDO` | JS required (SPA) | button "Añadir material" |
| API-004-03 darDeBajaUnidad | RPC JSON en plugin Vite | `/api/darDeBajaUnidad` → `src/domain/*` vía `src/server/plugin.js` | POST | unidad De baja, `M_RESERVAS_CANCELADAS_BAJA` | `E_UNIDAD_PRESTADA`, `E_UNIDAD_NO_ENCONTRADA` | JS required (SPA) | button "Dar de baja" |

## Requirement-mandated transport

| URL / mechanic | REQ | API-op | Implemented as |
|----------------|-----|--------|----------------|
| Día consultado en lo prestado | REQ-F-009 | API-003-09 | `GET /api/consultarPrestado?dia=AAAA-MM-DD` |
| Historial de un socio | REQ-F-010 | API-003-10 | `GET /api/consultarHistorialSocio?socioId=N` |

## Deviations from kit conventions

| API-op | Deviation | Reason (ADR / RN) |
|--------|-----------|-------------------|
| todas | no hay kit para el perfil Vite JS; transporte RPC propio en lugar de REST por recurso | ADR-DRAFT-001; contratos con `Style: operations` |
| API-003-03, API-003-05 | sin ruta HTTP (actor «sistema») | se aplican dentro de otras operaciones (RN-004, INV-LOA-002) |
