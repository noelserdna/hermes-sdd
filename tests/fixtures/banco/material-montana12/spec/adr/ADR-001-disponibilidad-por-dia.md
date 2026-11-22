# ADR-001 — La disponibilidad se calcula por día desde las reservas

| Field | Value |
|---|---|
| Status | Accepted · 2026-11-22 |
| Refs | REQ-F-003; UC-007, UC-016; INV-RES-004, INV-RES-005; RN-009 |

## Context
Las reservas cubren rangos de días y las unidades se liberan al cancelar, devolver o pasar a No recogida (ADR-002). Un contador global se desajustaría.

## Decision
La disponibilidad de un día es las unidades totales menos las de Reservada y Prestada que cubren ese día; se calcula al consultar, no se guarda.

## Alternatives
| Option | Why not |
|---|---|
| Contador global de libres | se desajusta con rangos, cancelaciones y retrasos |
| Calendario de ocupación guardado | duplica el dato y puede divergir de las reservas |

## Consequences
- + Sin desajustes: la reserva es la única fuente.
- − Cada consulta recorre las reservas del tipo; aceptado por el volumen del club.
