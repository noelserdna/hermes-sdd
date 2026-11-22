# UC-010 — Entregar reserva

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-005 (primary); WF-001 step 3; API-002-04, API-001-08; INV-RES-007, INV-RES-008, INV-RES-009, INV-SEC-003; RN-012, RN-013, RN-022; ADR-002, ADR-005; SM-001; E_ALMACEN_NO_DISPONIBLE; BDD-UC-010 |
| Actors | Primary: encargado. Secondary: almacén de datos |
| Trigger | El encargado pulsa "Entregar" en una reserva del Panel del encargado |
| Priority / Status | Must / Approved |

El encargado pasa una reserva de Reservada a Prestada cuando el socio recoge el material.

## Input / Output

```typescript
interface DeliverInput  { reservationId: ReservationId /* VO-001 */ }
interface DeliverOutput { reservationId: ReservationId; status: 'Prestada'; deliveredOn: Day /* VO-005 */; quantity: Quantity; item: string; member: string; startDate: Day; endDate: Day }
```

## Preconditions
1. Sesión del encargado (API-001-08, INV-SEC-003).
2. La reserva está Reservada con `startDate ≤ hoy ≤ endDate` (INV-RES-007).

## Postconditions
- Success: la reserva pasa a Prestada y registra `deliveredOn` (SM-001); sigue ocupando las mismas unidades (INV-RES-005); sale el aviso de entrega y la fila del préstamo.
- Failure: la reserva no cambia (INV-RES-009); error según la tabla.

## Main flow
1. Encargado: pulsa "Entregar" en una reserva.
2. System: comprueba rol (API-001-08) y que la reserva existe.
3. System: comprueba estado y fechas contra `hoy` (RN-013, RN-022, INV-RES-007).
4. System: pasa la reserva a Prestada y guarda `deliveredOn` (WF-001 step 3).
5. System: muestra el aviso de entrega y el estado "Prestada" en Panel del encargado.

## Extensions
- 3a. Ya Prestada (envío repetido) → no cambia; sigue una sola fila de préstamo. (AC-010-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | rol distinto de encargado | `E_ACCESO_DENEGADO` | sin cambios (INV-SEC-003); sin datos de la reserva | AC-010-06 |
| E2 | 2 | la reserva no existe | `E_RESERVA_NO_ENCONTRADA` | sin cambios; el panel avisa | AC-010-05 |
| E3 | 3 | `hoy < startDate` | `E_ANTES_DE_INICIO` | sin cambios; sigue Reservada (INV-RES-007) | AC-010-03 |
| E4 | 3 | `endDate < hoy` sin entregar: No recogida (INV-RES-008) | `E_NO_RECOGIDA` | sin cambios; sus unidades siguen libres (ADR-002) | AC-010-04 |
| E5 | 3 | la reserva está Cancelada o Devuelta | `E_RESERVA_NO_ENTREGABLE` | sin cambios | AC-010-07 |
| E6 | 4 | replay: entregar lo ya Prestada | `E_YA_ENTREGADA` | no se duplica el préstamo (INV-RES-009, ADR-005) | AC-010-02 |

## Supuestos
- RN-029: el Panel del encargado lista con «No recogida» (sin botón «Entregar») las Reservada con fin pasado de los últimos `NOT_COLLECTED_VISIBLE_DAYS` días.
