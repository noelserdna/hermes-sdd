# UC-005 — Entregar reserva

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-005 (primary); WF-001 steps 3, 4; API-003-01, API-003-07; INV-LOA-001, INV-LOA-002, INV-LOA-301, INV-RES-007, INV-RES-008, INV-STK-001, INV-ACC-008; RN-008, RN-020; ADR-001, ADR-002; BDD-UC-005 |
| Actors | Primary: Encargado. Secondary: reloj (ADR-001), almacén (ADR-002) |
| Trigger | El Encargado marca como entregada una reserva en Entregas y devoluciones |
| Priority / Status | Must / Approved |

El Encargado asigna una unidad concreta a la reserva y la deja Prestada; lo no recogido pasa a No recogida y libera unidades.

## Input / Output

```typescript
interface EntregarInput  { reservaId: number; unidadId: number /* ENT-003, RN-020 */ }
interface EntregarOutput { unidad: string; socio: string; estado: 'Prestada' }
```

## Preconditions
1. Sesión vigente con rol Encargado (INV-ACC-008).
2. La reserva está Reservada y hoy ≥ `desde` (INV-LOA-301, INV-LOA-001).

## Postconditions
- Success: reserva Prestada con `unidadId` asignada (INV-LOA-002); fila "{unidad} · {socio} · Prestada" en Entregas y devoluciones.
- Failure: reserva y unidades sin cambios (INV-RES-008); error según la tabla.

## Main flow
1. Encargado: elige la reserva e indica la unidad (RN-020).
2. System: aplica RN-008 a las reservas vencidas (API-003-07, INV-RES-007).
3. System: comprueba reserva, fecha y unidad (INV-LOA-301, INV-LOA-001, INV-STK-001).
4. System: asigna la unidad y pasa la reserva a Prestada en una sola operación indivisible (API-003-01, INV-LOA-002).
5. System: muestra la fila prestada.

## Extensions
- 2a. Reservada con hoy > `hasta` → pasa a No recogida, sin multa y con unidades libres; se muestra "No recogida". (AC-005-04)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 3 | la reserva no existe | `E_RESERVA_NO_ENCONTRADA` | sin cambios; se muestra el mensaje | AC-005-05 |
| E2 | 3 | hoy anterior a `desde` | `E_ENTREGA_ANTICIPADA` | sigue Reservada (INV-LOA-001); se muestra el mensaje | AC-005-03 |
| E3 | 3 | estado Devuelta, Cancelada o No recogida | `E_RESERVA_NO_ENTREGABLE` | sin cambios (INV-LOA-301) | AC-005-06 |
| E4 | 4 | unidad inexistente, de otro tipo, DeBaja o ya Prestada a otra reserva, también si otra entrega la toma a la vez | `E_UNIDAD_NO_DISPONIBLE` | la segunda entrega no asigna; sigue Reservada (INV-LOA-002) | AC-005-07 |
| E5 | 4 | replay: la reserva ya está Prestada | `—` | se mantiene la unidad y una sola fila prestada (INV-RES-008) | AC-005-02 |
