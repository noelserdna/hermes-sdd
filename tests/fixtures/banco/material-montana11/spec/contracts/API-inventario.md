# API-inventario

| Campo | Valor |
|---|---|
| Módulo | API-004 (operaciones `API-004-NN`) |
| Style | operations |
| Auth | sesión de encargado (INV-ACC-007) |
| Refs | REQ-F-008; UC-013, UC-014; INV-STK-001..005 |
| Errores | catálogo en `domain/03-VALUE-OBJECTS.md` § Catálogo de errores |
| Transporte | ver `design/OPERATION-MAPPING.md` |

## Operaciones

| ID | Operación | Actor | Entrada (VO) | Efecto / post (INV) | Errores de dominio | UC |
|---|---|---|---|---|---|---|
| API-004-01 | listarInventario | encargado | — | recuento de unidades en Alta por tipo y detalle con las De baja; sin escritura | `E_ACCESO_NO_PERMITIDO` | UC-013 |
| API-004-02 | anadirMaterial | encargado | tipo: TipoMaterial (VO-004), cantidad: Cantidad (VO-009) | crea `cantidad` unidades en Alta con número propio (INV-STK-001, INV-STK-002, RN-016) | `E_CANTIDAD_INVALIDA`, `E_MATERIAL_INVALIDO`, `E_DATOS_INVALIDOS`, `E_ACCESO_NO_PERMITIDO` | UC-013 |
| API-004-03 | darDeBajaUnidad | encargado | unidadId | unidad De baja; reservas Reservada canceladas con `M_RESERVAS_CANCELADAS_BAJA` (INV-STK-003..005) | `E_UNIDAD_PRESTADA`, `E_UNIDAD_NO_ENCONTRADA`, `E_ACCESO_NO_PERMITIDO` | UC-014 |

## Errores

| Código | Operaciones | Condición | Mensaje (VO) |
|---|---|---|---|
| `E_CANTIDAD_INVALIDA` | 02 | cantidad menor que 1 | VO-010 |
| `E_MATERIAL_INVALIDO` | 02 | tipo fuera de `MATERIAL_TYPES` | VO-010 |
| `E_DATOS_INVALIDOS` | 02 | cantidad o tipo ausente o mal formado | VO-010 |
| `E_UNIDAD_PRESTADA` | 03 | tiene una reserva Entregado | VO-010 |
| `E_UNIDAD_NO_ENCONTRADA` | 03 | no existe | VO-010 |
| `E_ACCESO_NO_PERMITIDO` | todas | rol distinto de encargado | VO-010 |
| `E_ALMACEN_NO_DISPONIBLE` | 02, 03 | el almacén no guarda | VO-010 |
