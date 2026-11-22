# API-material

| Field | Value |
|---|---|
| Module | API-003 |
| Style | operations |
| Auth | sesión del usuario; altas y bajas solo encargado |
| Refs | REQ-F-007, REQ-F-003; UC-007, UC-015, UC-016; INV-MAT-001..004, INV-RES-004; ADR-001 |
| Errors | catálogo en `domain/03-VALUE-OBJECTS.md` § Error catalog |
| Transport | ver `design/OPERATION-MAPPING.md` |

## Operations

| ID | Operation | Actor | Input (VO) | Effect / post (INV) | Domain errors | UC |
|---|---|---|---|---|---|---|
| API-003-01 | addUnits | encargado | name, quantity (VO-006) | total del tipo aumentado; tipo nuevo si no existe, sin distinguir mayúsculas (INV-MAT-004) | `E_ACCESO_DENEGADO`, `E_PAGINA_PROHIBIDA`, `E_CANTIDAD_INVALIDA`, `E_NOMBRE_VACIO` | UC-015 |
| API-003-02 | withdrawUnits | encargado | itemId (VO-001), quantity (VO-006) | total reducido solo si cada día desde hoy `total − n ≥ ocupadas` (INV-MAT-001, INV-MAT-002) | `E_ACCESO_DENEGADO`, `E_PAGINA_PROHIBIDA`, `E_CANTIDAD_INVALIDA`, `E_BAJA_UNIDADES_INSUFICIENTES`, `E_BAJA_UNIDADES_NECESARIAS` | UC-016 |
| API-003-03 | listMaterial | sesión | — | tipos con total y `reservable` solo si total > 0 (INV-MAT-003); sin cambios | `E_ACCESO_DENEGADO` | UC-007, UC-015 |

## Errors

| Code | Operations | Condition | Message (VO) |
|---|---|---|---|
| `E_CANTIDAD_INVALIDA` | 01, 02 | cantidad no entera o menor que 1 | VO-010 |
| `E_NOMBRE_VACIO` | 01 | nombre vacío | VO-010 |
| `E_BAJA_UNIDADES_INSUFICIENTES` | 02 | n mayor que el total | VO-010 |
| `E_BAJA_UNIDADES_NECESARIAS` | 02 | unidades necesarias algún día (RN-017) | VO-010 |
| `E_ACCESO_DENEGADO` | 01..03 | operación fuera del rol | VO-010 |
| `E_PAGINA_PROHIBIDA` | 01, 02 | página fuera del rol | VO-010 |
