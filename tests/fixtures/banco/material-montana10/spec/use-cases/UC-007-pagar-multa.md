# UC-007 — Pagar multa

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-007 (primary); WF-001 step 7; API-003-03, API-003-04; INV-LOA-005, INV-RES-005, INV-ACC-008; SM-002; ADR-002; BDD-UC-007 |
| Actors | Primary: Encargado. Secondary: almacén (ADR-002); Socio (vuelve a reservar) |
| Trigger | El Encargado abre Multas y marca una multa como pagada |
| Priority / Status | Must / Approved |

El Encargado anota el pago de una multa; el Socio vuelve a poder reservar si no le queda otra Pendiente.

## Input / Output

```typescript
interface PagarMultaInput  { multaId: number }
interface PagarMultaOutput { importeEur: number; socio: string; estado: 'Pagada'; pagadaEl: string }
```

## Preconditions
1. Sesión vigente con rol Encargado; Socio y Junta no acceden a Multas (INV-ACC-008).
2. La multa existe y está Pendiente o ya Pagada.

## Postconditions
- Success: multa Pagada con `pagadaEl` fijada una vez (INV-LOA-005); el Socio reserva si no tiene otra Pendiente (INV-RES-005).
- Failure: multas sin cambios; error según la tabla.

## Main flow
1. Encargado: abre la pantalla Multas (API-003-04).
2. System: lista todas las multas.
3. Encargado: marca una multa como pagada.
4. System: comprueba que la multa existe.
5. System: pasa a Pagada y fija `pagadaEl` (API-003-03, SM-002).
6. System: muestra "Multa de {importe} € · {socio} · Pagada"; el bloqueo del Socio depende solo de sus otras multas Pendientes (INV-RES-005).

## Extensions
- 6a. El Socio tiene otra multa Pendiente → sigue sin poder reservar y ve "Multa pendiente: {importe} €" en Mis reservas. (AC-007-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 1, 3 | un Socio o la Junta abre Multas directamente o intenta pagar | `E_SIN_PERMISO` | no se muestra la lista ni cambia ninguna multa (INV-ACC-008) | AC-007-04 |
| E2 | 4 | la multa no existe | `E_MULTA_NO_ENCONTRADA` | sin cambios; se muestra el mensaje | AC-007-05 |
| E3 | 5 | replay: la multa ya está Pagada, también si dos pagos coinciden | `—` | sigue Pagada una vez, con la misma fecha de pago (INV-LOA-005) | AC-007-03 |
