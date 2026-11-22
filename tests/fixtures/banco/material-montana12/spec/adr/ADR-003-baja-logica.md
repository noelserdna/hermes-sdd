# ADR-003 — La baja de socios es lógica

| Field | Value |
|---|---|
| Status | Accepted · 2026-11-22 |
| Refs | REQ-F-002, REQ-NF-003; UC-006; INV-SOC-001, INV-SOC-007, INV-SOC-008; RN-005; SM-003 |

## Context
El historial de préstamos y multas se conserva durante RETENTION_YEARS y el correo no puede reutilizarse.

## Decision
Dar de baja marca la cuenta como Baja y cancela sus reservas futuras; no se borra ningún registro y el correo sigue reservado.

## Alternatives
| Option | Why not |
|---|---|
| Borrado físico del socio | pierde el historial que consulta la junta |
| Anonimizar al dar de baja | el historial deja de ser consultable por socio |

## Consequences
- + Historial íntegro hasta la depuración (UC-019).
- − La cuenta de baja sigue guardada; el acceso se rechaza con `E_CREDENCIALES`.
