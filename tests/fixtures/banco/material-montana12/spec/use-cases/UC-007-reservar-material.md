# UC-007 — Reservar material

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-003 (primary), REQ-F-007 (AC6); WF-001 steps 1, 7; API-002-01, API-003-03, API-001-08; INV-RES-001..005, INV-MUL-002, INV-MAT-003, INV-SEC-001; RN-009, RN-010, RN-012, RN-016, RN-020, RN-022; ADR-001; SM-001; VO-005, VO-006; E_ALMACEN_NO_DISPONIBLE; BDD-UC-007 |
| Actors | Primary: socio. Secondary: almacén de datos |
| Trigger | El socio abre "Reservar" y envía el formulario |
| Priority / Status | Must / Approved |

El socio obtiene una reserva de unidades de un tipo de material para un rango de días, si hay unidades libres cada día.

## Input / Output

```typescript
interface ReserveInput  { itemId: ItemId; quantity: Quantity /* VO-006, INV-RES-003 */; startDate: Day; endDate: Day /* VO-005, INV-RES-001..002 */ }
interface ReserveOutput { reservationId: ReservationId; status: 'Reservada' /* SM-001 */ }
```

## Preconditions
1. Sesión de socio abierta (API-001-08, RN-020).
2. Ninguna multa Pendiente (INV-MUL-002); si la hay, ver E2.

## Postconditions
- Success: reserva Reservada con las unidades apartadas cada día (INV-RES-004, INV-RES-005); "Mis reservas" la muestra.
- Failure: ninguna reserva creada ni unidades apartadas; error según la tabla.

## Main flow
1. Socio: abre "Reservar"; el sistema autoriza (API-001-08) y ofrece solo tipos con unidades > 0 (API-003-03, INV-MAT-003).
2. Socio: elige tipo, cantidad, fecha de inicio y de fin, y envía.
3. System: comprueba que no hay multa pendiente (INV-MUL-002, RN-016; WF-001 paso 7 al pagarla).
4. System: valida en orden fecha pasada, fin anterior, `MAX_RESERVATION_DAYS`, `MAX_UNITS_PER_RESERVATION` (RN-010, INV-RES-001..003).
5. System: calcula libres por día desde las reservas (ADR-001, RN-009, INV-RES-004).
6. System: crea la reserva Reservada (WF-001 paso 1) y muestra "Mis reservas".

## Extensions
- 1a. Tipo con 0 unidades → no se ofrece. (AC-007-10)
- 3a. Multa ya pagada (WF-001 paso 7) → sigue en 4.

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 1 | Rol distinto de socio (página u operación) | `E_PAGINA_PROHIBIDA` / `E_ACCESO_DENEGADO` | Sin formulario ni reserva (RN-020) | AC-007-11 |
| E2 | 3 | Multa Pendiente | `E_MULTA_PENDIENTE` | Sin reserva; mensaje en Reservar | AC-007-08, AC-007-09 |
| E3 | 4 | Inicio anterior a hoy | `E_FECHA_PASADA` | Sin reserva; corrige el formulario | AC-007-04 |
| E4 | 4 | Fin anterior al inicio | `E_FECHA_FIN_ANTERIOR` | Ídem | AC-007-05 |
| E5 | 4 | Duración mayor que `MAX_RESERVATION_DAYS` | `E_MAX_DIAS` | Ídem | AC-007-06 |
| E6 | 4 | Cantidad mayor que `MAX_UNITS_PER_RESERVATION` | `E_MAX_UNIDADES` | Ídem | AC-007-07 |
| E7 | 5 | Faltan unidades algún día, o otra reserva las toma a la vez | `E_SIN_UNIDADES` | Sin reserva; cita primer día y libres (RN-009) | AC-007-02 |
| E8 | 6 | Replay: mismo formulario otra vez | `E_SIN_UNIDADES` si no caben; si caben, segunda reserva (RN-012) | Una sola reserva si no caben | AC-007-03 |

## Supuestos
- RN-034: cantidad menor que 1 o no entera → `E_CANTIDAD_INVALIDA`; fecha vacía o no válida → `E_FECHA_INVALIDA`.
