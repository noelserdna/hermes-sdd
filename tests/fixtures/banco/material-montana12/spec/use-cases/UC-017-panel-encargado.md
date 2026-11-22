# UC-017 — Ver panel del encargado

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-008 (primary), REQ-F-005; WF-001 steps 3-5; API-002-06, API-001-08; INV-RES-007, INV-RES-008, INV-MUL-001, INV-MUL-004, INV-SEC-003; RN-015, RN-018, RN-020, RN-022; ADR-002; E_ALMACEN_NO_DISPONIBLE; BDD-UC-017 |
| Actors | Primary: encargado. Secondary: almacén de datos |
| Trigger | El encargado abre el "Panel del encargado" ("/panel", REQ-F-008) |
| Priority / Status | Must / Approved |

El encargado ve qué entregar, qué está prestado y cuándo vuelve, y los retrasos, para una fecha (por defecto hoy).

## Input / Output

```typescript
interface PanelInput  { date?: Day /* VO-005; por defecto hoy (RN-022) */ }
interface PanelOutput {
  toDeliver: { quantity: Quantity; item: string; member: string; startDate: Day }[];
  loans: { quantity: Quantity; item: string; member: string; endDate: Day; lateDays?: number }[];
  returningOn: Day; returning: PanelOutput['loans']
}
```

## Preconditions
1. Sesión del encargado (API-001-08, INV-SEC-003).

## Postconditions
- Success: tres listas según RN-018 (Por entregar, Prestado, vuelven en la fecha); retraso solo en préstamos con fin pasado (INV-MUL-004); ninguna multa se crea al abrir (ADR-004).
- Failure: sin datos del panel; error según la tabla.

## Main flow
1. Encargado: abre "Panel del encargado" y, si quiere, elige una fecha.
2. System: comprueba la sesión y el rol (API-001-08, RN-020).
3. System: lista las Reservadas con inicio ≤ hoy ≤ fin como "Por entregar" con el botón "Entregar" (RN-018, INV-RES-007).
4. System: lista los Prestados; los de fin = hoy salen bajo "Vuelven hoy"; con fecha elegida, bajo "Vuelven el {fecha}" (RN-018).
5. System: marca "Retraso" en los Prestados con fin anterior a hoy, en "día"/"días" (RN-015, INV-MUL-004).
6. System: sin préstamos, muestra el aviso de lista vacía.

## Extensions
- 4a. Fecha elegida distinta de hoy → agrupa por esa fecha. (AC-017-03)
- 5a. Retraso de 1 día → singular. (AC-017-09)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | sesión de socio | `E_PAGINA_PROHIBIDA` | no se muestra ningún dato del panel (REQ-F-008, RN-020) | AC-017-06 |
| E2 | 2 | sesión de junta | `E_PAGINA_PROHIBIDA` | no se muestra ningún dato del panel (REQ-F-008, RN-020) | AC-017-07 |

## Supuestos
- RN-032: fecha vacía o no válida en el selector → `E_FECHA_INVALIDA`; el panel sigue mostrando la lista de hoy.
