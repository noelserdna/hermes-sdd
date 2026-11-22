# Spec id plan — material-montana11 — 2026-11-21 (working file; not part of spec/)
Mode: fanout · lanes: R1 R2 R3 R4 · model: sonnet · prose language: español · BDD: keywords English, body Spanish, visible literals verbatim

| Lane | REQs (lines) | UC ids + title | AC | API operations | INV mint | NC mint |
|---|---|---|---|---|---|---|
| R1 | REQ-F-001 (13-42), REQ-F-002 (43-69) | UC-001 Entrar con correo y contraseña; UC-002 Mantener y cerrar la sesión (caducidad, salir, acceso anónimo); UC-003 Crear socio y listar socios; UC-004 Restablecer contraseña y dar de baja socio | AC-001-NN..AC-004-NN | API-001-01..07 | INV-ACC-1NN | NC-1NN |
| R2 | REQ-F-003 (70-99), REQ-F-004 (100-121) | UC-005 Reservar material; UC-006 Ver mis reservas; UC-007 Cancelar reserva | AC-005-NN..AC-007-NN | API-002-01..04 | INV-RES-2NN | NC-2NN |
| R3 | REQ-F-005 (122-145), REQ-F-006 (146-169), REQ-F-007 (170-187) | UC-008 Entregar material (incl. No recogida); UC-009 Registrar devolución; UC-010 Aplicar multa por retraso; UC-011 Ver mis multas; UC-012 Marcar multa pagada (incl. listado Multas) | AC-008-NN..AC-012-NN | API-003-01..08 | INV-LOA-3NN / INV-FIN-3NN | NC-3NN |
| R4 | REQ-F-008 (188-213), REQ-F-009 (214-233), REQ-F-010 (234-253) | UC-013 Añadir material (incl. listar inventario); UC-014 Dar de baja unidad; UC-015 Ver lo prestado y lo que vuelve cada día; UC-016 Consultar historial de un socio | AC-013-NN..AC-016-NN | API-004-01..03; API-003-09, API-003-10 | INV-STK-4NN / INV-SEC-4NN | NC-4NN |
| main | REQ-NF-001, REQ-C-* | — | — | headers, index, Errors | INV-xxx-0NN | NC-0NN |

## Contract modules (all Style: operations; file contracts/API-{name}.md)
- API-001 `acceso` (cuentas y sesión): 01 iniciarSesion(UC-001) · 02 cerrarSesion(UC-002) · 03 comprobarSesion(UC-002) · 04 crearSocio(UC-003) · 05 listarSocios(UC-003) · 06 restablecerContrasena(UC-004) · 07 darDeBajaSocio(UC-004)
- API-002 `reservas`: 01 consultarDisponibilidad(UC-005) · 02 reservarMaterial(UC-005) · 03 listarMisReservas(UC-006) · 04 cancelarReserva(UC-007)
- API-003 `prestamos` (entregas, devoluciones, multas, paneles): 01 entregarReserva(UC-008) · 02 registrarDevolucion(UC-009) · 03 marcarNoRecogidas(UC-008, interna al cambiar el día) · 04 listarPrestamosYReservas(UC-008) · 05 aplicarMultaPorRetraso(UC-010) · 06 listarMisMultas(UC-011) · 07 listarMultas(UC-012) · 08 marcarMultaPagada(UC-012) · 09 consultarPrestado(UC-015) · 10 consultarHistorialSocio(UC-016)
- API-004 `inventario`: 01 listarInventario(UC-013) · 02 anadirMaterial(UC-013) · 03 darDeBajaUnidad(UC-014)
Roles: socio/encargado/junta. Todas las operaciones salvo API-001-01 exigen sesión (E_NO_AUTENTICADO / E_SESION_CADUCADA).

## Fixed skeletons — cite these ids, never invent one
- WF-001 Ciclo del préstamo. Steps: 1 entrar (UC-001) · 2 reservar (UC-005) · 3 ver o cancelar reserva (UC-006, UC-007) · 4 entregar el día de inicio o pasar a No recogida (UC-008) · 5 devolver (UC-009) · 6 multa por retraso (UC-010) · 7 pagar la multa (UC-012) · 8 volver a reservar
- WF-002 Sesión de acceso. Steps: 1 entrar (UC-001) · 2 operar con sesión (UC-002) · 3 caducidad por inactividad (UC-002) · 4 salir (UC-002) · 5 gestión de cuentas por el encargado (UC-003, UC-004)
- ADR-001 almacén único compartido en servidor · ADR-002 reloj del sistema y días completos · ADR-003 contraseñas con hash · ADR-004 errores de dominio con mensaje literal · ADR-005 escrituras atómicas y serializadas (owner: main)
- Domain areas: ACC STK RES LOA FIN SEC. Existing INV: see spec/domain/05-INVARIANTS.md (cite, don't re-mint).
- Errors/messages already in catalog VO-010 (E_*, M_*). Reuse; a new code → `errs` with new:true.
- UI screens (names as in "Se ve:" lines): Entrar, Inicio del socio, Inicio del encargado, Socios, Reservar, Mis reservas, Mis multas, Préstamos, Multas, Inventario, Prestado, Historial del socio.
