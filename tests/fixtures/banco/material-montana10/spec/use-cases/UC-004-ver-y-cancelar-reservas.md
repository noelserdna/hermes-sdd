# UC-004 — Ver y cancelar mis reservas

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-004 (primary); WF-001 steps 1–2; API-002-02, API-002-03; INV-RES-006, INV-RES-008, INV-ACC-008, INV-ACC-009; RN-002, RN-008, RN-019; ADR-001; BDD-UC-004 |
| Actors | Primary: Socio. Secondary: almacén compartido, reloj (ADR-001) |
| Trigger | El socio abre Mis reservas o cancela una de sus reservas |
| Priority / Status | Must / Approved |

El socio ve sus reservas, su estado y sus multas, y libera una reserva futura cancelándola.

## Input / Output

```typescript
interface ListarOutput  { reservas: Reserva[]; multas: Multa[] /* solo del socio, ENT-005 */ }
interface CancelarInput { reservaId: number }
interface CancelarOutput { reserva: Reserva /* estado Cancelada */ }
```

## Preconditions
1. Sesión vigente de una cuenta Activa con rol socio (INV-ACC-008).

## Postconditions
- Success: la lista muestra solo lo propio (INV-ACC-009); una cancelada pasa a `Cancelada` y libera sus unidades (RN-002, INV-RES-006).
- Failure: ninguna reserva cambia; error según la tabla.

## Main flow
1. Socio: abre Mis reservas.
2. System: lista sus reservas con estado, evaluando No recogida al consultar (RN-008), sus multas Pendientes y, sin reservas, "No tienes reservas" (INV-ACC-009).
3. Socio: cancela una reserva.
4. System: comprueba que la reserva existe y es suya (RN-019, INV-ACC-009).
5. System: si ya está Cancelada, no cambia nada (INV-RES-008).
6. System: comprueba que está Reservada y que hoy es anterior a `desde` (INV-RES-006, `CANCEL_MIN_DAYS_BEFORE`).
7. System: la pasa a Cancelada, libera sus unidades y muestra la lista (WF-001 step 2).

## Extensions
- 2a. El socio no tiene reservas → se muestra "No tienes reservas". (AC-004-02)
- 2b. El socio debe una multa → se muestra "Multa pendiente: {importe} €". (AC-004-06)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 4 | la reserva no existe | `E_RESERVA_NO_ENCONTRADA` | mensaje en Mis reservas; nada cambia | AC-004-08 |
| E2 | 4 | la reserva es de otro socio | `E_SIN_PERMISO_CANCELAR` | sigue Reservada | AC-004-07 |
| E3 | 5 | replay: ya Cancelada | `—` | sigue Cancelada una sola vez, sin otro cambio | AC-004-04 |
| E4 | 6 | hoy no es anterior a `desde` (incluye entrega concurrente, que exige hoy ≥ `desde`) | `E_CANCELACION_TARDIA` | sigue como estaba; unidades sin liberar | AC-004-05 |

Fallo de almacenamiento y sesión caducada o ausente: se describen una vez en el contrato API-002.
