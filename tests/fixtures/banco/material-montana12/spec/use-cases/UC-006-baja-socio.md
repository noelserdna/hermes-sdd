# UC-006 — Dar de baja socio

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-002 (primary); API-001-06, API-001-08, API-002-03 (cancelación de reservas); INV-SOC-007, INV-SOC-008, INV-SOC-101, INV-RES-005, INV-SEC-003; RN-005, RN-006, RN-012, RN-020; ADR-003, ADR-005; SM-001, SM-003; E_ALMACEN_NO_DISPONIBLE (fallo de almacén compartido, mensaje en VO-010); BDD-UC-006 |
| Actors | Primary: encargado. Secondary: almacén de datos |
| Trigger | El encargado pulsa dar de baja a un socio en "Socios" |
| Priority / Status | Must / Approved |

El encargado desactiva la cuenta de un socio sin préstamos sin devolver ni multas pendientes, conservando su historial.

## Input / Output

```typescript
interface RemoveMemberInput  { accountId: AccountId /* VO-001 */ }
interface RemoveMemberOutput { name: string; cancelledReservations: ReservationId[] }
```

## Preconditions
1. Sesión de encargado (INV-SEC-003); cuenta existente.

## Postconditions
- Success: cuenta en Baja, historial y correo conservados (ADR-003, RN-005); sus reservas Reservada pasan a Cancelada y liberan unidades (SM-001, INV-SOC-101, INV-RES-005).
- Failure: cuenta activa y reservas intactas (INV-SOC-007).

## Main flow
1. Encargado: pide la baja del socio en Socios.
2. Sistema: comprueba que es encargado (API-001-08).
3. Sistema: comprueba que no hay préstamos sin devolver (INV-SOC-007); si además hay multas, gana este error (RN-006).
4. Sistema: comprueba que no hay multas Pendiente (INV-SOC-007).
5. Sistema: en una sola operación cancela sus reservas Reservada, sin la guarda de fecha de API-002-03 (SM-001), y pasa la cuenta a Baja (API-001-06).
6. Sistema: muestra "Socio dado de baja: {nombre}".

## Extensions
- 6a. el socio dado de baja intenta entrar → `E_CREDENCIALES` (INV-SOC-008). (AC-006-02)
- 5a. con reservas futuras → quedan canceladas y sus unidades libres. (AC-006-03)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | quien envía no es encargado | `E_ACCESO_DENEGADO` | rechazo sin cambios (RN-020) | AC-006-06 |
| E2 | 3 | préstamo sin devolver, también si se entrega durante la baja | `E_BAJA_PRESTAMOS` | cuenta activa; sin cancelaciones | AC-006-04 |
| E3 | 4 | multa pendiente | `E_BAJA_MULTAS` | cuenta activa; sin cancelaciones | AC-006-05 |
| E4 | 6 | replay: baja de una cuenta ya de baja | `—` | sin cambios (RN-012, ADR-005) | AC-006-07 |

## Supuestos
- RN-026: la baja cierra las sesiones abiertas del socio; su siguiente petición muestra el formulario Entrar (INV-SOC-008).
- RN-027: baja repetida o de un socio inexistente → `E_SOCIO_NO_ENCONTRADO`, sin cambios.
