# UC-014 — Dar de baja unidad

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-008 (primary); WF-001 step 4; API-004-03, API-004-01; INV-STK-003, INV-STK-004, INV-STK-005, INV-SEC-002, INV-SEC-003, INV-ACC-007, INV-LOA-001; RN-005; BDD-UC-014 |
| Actors | Primary: encargado. Secondary: almacén |
| Trigger | El encargado da de baja una unidad rota en Inventario |
| Priority / Status | Must / Approved |

El encargado retira una unidad rota: queda "De baja" y deja de contar para nuevas reservas. Sus reservas futuras se cancelan y se le informa del número.

## Input / Output

```typescript
interface DarDeBajaUnidadInput  { unidadId: string /* "Casco 3" */ }
interface DarDeBajaUnidadOutput { inventario: InventarioOutput /* UC-013 */; mensaje?: string /* M_RESERVAS_CANCELADAS_BAJA */ }
```

## Preconditions
1. Sesión válida del encargado (INV-ACC-007); sin sesión rige E_NO_AUTENTICADO / E_SESION_CADUCADA del contrato.

## Postconditions
- Success: la unidad pasa a De baja (SM-003); sus reservas Reservada pasan a Cancelada (INV-STK-005); Inventario muestra "{tipo}: {n} unidades" sin ella.
- Failure: la unidad y sus reservas no cambian (INV-SEC-003).

## Main flow
1. Encargado: elige una unidad en Inventario y la da de baja (API-004-03).
2. System: comprueba que la unidad existe y que no tiene reserva Entregado (INV-STK-003).
3. System: pasa la unidad a De baja y cancela sus reservas Reservada, de forma atómica (INV-STK-005, INV-SEC-003).
4. System: muestra Inventario con "{tipo}: {n} unidades" y la unidad como "De baja".

## Extensions
- 3a. La unidad tenía reservas Reservada futuras → se muestra `M_RESERVAS_CANCELADAS_BAJA`. (AC-014-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | unidad prestada (INV-STK-003) | `E_UNIDAD_PRESTADA` | la unidad sigue en Alta; hasta devolverla | AC-014-03 |
| E2 | 2 | la unidad no existe | `E_UNIDAD_NO_ENCONTRADA` | no cambia nada | AC-014-04 |
| E3 | 1 | socio o junta (INV-SEC-002, INV-ACC-007) | `E_ACCESO_NO_PERMITIDO` | no cambia nada | AC-014-05 |
| E4 | 3 | se entrega la unidad a la vez: gana la primera escritura confirmada (INV-LOA-001) | `E_UNIDAD_PRESTADA` | si gana la entrega, la baja se rechaza; si gana la baja, la entrega falla con `E_ESTADO_INVALIDO` | AC-014-06 |
| E5 | 3 | replay: la unidad ya está De baja (INV-STK-004) | `—` | el recuento no cambia; sin más cancelaciones | AC-014-07 |
| E6 | 3 | fallo del almacén (compartido, WF-001) | `E_ALMACEN_NO_DISPONIBLE` | ni baja ni cancelaciones; se reintenta | AC-014-08 |
