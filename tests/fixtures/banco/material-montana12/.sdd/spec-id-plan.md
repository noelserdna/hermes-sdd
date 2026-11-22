# Spec id plan — material-montana12 — 2026-11-22   (working file; not part of spec/)
Mode: fanout · lanes: R1 R2 R3 X · model: sonnet · idioma: español (ids/código en inglés)
Líneas de requirements/REQUIREMENTS.md: F-001 25-52, F-002 54-92, F-003 94-125, F-004 127-152, F-005 154-190, F-006 192-220, F-007 222-245, F-008 247-271, F-009 273-291, NF-001 295-308, NF-002 310-322, NF-003 324-336, C-001 340-346, C-002 348-354, Supuestos 356-374. Cabecera/roles: 1-21.

| Lane | REQs | UC ids + título | AC | API operaciones | INV mint | NC mint |
|---|---|---|---|---|---|---|
| R1 | F-001, F-002, F-009 | UC-001 Entrar; UC-002 Salir; UC-003 Dar de alta socio; UC-004 Cambiar contraseña provisional; UC-005 Restablecer contraseña de socio; UC-006 Dar de baja socio; UC-018 Consultar historial de un socio | AC-001-NN … AC-006-NN, AC-018-NN | API-001-01..08 (ver abajo) | INV-{AREA}-1NN | NC-1NN |
| R2 | F-003, F-004, F-007 | UC-007 Reservar material; UC-008 Ver mis reservas; UC-009 Cancelar reserva; UC-015 Añadir unidades de material; UC-016 Retirar unidades rotas | AC-007-NN … AC-009-NN, AC-015-NN, AC-016-NN | API-002-01..03; API-003-01..03 | INV-{AREA}-2NN | NC-2NN |
| R3 | F-005, F-006, F-008, NF-003 | UC-010 Entregar reserva; UC-011 Recibir devolución; UC-012 Ver mis multas; UC-013 Marcar multa pagada; UC-014 Ver todas las multas; UC-017 Ver panel del encargado; UC-019 Depurar historial antiguo | AC-010-NN … AC-014-NN, AC-017-NN, AC-019-NN | API-002-04..07; API-004-01..03 | INV-{AREA}-3NN | NC-3NN |
| X | NF-001, NF-002, NF-003(límites), C-001, C-002 | — | — | — | INV-SEC-4NN | NC-4NN |
| main | — | — | — | cabeceras, índices, tablas Errors | INV-{AREA}-0NN | NC-0NN |

## Operaciones (Style operations en los 4 módulos)
API-001 `cuentas` (contracts/API-cuentas.md): 01 login (R1) · 02 logout (R1) · 03 changePassword (R1) · 04 registerMember (R1) · 05 resetMemberPassword (R1) · 06 removeMember (R1) · 07 getMemberHistory (R1, junta) · 08 authorize(sesión, rol/página) (R1; la usan todas las UC)
API-002 `prestamos` (contracts/API-prestamos.md): 01 reserve (R2) · 02 listMyReservations (R2) · 03 cancelReservation (R2) · 04 deliverReservation (R3) · 05 returnLoan (R3; crea multa → fila en API-004) · 06 getPanel (R3) · 07 purgeOldRecords (R3, sistema)
API-003 `material` (contracts/API-material.md): 01 addUnits (R2, incluye tipo nuevo) · 02 withdrawUnits (R2) · 03 listMaterial (R2; total + reservable)
API-004 `multas` (contracts/API-multas.md): 01 listMyFines (R3) · 02 payFine (R3) · 03 listFines (R3, encargado)
Transporte exigido por REQ (citar REQ): `/mis-reservas` (REQ-F-001 AC8), `/panel` (REQ-F-008 AC6/7). El resto de rutas/verbos va a design/.

## Esqueletos fijos — cita estos ids, nunca inventes otros
- WF-001 Ciclo de un préstamo. Pasos: 1 reservar (UC-007) · 2 cancelar opcional (UC-009) · 3 entregar (UC-010) · 4 devolver (UC-011) · 5 multa por retraso (UC-011) · 6 pagar multa (UC-013) · 7 se levanta el bloqueo (UC-013, UC-007).
- WF-002 Alta y primer acceso de un socio. Pasos: 1 alta (UC-003) · 2 primer acceso con provisional (UC-001) · 3 cambio de contraseña (UC-004) · 4 primera reserva (UC-007). Olvido: UC-005 repite 2-3.
- ADR-001 la disponibilidad se calcula por día desde las reservas · ADR-002 «No recogida» y «Retraso» son estados derivados, no guardados · ADR-003 baja lógica de socios · ADR-004 la multa se crea al marcar la devolución · ADR-005 operaciones repetidas son idempotentes («Ya estaba …») (owner X).
- SM-001 Reserva (Reservada, Prestada, Devuelta, Cancelada; derivado No recogida) · SM-002 Multa (Pendiente, Pagada) · SM-003 Cuenta (Provisional, Activa, Bloqueada temporal, Baja).
- ENT-001 Socio(cuenta) · ENT-002 Material (tipo) · ENT-003 Reserva (con entrega/devolución = préstamo) · ENT-004 Multa. VO-001.. ver 03.
- Áreas INV: SOC (cuentas y acceso), RES (reservas y disponibilidad), MUL (multas), MAT (material), SEC (permisos y datos personales).
- Códigos de error: catálogo en domain/03; si necesitas uno nuevo, devuélvelo en `errs` con new:true.
