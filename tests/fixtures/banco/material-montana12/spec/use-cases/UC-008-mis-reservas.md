# UC-008 — Ver mis reservas

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-004 (primary), REQ-F-001 (ruta `/mis-reservas`, AC8); API-002-02, API-001-08; INV-RES-005, INV-RES-006, INV-RES-010, INV-SEC-001; RN-011, RN-020, RN-022; ADR-002; SM-001; VO-007; E_ALMACEN_NO_DISPONIBLE; BDD-UC-008 |
| Actors | Primary: socio. Secondary: almacén de datos |
| Trigger | El socio abre "Mis reservas" |
| Priority / Status | Must / Approved |

El socio ve solo sus reservas con su estado y sabe cuáles puede cancelar.

## Input / Output

```typescript
interface ListMyReservationsInput  { /* cuenta de la sesión */ }
interface ListMyReservationsOutput { rows: { reservationId: ReservationId; quantity: Quantity; item: string; startDate: Day; endDate: Day; status: ReservationStatus /* RESERVATION_STATUS */; canCancel: boolean /* INV-RES-006 */ }[] }
```

## Preconditions
1. Sesión de socio abierta (API-001-08).

## Postconditions
- Success: lista de las reservas de la cuenta de la sesión, sin datos de otros socios (INV-RES-010); sin cambios de estado.
- Failure: no se muestra ninguna reserva; error según la tabla.

## Main flow
1. Socio: abre "Mis reservas".
2. System: autoriza el rol (API-001-08, RN-020).
3. System: lee las reservas con `accountId` = sesión (INV-RES-010).
4. System: muestra cada una con cantidad, material, fechas y estado (ADR-002 para «No recogida»).
5. System: ofrece "Cancelar" solo si hoy < inicio (INV-RES-006, RN-011); si no, muestra el motivo en la fila.

## Extensions
- 4a. La reserva empieza hoy → fila con `E_EMPIEZA_HOY` y sin botón "Cancelar". (AC-008-02)
- 4b. Sin reservas → texto "Aún no tienes reservas". (AC-008-03, AC-008-04)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | Rol encargado o junta abre la página | `E_PAGINA_PROHIBIDA` | Sin lista (RN-020) | AC-008-05 |
| E2 | 3 | Reserva de otra cuenta solicitada | `E_ACCESO_DENEGADO` | Sin datos de otro socio (INV-SEC-001) | AC-008-01 |

## Supuestos
None.
