# UC-004 — Restablecer contraseña y dar de baja socio

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-002 (primary); WF-002 step 5; API-001-06, API-001-07; INV-ACC-002, INV-ACC-003, INV-ACC-006, INV-ACC-007, INV-LOA-004, INV-SEC-003; RN-005, RN-007; ADR-005; BDD-UC-004 |
| Actors | Primary: encargado. Secondary: almacén |
| Trigger | El encargado fija una contraseña nueva o da de baja a un socio en Socios |
| Priority / Status | Must / Approved |

El encargado devuelve el acceso a quien olvidó su contraseña y retira a quien deja el club. El historial de la baja se conserva (RN-007).

## Input / Output

```typescript
interface RestablecerInput { socioId: string; contrasena: Contrasena /* VO-003, INV-ACC-002 */ }
interface DarDeBajaInput   { socioId: string }
interface CuentaOutput     { socios: SocioVista[] /* UC-003 */ }
```

## Preconditions
1. Sesión de rol encargado (INV-ACC-007).
2. El socio existe.

## Postconditions
- Success: reset → contraseña nueva solo como hash (INV-ACC-003), la anterior ya no vale; baja → cuenta en Baja (SM-004, INV-ACC-006) y sus reservas Reservada pasan a Cancelada liberando la unidad (SM-001).
- Failure: cuenta y reservas sin cambios (INV-SEC-003); error según la tabla.

## Main flow
1. Encargado: elige un socio en Socios y envía una contraseña nueva.
2. System: valida el socio y la contraseña mínima (INV-ACC-002).
3. System: guarda el hash y muestra el aviso M_CONTRASENA_RESTABLECIDA.
4. Encargado: da de baja a un socio.
5. System: comprueba que no tiene reservas Entregado (INV-LOA-004).
6. System: pone la cuenta en Baja y cancela sus reservas Reservada de forma atómica (INV-SEC-003).
7. System: muestra la lista actualizada.

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | Contraseña por debajo de `PASSWORD_MIN_LENGTH` | `E_CONTRASENA_CORTA` | La contraseña anterior sigue vigente | AC-004-03 |
| E2 | 2, 5 | El socio no existe (RN-005) | `E_SOCIO_NO_ENCONTRADO` | Nada cambia | AC-004-04 |
| E3 | 5 | Reserva Entregado sin devolver, también si se entrega a la vez (INV-LOA-004) | `E_SOCIO_CON_MATERIAL` | Sigue Activa; reservas intactas | AC-004-05 |
| E4 | 1, 4 | Rol distinto de encargado | `E_ACCESO_NO_PERMITIDO` | Nada cambia | AC-004-06 |
| E5 | 3, 6 | Almacén no disponible (compartido, ver VO-010) | `E_ALMACEN_NO_DISPONIBLE` | Ni contraseña ni baja se aplican (INV-SEC-003) | AC-004-07 |
| E6 | 3 | Replay: la misma contraseña nueva otra vez | `—` | Mismo aviso; solo queda la contraseña nueva | AC-004-08 |
| E7 | 6 | Replay: baja de una cuenta ya en Baja | `—` | Sigue en Baja; sin más cancelaciones | AC-004-09 |

Sin sesión o con sesión caducada aplican `E_NO_AUTENTICADO` y `E_SESION_CADUCADA` de UC-002.
