# WF-001 — Ciclo de un préstamo

| Field | Value |
|---|---|
| Trigger | un socio reserva material (UC-007) |
| Total timeout | — (proceso de días; la reserva dura hasta `MAX_RESERVATION_DAYS` días) |
| Actors | socio, encargado |
| Refs | REQ-F-003, REQ-F-004, REQ-F-005, REQ-F-006; UC-007, UC-009, UC-010, UC-011, UC-013; SM-001, SM-002; INV-RES-004, INV-MUL-001..003; ADR-004, ADR-005 |

## Steps

| # | Name | Type | Timeout | Retry | Input → Output | On failure | Compensation |
|---|---|---|---|---|---|---|---|
| 1 | Reservar (UC-007) | manual | — | — | itemId, quantity, fechas → Reservada | `E_SIN_UNIDADES`, `E_MULTA_PENDIENTE`, validaciones: nada se crea | — |
| 2 | Cancelar, opcional (UC-009) | manual | — | — | reservationId → Cancelada | `E_EMPIEZA_HOY`, `E_YA_EMPEZADA`: sigue Reservada | libera unidades |
| 3 | Entregar (UC-010) | manual | — | — | reservationId → Prestada | `E_ANTES_DE_INICIO`, `E_NO_RECOGIDA`: no se entrega | — |
| 4 | Devolver (UC-011) | manual | — | — | reservationId → Devuelta | `E_NO_PRESTADA`: sin cambios | — |
| 5 | Multa por retraso (UC-011) | sync | — | — | retraso > 0 → multa Pendiente | — | — |
| 6 | Pagar la multa (UC-013) | manual | — | — | fineId → Pagada | `E_MULTA_YA_PAGADA`: sin cambios | — |
| 7 | Se levanta el bloqueo (UC-013, UC-007) | sync | — | — | sin Pendientes → el socio vuelve a reservar | — | — |

## Navigation

| # | Screen | Actor | How to get there | What the user does |
|---|---|---|---|---|
| 1 | Reservar | socio | entrada «Reservar» del menú | elige material, cantidad y fechas y envía |
| 2 | Mis reservas | socio | entrada «Mis reservas» | pulsa «Cancelar» en la fila |
| 3 | Panel del encargado | encargado | página de inicio tras entrar | pulsa «Entregar» en «Por entregar» |
| 4 | Panel del encargado | encargado | página de inicio | marca la devolución del préstamo |
| 5 | Multas | encargado | entrada «Multas» | ve la multa creada |
| 6 | Multas | encargado | entrada «Multas» | pulsa «Marcar pagada» |
| 7 | Mis multas | socio | entrada «Mis multas» | comprueba que no tiene multas pendientes |

## Error scenarios

| Error | Step | Action | Result state |
|---|---|---|---|
| `E_ALMACEN_NO_DISPONIBLE` | 1..6 | abortar, avisar | sin cambios |
| `E_ACCESO_DENEGADO` | 3, 4, 6 | abortar | sin cambios |

## Events emitted
None.

## Metrics
None.
