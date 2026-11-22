# API-prestamos

| Field | Value |
|---|---|
| Module | API-003 |
| Style | operations |
| Auth | sesión vigente (INV-ACC-008); roles en `PERMISSIONS-MATRIX.md` |
| Refs | REQ-F-005, REQ-F-006, REQ-F-007, REQ-F-009, REQ-F-010, REQ-NF-001; UC-005, UC-006, UC-007, UC-009, UC-010; WF-001; ADR-001, ADR-002 |
| Errors | catálogo en `domain/03-VALUE-OBJECTS.md` (VO-010) |
| Transport | ver `design/OPERATION-MAPPING.md` |

## Operations

| ID | Operation | Actor | Input (VO) | Effect / post (INV) | Domain errors | UC |
|---|---|---|---|---|---|---|
| API-003-01 | entregarReserva | encargado | reservaId, unidadId | reserva Prestada con esa unidad; repetir no asigna otra (INV-LOA-001, INV-LOA-002, INV-LOA-301, RN-020) | `E_RESERVA_NO_ENCONTRADA`, `E_ENTREGA_ANTICIPADA`, `E_RESERVA_NO_ENTREGABLE`, `E_UNIDAD_NO_DISPONIBLE` | UC-005 |
| API-003-02 | devolverPrestamo | encargado | reservaId | Devuelta; multa Pendiente si hay retraso; repetir no duplica (INV-LOA-003, INV-LOA-004, RN-009) | `E_RESERVA_NO_ENCONTRADA`, `E_RESERVA_NO_PRESTADA` | UC-006 |
| API-003-03 | pagarMulta | encargado | multaId | multa Pagada con su fecha; repetir no cambia nada (INV-LOA-005) | `E_SIN_PERMISO`, `E_MULTA_NO_ENCONTRADA` | UC-007 |
| API-003-04 | listarMultas | encargado | — | todas las multas (pantalla Multas); sin cambios | `E_SIN_PERMISO` | UC-007 |
| API-003-05 | consultarEntregasYDevoluciones | encargado, junta (solo lectura) | — | prestado, vuelve hoy, con retraso, entregar hoy (RN-022); sin cambios (INV-LOA-401) | `E_SIN_PERMISO` | UC-009 |
| API-003-06 | consultarHistorial | junta, encargado | socioId | reservas con estado y multas del socio (RN-012, RN-024); sin cambios (INV-LOA-402) | `E_SIN_PERMISO`, `E_SOCIO_NO_ENCONTRADO` | UC-010 |
| API-003-07 | resolverNoRecogidas | sistema | — | Reservada con hoy posterior a `hasta` pasa a No recogida, sin multa; idempotente (INV-RES-007, RN-008) | — | UC-005 |
| API-003-08 | purgarRegistrosAntiguos | sistema (limpieza diaria) | — | borra préstamos y multas cerrados hace más de `RETENTION_YEARS` años; nunca multas Pendientes (INV-LOA-006, RN-013) | — | REQ-NF-001 |

## Errors

| Code | Operations | Condition | Message (VO) |
|---|---|---|---|
| `E_SIN_PERMISO` | 03, 04, 05, 06 | rol no permitido | VO-010 |
| `E_RESERVA_NO_ENCONTRADA` | 01, 02 | la reserva no existe | VO-010 |
| `E_ENTREGA_ANTICIPADA` | 01 | hoy anterior a `desde` | VO-010 |
| `E_RESERVA_NO_ENTREGABLE` | 01 | reserva Devuelta, Cancelada o No recogida | VO-010 |
| `E_UNIDAD_NO_DISPONIBLE` | 01 | unidad inexistente, de otro tipo, DeBaja u ocupada | VO-010 |
| `E_RESERVA_NO_PRESTADA` | 02 | la reserva no está Prestada | VO-010 |
| `E_MULTA_NO_ENCONTRADA` | 03 | la multa no existe | VO-010 |
| `E_SOCIO_NO_ENCONTRADO` | 06 | el socio elegido no existe | VO-010 |
| `E_ALMACEN_NO_DISPONIBLE` | todas | el almacén no puede leerse o escribirse; sin cambios | VO-010 |
