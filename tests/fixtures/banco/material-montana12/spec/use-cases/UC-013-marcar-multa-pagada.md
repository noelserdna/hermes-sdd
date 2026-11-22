# UC-013 — Marcar multa pagada

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-006 (primary); WF-001 steps 6-7; API-004-02, API-001-08; INV-MUL-002, INV-MUL-003, INV-SEC-003; RN-012, RN-016; ADR-005; SM-002; ENT-004; E_ALMACEN_NO_DISPONIBLE; BDD-UC-013 |
| Actors | Primary: encargado. Secondary: almacén de datos |
| Trigger | El encargado pulsa "Marcar pagada" en una multa de Multas |
| Priority / Status | Must / Approved |

El encargado registra el cobro de una multa; si era la última pendiente del socio, este vuelve a poder reservar.

## Input / Output

```typescript
interface PayFineInput  { fineId: FineId /* VO-001 */ }
interface PayFineOutput { status: 'Pagada'; paidOn: Day /* VO-005 */; memberBlocked: boolean }
```

## Preconditions
1. Sesión del encargado (API-001-08, INV-SEC-003).
2. La multa está Pendiente.

## Postconditions
- Success: la multa pasa a Pagada con `paidOn` (SM-002); el bloqueo de reserva se levanta solo si no quedan multas Pendientes del socio (INV-MUL-003, RN-016).
- Failure: la multa y el bloqueo no cambian; error según la tabla.

## Main flow
1. Encargado: pulsa "Marcar pagada" en una multa.
2. System: comprueba rol y que la multa existe (API-001-08).
3. System: comprueba que está Pendiente (SM-002).
4. System: la marca Pagada y guarda `paidOn` (WF-001 step 6).
5. System: recalcula el bloqueo del socio (WF-001 step 7, INV-MUL-002).
6. System: muestra "Multa pagada" en Multas.

## Extensions
- 5a. Quedan otras multas Pendientes del socio → el bloqueo sigue y cita la más antigua (RN-016). (AC-013-03)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | rol distinto de encargado | `E_ACCESO_DENEGADO` | sin cambios (INV-SEC-003) | AC-013-05 |
| E2 | 2 | la multa no existe | `E_MULTA_NO_ENCONTRADA` | sin cambios | AC-013-04 |
| E3 | 4 | replay: la multa ya está Pagada | `E_MULTA_YA_PAGADA` | sigue Pagada y una sola multa del mismo importe (INV-MUL-003, ADR-005) | AC-013-02 |

## Supuestos
None.
