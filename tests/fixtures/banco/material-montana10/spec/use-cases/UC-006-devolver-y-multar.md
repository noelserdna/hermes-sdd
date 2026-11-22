# UC-006 — Devolver y multar

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-006 (primary); WF-001 steps 5, 6; API-003-02; INV-LOA-003, INV-LOA-004, INV-RES-008, INV-ACC-008; RN-009; ADR-001, ADR-002; BDD-UC-006 |
| Actors | Primary: Encargado. Secondary: reloj (ADR-001), almacén (ADR-002); Socio (ve la multa en Mis reservas) |
| Trigger | El Encargado marca como devuelto un préstamo en Entregas y devoluciones |
| Priority / Status | Must / Approved |

El Encargado cierra el préstamo; si hay retraso se crea la multa y el Socio la ve en Mis reservas.

## Input / Output

```typescript
interface DevolverInput  { reservaId: number }
interface DevolverOutput { unidad: string; socio: string; estado: 'Devuelta'; multa: { importeEur: number /* VO-006 */; dias: number } | null }
```

## Preconditions
1. Sesión vigente con rol Encargado (INV-ACC-008).
2. La reserva está Prestada (INV-LOA-003).

## Postconditions
- Success: reserva Devuelta con `devueltaEl` = hoy; multa Pendiente de `FINE_PER_DAY_EUR` × días solo si hay retraso (INV-LOA-004).
- Failure: reserva y multas sin cambios (INV-RES-008); error según la tabla.

## Main flow
1. Encargado: marca la devolución de una reserva.
2. System: comprueba que existe y está Prestada (INV-LOA-003).
3. System: cuenta los días naturales de retraso desde `hasta` (RN-009).
4. System: pasa la reserva a Devuelta y fija `devueltaEl` (API-003-02).
5. System: si días > 0, crea una multa Pendiente en la misma operación indivisible (INV-LOA-004).
6. System: muestra "{unidad} · {socio} · Devuelta" y, si hay multa, su aviso; el Socio la ve después en Mis reservas.

## Extensions
- 3a. Devuelta el día `hasta` o antes → no se crea multa (RN-009). (AC-006-01)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | la reserva no existe | `E_RESERVA_NO_ENCONTRADA` | sin cambios; se muestra el mensaje | AC-006-06 |
| E2 | 2 | estado Reservada, Cancelada o No recogida | `E_RESERVA_NO_PRESTADA` | sin cambios ni multa (INV-LOA-003) | AC-006-05 |
| E3 | 4 | replay: la reserva ya está Devuelta, también si dos devoluciones coinciden | `—` | se conserva una sola multa y la misma `devueltaEl` (INV-LOA-004, INV-RES-008) | AC-006-04 |
