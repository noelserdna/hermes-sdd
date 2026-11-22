# Operation Mapping — material-montana10

> Stack: JavaScript (ES modules) + Vite + Vitest (AGENTS.md § SDD Stack Profile) · Conventions: ADR drafts 002 y 003 (no hay stack kit) · Contracts: spec/contracts/API-*.md (20 operations)

Idioma de todas: caso de uso puro `src/domain/<modulo>.js` (recibe `{ store, reloj }` y el actor) expuesto por el adaptador `src/server/http.js` como `POST /api/<operacion>` (lectura: `GET`). La SPA llama con `fetch` y cookie de sesión. Error de dominio: `{ error: "E_…" }`; familias: sin sesión/permiso 401/403, no encontrado 404, regla violada 409 o 422. Los estados exactos los fija el adaptador, no el spec.

## Mapping

| API-op | Idiom | Route / action | Verb | Success | Validation error | No-JS fallback | Accessible element |
|--------|-------|----------------|------|---------|------------------|----------------|--------------------|
| API-001-01 iniciarSesion | caso de uso `acceso.iniciarSesion` | `/api/iniciar-sesion` | POST | 200 + cookie de sesión; la SPA va a la pantalla inicial del rol (RN-015) | 401 `E_CREDENCIALES_INVALIDAS`, 423 `E_CUENTA_BLOQUEADA`; mensaje junto al formulario | JS required (SPA) — REQ-C-002 | botón "Entrar" |
| API-001-02 cerrarSesion | `acceso.cerrarSesion` | `/api/cerrar-sesion` | POST | 204, cookie borrada | 401 `E_NO_AUTENTICADO` | JS required | botón "Salir" |
| API-001-03 crearSocio | `socios.crearSocio` | `/api/socios` | POST | 201 con socio sin hash | 403 `E_SIN_PERMISO`, 409 `E_CORREO_DUPLICADO`, 422 `E_CONTRASENA_CORTA`/`E_DATOS_SOCIO_INVALIDOS` junto al campo | JS required | botón "Dar de alta" |
| API-001-04 darDeBajaSocio | `socios.darDeBajaSocio` | `/api/socios/baja` | POST | 200, estado Baja | 403 `E_SIN_PERMISO`, 409 `E_BAJA_SOCIO_BLOQUEADA` | JS required | botón "Dar de baja" |
| API-001-05 restablecerContrasena | `socios.restablecerContrasena` | `/api/socios/contrasena` | POST | 204 | 403 `E_SIN_PERMISO`, 422 `E_CONTRASENA_CORTA` | JS required | botón "Restablecer contraseña" |
| API-001-06 listarSocios | `socios.listarSocios` | `/api/socios` | GET | 200 lista sin hash | 403 `E_SIN_PERMISO` | JS required | tabla "Socios" |
| API-002-01 reservarMaterial | `reservas.reservarMaterial` (dentro de `store.transaction`) | `/api/reservas` | POST | 201 reserva (o la idéntica, 200) | 422 `E_TIPO_INVALIDO`/`E_FECHA_PASADA`/`E_FECHAS_INVERTIDAS`/`E_RESERVA_MUY_LARGA`, 409 `E_MULTA_PENDIENTE`/`E_SIN_UNIDADES_LIBRES` | JS required | botón "Reservar" |
| API-002-02 listarMisReservas | `reservas.listarMisReservas` (deriva No recogida) | `/api/mis-reservas` | GET | 200 reservas y multas del socio | — | JS required | lista "Mis reservas" |
| API-002-03 cancelarReserva | `reservas.cancelarReserva` | `/api/reservas/cancelar` | POST | 200 Cancelada (repetir igual) | 404 `E_RESERVA_NO_ENCONTRADA`, 403 `E_SIN_PERMISO_CANCELAR`, 409 `E_CANCELACION_TARDIA` | JS required | botón "Cancelar reserva" |
| API-003-01 entregarReserva | `prestamos.entregarReserva` (transacción) | `/api/prestamos/entregar` | POST | 200 Prestada con unidad | 404 `E_RESERVA_NO_ENCONTRADA`, 409 `E_ENTREGA_ANTICIPADA`/`E_RESERVA_NO_ENTREGABLE`/`E_UNIDAD_NO_DISPONIBLE` | JS required | botón "Entregar" |
| API-003-02 devolverPrestamo | `prestamos.devolverPrestamo` | `/api/prestamos/devolver` | POST | 200 Devuelta (+ multa Pendiente si hay retraso) | 404 `E_RESERVA_NO_ENCONTRADA`, 409 `E_RESERVA_NO_PRESTADA` | JS required | botón "Devolver" |
| API-003-03 pagarMulta | `prestamos.pagarMulta` | `/api/multas/pagar` | POST | 200 Pagada con fecha | 403 `E_SIN_PERMISO`, 404 `E_MULTA_NO_ENCONTRADA` | JS required | botón "Marcar como pagada" |
| API-003-04 listarMultas | `prestamos.listarMultas` | `/api/multas` | GET | 200 | 403 `E_SIN_PERMISO` | JS required | tabla "Multas" |
| API-003-05 consultarEntregasYDevoluciones | `prestamos.consultarEntregasYDevoluciones` | `/api/entregas-y-devoluciones` | GET | 200 | 403 `E_SIN_PERMISO` | JS required | región "Entregas y devoluciones" |
| API-003-06 consultarHistorial | `prestamos.consultarHistorial` | `/api/historial?socioId=` | GET | 200 | 403 `E_SIN_PERMISO`, 404 `E_SOCIO_NO_ENCONTRADO` | JS required | región "Historial", selector "Socio" |
| API-003-07 resolverNoRecogidas | `tareas.resolverNoRecogidas` | interna (tarea diaria y al leer) y `/api/tareas-diarias` | POST | 200 contadores | 401 sin `x-cron-secret` | no aplica (sistema) | — |
| API-003-08 purgarRegistrosAntiguos | `tareas.purgarRegistrosAntiguos` | interna (tarea diaria) y `/api/tareas-diarias` | POST | 200 contadores | 401 sin `x-cron-secret` | no aplica (sistema) | — |
| API-004-01 anadirUnidades | `inventario.anadirUnidades` | `/api/inventario/unidades` | POST | 201 | 403 `E_SIN_PERMISO`, 422 `E_TIPO_INVALIDO`/`E_CANTIDAD_INVALIDA` | JS required | botón "Añadir unidades" |
| API-004-02 darDeBajaUnidad | `inventario.darDeBajaUnidad` | `/api/inventario/unidades/baja` | POST | 200 | 403 `E_SIN_PERMISO`, 404 `E_UNIDAD_NO_ENCONTRADA`, 409 `E_BAJA_UNIDAD_PRESTADA` | JS required | botón "Dar de baja" |
| API-004-03 listarInventario | `inventario.listarInventario` | `/api/inventario` | GET | 200 | 403 `E_SIN_PERMISO` | JS required | tabla "Inventario" |

## Requirement-mandated transport

| URL / mechanic | REQ | API-op | Implemented as |
|----------------|-----|--------|----------------|
| Sesión | REQ-F-001 | API-001-01/02 | cookie `HttpOnly; SameSite=Strict`, sin tokens en `localStorage`/`sessionStorage` (REQ-C-003) |
| Salud | — | — | `GET /api/salud` (verificación posterior al despliegue; no es operación de contrato) |

## Deviations from kit conventions

| API-op | Deviation | Reason (ADR / RN) |
|--------|-----------|-------------------|
| todas | sin stack kit ni No-JS: SPA con JS obligatorio | REQ-C-002 (Vite SPA); ADR draft 002 |
| API-003-07/08 | no son rutas de usuario; el servidor las ejecuta él mismo | tareas del sistema; ADR draft 002 |
