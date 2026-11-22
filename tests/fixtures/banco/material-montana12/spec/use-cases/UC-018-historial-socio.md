# UC-018 — Consultar historial de un socio

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-009 (primary), REQ-NF-001; API-001-07, API-001-08; INV-SEC-001, INV-SEC-002; RN-019, RN-020; E_ALMACEN_NO_DISPONIBLE (fallo de almacén compartido, mensaje en VO-010); BDD-UC-018 |
| Actors | Primary: junta. Secondary: almacén de datos |
| Trigger | La junta busca un socio en "Historial del socio" |
| Priority / Status | Must / Approved |

La junta busca un socio y consulta sus préstamos y multas, sin poder modificar nada.

## Input / Output

```typescript
interface HistoryInput  { query: string /* nombre o correo, parcial (RN-019) */; accountId?: AccountId /* VO-001 */ }
interface HistoryOutput { matches: { accountId: AccountId; name: string }[]; loans: { quantity: Quantity; item: string; start: Day; end: Day; returnedOn?: Day }[]; fines: { amountEur: number; status: FineStatus }[] }
```

## Preconditions
1. Sesión de junta (INV-SEC-002).

## Postconditions
- Success: se muestra el historial del socio elegido; ningún dato cambia (INV-SEC-002).
- Failure: ningún dato cambia; error según la tabla.

## Main flow
1. Junta: escribe nombre o correo en Historial del socio.
2. Sistema: comprueba el rol (API-001-08, INV-SEC-001).
3. Sistema: busca por nombre o correo, parcial y sin mayúsculas (API-001-07, RN-019).
4. Junta: si hay varios resultados, elige uno de la lista.
5. Sistema: muestra préstamos y multas del socio, solo lectura.

## Extensions
- 4a. varios resultados → se muestra la lista para elegir. (AC-018-05)
- 5a. el socio no tiene préstamos ni multas → se indica. (AC-018-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | rol distinto de junta, o la junta intenta una operación de gestión | `E_ACCESO_DENEGADO` | sin cambios ni datos de socios (INV-SEC-002, RN-020); al abrir la página, `E_PAGINA_PROHIBIDA` | AC-018-06 |
| E2 | 3 | ningún socio coincide | `E_BUSQUEDA_VACIA` | no se muestra historial | AC-018-03 |

## Supuestos
- RN-028: solo la junta consulta este historial; el encargado ve multas en «Multas» (UC-014).
