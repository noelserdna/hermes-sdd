# UC-014 — Ver todas las multas

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-006 (primary), REQ-F-005; WF-001 steps 5-6; API-004-03, API-001-08; INV-SEC-003, INV-MUL-001; RN-020; SM-002; E_ALMACEN_NO_DISPONIBLE; BDD-UC-014 |
| Actors | Primary: encargado. Secondary: almacén de datos |
| Trigger | El encargado abre "Multas" |
| Priority / Status | Must / Approved |

El encargado ve las multas de todos los socios con su estado y puede marcarlas pagadas (UC-013).

## Input / Output

```typescript
interface ListFinesInput  { /* sesión del encargado */ }
interface ListFinesOutput { fines: { fineId: FineId; member: string; amountEur: number; status: FineStatus /* VO-008 */ }[] }
```

## Preconditions
1. Sesión del encargado (API-001-08, INV-SEC-003).

## Postconditions
- Success: lista de todas las multas, una fila por multa, sin cambios de datos.
- Failure: sin datos de ninguna multa (RN-020).

## Main flow
1. Encargado: abre "Multas".
2. System: comprueba la sesión y el rol (API-001-08, RN-020).
3. System: lee todas las multas con el nombre de su socio.
4. System: muestra una fila por multa con nombre, importe y estado.

## Extensions
None.

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | sesión de socio o de junta | `E_PAGINA_PROHIBIDA` | no se muestra ninguna multa (INV-SEC-003, RN-020) | AC-014-02 |

## Supuestos
- RN-031: sin multas, «Multas» muestra «No hay multas».
