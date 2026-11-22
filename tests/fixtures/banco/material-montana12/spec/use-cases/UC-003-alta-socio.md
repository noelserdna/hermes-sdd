# UC-003 — Dar de alta socio

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-002 (primary), REQ-NF-001; WF-002 step 1; API-001-04, API-001-08; INV-SOC-001, INV-SOC-002, INV-SOC-003, INV-SOC-009, INV-SEC-003; RN-004, RN-005, RN-020; SM-003; VO-002, VO-003; E_ALMACEN_NO_DISPONIBLE (fallo de almacén compartido, mensaje en VO-010); BDD-UC-003 |
| Actors | Primary: encargado. Secondary: almacén de datos |
| Trigger | El encargado envía el alta en la página "Socios" |
| Priority / Status | Must / Approved |

El encargado crea la cuenta de un socio con una contraseña provisional que el socio cambiará al entrar.

## Input / Output

```typescript
interface RegisterMemberInput  { name: string; email: Email /* VO-002, INV-SOC-001 */; password: string /* VO-003, INV-SOC-002 */ }
interface RegisterMemberOutput { accountId: AccountId; name: string; status: 'Provisional' }
```

## Preconditions
1. Sesión de encargado (INV-SEC-003).

## Postconditions
- Success: cuenta de socio en estado Provisional con `mustChangePassword`, contraseña solo cifrada (INV-SOC-003); aparece en la lista de Socios como Activo; se muestra "Socio creado".
- Failure: ninguna cuenta creada ni modificada (INV-SOC-001).

## Main flow
1. Encargado: envía nombre, correo y contraseña provisional en Socios.
2. Sistema: comprueba que es encargado (API-001-08, INV-SEC-003).
3. Sistema: valida la contraseña, mínimo `PASSWORD_MIN_LENGTH` (INV-SOC-002).
4. Sistema: comprueba que el correo no existe, ni entre cuentas de baja (INV-SOC-001, RN-005).
5. Sistema: crea la cuenta (INV-SOC-009) y la lista de Socios la muestra.

## Extensions
- 5a. la cuenta nueva entra con la provisional → UC-001 y UC-004 (WF-002 pasos 2-3).

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | quien envía no es encargado | `E_ACCESO_DENEGADO` | se rechaza sin cambios (RN-020, INV-SEC-003); al abrir Socios, `E_PAGINA_PROHIBIDA` | AC-003-04 |
| E2 | 3 | contraseña más corta que el mínimo | `E_CONTRASENA_CORTA` | sin cuenta nueva; el encargado corrige | AC-003-03 |
| E3 | 4 | correo ya existente, o dos altas simultáneas con el mismo correo | `E_SOCIO_DUPLICADO` | solo una cuenta; la lista no repite el socio (INV-SOC-001) | AC-003-02 |
| E4 | 5 | replay: se repite el alta ya hecha | `E_SOCIO_DUPLICADO` | no se duplica; sigue una sola fila | AC-003-02 |

## Supuestos
- RN-024: nombre vacío o correo con formato no válido → `E_SOCIO_DATOS_INVALIDOS`, sin crear la cuenta.
