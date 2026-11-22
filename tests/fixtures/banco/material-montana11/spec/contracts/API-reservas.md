# API-reservas

| Campo | Valor |
|---|---|
| Módulo | API-002 (operaciones `API-002-NN`) |
| Style | operations |
| Auth | sesión de socio; cada socio solo ve y toca lo suyo (INV-SEC-001) |
| Refs | REQ-F-003, REQ-F-004; UC-005..UC-007; WF-001; RN-001, RN-011; ADR-005 |
| Errores | catálogo en `domain/03-VALUE-OBJECTS.md` § Catálogo de errores |
| Transporte | ver `design/OPERATION-MAPPING.md` |

## Operaciones

| ID | Operación | Actor | Entrada (VO) | Efecto / post (INV) | Errores de dominio | UC |
|---|---|---|---|---|---|---|
| API-002-01 | consultarDisponibilidad | socio | material: TipoMaterial (VO-004), inicio, fin: Fecha (VO-001) | unidades libres en el rango (RN-001); no escribe | `E_NO_AUTENTICADO` | UC-005 |
| API-002-02 | reservarMaterial | socio | material, inicio, fin | reserva Reservada con la unidad libre de menor número (INV-RES-001..005, RN-001); repetir el envío no duplica (RN-011); mensaje `M_RESERVA_CREADA` | `E_FECHA_PASADA`, `E_FECHAS_INVERTIDAS`, `E_RESERVA_MUY_LARGA`, `E_MULTA_PENDIENTE`, `E_SIN_UNIDADES`, `E_MATERIAL_INVALIDO`, `E_DATOS_INVALIDOS`, `E_ACCESO_NO_PERMITIDO` | UC-005 |
| API-002-03 | listarMisReservas | socio | — | solo reservas propias; aplica No recogida (RN-004, INV-SEC-001) | `E_NO_AUTENTICADO` | UC-006 |
| API-002-04 | cancelarReserva | socio | reservaId | Cancelada y unidad libre (INV-RES-006); repetir no cambia nada (INV-RES-007); mensaje `M_RESERVA_CANCELADA` | `E_CANCELACION_TARDIA`, `E_RESERVA_NO_ENCONTRADA`, `E_ESTADO_INVALIDO` | UC-007 |

## Errores

| Código | Operaciones | Condición | Mensaje (VO) |
|---|---|---|---|
| `E_NO_AUTENTICADO` | 01, 03 | sin sesión | VO-010 |
| `E_DATOS_INVALIDOS` | 02 | campos vacíos o fecha mal formada | VO-010 |
| `E_MATERIAL_INVALIDO` | 02 | tipo fuera de `MATERIAL_TYPES` | VO-010 |
| `E_FECHA_PASADA` | 02 | `inicio` anterior a hoy | VO-010 |
| `E_FECHAS_INVERTIDAS` | 02 | `fin` anterior a `inicio` | VO-010 |
| `E_RESERVA_MUY_LARGA` | 02 | más de `RESERVATION_MAX_DAYS` días | VO-010 |
| `E_MULTA_PENDIENTE` | 02 | el socio tiene una multa Pendiente | VO-010 |
| `E_SIN_UNIDADES` | 02 | ninguna unidad libre en todo el rango | VO-010 |
| `E_RESERVA_NO_ENCONTRADA` | 04 | no existe o es de otro socio | VO-010 |
| `E_CANCELACION_TARDIA` | 04 | `inicio` no posterior a hoy | VO-010 |
| `E_ESTADO_INVALIDO` | 04 | la reserva no está Reservada ni Cancelada | VO-010 |
| `E_ACCESO_NO_PERMITIDO` | 02, 04 | rol distinto de socio | VO-010 |
| `E_ALMACEN_NO_DISPONIBLE` | todas | el almacén no lee o no guarda | VO-010 |
