# API-reservas

| Field | Value |
|---|---|
| Module | API-002 |
| Style | operations |
| Auth | sesión vigente (INV-ACC-008); roles en `PERMISSIONS-MATRIX.md` |
| Refs | REQ-F-003, REQ-F-004; UC-003, UC-004; WF-001; ADR-001, ADR-002 |
| Errors | catálogo en `domain/03-VALUE-OBJECTS.md` (VO-010) |
| Transport | ver `design/OPERATION-MAPPING.md` |

## Operations

| ID | Operation | Actor | Input (VO) | Effect / post (INV) | Domain errors | UC |
|---|---|---|---|---|---|---|
| API-002-01 | reservarMaterial | socio | tipo: TipoMaterial (VO-004), desde: Fecha (VO-003), hasta: Fecha | reserva Reservada creada o la idéntica devuelta; indivisible por tipo (INV-RES-001..005, RN-004, RN-017, RN-018) | `E_SIN_PERMISO`, `E_TIPO_INVALIDO`, `E_FECHA_PASADA`, `E_FECHAS_INVERTIDAS`, `E_RESERVA_MUY_LARGA`, `E_MULTA_PENDIENTE`, `E_SIN_UNIDADES_LIBRES` | UC-003 |
| API-002-02 | listarMisReservas | socio | — | reservas y multas solo del socio; No recogida derivada (INV-RES-007, INV-ACC-009); sin cambios | — | UC-004 |
| API-002-03 | cancelarReserva | socio | reservaId | Cancelada y unidades liberadas; repetir no cambia nada (INV-RES-006, INV-RES-008, RN-019) | `E_RESERVA_NO_ENCONTRADA`, `E_SIN_PERMISO_CANCELAR`, `E_CANCELACION_TARDIA` | UC-004 |

## Errors

| Code | Operations | Condition | Message (VO) |
|---|---|---|---|
| `E_SIN_PERMISO` | 01 | rol distinto de socio | VO-010 |
| `E_TIPO_INVALIDO` | 01 | tipo fuera de `TIPOS_MATERIAL` | VO-010 |
| `E_FECHA_PASADA` | 01 | `desde` anterior a hoy | VO-010 |
| `E_FECHAS_INVERTIDAS` | 01 | `hasta` anterior a `desde` | VO-010 |
| `E_RESERVA_MUY_LARGA` | 01 | más de `RESERVA_MAX_DAYS` días | VO-010 |
| `E_MULTA_PENDIENTE` | 01 | el socio tiene una multa Pendiente | VO-010 |
| `E_SIN_UNIDADES_LIBRES` | 01 | algún día sin unidad libre (también con concurrencia) | VO-010 |
| `E_RESERVA_NO_ENCONTRADA` | 03 | la reserva no existe | VO-010 |
| `E_SIN_PERMISO_CANCELAR` | 03 | la reserva es de otro socio | VO-010 |
| `E_CANCELACION_TARDIA` | 03 | hoy no es anterior a `desde` | VO-010 |
| `E_ALMACEN_NO_DISPONIBLE` | todas | el almacén no puede leerse o escribirse; sin cambios | VO-010 |
