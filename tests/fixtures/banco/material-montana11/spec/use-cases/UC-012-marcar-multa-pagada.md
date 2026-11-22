# UC-012 — Marcar multa pagada

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-007 (primary), REQ-F-006; WF-001 steps 7, 8; API-003-07, API-003-08; INV-FIN-003, INV-FIN-004, INV-RES-005, INV-ACC-007, INV-SEC-001, INV-SEC-002, INV-SEC-003; SM-002; ADR-005; UC-005; BDD-UC-012 |
| Actors | Primary: encargado. Secondary: almacén |
| Trigger | El encargado abre Multas o marca "Pagada" sobre una multa Pendiente |
| Priority / Status | Must / Approved |

El encargado ve todas las multas y anota el pago. Cuando el socio no tiene más multas Pendiente, puede volver a reservar.

## Input / Output

```typescript
interface PagarInput  { multaId: string }
interface PagarOutput { estado: 'Pagada'; pagadaEl: Fecha /* VO-001 */ }
```

## Preconditions
1. Sesión de encargado (INV-ACC-007).
2. La multa existe.

## Postconditions
- Success: la multa queda Pagada con `pagadaEl` = hoy (SM-002); si no queda otra Pendiente, el socio puede reservar (INV-RES-005, INV-FIN-004).
- Replay: se conserva la primera `pagadaEl` (INV-FIN-003).
- Failure: la multa no cambia (INV-SEC-003).

## Main flow
1. Encargado: abre Multas.
2. System: lista todas las multas con socio, importe y estado (API-003-07).
3. Encargado: marca "Pagada" sobre una multa Pendiente.
4. System: comprueba rol y existencia (INV-ACC-007).
5. System: pasa la multa a Pagada y anota `pagadaEl` en una escritura atómica (INV-SEC-003, ADR-005).
6. System: Multas muestra "Pagada"; el socio sin otra multa Pendiente ya puede reservar (UC-005).

## Extensions
- 5a. El socio tiene otra multa Pendiente → sigue bloqueado para reservar (INV-RES-005). (AC-012-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 1, 3 | Socio o junta abre Multas o intenta pagar | `E_ACCESO_NO_PERMITIDO` | Se ve el mensaje; nada cambia (INV-SEC-002) | AC-012-04 |
| E2 | 4 | La multa no existe | `E_MULTA_NO_ENCONTRADA` | Nada cambia | AC-012-05 |
| E3 | 2, 5 | Falla el almacén | `E_ALMACEN_NO_DISPONIBLE` | Compartido (WF-001); sigue Pendiente; se reintenta | AC-012-06 |
| E4 | 5 | replay: ya Pagada (dos encargados a la vez: gana el primero) | `—` | Se conserva la primera fecha de pago (INV-FIN-003) | AC-012-03 |
