# UC-005 — Reservar material

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-003 (primary); WF-001 step 2; API-002-01, API-002-02; INV-RES-001, INV-RES-002, INV-RES-003, INV-RES-004, INV-RES-005, INV-STK-001, INV-ACC-007, INV-SEC-003; RN-001, RN-002, RN-005, RN-011; ADR-002, ADR-004, ADR-005; BDD-UC-005 |
| Actors | Primary: socio. Secondary: almacén (ADR-001) |
| Trigger | El socio envía el formulario de Reservar |
| Priority / Status | Must / Approved |

El socio consulta cuántas unidades quedan libres de un tipo de material en un rango y reserva una. El sistema asigna la unidad (RN-001).

## Input / Output

```typescript
interface ReservarInput  { material: TipoMaterial /* VO-004, INV-STK-001 */; inicio: Fecha; fin: Fecha /* VO-001 */ }
interface ReservarOutput { reservaId: string; material: TipoMaterial; unidad: number; inicio: Fecha; fin: Fecha; estado: 'Reservada'; mensaje: 'M_RESERVA_CREADA' }
interface DisponibilidadOutput { material: TipoMaterial; libres: Cantidad } // API-002-01
```

## Preconditions
1. Sesión válida de rol socio (INV-ACC-007).
2. El socio no tiene multa Pendiente (INV-RES-005).

## Postconditions
- Success: reserva en estado Reservada con la unidad libre de menor número (RN-001, INV-RES-001); se muestra M_RESERVA_CREADA y la reserva aparece en Mis reservas.
- Failure: no se crea ninguna reserva ni cambia el recuento de libres (INV-SEC-003); error según la tabla.

## Main flow
1. Socio: abre Reservar y elige tipo de material, inicio y fin.
2. Sistema: calcula las unidades libres del rango y las muestra, p. ej. "2 libres" (API-002-01, RN-001).
3. Socio: envía la reserva.
4. Sistema: valida tipo (INV-STK-001), `inicio` ≥ hoy (INV-RES-002, RN-002), `fin` ≥ `inicio` (INV-RES-003) y duración ≤ `RESERVATION_MAX_DAYS` (INV-RES-004).
5. Sistema: comprueba que el socio no tiene multa Pendiente (INV-RES-005).
6. Sistema: asigna la unidad libre de menor número y guarda la reserva de forma atómica y serializada (INV-RES-001, ADR-005).
7. Sistema: muestra M_RESERVA_CREADA.

## Extensions
- 6a. Otra reserva termina el día anterior a `inicio` → no hay solape y la reserva se crea. (AC-005-02)
- 5a. Socio sin multas → no queda bloqueado y la reserva se crea. (AC-005-03)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 6 | ninguna unidad libre en todo el rango | `E_SIN_UNIDADES` | no se crea reserva (INV-RES-001); elegir otras fechas | AC-005-04 |
| E2 | 4 | `inicio` < hoy | `E_FECHA_PASADA` | estado sin cambios; corregir fechas | AC-005-05 |
| E3 | 4 | `fin` < `inicio` | `E_FECHAS_INVERTIDAS` | estado sin cambios | AC-005-06 |
| E4 | 4 | más de `RESERVATION_MAX_DAYS` días | `E_RESERVA_MUY_LARGA` | estado sin cambios | AC-005-07 |
| E5 | 5 | socio con multa Pendiente | `E_MULTA_PENDIENTE` | no se crea reserva; las existentes se conservan (INV-RES-005) | AC-005-08 |
| E6 | 4 | tipo fuera del catálogo | `E_MATERIAL_INVALIDO` | estado sin cambios | AC-005-09 |
| E7 | 4 | campos vacíos o fecha mal formada | `E_DATOS_INVALIDOS` | estado sin cambios (RN-005) | AC-005-10 |
| E8 | 1 | rol distinto de socio | `E_ACCESO_NO_PERMITIDO` | no se muestra ni crea nada (INV-ACC-007) | AC-005-11 |
| E9 | 6 | dos socios reservan la última unidad a la vez | `E_SIN_UNIDADES` | gana la primera escritura confirmada; la otra no crea reserva (ADR-005) | AC-005-12 |
| E10 | 6 | fallo del almacén (compartido, WF-001) | `E_ALMACEN_NO_DISPONIBLE` | no se guarda nada (INV-SEC-003); reintentar | AC-005-13 |
| E11 | 3 | replay: mismo envío repetido | `—` | se devuelve la reserva existente idéntica, sin duplicar (RN-011); si no queda unidad, E1 | AC-005-14 |
