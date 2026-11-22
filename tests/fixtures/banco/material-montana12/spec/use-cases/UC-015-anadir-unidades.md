# UC-015 — Añadir unidades de material

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-007 (primary); API-003-01, API-003-03, API-001-08; INV-MAT-001, INV-MAT-003, INV-MAT-004, INV-SEC-003; RN-017, RN-020; ENT-002; VO-006; E_ALMACEN_NO_DISPONIBLE; BDD-UC-015 |
| Actors | Primary: encargado. Secondary: almacén de datos |
| Trigger | El encargado envía tipo y cantidad en "Material" |
| Priority / Status | Must / Approved |

El encargado aumenta las unidades de un tipo, o da de alta un tipo nuevo, y ve el total en "Material".

## Input / Output

```typescript
interface AddUnitsInput  { name: string /* INV-MAT-004 */; quantity: Quantity /* entero ≥ 1, VO-006 */ }
interface AddUnitsOutput { rows: { item: string; totalUnits: number /* INV-MAT-001 */ }[] }
```

## Preconditions
1. Sesión de encargado abierta (API-001-08, INV-SEC-003).

## Postconditions
- Success: `totalUnits` del tipo aumentado en la cantidad; tipo nuevo creado si el nombre no existía (INV-MAT-004); "Material" lo muestra.
- Failure: inventario sin cambios; error según la tabla.

## Main flow
1. Encargado: abre "Material"; el sistema lo autoriza y lista tipos con su total (API-003-03).
2. Encargado: indica nombre y cantidad y envía.
3. System: valida nombre no vacío y cantidad entera ≥ 1 (RN-017).
4. System: busca el tipo sin distinguir mayúsculas; si no existe lo crea (INV-MAT-004).
5. System: suma la cantidad y muestra la lista actualizada.

## Extensions
- 4a. Tipo nuevo → se crea con la cantidad como total. (AC-015-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 1 | Rol distinto de encargado | `E_PAGINA_PROHIBIDA` / `E_ACCESO_DENEGADO` | Sin lista ni cambios (RN-020) | AC-015-05 |
| E2 | 3 | Cantidad no entera o < 1 | `E_CANTIDAD_INVALIDA` | Sin cambios | AC-015-03 |
| E3 | 3 | Nombre vacío | `E_NOMBRE_VACIO` | Sin cambios | AC-015-04 |
| E4 | 5 | Replay: mismo envío otra vez | `—` | Las unidades se suman otra vez, segunda alta por diseño (RN-012, RN-035) | AC-015-06 |
