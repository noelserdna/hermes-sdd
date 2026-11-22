# UC-007 — Cancelar reserva

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-004 (primary); WF-001 step 3; API-002-04; INV-RES-006, INV-RES-007, INV-RES-001, INV-SEC-001, INV-SEC-003, INV-ACC-007; RN-002, RN-005; ADR-002, ADR-005; BDD-UC-007 |
| Actors | Primary: socio. Secondary: almacén (ADR-001) |
| Trigger | El socio pulsa cancelar en una reserva de Mis reservas |
| Priority / Status | Must / Approved |

El socio anula una de sus reservas hasta el día antes del inicio y la unidad queda libre.

## Input / Output

```typescript
interface CancelarInput  { reservaId: string }
interface CancelarOutput { reservaId: string; estado: 'Cancelada'; mensaje: 'M_RESERVA_CANCELADA' }
```

## Preconditions
1. Sesión válida de rol socio (INV-ACC-007).
2. La reserva es del socio de la sesión (INV-SEC-001).

## Postconditions
- Success: la reserva pasa a Cancelada (SM-001) y su unidad queda libre (INV-RES-001); se muestra M_RESERVA_CANCELADA.
- Failure: la reserva no cambia (INV-SEC-003); error según la tabla.

## Main flow
1. Socio: cancela una reserva en Mis reservas.
2. Sistema: comprueba que la reserva existe y es del socio (INV-SEC-001).
3. Sistema: si ya está Cancelada, no cambia nada (INV-RES-007).
4. Sistema: comprueba estado Reservada e `inicio` > hoy (INV-RES-006, RN-002).
5. Sistema: guarda la cancelación de forma atómica y serializada (ADR-005).
6. Sistema: muestra M_RESERVA_CANCELADA y estado "Cancelada".

## Extensions
None.

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 4 | `inicio` ≤ hoy | `E_CANCELACION_TARDIA` | la reserva se queda como está (INV-RES-006) | AC-007-02 |
| E2 | 3 | replay: cancelación repetida | `—` | sigue Cancelada y nada más cambia (INV-RES-007) | AC-007-03 |
| E3 | 2 | reserva inexistente o de otro socio | `E_RESERVA_NO_ENCONTRADA` | no se revela ni cambia nada (INV-SEC-001, RN-005) | AC-007-04 |
| E4 | 4 | estado distinto de Reservada o Cancelada (p. ej. entregada a la vez) | `E_ESTADO_INVALIDO` | la reserva no cambia; gana la escritura confirmada antes (ADR-005) | AC-007-05 |
| E5 | 5 | fallo del almacén (compartido, WF-001) | `E_ALMACEN_NO_DISPONIBLE` | no se guarda nada (INV-SEC-003); reintentar | AC-007-06 |
