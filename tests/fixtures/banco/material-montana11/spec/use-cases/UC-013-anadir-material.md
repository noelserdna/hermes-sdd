# UC-013 — Añadir material

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-008 (primary); API-004-01, API-004-02; INV-STK-001, INV-STK-002, INV-SEC-002, INV-SEC-003, INV-ACC-007; RN-005; BDD-UC-013 |
| Actors | Primary: encargado. Secondary: almacén |
| Trigger | El encargado abre Inventario o añade unidades de un tipo |
| Priority / Status | Must / Approved |

El encargado añade unidades de un tipo de material y ve el recuento por tipo en Inventario. Las unidades nuevas quedan libres para reservar.

## Input / Output

```typescript
interface AnadirMaterialInput  { tipo: TipoMaterial /* VO-004, INV-STK-001 */; cantidad: Cantidad /* VO-009, INV-STK-002 */ }
interface InventarioOutput { tipos: { tipo: TipoMaterial; unidades: number; detalle: { nombre: string; estado: 'Alta' | 'De baja' }[] }[] }
```

## Preconditions
1. Sesión válida del encargado (INV-ACC-007); sin sesión rige E_NO_AUTENTICADO / E_SESION_CADUCADA del contrato.

## Postconditions
- Success: `cantidad` unidades nuevas en Alta, cada una con número propio en su tipo (INV-STK-001); Inventario muestra "{tipo}: {n} unidades" con las unidades en Alta.
- Failure: el inventario no cambia (INV-SEC-003); error según la tabla.

## Main flow
1. Encargado: abre Inventario (API-004-01).
2. System: muestra cada tipo con "{tipo}: {n} unidades" y sus unidades, también las "De baja".
3. Encargado: elige un tipo e indica la cantidad (API-004-02).
4. System: valida tipo (INV-STK-001) y cantidad (INV-STK-002).
5. System: crea las unidades con los números siguientes del tipo, de forma atómica (INV-SEC-003).
6. System: muestra Inventario con el recuento nuevo.

## Extensions
- 2a. Un tipo sin unidades → se muestra con 0 unidades. (AC-013-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 4 | cantidad menor que 1 (INV-STK-002) | `E_CANTIDAD_INVALIDA` | no se crea nada; se corrige la cantidad | AC-013-03 |
| E2 | 4 | tipo fuera de `MATERIAL_TYPES` | `E_MATERIAL_INVALIDO` | no se crea nada | AC-013-04 |
| E3 | 4 | cantidad o tipo ausente o mal formado | `E_DATOS_INVALIDOS` | no se crea nada | AC-013-05 |
| E4 | 1, 3 | socio o junta (INV-SEC-002, INV-ACC-007) | `E_ACCESO_NO_PERMITIDO` | no se muestra ni cambia nada | AC-013-06 |
| E6 | 4 | replay: el mismo envío otra vez (RN-016) | `—` | se crean otras unidades con números nuevos; cada envío es una petición distinta | AC-013-08 |
| E5 | 5 | fallo del almacén (compartido, WF-001) | `E_ALMACEN_NO_DISPONIBLE` | no se crea nada; se reintenta | AC-013-07 |
