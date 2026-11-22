# WF-001 — Ciclo de un préstamo

| Field | Value |
|---|---|
| Trigger | un socio reserva material |
| Total timeout | — (dura hasta `RESERVA_MAX_DAYS` días más el retraso) |
| Actors | Socio, Encargado, reloj (ADR-001) |
| Refs | REQ-F-003..REQ-F-007, REQ-F-009; UC-003..UC-007, UC-009; SM-001, SM-002; INV-RES-004, INV-LOA-004 |

## Steps

| # | Name | Type | Timeout | Retry | Input → Output | On failure | Compensation |
|---|---|---|---|---|---|---|---|
| 1 | reservar (UC-003) | sync | — | — | tipo, desde, hasta → Reserva `Reservada` | abort con error | — |
| 2 | cancelar (UC-004) | sync | hasta el día antes de `desde` | — | reservaId → `Cancelada` | abort con `E_CANCELACION_TARDIA` | libera unidades |
| 3 | entregar (UC-005) | manual | desde `desde` | — | reservaId, unidadId → `Prestada` | abort con error | — |
| 4 | marcar No recogida (UC-005) | sync | al pasar `hasta` | — | Reservada vencida → `No recogida` | — | libera unidades |
| 5 | devolver (UC-006) | manual | — | — | reservaId → `Devuelta` | abort con `E_RESERVA_NO_PRESTADA` | — |
| 6 | poner multa (UC-006) | sync | — | — | días de retraso → Multa `Pendiente` | — | — |
| 7 | pagar multa (UC-007) | manual | — | — | multaId → `Pagada` | abort con `E_MULTA_NO_ENCONTRADA` | desbloquea reservar |

## Navigation

| # | Screen | Actor | How to get there | What the user does |
|---|---|---|---|---|
| 1 | Reservar | Socio | menú Reservar | elige tipo y fechas |
| 2 | Mis reservas | Socio | menú Mis reservas | cancela una reserva |
| 3 | Entregas y devoluciones | Encargado | menú Entregas y devoluciones | marca entregada con su unidad |
| 5 | Entregas y devoluciones | Encargado | menú Entregas y devoluciones | marca devuelta |
| 7 | Multas | Encargado | menú Multas | marca pagada |

## Error scenarios

| Error | Step | Action | Result state |
|---|---|---|---|
| `E_SIN_UNIDADES_LIBRES` | 1 | abort | sin reserva |
| `E_ENTREGA_ANTICIPADA` | 3 | abort | sigue Reservada |
| `E_ALMACEN_NO_DISPONIBLE` | todos | abort | sin cambios |

## Events emitted
None.
