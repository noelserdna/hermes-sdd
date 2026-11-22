# UC-011 — Ver mis multas

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-006 (primary); WF-001 step 8; API-003-06; INV-SEC-001, INV-ACC-007, INV-FIN-004; SM-002; BDD-UC-011 |
| Actors | Primary: socio. Secondary: almacén |
| Trigger | El socio abre Mis multas |
| Priority / Status | Must / Approved |

El socio ve sus propias multas con importe y estado, y sabe si está bloqueado para reservar.

## Input / Output

```typescript
interface MisMultasInput  { }
interface MisMultasOutput { multas: { importe: Importe /* VO-008 */; estado: EstadoMulta /* VO-007 */; reservaId: string }[] }
```

## Preconditions
1. Sesión de socio (INV-ACC-007).

## Postconditions
- Success: Mis multas muestra solo las multas del socio, Pendiente y Pagada (INV-SEC-001); no cambia nada.
- Failure: no se muestra ninguna multa; error según la tabla.

## Main flow
1. Socio: abre Mis multas.
2. System: obtiene las multas cuyo dueño es el socio de la sesión (INV-SEC-001).
3. System: muestra cada importe con su estado.

## Extensions
- 2a. Otros socios tienen multas → no aparecen. (AC-011-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | Falla el almacén | `E_ALMACEN_NO_DISPONIBLE` | Compartido (WF-001); no se muestra la lista; se reintenta | AC-011-03 |
