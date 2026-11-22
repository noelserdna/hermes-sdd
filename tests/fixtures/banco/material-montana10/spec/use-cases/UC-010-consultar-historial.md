# UC-010 — Consultar historial

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-010 (primary); API-003-06; INV-LOA-402, INV-ACC-008; RN-012, RN-016, RN-023, RN-024; BDD-UC-010 |
| Actors | Primary: Junta. Secondary: Encargado |
| Trigger | Elegir un socio en la pantalla Historial |
| Priority / Status | Must / Approved |

La junta (o el encargado) ve todos los préstamos y multas de un socio sin poder cambiar nada.

## Input / Output

```typescript
interface HistorialInput  { socioId: number /* ENT-001 */ }
interface HistorialOutput {
  prestamos: { unidad: string | null; desde: Fecha; hasta: Fecha; estado: EstadoReserva /* VO-005 */ }[];
  multas: { importe: Importe /* VO-006 */; estado: 'Pendiente' | 'Pagada' }[];
}
```

## Preconditions
1. Sesión vigente de junta o encargado (INV-ACC-008, RN-016).

## Postconditions
- Success: se devuelve el historial completo (RN-012); no cambia ningún dato (INV-LOA-402).
- Failure: no se muestra historial; nada cambia; error según Exceptions.

## Main flow
1. Junta: abre Historial y elige un socio.
2. System: comprueba sesión y rol (INV-ACC-008).
3. System: comprueba que el socio existe.
4. System: devuelve sus reservas con estado y sus multas (RN-012).
5. System: muestra el resultado sin acciones (INV-LOA-402).

## Extensions
- 1a. Rol encargado → mismo resultado. (AC-010-05)
- 4a. Socio sin préstamos ni multas → mensaje de vacío. (AC-010-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | Socio abre Historial directamente | `E_SIN_PERMISO` | no se muestra historial; ve el mensaje del catálogo | AC-010-04 |
| E2 | 3 | El socio elegido no existe | `E_SOCIO_NO_ENCONTRADO` | no se muestra historial; puede elegir otro | AC-010-06 |
