# WF-001 — Ciclo del préstamo

| Campo | Valor |
|---|---|
| Disparador | un socio quiere material para unas fechas |
| Actores | socio, encargado |
| Refs | REQ-F-003..REQ-F-007, REQ-F-009; UC-001, UC-005..UC-012; INV-RES-001, INV-LOA-001, INV-FIN-001; RN-003, RN-004 |

## Pasos

| # | Nombre | Tipo | Entrada → Salida | Si falla | Compensación |
|---|---|---|---|---|---|
| 1 | Entrar (UC-001) | sync | credenciales → sesión | `E_CREDENCIALES_INVALIDAS`, `E_CUENTA_BLOQUEADA`: no hay sesión | — |
| 2 | Reservar (UC-005) | sync | material + rango → reserva Reservada | `E_SIN_UNIDADES`, `E_MULTA_PENDIENTE`, fechas: no se crea | — |
| 3 | Ver o cancelar (UC-006, UC-007) | manual | reserva → Cancelada | `E_CANCELACION_TARDIA`: se conserva | libera la unidad |
| 4 | Entregar o No recogida (UC-008) | manual | reserva → Entregado, o No recogida al pasar `inicio` | `E_ENTREGA_ANTICIPADA`: sin cambios | No recogida libera la unidad |
| 5 | Devolver (UC-009) | manual | Entregado → Devuelto | `E_ESTADO_INVALIDO`: sin cambios | — |
| 6 | Multa por retraso (UC-010) | sync | devolución tardía → multa Pendiente | — | — |
| 7 | Pagar multa (UC-012) | manual | multa Pendiente → Pagada | `E_MULTA_NO_ENCONTRADA`: sin cambios | — |
| 8 | Volver a reservar (UC-005) | sync | sin multa Pendiente → reserva | `E_MULTA_PENDIENTE` mientras quede alguna | — |

## Navegación

| # | Pantalla | Rol | Cómo llegar | Qué hace |
|---|---|---|---|---|
| 1 | Entrar | cualquiera | dirección de la web | escribe correo y contraseña |
| 2 | Reservar | socio | menú del Inicio del socio | elige material y fechas |
| 3 | Mis reservas | socio | menú del Inicio del socio | consulta y cancela |
| 4 | Préstamos | encargado | menú del Panel del encargado | marca Entregar |
| 5 | Préstamos | encargado | menú del Panel del encargado | marca Devolver |
| 6 | Multas | encargado | menú del Panel del encargado | ve la multa creada |
| 7 | Multas | encargado | menú del Panel del encargado | marca Pagada |
| 8 | Mis multas | socio | menú del Inicio del socio | consulta sus multas |

## Escenarios de error

| Error | Paso | Acción | Estado resultante |
|---|---|---|---|
| `E_ALMACEN_NO_DISPONIBLE` | 2..7 | se cancela la escritura entera (INV-SEC-003); se reintenta | sin cambios |
| `E_NO_AUTENTICADO` | 2..8 | se muestra Entrar | sin cambios |

## Eventos emitidos
None.

## Métricas
None.
