# UC-003 — Reservar material

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-003 (primary); WF-001 steps 1–2; API-002-01; INV-RES-001..005, INV-RES-008, INV-STK-004, INV-ACC-008; RN-002, RN-004, RN-007, RN-017, RN-018; ADR-001; BDD-UC-003 |
| Actors | Primary: Socio. Secondary: almacén compartido, reloj (ADR-001) |
| Trigger | El socio envía el formulario de la pantalla Reservar |
| Priority / Status | Must / Approved |

El socio obtiene una reserva de un tipo de material para unas fechas, o el motivo concreto por el que no se crea.

## Input / Output

```typescript
interface ReservarInput  { tipo: TipoMaterial /* VO-004, INV-STK-004 */; desde: Fecha; hasta: Fecha /* VO-003 */ }
interface ReservarOutput { reserva: Reserva /* ENT-004, estado Reservada */ }
```

## Preconditions
1. Sesión vigente de una cuenta Activa con rol socio (INV-ACC-008).

## Postconditions
- Success: existe una Reserva `Reservada` que ocupa una unidad libre cada día (RN-002); se muestra Mis reservas con "Reserva creada: {material} del {desde} al {hasta}".
- Failure: no se crea ni cambia ninguna reserva; error según la tabla.

## Main flow
1. Socio: abre Reservar, elige tipo, desde y hasta, y envía.
2. System: comprueba rol y tipo (INV-ACC-008, INV-STK-004).
3. System: valida fechas en el orden de RN-017: pasado, orden, duración (INV-RES-002, INV-RES-003, INV-RES-001).
4. System: comprueba que no tiene multa Pendiente (INV-RES-005, RN-007).
5. System: si ya tiene una Reservada idéntica, la devuelve sin crear otra (RN-004, INV-RES-008).
6. System: en una sola operación indivisible por tipo, comprueba unidades libres cada día y crea la reserva (RN-002, RN-018, INV-RES-004).
7. System: muestra Mis reservas con la confirmación.

## Extensions
- 6a. Las unidades ocupadas no coinciden en los mismos días del rango → se crea la reserva. (AC-003-04)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | rol distinto de socio | `E_SIN_PERMISO` | no se crea nada | AC-003-11 |
| E2 | 2 | tipo fuera de `TIPOS_MATERIAL` | `E_TIPO_INVALIDO` | no se crea nada; se corrige el tipo | AC-003-12 |
| E3 | 3 | `desde` anterior a hoy | `E_FECHA_PASADA` | mensaje en Reservar; sin reserva | AC-003-05 |
| E4 | 3 | `hasta` anterior a `desde` | `E_FECHAS_INVERTIDAS` | mensaje en Reservar; sin reserva | AC-003-06 |
| E5 | 3 | duración mayor que `RESERVA_MAX_DAYS` | `E_RESERVA_MUY_LARGA` | mensaje en Reservar; sin reserva | AC-003-07 |
| E6 | 4 | multa Pendiente de 4 € | `E_MULTA_PENDIENTE` | mensaje con el importe; sin reserva | AC-003-08 |
| E7 | 4 | multa Pendiente de 2 € | `E_MULTA_PENDIENTE` | mensaje con el importe; sin reserva | AC-003-09 |
| E8 | 5 | replay: misma reserva Reservada | `—` | Mis reservas conserva una sola fila | AC-003-02 |
| E9 | 6 | algún día sin unidad libre | `E_SIN_UNIDADES_LIBRES` | mensaje en Reservar; sin reserva | AC-003-03 |
| E10 | 6 | dos socios por la última unidad a la vez | `E_SIN_UNIDADES_LIBRES` | gana la primera operación; la segunda ve el error (RN-018) | AC-003-10 |

Fallo de almacenamiento y sesión caducada o ausente: se describen una vez en el contrato API-002.
