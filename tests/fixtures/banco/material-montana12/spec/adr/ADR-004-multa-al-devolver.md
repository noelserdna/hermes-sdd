# ADR-004 — La multa se crea al marcar la devolución

| Field | Value |
|---|---|
| Status | Accepted · 2026-11-22 |
| Refs | REQ-F-005, REQ-F-006; UC-011, UC-017; INV-MUL-001, INV-MUL-004; RN-014 |

## Context
El importe depende de los días de retraso, que solo se conocen al devolver.

## Decision
La multa se crea en UC-011, una por préstamo, con FINE_PER_DAY_EUR por día de retraso; mientras no se devuelve, el encargado lo ve como Retraso en el panel.

## Alternatives
| Option | Why not |
|---|---|
| Multa creciente cada día | importe cambiante sin devolución y sin fecha de cobro |
| Multa al vencer | choca con ADR-002 y con devolver el mismo día de fin |

## Consequences
- + Importe definitivo y una sola multa por préstamo.
- − Lo no devuelto nunca genera multa; lo cubre el panel (UC-017).
