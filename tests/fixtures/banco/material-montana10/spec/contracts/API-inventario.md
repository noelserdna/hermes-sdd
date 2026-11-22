# API-inventario

| Field | Value |
|---|---|
| Module | API-004 |
| Style | operations |
| Auth | sesión vigente (INV-ACC-008); roles en `PERMISSIONS-MATRIX.md` |
| Refs | REQ-F-008; UC-008; ADR-002 |
| Errors | catálogo en `domain/03-VALUE-OBJECTS.md` (VO-010) |
| Transport | ver `design/OPERATION-MAPPING.md` |

## Operations

| ID | Operation | Actor | Input (VO) | Effect / post (INV) | Domain errors | UC |
|---|---|---|---|---|---|---|
| API-004-01 | anadirUnidades | encargado | tipo: TipoMaterial (VO-004), cantidad ≥ 1 | suma `cantidad` unidades Activas en cada llamada (INV-STK-003, INV-STK-004) | `E_SIN_PERMISO`, `E_TIPO_INVALIDO`, `E_CANTIDAD_INVALIDA` | UC-008 |
| API-004-02 | darDeBajaUnidad | encargado | unidadId | unidad DeBaja; repetir no cambia nada (INV-STK-001, INV-STK-002, RN-011) | `E_SIN_PERMISO`, `E_UNIDAD_NO_ENCONTRADA`, `E_BAJA_UNIDAD_PRESTADA` | UC-008 |
| API-004-03 | listarInventario | encargado | — | por tipo, unidades Activas y cada unidad con su estado; sin cambios | `E_SIN_PERMISO` | UC-008 |

## Errors

| Code | Operations | Condition | Message (VO) |
|---|---|---|---|
| `E_SIN_PERMISO` | 01, 02, 03 | rol distinto de encargado | VO-010 |
| `E_TIPO_INVALIDO` | 01 | tipo fuera de `TIPOS_MATERIAL` | VO-010 |
| `E_CANTIDAD_INVALIDA` | 01 | cantidad no entera o menor que 1 | VO-010 |
| `E_UNIDAD_NO_ENCONTRADA` | 02 | la unidad no existe | VO-010 |
| `E_BAJA_UNIDAD_PRESTADA` | 02 | la unidad está Prestada | VO-010 |
| `E_ALMACEN_NO_DISPONIBLE` | todas | el almacén no puede leerse o escribirse; sin cambios | VO-010 |
