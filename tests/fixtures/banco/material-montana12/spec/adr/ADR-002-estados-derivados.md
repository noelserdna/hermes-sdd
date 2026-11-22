# ADR-002 — «No recogida» y «Retraso» son estados derivados, no guardados

| Field | Value |
|---|---|
| Status | Accepted · 2026-11-22 |
| Refs | REQ-F-005, REQ-F-008; UC-010, UC-017; INV-RES-008, INV-MUL-004; RN-013, RN-018; SM-001 |

## Context
El paso del tiempo cambia el estado sin que nadie actúe; no hay tarea que lo anote el día exacto.

## Decision
Se calculan comparando la fecha de fin con hoy (RN-022): Reservada vencida es No recogida y libera unidades; Prestada vencida es Retraso.

## Alternatives
| Option | Why not |
|---|---|
| Guardar el estado con tarea diaria | si la tarea falla el estado es erróneo |
| Multa al vencer | contradice ADR-004 |

## Consequences
- + Siempre correcto sin tareas programadas.
- − Todo cálculo de estado depende de «hoy»; fuente única en RN-022.
