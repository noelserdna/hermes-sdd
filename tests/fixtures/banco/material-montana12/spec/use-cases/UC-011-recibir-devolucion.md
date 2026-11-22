# UC-011 — Recibir devolución

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-005 (primary), REQ-F-006; WF-001 steps 4-5; API-002-05, API-001-08; INV-RES-009, INV-MUL-001, INV-MUL-004, INV-SEC-003; RN-012, RN-014, RN-015, RN-022; ADR-004, ADR-005; SM-001, SM-002; ENT-004; E_ALMACEN_NO_DISPONIBLE; BDD-UC-011 |
| Actors | Primary: encargado. Secondary: almacén de datos |
| Trigger | El encargado pulsa "Devolver" en un préstamo del Panel del encargado |
| Priority / Status | Must / Approved |

El encargado cierra un préstamo; si hay retraso, el sistema crea la multa en ese momento.

## Input / Output

```typescript
interface ReturnInput  { reservationId: ReservationId /* VO-001 */ }
interface ReturnOutput { status: 'Devuelta'; returnedOn: Day /* VO-005 */; lateDays: number /* INV-MUL-004 */; fine?: { fineId: FineId; amountEur: number; status: 'Pendiente' } }
```

## Preconditions
1. Sesión del encargado (API-001-08, INV-SEC-003).
2. La reserva está Prestada.

## Postconditions
- Success: Devuelta con `returnedOn` (SM-001); sus unidades quedan libres (INV-RES-005); con retraso > 0 existe una multa Pendiente de `FINE_PER_DAY_EUR` × días, una por préstamo (INV-MUL-001); sin retraso no existe multa.
- Failure: ni la reserva ni las multas cambian (INV-RES-009); error según la tabla.

## Main flow
1. Encargado: pulsa "Devolver" en un préstamo.
2. System: comprueba rol y que la reserva existe (API-001-08).
3. System: comprueba que está Prestada (SM-001).
4. System: calcula el retraso `returnedOn − endDate` (RN-014, INV-MUL-004, RN-022) y guarda la devolución (WF-001 step 4).
5. System: si retraso > 0, crea la multa Pendiente en la misma operación (WF-001 step 5, ADR-004, INV-MUL-001).
6. System: muestra en Panel del encargado "Devuelto a tiempo" o el aviso de retraso y multa, con "día"/"días" según RN-015.

## Extensions
- 4a. Retraso 0 → no se crea multa; el socio no ve ninguna. (AC-011-01)
- 4b. Retraso de 1 día → singular. (AC-011-03)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | rol distinto de encargado | `E_ACCESO_DENEGADO` | sin cambios (INV-SEC-003) | AC-011-07 |
| E2 | 2 | la reserva no existe | `E_RESERVA_NO_ENCONTRADA` | sin cambios | AC-011-06 |
| E3 | 3 | la reserva no está Prestada (Reservada, Cancelada) | `E_NO_PRESTADA` | sin cambios; no se crea multa | AC-011-05 |
| E4 | 5 | replay: devolver lo ya Devuelta | `E_YA_DEVUELTA` | sigue una sola multa del mismo importe (INV-RES-009, ADR-005) | AC-011-04 |

## Supuestos
None.
