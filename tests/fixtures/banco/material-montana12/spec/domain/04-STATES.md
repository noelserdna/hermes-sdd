# 04 — State Machines

## SM-001: Reserva

| State | Initial | Final | Description |
|---|---|---|---|
| Reservada | Yes | No | Unidades apartadas, sin entregar |
| Prestada | No | No | Entregada, pendiente de devolver |
| Devuelta | No | Yes | Devolución marcada, unidades libres |
| Cancelada | No | Yes | Cancelada por el socio o por la baja |

| From | To | Trigger | Guard | Action / Events | Timeout |
|---|---|---|---|---|---|
| Reservada | Prestada | entregar (UC-010) | startDate ≤ hoy ≤ endDate (INV-RES-007) | registra `deliveredOn` | — |
| Reservada | Cancelada | cancelar (UC-009) / baja de socio (UC-006) | hoy < startDate (INV-RES-006); la baja cancela sin guarda | libera unidades | — |
| Prestada | Devuelta | devolver (UC-011) | — | registra `returnedOn`; crea multa si hay retraso (INV-MUL-001) | — |

Derivados, no guardados (ADR-002): **No recogida** = Reservada con endDate < hoy (libera unidades, INV-RES-008); **Retraso** = Prestada con endDate < hoy (INV-MUL-004).
Refs: INV-RES-005..009, UC-006, UC-009..011.

## SM-002: Multa

| State | Initial | Final | Description |
|---|---|---|---|
| Pendiente | Yes | No | Sin pagar; bloquea reservar |
| Pagada | No | Yes | Cobrada por el encargado |

| From | To | Trigger | Guard | Action / Events | Timeout |
|---|---|---|---|---|---|
| Pendiente | Pagada | marcar pagada (UC-013) | — | registra `paidOn`; levanta el bloqueo si no quedan pendientes (INV-MUL-003) | — |

Refs: INV-MUL-001..004, UC-011, UC-013.

## SM-003: Cuenta

| State | Initial | Final | Description |
|---|---|---|---|
| Provisional | Yes | No | Debe cambiar la contraseña |
| Activa | No | No | Uso normal |
| Baja | No | Yes | Desactivada, historial conservado |

| From | To | Trigger | Guard | Action / Events | Timeout |
|---|---|---|---|---|---|
| Provisional | Activa | cambiar contraseña (UC-004) | contraseña válida (INV-SOC-002) | `mustChangePassword` = false | — |
| Activa | Provisional | restablecer (UC-005) | — | nueva provisional | — |
| Provisional / Activa | Baja | dar de baja (UC-006) | sin préstamos ni multas (INV-SOC-007) | cancela reservas futuras | — |

Bloqueo de cuenta (INV-SOC-004) es un atributo temporal (`lockedUntil`), no un estado.
Refs: INV-SOC-004..008, UC-001, UC-004..006.
