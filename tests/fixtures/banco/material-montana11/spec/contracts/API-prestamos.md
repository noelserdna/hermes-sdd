# API-prestamos

| Campo | Valor |
|---|---|
| Módulo | API-003 (operaciones `API-003-NN`) |
| Style | operations |
| Auth | sesión; rol por operación (PERMISSIONS-MATRIX) |
| Refs | REQ-F-005, REQ-F-006, REQ-F-007, REQ-F-009, REQ-F-010; UC-008..UC-012, UC-015, UC-016; WF-001; RN-003, RN-004, RN-009 |
| Errores | catálogo en `domain/03-VALUE-OBJECTS.md` § Catálogo de errores |
| Transporte | ver `design/OPERATION-MAPPING.md` |

## Operaciones

| ID | Operación | Actor | Entrada (VO) | Efecto / post (INV) | Errores de dominio | UC |
|---|---|---|---|---|---|---|
| API-003-01 | entregarReserva | encargado | reservaId | Reservada → Entregado con `entregadaEl` = hoy (INV-LOA-001) | `E_RESERVA_NO_ENCONTRADA`, `E_ENTREGA_ANTICIPADA`, `E_ESTADO_INVALIDO`, `E_ACCESO_NO_PERMITIDO` | UC-008 |
| API-003-02 | registrarDevolucion | encargado | reservaId | Entregado → Devuelto con `devueltaEl` = hoy; invoca API-003-05 en la misma escritura; repetir conserva la primera fecha (INV-LOA-003) | `E_RESERVA_NO_ENCONTRADA`, `E_ESTADO_INVALIDO`, `E_ACCESO_NO_PERMITIDO` | UC-009 |
| API-003-03 | marcarNoRecogidas | sistema | — | Reservada con `inicio` anterior a hoy → No recogida y libera la unidad (INV-LOA-002, RN-004); idempotente; se aplica al leer o escribir | — | UC-008 |
| API-003-04 | listarPrestamosYReservas | encargado | — | aplica API-003-03 y lista reservas y préstamos con estado | `E_ACCESO_NO_PERMITIDO` | UC-008 |
| API-003-05 | aplicarMultaPorRetraso | sistema | reservaId | si `devueltaEl` > `fin` crea multa Pendiente de `FINE_PER_DAY_EUR` × días (INV-FIN-001, INV-FIN-002) | — | UC-010 |
| API-003-06 | listarMisMultas | socio | — | multas propias con importe y estado (INV-SEC-001, RN-015) | `E_NO_AUTENTICADO`, `E_ACCESO_NO_PERMITIDO` | UC-011 |
| API-003-07 | listarMultas | encargado | — | todas las multas con socio, importe y estado | `E_ACCESO_NO_PERMITIDO` | UC-012 |
| API-003-08 | marcarMultaPagada | encargado | multaId | Pendiente → Pagada con `pagadaEl` (INV-FIN-003); desbloquea si no queda otra Pendiente | `E_MULTA_NO_ENCONTRADA`, `E_ACCESO_NO_PERMITIDO` | UC-012 |
| API-003-09 | consultarPrestado | encargado | dia?: Fecha (VO-001) | préstamos actuales con retraso y devoluciones del día; sin escritura | `E_DATOS_INVALIDOS`, `E_ACCESO_NO_PERMITIDO` | UC-015 |
| API-003-10 | consultarHistorialSocio | junta | socioId | préstamos y multas de ese socio; sin escritura (INV-SEC-002) | `E_SOCIO_NO_ENCONTRADO`, `E_ACCESO_NO_PERMITIDO` | UC-016 |

## Errores

| Código | Operaciones | Condición | Mensaje (VO) |
|---|---|---|---|
| `E_NO_AUTENTICADO` | 06 | sin sesión | VO-010 |
| `E_RESERVA_NO_ENCONTRADA` | 01, 02 | no existe | VO-010 |
| `E_ENTREGA_ANTICIPADA` | 01 | hoy anterior a `inicio` | VO-010 |
| `E_ESTADO_INVALIDO` | 01, 02 | el estado no admite la acción (incluye al segundo encargado) | VO-010 |
| `E_MULTA_NO_ENCONTRADA` | 08 | no existe | VO-010 |
| `E_SOCIO_NO_ENCONTRADO` | 10 | no existe | VO-010 |
| `E_DATOS_INVALIDOS` | 09 | día mal formado | VO-010 |
| `E_ACCESO_NO_PERMITIDO` | 01, 02, 04, 06..10 | rol no permitido | VO-010 |
| `E_ALMACEN_NO_DISPONIBLE` | todas | el almacén no lee o no guarda | VO-010 |
