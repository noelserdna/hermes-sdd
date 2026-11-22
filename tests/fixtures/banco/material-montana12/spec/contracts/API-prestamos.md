# API-prestamos

| Field | Value |
|---|---|
| Module | API-002 |
| Style | operations |
| Auth | sesión del usuario; rol por operación (PERMISSIONS-MATRIX) |
| Refs | REQ-F-003, REQ-F-004, REQ-F-005, REQ-F-008, REQ-NF-003; UC-007..011, UC-017, UC-019; INV-RES-001..011, INV-MUL-001..004; ADR-001, ADR-002, ADR-004, ADR-005 |
| Errors | catálogo en `domain/03-VALUE-OBJECTS.md` § Error catalog |
| Transport | ver `design/OPERATION-MAPPING.md` |

## Operations

| ID | Operation | Actor | Input (VO) | Effect / post (INV) | Domain errors | UC |
|---|---|---|---|---|---|---|
| API-002-01 | reserve | socio | itemId (VO-001), quantity (VO-006), startDate, endDate (VO-005) | reserva Reservada con unidades apartadas cada día; si falla, nada creado (INV-RES-001..004, INV-MUL-002) | `E_ACCESO_DENEGADO`, `E_PAGINA_PROHIBIDA`, `E_MULTA_PENDIENTE`, `E_FECHA_PASADA`, `E_FECHA_FIN_ANTERIOR`, `E_FECHA_INVALIDA`, `E_MAX_DIAS`, `E_MAX_UNIDADES`, `E_CANTIDAD_INVALIDA`, `E_SIN_UNIDADES` | UC-007 |
| API-002-02 | listMyReservations | socio | — | filas solo de la sesión con estado y si se puede cancelar; sin cambios (INV-RES-010) | `E_PAGINA_PROHIBIDA`, `E_ACCESO_DENEGADO` | UC-008 |
| API-002-03 | cancelReservation | socio dueño | reservationId (VO-001) | Cancelada y unidades liberadas una sola vez (INV-RES-006, INV-RES-009) | `E_ACCESO_DENEGADO`, `E_YA_CANCELADA`, `E_EMPIEZA_HOY`, `E_YA_EMPEZADA` | UC-009 |
| API-002-04 | deliverReservation | encargado | reservationId (VO-001) | Prestada con `deliveredOn`; repetir avisa sin duplicar (INV-RES-007..009) | `E_ACCESO_DENEGADO`, `E_RESERVA_NO_ENCONTRADA`, `E_ANTES_DE_INICIO`, `E_NO_RECOGIDA`, `E_RESERVA_NO_ENTREGABLE`, `E_YA_ENTREGADA` | UC-010 |
| API-002-05 | returnLoan | encargado | reservationId (VO-001) | Devuelta con `returnedOn`; con retraso crea la multa Pendiente en la misma operación (INV-MUL-001, INV-MUL-004) | `E_ACCESO_DENEGADO`, `E_RESERVA_NO_ENCONTRADA`, `E_NO_PRESTADA`, `E_YA_DEVUELTA` | UC-011 |
| API-002-06 | getPanel | encargado | date? (VO-005) | listas por entregar, prestadas, que vuelven y con retraso (RN-018, RN-029); sin cambios | `E_PAGINA_PROHIBIDA`, `E_FECHA_INVALIDA` | UC-017 |
| API-002-07 | purgeOldRecords | sistema | today | sin registros cerrados anteriores a hoy − `RETENTION_YEARS` años; idempotente (INV-RES-011, RN-033) | — | UC-019 |

## Errors

| Code | Operations | Condition | Message (VO) |
|---|---|---|---|
| `E_MULTA_PENDIENTE` | 01 | el socio tiene una multa pendiente | VO-010 |
| `E_FECHA_PASADA` | 01 | inicio anterior a hoy | VO-010 |
| `E_FECHA_FIN_ANTERIOR` | 01 | fin anterior al inicio | VO-010 |
| `E_FECHA_INVALIDA` | 01, 06 | fecha vacía o no válida | VO-010 |
| `E_MAX_DIAS` | 01 | más de `MAX_RESERVATION_DAYS` días | VO-010 |
| `E_MAX_UNIDADES` | 01 | más de `MAX_UNITS_PER_RESERVATION` unidades | VO-010 |
| `E_CANTIDAD_INVALIDA` | 01 | cantidad no entera o menor que 1 | VO-010 |
| `E_SIN_UNIDADES` | 01 | algún día con menos libres que lo pedido | VO-010 |
| `E_YA_CANCELADA` | 03 | reserva ya cancelada | VO-010 |
| `E_EMPIEZA_HOY` | 03 | inicio = hoy | VO-010 |
| `E_YA_EMPEZADA` | 03 | inicio anterior a hoy | VO-010 |
| `E_RESERVA_NO_ENCONTRADA` | 04, 05 | la reserva no existe | VO-010 |
| `E_ANTES_DE_INICIO` | 04 | hoy anterior al inicio | VO-010 |
| `E_NO_RECOGIDA` | 04 | fin pasado sin entregar | VO-010 |
| `E_RESERVA_NO_ENTREGABLE` | 04 | reserva Cancelada o Devuelta | VO-010 |
| `E_YA_ENTREGADA` | 04 | reserva ya entregada | VO-010 |
| `E_NO_PRESTADA` | 05 | la reserva no está Prestada | VO-010 |
| `E_YA_DEVUELTA` | 05 | reserva ya devuelta | VO-010 |
| `E_ACCESO_DENEGADO` | 01..05 | operación fuera del rol o reserva ajena | VO-010 |
| `E_PAGINA_PROHIBIDA` | 01, 02, 06 | página fuera del rol | VO-010 |

## Requirement-mandated transport

| URL / mechanic | REQ | Operations |
|---|---|---|
| `/panel` abierto por socio o junta muestra «No tienes permiso para ver esta página» | REQ-F-008 | 06 |
