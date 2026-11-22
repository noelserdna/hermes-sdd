# UC-005 — Restablecer contraseña de socio

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-002 (primary), REQ-F-001; WF-002 (repite pasos 2-3); API-001-05, API-001-08; INV-SOC-002, INV-SOC-003, INV-SOC-006, INV-SOC-102, INV-SEC-003; RN-004, RN-020; SM-003; VO-003; E_ALMACEN_NO_DISPONIBLE (fallo de almacén compartido, mensaje en VO-010); BDD-UC-005 |
| Actors | Primary: encargado. Secondary: almacén de datos |
| Trigger | El encargado da una contraseña provisional nueva a un socio que la olvidó |
| Priority / Status | Must / Approved |

El encargado sustituye la contraseña de un socio por una provisional que el socio deberá cambiar.

## Input / Output

```typescript
interface ResetInput  { accountId: AccountId /* VO-001 */; password: string /* VO-003, INV-SOC-002 */ }
interface ResetOutput { name: string }
```

## Preconditions
1. Sesión de encargado (INV-SEC-003); cuenta del socio existente.

## Postconditions
- Success: nueva contraseña solo cifrada (INV-SOC-003); la anterior deja de valer (INV-SOC-102); cuenta Activa → Provisional (SM-003, INV-SOC-006).
- Failure: contraseña de la cuenta sin cambios.

## Main flow
1. Encargado: elige al socio en Socios e introduce la provisional.
2. Sistema: comprueba que es encargado (API-001-08).
3. Sistema: valida mínimo `PASSWORD_MIN_LENGTH` (INV-SOC-002).
4. Sistema: guarda cifrada y activa `mustChangePassword` (API-001-05); muestra "Contraseña provisional guardada para {nombre}".
5. Socio: entra con la nueva (UC-001) y la cambia (UC-004).

## Extensions
- 5a. el socio entra con la contraseña antigua → `E_CREDENCIALES`. (AC-005-03)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | quien envía no es encargado | `E_ACCESO_DENEGADO` | rechazo sin cambios (RN-020, INV-SEC-003) | AC-005-05 |
| E2 | 3 | contraseña más corta que el mínimo | `E_CONTRASENA_CORTA` | contraseña sin cambios | AC-005-04 |
| E3 | 4 | replay: se repite el mismo restablecimiento | `—` | queda la última provisional; sin duplicados | AC-005-06 |

## Supuestos
- RN-027: restablecer a un socio de baja o inexistente → `E_SOCIO_NO_ENCONTRADO`, sin cambios.
