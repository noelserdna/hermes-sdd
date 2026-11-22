# 04 — Máquinas de estados

## SM-001: Reserva

| Estado | Inicial | Final | Descripción |
|---|---|---|---|
| Reservada | Sí | No | Creada; ocupa una unidad libre cada día |
| Prestada | No | No | Entregada con unidad asignada |
| Devuelta | No | Sí | Material devuelto |
| Cancelada | No | Sí | Cancelada por el socio; libera unidades |
| No recogida | No | Sí | No entregada al acabar `hasta`; libera unidades |

| Desde | A | Disparador | Guarda | Acción |
|---|---|---|---|---|
| Reservada | Prestada | entregar (API-003-01) | hoy ≥ desde; unidad libre válida | asigna unidad (INV-LOA-001, INV-LOA-002) |
| Reservada | Cancelada | cancelar (API-002-03) | hoy < desde; dueño | libera unidades (INV-RES-006) |
| Reservada | No recogida | paso del tiempo | hoy > hasta | libera unidades, sin multa (INV-RES-007, RN-008) |
| Prestada | Devuelta | devolver (API-003-02) | — | fija `devueltaEl`; crea multa si hay retraso (INV-LOA-004) |

## SM-002: Multa

| Estado | Inicial | Final | Descripción |
|---|---|---|---|
| Pendiente | Sí | No | Impagada; bloquea reservar al socio |
| Pagada | No | Sí | Cobrada por el encargado |

| Desde | A | Disparador | Guarda | Acción |
|---|---|---|---|---|
| Pendiente | Pagada | pagar (API-003-03) | — | fija `pagadaEl` (INV-LOA-005) |

## SM-003: Unidad

| Estado | Inicial | Final | Descripción |
|---|---|---|---|
| Activa | Sí | No | Se puede reservar y entregar |
| DeBaja | No | Sí | Rota; fuera del inventario |

| Desde | A | Disparador | Guarda | Acción |
|---|---|---|---|---|
| Activa | DeBaja | dar de baja (API-004-02) | no Prestada | deja de contar como libre (INV-STK-001, INV-STK-002) |

## SM-004: Cuenta

| Estado | Inicial | Final | Descripción |
|---|---|---|---|
| Activa | Sí | No | Puede entrar (salvo bloqueo temporal) |
| Baja | No | Sí | No puede entrar |

| Desde | A | Disparador | Guarda | Acción |
|---|---|---|---|---|
| Activa | Baja | dar de baja (API-001-04) | sin préstamo en curso ni multa pendiente | impide entrar (INV-ACC-006, INV-ACC-007) |

Refs: UC-003..UC-008, INV-RES-*, INV-LOA-*.
