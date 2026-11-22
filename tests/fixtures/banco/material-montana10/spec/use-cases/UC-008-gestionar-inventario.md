# UC-008 — Gestionar inventario

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-008 (primary); API-004-01, API-004-02, API-004-03; INV-STK-001..004, INV-ACC-008; RN-002, RN-011, RN-016; BDD-UC-008 |
| Actors | Primary: Encargado. Secondary: almacén compartido |
| Trigger | El encargado abre Inventario, añade unidades o da de baja una unidad |
| Priority / Status | Must / Approved |

El encargado mantiene el inventario real por tipo, del que dependen las unidades libres para reservar.

## Input / Output

```typescript
interface AnadirInput { tipo: TipoMaterial /* VO-004, INV-STK-004 */; cantidad: number /* entero ≥ 1 */ }
interface BajaInput   { unidadId: number }
interface InventarioOutput { tipos: { tipo: TipoMaterial; activas: number; unidades: Unidad[] }[] }
```

## Preconditions
1. Sesión vigente de una cuenta Activa con rol encargado (INV-ACC-008, RN-016).

## Postconditions
- Success: añadir crea `cantidad` unidades Activas (INV-STK-003); dar de baja deja la unidad DeBaja, que no cuenta como libre (INV-STK-001).
- Failure: el inventario no cambia; error según la tabla.

## Main flow
1. Encargado: abre Inventario.
2. System: comprueba rol y lista por tipo "{material} · {n} unidades" (solo Activas) y cada unidad (INV-ACC-008).
3. Encargado: indica tipo y cantidad y añade.
4. System: valida tipo y cantidad, crea las unidades y muestra "Añadidas {n} unidades de {material}" (INV-STK-003, INV-STK-004).
5. Encargado: marca una unidad como rota.
6. System: si ya está DeBaja, no cambia nada (INV-STK-001).
7. System: comprueba que no está Prestada (INV-STK-002) y la pasa a DeBaja; muestra "{unidad} · De baja" (RN-011).

## Extensions
- 4a. Repetir el añadido suma otras unidades; no es idempotente por diseño. (AC-008-02)
- 7a. La unidad tiene reservas futuras → se da de baja igualmente (RN-011). (AC-008-03)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | rol distinto de encargado (socio, junta) | `E_SIN_PERMISO` | no se muestra ni cambia nada | AC-008-06 |
| E2 | 4 | tipo fuera de `TIPOS_MATERIAL` | `E_TIPO_INVALIDO` | no se crea ninguna unidad | AC-008-07 |
| E3 | 4 | cantidad no entera o menor que 1 | `E_CANTIDAD_INVALIDA` | no se crea ninguna unidad | AC-008-08 |
| E4 | 4 | replay: mismo añadido otra vez | `—` | se suman otras unidades (INV-STK-003) | AC-008-02 |
| E5 | 6 | la unidad no existe | `E_UNIDAD_NO_ENCONTRADA` | el inventario no cambia | AC-008-09 |
| E6 | 6 | replay: unidad ya DeBaja | `—` | sigue DeBaja una sola vez | AC-008-05 |
| E7 | 7 | unidad Prestada (también si la entrega ocurre a la vez) | `E_BAJA_UNIDAD_PRESTADA` | sigue Activa | AC-008-04 |

Fallo de almacenamiento y sesión caducada o ausente: se describen una vez en el contrato API-004.
