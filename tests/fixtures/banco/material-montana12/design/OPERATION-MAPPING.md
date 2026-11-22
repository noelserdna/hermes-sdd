# Operation Mapping — material-montana12

> Stack: JavaScript (ES modules) + Vite + Vitest (Stack Profile de AGENTS.md; no hay kit de stack instalado) · Conventions: design/TECHNICAL-DESIGN.md §8 · Contracts: spec/contracts/API-*.md (21 operations)

Convención común: JSON sobre `fetch`; la sesión va en la cookie; cada ruta vive en `src/server/http/rutas.js` y llama a la función del servicio indicada. Éxito: 200 con el resultado (o aviso ADR-005). Error de dominio: `{ error: { codigo, mensaje } }` con 400 (validación), 401 (sin sesión / `E_CREDENCIALES`), 403 (`E_ACCESO_DENEGADO`, `E_PAGINA_PROHIBIDA`), 404 (no encontrado), 409 (conflicto: duplicado, sin unidades, bloqueo de baja), 423 (`E_CUENTA_BLOQUEADA`), 503 (`E_ALMACEN_NO_DISPONIBLE`). El mensaje se pinta junto al formulario con `role="alert"`.

## Mapping

| API-op | Idiom | Route / action | Verb | Success | Validation error | No-JS fallback | Accessible element |
|--------|-------|----------------|------|---------|------------------|----------------|--------------------|
| API-001-01 login | route handler + servicio | `/api/entrar` → `cuentas.login` | POST | sesión + cookie; destino por rol | mensaje VO-010 bajo el formulario | JS required — SPA (REQ-F-001) | button "Entrar" |
| API-001-02 logout | route handler | `/api/salir` → `cuentas.logout` | POST | cookie borrada; muestra "Entrar" | — | JS required | button "Salir" |
| API-001-03 changePassword | route handler | `/api/cuenta/contrasena` → `cuentas.changePassword` | PUT | cuenta Activa; va a la home del rol | `E_CONTRASENA_CORTA` bajo el campo | JS required | button "Guardar contraseña" |
| API-001-04 registerMember | route handler | `/api/socios` → `cuentas.registerMember` | POST | "Socio creado: {nombre}" | `E_SOCIO_DUPLICADO`, `E_CONTRASENA_CORTA`, `E_SOCIO_DATOS_INVALIDOS` | JS required | button "Dar de alta" |
| API-001-05 resetMemberPassword | route handler | `/api/socios/:id/contrasena` → `cuentas.resetMemberPassword` | PUT | "Contraseña provisional guardada para {nombre}" | `E_CONTRASENA_CORTA`, `E_SOCIO_NO_ENCONTRADO` | JS required | button "Restablecer contraseña" |
| API-001-06 removeMember | route handler | `/api/socios/:id/baja` → `cuentas.removeMember` | POST | "Socio dado de baja: {nombre}" | `E_BAJA_PRESTAMOS`, `E_BAJA_MULTAS` | JS required | button "Dar de baja" |
| API-001-07 getMemberHistory | route handler | `/api/historial?q=&id=` → `cuentas.getMemberHistory` | GET | historial de solo lectura | `E_BUSQUEDA_VACIA` | JS required | search "Buscar socio" |
| API-001-08 authorize | middleware previo a toda ruta `/api` y guardia del router | `src/server/http/autorizar.js` (`authorize`) | — | continúa; renueva caducidad | `E_ACCESO_DENEGADO`, `E_PAGINA_PROHIBIDA`; sin sesión → "Entrar" | JS required | — |
| API-002-01 reserve | route handler | `/api/reservas` → `prestamos.reserve` | POST | "Reserva creada: {cantidad} × {material} del {inicio} al {fin}" | `E_MAX_DIAS`, `E_MAX_UNIDADES`, sin unidades, fecha pasada, multa pendiente | JS required | button "Reservar" |
| API-002-02 listMyReservations | route handler | `/api/mis-reservas` → `prestamos.listMyReservations` | GET | lista propia o "Aún no tienes reservas" | — | JS required | list "Mis reservas" |
| API-002-03 cancelReservation | route handler | `/api/reservas/:id/cancelar` → `prestamos.cancelReservation` | POST | "Reserva cancelada" / aviso "La reserva ya estaba cancelada" | "No se puede cancelar: empieza hoy" | JS required | button "Cancelar" |
| API-002-04 deliverReservation | route handler | `/api/reservas/:id/entregar` → `prestamos.deliverReservation` | POST | préstamo registrado / aviso de repetición | errores del contrato | JS required | button "Entregar" |
| API-002-05 returnLoan | route handler | `/api/reservas/:id/devolver` → `prestamos.returnLoan` | POST | préstamo cerrado, unidades libres, multa si hay retraso | errores del contrato | JS required | button "Devolver" |
| API-002-06 getPanel | route handler | `/api/panel?fecha=` → `prestamos.getPanel` | GET | panel del encargado | fecha inválida | JS required | region "Panel del encargado" |
| API-002-07 purgeOldRecords | tarea interna | `src/server/servicios/depurar.js`, al arrancar y cada 24 h (sin ruta HTTP) | — | borra solo cerrados > `RETENTION_YEARS` | — | n/a (sistema) | — |
| API-003-01 addUnits | route handler | `/api/material` → `material.addUnits` | POST | material actualizado | `VO-006` cantidad | JS required | button "Añadir unidades" |
| API-003-02 withdrawUnits | route handler | `/api/material/:id/retirar` → `material.withdrawUnits` | POST | unidades retiradas | errores del contrato | JS required | button "Retirar unidades" |
| API-003-03 listMaterial | route handler | `/api/material` → `material.listMaterial` | GET | catálogo con unidades | — | JS required | list "Material" |
| API-004-01 listMyFines | route handler | `/api/mis-multas` → `multas.listMyFines` | GET | multas propias | — | JS required | list "Mis multas" |
| API-004-02 payFine | route handler | `/api/multas/:id/pagar` → `multas.payFine` | POST | multa Pagada / aviso de repetición | `E_MULTA_NO_ENCONTRADA` (según contrato) | JS required | button "Marcar pagada" |
| API-004-03 listFines | route handler | `/api/multas` → `multas.listFines` | GET | todas las multas | — | JS required | list "Multas" |

## Requirement-mandated transport

| URL / mechanic | REQ | API-op | Implemented as |
|----------------|-----|--------|----------------|
| `/mis-reservas` sin sesión muestra "Entrar" | REQ-F-001 | API-001-08 | Guardia del router + `GET /api/mis-reservas` → 401 |
| `/mis-reservas` con contraseña provisional muestra "Elige una contraseña nueva" | REQ-F-002 | API-001-08 | Guardia del router; el servidor rechaza toda operación salvo -02 y -03 |
| Volver atrás tras salir no muestra datos | REQ-F-001 | API-001-02 | `Cache-Control: no-store` en `/api/*` y la SPA vacía su estado al salir |

## Deviations from kit conventions

| API-op | Deviation | Reason (ADR / RN) |
|--------|-----------|-------------------|
| Todas | No hay kit de stack instalado: rutas propias bajo `/api` en un plugin de Vite | Stack Profile fijo (Vite + Vitest); ADR-DRAFT-001 |
| API-002-07 | Sin ruta HTTP | Depuración interna (UC-019), sin endpoint de cron |
| Rutas y verbos | Los nombres exactos de ruta son de diseño; los contratos solo fijan operaciones | `spec/contracts/` no define URLs |
