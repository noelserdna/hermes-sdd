# UC-008 — Entregar material

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-005 (primary); WF-001 step 4; API-003-01, API-003-03, API-003-04; INV-LOA-001, INV-LOA-002, INV-ACC-007, INV-SEC-001, INV-SEC-003; SM-001; RN-003, RN-004; ADR-001, ADR-002, ADR-005; BDD-UC-008 |
| Actors | Primary: encargado. Secondary: reloj del sistema (ADR-002), almacén |
| Trigger | El encargado abre Préstamos o marca "Entregar" sobre una reserva |
| Priority / Status | Must / Approved |

El encargado ve las reservas y los préstamos y entrega la unidad reservada el día de inicio. Las reservas no recogidas pasan solas a No recogida y liberan la unidad.

## Input / Output

```typescript
interface EntregarInput  { reservaId: string }
interface PrestamosOutput { filas: { reservaId: string; socio: string; tipo: TipoMaterial /* VO-004 */; unidad: number; inicio: Fecha; fin: Fecha; estado: EstadoReserva /* VO-006 */; entregadaEl?: Fecha }[] }
```

## Preconditions
1. Sesión de encargado (INV-ACC-007).
2. La reserva está Reservada (INV-LOA-001).

## Postconditions
- Success: la reserva queda Entregado con `entregadaEl` = hoy (INV-LOA-001); Préstamos lo muestra.
- Success (día nuevo): toda Reservada con `inicio` < hoy queda No recogida y su unidad libre (INV-LOA-002).
- Failure: la reserva no cambia (INV-SEC-003); error según la tabla.

## Main flow
1. Encargado: abre Préstamos.
2. System: aplica No recogida a las Reservada con `inicio` < hoy (RN-004, API-003-03) y lista reservas y préstamos (API-003-04).
3. Encargado: marca "Entregar" sobre una reserva Reservada.
4. System: comprueba que existe, que está Reservada y que hoy = `inicio` (RN-003, INV-LOA-001).
5. System: pasa la reserva a Entregado y anota `entregadaEl` en una escritura atómica (INV-SEC-003, ADR-005).
6. System: Préstamos muestra el nuevo estado.

## Extensions
- 2a. Hay reservas con `inicio` < hoy sin entregar → se muestran como No recogida y la unidad queda libre para reservar. (AC-008-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 1, 3 | Socio o junta abre Préstamos o intenta entregar | `E_ACCESO_NO_PERMITIDO` | Se ve el mensaje; nada cambia (INV-SEC-002) | AC-008-04 |
| E2 | 4 | La reserva no existe | `E_RESERVA_NO_ENCONTRADA` | Nada cambia | AC-008-05 |
| E3 | 4 | Hoy es anterior a `inicio` | `E_ENTREGA_ANTICIPADA` | La reserva sigue Reservada | AC-008-03 |
| E4 | 4 | La reserva no está Reservada (ya Entregado por otro encargado: gana el primero; No recogida; Cancelada) | `E_ESTADO_INVALIDO` | Se conserva el estado y la `entregadaEl` del primero | AC-008-06 |
| E5 | 2, 5 | Falla el almacén | `E_ALMACEN_NO_DISPONIBLE` | Compartido (WF-001); nada cambia; se reintenta | AC-008-07 |
