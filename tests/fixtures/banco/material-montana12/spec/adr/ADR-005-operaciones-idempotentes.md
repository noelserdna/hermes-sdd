# ADR-005 — Repetir una operación no cambia nada y avisa

| Field | Value |
|---|---|
| Status | Accepted · 2026-11-22 |
| Refs | REQ-F-004..REQ-F-006; UC-009..UC-011, UC-013; INV-RES-009, INV-MUL-003; RN-012 |

## Context
Doble pulsación o recarga repiten cancelar, entregar, devolver y marcar pagada.

## Decision
Repetirlas no modifica datos y responde «Ya estaba …» con su código de aviso (ReplayNotice en VO-010). Reservar repetido crea otra reserva si caben.

## Alternatives
| Option | Why not |
|---|---|
| Rechazar como error | el usuario cree que falló aunque el resultado es el pedido |
| Repetir el efecto | duplica multas o cambia fechas registradas |

## Consequences
- + Sin duplicados ni efectos dobles.
- − El aviso no es un fallo; la interfaz lo muestra como información.
