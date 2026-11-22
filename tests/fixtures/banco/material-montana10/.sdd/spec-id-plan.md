# Spec id plan — material-montana10 — 2026-11-21 (working file; not part of spec/)
Mode: fanout · lanes: R1 R2 R3 R4 (no X: main writes nfr/ adr/) · model: sonnet · Idioma: español (ids, código y keywords Gherkin en inglés)
Contract Style: operations en los 4 módulos. Funcionales F=10.

| Lane | REQs (líneas REQUIREMENTS.md) | UC ids + file slug | AC | API ops | INV mint | NC mint |
|---|---|---|---|---|---|---|
| R1 | REQ-F-001 (15-44), REQ-F-002 (45-71) | UC-001 entrar-y-salir; UC-002 gestionar-socios | AC-001-NN, AC-002-NN | API-001-01..06 | INV-ACC-1NN | NC-1NN |
| R2 | REQ-F-003 (72-103), REQ-F-004 (104-129), REQ-F-008 (192-215) | UC-003 reservar-material; UC-004 ver-y-cancelar-reservas; UC-008 gestionar-inventario | AC-003-NN, AC-004-NN, AC-008-NN | API-002-01..03; API-004-01..03 | INV-RES-2NN, INV-STK-2NN | NC-2NN |
| R3 | REQ-F-005 (130-149), REQ-F-006 (150-171), REQ-F-007 (172-191) | UC-005 entregar-reserva; UC-006 devolver-y-multar; UC-007 pagar-multa | AC-005-NN, AC-006-NN, AC-007-NN | API-003-01,02,03,04,07 | INV-LOA-3NN | NC-3NN |
| R4 | REQ-F-009 (216-237), REQ-F-010 (238-257) | UC-009 ver-entregas-y-devoluciones; UC-010 consultar-historial | AC-009-NN, AC-010-NN | API-003-05,06 | INV-LOA-4NN | NC-4NN |
| main | REQ-NF-001, REQ-C-* | — | — | API-003-08 purgarRegistrosAntiguos (REQ-NF-001); cabeceras y tabla Errors | INV-*-0NN | NC-0NN |

Líneas comunes a todos: 11 (roles y fechas) y 299-317 (Supuestos).

## Operaciones (id · nombre · UC · lane)
- Módulo API-001 `acceso` (contracts/API-acceso.md): 01 iniciarSesion UC-001 · 02 cerrarSesion UC-001 · 03 crearSocio UC-002 · 04 darDeBajaSocio UC-002 · 05 restablecerContrasena UC-002 · 06 listarSocios UC-002 (R1)
- Módulo API-002 `reservas`: 01 reservarMaterial UC-003 · 02 listarMisReservas UC-004 (incluye multas del socio) · 03 cancelarReserva UC-004 (R2)
- Módulo API-003 `prestamos`: 01 entregarReserva UC-005 · 02 devolverPrestamo UC-006 · 03 pagarMulta UC-007 · 04 listarMultas UC-007 (R3) · 05 consultarEntregasYDevoluciones UC-009 · 06 consultarHistorial UC-010 (R4) · 07 resolverNoRecogidas UC-005 (R3; aplica RN-008 al consultar y operar) · 08 purgarRegistrosAntiguos (main)
- Módulo API-004 `inventario`: 01 anadirUnidades UC-008 · 02 darDeBajaUnidad UC-008 · 03 listarInventario UC-008 (R2)

## Esqueletos fijos — cita estos ids, nunca inventes otros
- WF-001 Ciclo de un préstamo. Pasos: 1 reservar (UC-003) · 2 cancelar (UC-004) · 3 entregar (UC-005) · 4 marcar No recogida (UC-005) · 5 devolver (UC-006) · 6 poner multa (UC-006) · 7 pagar multa (UC-007)
- WF-002 Sesión de una cuenta. Pasos: 1 entrar (UC-001) · 2 bloqueo tras fallos (UC-001) · 3 caducidad por inactividad (UC-001) · 4 salir (UC-001)
- ADR-001 Reloj inyectable en fecha natural Europe/Madrid · ADR-002 Un almacén compartido en servidor; reserva y comprobación de unidades indivisibles por tipo (main escribe)
- Áreas INV: ACC, RES, LOA, STK. Estados SM-001 reserva, SM-002 multa, SM-003 unidad, SM-004 cuenta. Entidades ENT-001..005. VO-001..006, catálogo VO-010.
- Pantallas (nombres tal cual los dicen los requisitos): Entrar, Mis reservas, Reservar, Socios, Inventario, Entregas y devoluciones, Multas, Historial.
