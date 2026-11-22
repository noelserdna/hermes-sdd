# 04 — Máquinas de estados

## SM-001: Reserva

| Estado | Inicial | Final | Descripción |
|---|---|---|---|
| Reservada | Sí | No | Unidad reservada, aún no entregada |
| Entregado | No | No | Unidad fuera del almacén (préstamo) |
| Devuelto | No | Sí | Unidad devuelta |
| Cancelada | No | Sí | Anulada; la unidad queda libre |
| No recogida | No | Sí | No se recogió el día de inicio; unidad libre |

| Desde | A | Disparador | Guarda | Acción | Plazo |
|---|---|---|---|---|---|
| Reservada | Entregado | entrega del encargado | hoy = inicio (INV-LOA-001) | anota `entregadaEl` | — |
| Reservada | Cancelada | socio cancela | inicio > hoy (INV-RES-006) | anota `canceladaEl`, libera unidad | — |
| Reservada | Cancelada | baja de unidad o de socio | — (INV-STK-005) | libera unidad | — |
| Reservada | No recogida | paso de día | hoy > inicio (INV-LOA-002) | libera unidad | día siguiente al inicio |
| Entregado | Devuelto | devolución del encargado | — (INV-LOA-003) | anota `devueltaEl`; multa si procede (INV-FIN-001) | — |

Ocupan la unidad: Reservada y Entregado (INV-RES-001). Refs: UC-005..UC-010.

## SM-002: Multa

| Estado | Inicial | Final | Descripción |
|---|---|---|---|
| Pendiente | Sí | No | Impide reservar |
| Pagada | No | Sí | Pago anotado por el encargado |

| Desde | A | Disparador | Guarda | Acción | Plazo |
|---|---|---|---|---|---|
| Pendiente | Pagada | encargado marca pagada | — | anota `pagadaEl` (INV-FIN-003) | — |

Refs: INV-FIN-001..004, UC-010, UC-012.

## SM-003: Unidad

| Estado | Inicial | Final | Descripción |
|---|---|---|---|
| Alta | Sí | No | Disponible para reservar (prestada si tiene una reserva Entregado) |
| De baja | No | Sí | Rota o retirada |

| Desde | A | Disparador | Guarda | Acción | Plazo |
|---|---|---|---|---|---|
| Alta | De baja | encargado da de baja | sin reserva Entregado (INV-STK-003) | cancela reservas Reservada (INV-STK-005) | — |

## SM-004: Cuenta

| Estado | Inicial | Final | Descripción |
|---|---|---|---|
| Activa | Sí | No | Puede entrar (salvo bloqueo temporal) |
| Baja | No | Sí | No puede entrar (INV-ACC-006) |

| Desde | A | Disparador | Guarda | Acción | Plazo |
|---|---|---|---|---|---|
| Activa | Activa (bloqueada) | 5.º fallo seguido | — | fija `bloqueadaHasta` | `LOCK_MINUTES` |
| Activa | Baja | encargado da de baja | sin material sin devolver (INV-LOA-004) | cancela reservas Reservada | — |
