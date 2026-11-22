# UC-006 — Ver mis reservas

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-004 (primary); WF-001 step 3; API-002-03; INV-SEC-001, INV-ACC-007; RN-004; ADR-004; BDD-UC-006 |
| Actors | Primary: socio. Secondary: almacén (ADR-001) |
| Trigger | El socio abre Mis reservas |
| Priority / Status | Must / Approved |

El socio ve la lista de sus propias reservas con su estado, y puede cancelar desde ella (UC-007).

## Input / Output

```typescript
interface MisReservasInput  { /* identidad tomada de la sesión */ }
interface MisReservasOutput { reservas: { reservaId: string; material: TipoMaterial; inicio: Fecha; fin: Fecha; estado: EstadoReserva /* VO-006 */ }[] }
```

## Preconditions
1. Sesión válida de rol socio (INV-ACC-007).

## Postconditions
- Success: solo se devuelven reservas del socio de la sesión (INV-SEC-001); no cambia ningún dato.
- Failure: no se devuelve ninguna reserva; error según la tabla.

## Main flow
1. Socio: abre Mis reservas.
2. Sistema: aplica el paso de día a las reservas vencidas (RN-004).
3. Sistema: filtra por dueño y devuelve sus reservas con su estado (INV-SEC-001).
4. Sistema: muestra la lista.

## Extensions
- 3a. El socio no tiene reservas → se muestra "No tienes reservas". (AC-006-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 1 | sin sesión | `E_NO_AUTENTICADO` | se muestra Entrar; nada se lista (INV-ACC-007) | AC-006-03 |
| E2 | 3 | fallo del almacén (compartido, WF-001) | `E_ALMACEN_NO_DISPONIBLE` | no se lista nada; reintentar | AC-006-04 |
