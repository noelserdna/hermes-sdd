# UC-016 — Retirar unidades rotas

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-007 (primary); API-003-02, API-001-08; INV-MAT-001, INV-MAT-002, INV-RES-004, INV-RES-005, INV-SEC-003; RN-012, RN-017, RN-020, RN-022; ADR-001; ENT-002; VO-006; E_ALMACEN_NO_DISPONIBLE; BDD-UC-016 |
| Actors | Primary: encargado. Secondary: almacén de datos |
| Trigger | El encargado envía tipo y cantidad de baja en "Material" |
| Priority / Status | Must / Approved |

El encargado da de baja unidades rotas que ninguna reserva ni préstamo necesita y ve el total en "Material".

## Input / Output

```typescript
interface WithdrawUnitsInput  { itemId: ItemId; quantity: Quantity /* entero ≥ 1, VO-006 */ }
interface WithdrawUnitsOutput { item: string; totalUnits: number /* INV-MAT-001 */ }
```

## Preconditions
1. Sesión de encargado abierta (API-001-08, INV-SEC-003).

## Postconditions
- Success: `totalUnits` reducido en la cantidad y cada día desde hoy `total − n ≥ ocupadas` (INV-MAT-002); "Material" lo muestra.
- Failure: `totalUnits` sin cambios; error según la tabla.

## Main flow
1. Encargado: elige tipo y cantidad de baja en "Material" y envía; el sistema autoriza (API-001-08).
2. System: valida cantidad entera ≥ 1 (RN-017).
3. System: comprueba que la cantidad no supera el total (INV-MAT-001).
4. System: comprueba cada día desde hoy `total − n ≥ ocupadas` (INV-MAT-002, RN-009, ADR-001).
5. System: reduce el total y muestra la lista actualizada.

## Extensions
None.

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 1 | Rol distinto de encargado | `E_PAGINA_PROHIBIDA` / `E_ACCESO_DENEGADO` | Sin cambios (RN-020) | AC-016-05 |
| E2 | 2 | Cantidad no entera o < 1 | `E_CANTIDAD_INVALIDA` | Sin cambios | AC-016-04 |
| E3 | 3 | Replay: cantidad mayor que el total (p. ej. baja repetida con stock 0) | `E_BAJA_UNIDADES_INSUFICIENTES` | Sin cambios; si aún hay stock, la baja repetida resta otra vez (RN-012) | AC-016-03 |
| E4 | 4 | Un día necesita las unidades, o una reserva las toma a la vez | `E_BAJA_UNIDADES_NECESARIAS` | Sin cambios; cita primer día (RN-017) | AC-016-02 |

## Supuestos
None.
