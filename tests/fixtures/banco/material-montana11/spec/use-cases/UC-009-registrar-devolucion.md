# UC-009 — Registrar devolución

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-005 (primary), REQ-F-006; WF-001 step 5; API-003-02, API-003-05; INV-LOA-003, INV-FIN-001, INV-FIN-002, INV-ACC-007, INV-SEC-002, INV-SEC-003; SM-001; ADR-005; UC-010; BDD-UC-009 |
| Actors | Primary: encargado. Secondary: almacén |
| Trigger | El encargado marca "Devolver" sobre un préstamo |
| Priority / Status | Must / Approved |

El encargado registra que el material ha vuelto: el préstamo pasa a Devuelto y la unidad queda libre. Si hay retraso se crea la multa (UC-010).

## Input / Output

```typescript
interface DevolverInput  { reservaId: string }
interface DevolverOutput { estado: 'Devuelto'; devueltaEl: Fecha; multaId?: string /* UC-010 */ }
```

## Preconditions
1. Sesión de encargado (INV-ACC-007).
2. La reserva está Entregado (INV-LOA-003).

## Postconditions
- Success: la reserva queda Devuelto con `devueltaEl` = hoy y la unidad libre; si hoy > `fin`, existe la multa (UC-010).
- Replay: se conserva la primera `devueltaEl` y no se crea otra multa (INV-LOA-003, INV-FIN-002).
- Failure: ni estado ni multa cambian (INV-SEC-003).

## Main flow
1. Encargado: marca "Devolver" sobre un préstamo en Préstamos.
2. System: comprueba rol, existencia y estado Entregado (INV-LOA-003).
3. System: anota `devueltaEl` = hoy y pasa a Devuelto.
4. System: si `devueltaEl` > `fin`, invoca UC-010 en la misma escritura atómica (INV-FIN-001, ADR-005).
5. System: Préstamos muestra "Devuelto".

## Extensions
- 4a. Hay retraso → se crea la multa Pendiente (UC-010, AC-010-01). (AC-009-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 1 | Socio o junta intenta devolver | `E_ACCESO_NO_PERMITIDO` | Se ve el mensaje; nada cambia (INV-SEC-002) | AC-009-04 |
| E2 | 2 | La reserva no existe | `E_RESERVA_NO_ENCONTRADA` | Nada cambia | AC-009-05 |
| E3 | 2 | La reserva está Reservada, Cancelada o No recogida | `E_ESTADO_INVALIDO` | Nada cambia | AC-009-06 |
| E4 | 3, 4 | Falla el almacén | `E_ALMACEN_NO_DISPONIBLE` | Compartido (WF-001); sigue Entregado y sin multa | AC-009-07 |
| E5 | 2 | replay: ya Devuelto (incluye dos encargados a la vez: gana el primero) | `—` | Se conserva la primera fecha; no hay segunda multa | AC-009-03 |
