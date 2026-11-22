# UC-019 — Depurar historial antiguo

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-NF-003 (primary); API-002-07; INV-RES-011; RN-021, RN-022; E_ALMACEN_NO_DISPONIBLE; BDD-UC-019 |
| Actors | Primary: sistema. Secondary: almacén de datos |
| Trigger | Arranque del servidor y una vez al día (RN-021) |
| Priority / Status | Must / Approved |

El sistema borra los registros más antiguos que `RETENTION_YEARS` años; ningún usuario lo invoca.

## Input / Output

```typescript
interface PurgeInput  { today: Day /* VO-005, RN-022 */ }
interface PurgeOutput { deletedReservations: number; deletedFines: number }
```

## Preconditions
1. Almacén de datos accesible.

## Postconditions
- Success: no quedan reservas ni préstamos cerrados (RN-033) con `endDate` anterior a hoy − `RETENTION_YEARS` años (INV-RES-011) ni multas con creación anterior a ese límite (RN-021); el resto queda intacto.
- Failure: no se borra nada parcialmente visible; se reintenta en la siguiente ejecución.

## Main flow
1. Sistema: se activa al arrancar o al pasar un día (RN-021).
2. System: calcula el límite `hoy − RETENTION_YEARS` años (RN-022).
3. System: borra reservas y préstamos cerrados con `endDate` anterior al límite (INV-RES-011, RN-033).
4. System: borra multas Pagadas con creación anterior al límite (RN-021, RN-033).
5. System: devuelve los recuentos borrados.

## Extensions
- 3a. `endDate` igual al límite → se conserva (anterior estricto). (AC-019-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 3 | replay: segunda ejecución el mismo día | `—` | recuentos a 0; datos sin cambios | AC-019-03 |

## Supuestos
- RN-033: la depuración solo borra registros cerrados (reserva Devuelta, Cancelada o No recogida; multa Pagada); un préstamo sin devolver o una multa Pendiente no se borra.
