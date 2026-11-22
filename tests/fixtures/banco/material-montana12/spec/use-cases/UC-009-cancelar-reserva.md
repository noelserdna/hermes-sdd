# UC-009 — Cancelar reserva

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-004 (primary); WF-001 step 2; API-002-03, API-001-08; INV-RES-004..006, INV-RES-009, INV-RES-010, INV-SEC-001; RN-011, RN-012, RN-020, RN-022; ADR-001, ADR-005; SM-001; E_ALMACEN_NO_DISPONIBLE; BDD-UC-009 |
| Actors | Primary: socio. Secondary: almacén de datos |
| Trigger | El socio pulsa "Cancelar" en una fila de "Mis reservas" |
| Priority / Status | Must / Approved |

El socio cancela una reserva suya que aún no ha empezado y deja libres sus unidades.

## Input / Output

```typescript
interface CancelReservationInput  { reservationId: ReservationId /* VO-001, INV-RES-010 */ }
interface CancelReservationOutput { status: 'Cancelada' /* SM-001 */; replay: boolean /* INV-RES-009 */ }
```

## Preconditions
1. Sesión de socio abierta (API-001-08).
2. La reserva es de la cuenta de la sesión (INV-RES-010).

## Postconditions
- Success: reserva Cancelada y sus unidades libres todos sus días (INV-RES-005); "Mis reservas" la muestra Cancelada.
- Failure: estado y unidades sin cambios (INV-RES-009); error según la tabla.

## Main flow
1. Socio: pulsa "Cancelar" en una reserva (WF-001 paso 2).
2. System: autoriza y comprueba que la reserva es suya (API-001-08, INV-RES-010).
3. System: comprueba que no estaba ya Cancelada (INV-RES-009).
4. System: comprueba hoy < inicio (INV-RES-006, RN-011).
5. System: pasa a Cancelada y libera las unidades una sola vez (SM-001, RN-012).
6. System: muestra "Mis reservas" con el aviso de éxito.

## Extensions
None.

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | Reserva ajena o rol no socio | `E_ACCESO_DENEGADO` | Sin cambios ni datos ajenos (INV-SEC-001) | AC-009-05 |
| E2 | 3 | Replay: ya Cancelada | `E_YA_CANCELADA` | Sin cambios; unidades no liberadas dos veces (ADR-005) | AC-009-02 |
| E3 | 4 | Inicio = hoy | `E_EMPIEZA_HOY` | Sin cambios; sigue Reservada | AC-009-03 |
| E4 | 4 | Inicio pasado y sin entregar, o entregada a la vez por el encargado | `E_YA_EMPEZADA` | Sin cambios | AC-009-04 |

## Supuestos
None.
