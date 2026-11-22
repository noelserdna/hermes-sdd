# UC-009 — Ver entregas y devoluciones

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-009 (primary); WF-001 steps 3, 4, 5; API-003-05; INV-LOA-401, INV-RES-007, INV-ACC-008; RN-001, RN-008, RN-009, RN-016, RN-022; BDD-UC-009 |
| Actors | Primary: Encargado. Secondary: Junta (solo lectura) |
| Trigger | Abrir la pantalla Entregas y devoluciones |
| Priority / Status | Must / Approved |

El encargado ve qué material está fuera, qué vuelve hoy, qué se retrasa y qué hay que entregar hoy. La junta ve lo mismo sin acciones.

## Input / Output

```typescript
interface EntregasYDevolucionesInput  { /* solo sesión (INV-ACC-008) */ }
interface Linea { unidad: string; socio: string; hasta: Fecha /* VO-003 */; diasRetraso?: number }
interface EntregasYDevolucionesOutput {
  prestado: Linea[]; vuelveHoy: Linea[]; conRetraso: Linea[];
  entregarHoy: { material: TipoMaterial; socio: string }[];
  acciones: boolean /* true solo para encargado (INV-LOA-401) */;
}
```

## Preconditions
1. Sesión vigente de encargado o junta (INV-ACC-008, RN-016).

## Postconditions
- Success: listas calculadas con hoy (RN-001); no cambia ninguna reserva (INV-LOA-401).
- Failure: nada se muestra ni cambia; error según Exceptions.

## Main flow
1. Encargado: abre Entregas y devoluciones.
2. System: comprueba sesión y rol (INV-ACC-008).
3. System: aplica RN-008 a las reservas vencidas (INV-RES-007).
4. System: lista Prestada con `hasta` ≥ hoy como prestado; con `hasta` = hoy también como vuelve hoy.
5. System: lista Prestada con `hasta` < hoy como con retraso, con días de RN-009.
6. System: lista Reservada con `desde` ≤ hoy ≤ `hasta` como entregar hoy (RN-022).
7. System: muestra botones de entregar y devolver solo al encargado (INV-LOA-401).

## Extensions
- 1a. Rol junta → mismas listas sin botones. (AC-009-05)
- 4a. Nada prestado → mensaje de vacío. (AC-009-04)
- 3a. Reserva Reservada con `hasta` < hoy → no se lista; cuenta como No recogida. (AC-009-07)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | Socio abre la pantalla directamente | `E_SIN_PERMISO` | no se muestran listas; ve el mensaje del catálogo | AC-009-06 |
