# UC-010 — Aplicar multa por retraso

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-006 (primary); WF-001 steps 6, 8; API-003-05; INV-FIN-001, INV-FIN-002, INV-FIN-004, INV-RES-005, INV-SEC-003; SM-002; RN-009; ADR-005; UC-005, UC-009; BDD-UC-010 |
| Actors | Primary: encargado (vía UC-009). Secondary: almacén |
| Trigger | UC-009 registra una devolución con `devueltaEl` > `fin` |
| Priority / Status | Must / Approved |

Una devolución tardía genera una multa Pendiente por `FINE_PER_DAY_EUR` por día de retraso. Mientras el socio tenga una multa Pendiente no puede reservar.

## Input / Output

```typescript
interface MultaInput  { reservaId: string /* Devuelto */ }
interface MultaOutput { multaId?: string; socio: string; importe: Importe /* VO-008 */; estado: EstadoMulta /* VO-007 */ }
```

## Preconditions
1. La reserva acaba de pasar a Devuelto (UC-009).

## Postconditions
- Success: existe una multa Pendiente de `FINE_PER_DAY_EUR` × días de retraso (INV-FIN-001); Multas la muestra.
- Sin retraso: no se crea multa y Multas muestra "Sin multas".
- Failure: no se registra ni devolución ni multa (INV-SEC-003).

## Main flow
1. System: calcula días = `devueltaEl` − `fin`, naturales (RN-009, INV-FIN-001).
2. System: si días > 0, crea la multa Pendiente con importe `FINE_PER_DAY_EUR` × días (INV-FIN-001).
3. System: comprueba que la reserva no tiene ya multa (INV-FIN-002).
4. System: el socio queda bloqueado para reservar mientras exista una multa Pendiente (INV-RES-005, INV-FIN-004); el rechazo se especifica en UC-005.

## Extensions
- 1a. `devueltaEl` ≤ `fin` → no se crea multa. (AC-010-02)
- 1b. Un solo día de retraso → importe de 1 × `FINE_PER_DAY_EUR`. (AC-010-03)
- 4a. El socio intenta reservar → `E_MULTA_PENDIENTE` y sus reservas existentes se conservan. (AC-010-04)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | Falla el almacén | `E_ALMACEN_NO_DISPONIBLE` | Compartido (WF-001); no hay devolución ni multa | AC-010-05 |
| E2 | 3 | replay: la reserva ya tiene multa (dos encargados a la vez: gana el primero) | `—` | Se conserva la multa existente; no hay segunda (INV-FIN-002) | AC-010-06 |
