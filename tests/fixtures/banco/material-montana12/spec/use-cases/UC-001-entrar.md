# UC-001 — Entrar

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-001 (primary), REQ-NF-001; WF-002 step 2; API-001-01, API-001-08; INV-SOC-004, INV-SOC-005, INV-SOC-006, INV-SOC-008, INV-SEC-001; RN-001, RN-002, RN-007, RN-020, RN-022; SM-003; VO-002, VO-003, VO-004; E_ALMACEN_NO_DISPONIBLE (fallo de almacén compartido, mensaje en VO-010); BDD-UC-001 |
| Actors | Primary: socio, encargado o junta. Secondary: almacén de datos |
| Trigger | El usuario envía el formulario Entrar o abre una página privada |
| Priority / Status | Must / Approved |

El usuario abre una sesión con su correo y contraseña y llega a la página de su rol. Sin sesión válida solo ve el formulario Entrar.

## Input / Output

```typescript
interface LoginInput  { email: Email /* VO-002 */; password: string /* VO-003 */ }
interface LoginOutput { role: Role /* VO-004 */; name: string; mustChangePassword: boolean }
```

## Preconditions
1. La cuenta existe y está activa, o se responde `E_CREDENCIALES` (INV-SOC-008).

## Postconditions
- Success: sesión abierta; fallos seguidos a cero (INV-SOC-004); se muestra la página de su rol, o Cambiar contraseña si `mustChangePassword` (INV-SOC-006).
- Failure: sin sesión; un fallo con cuenta existente suma al contador (INV-SOC-004); correo desconocido no suma (RN-007).

## Main flow
1. Usuario: envía correo y contraseña en Entrar.
2. Sistema: comprueba bloqueo de cuenta (`LOGIN_MAX_FAILURES`, `LOGIN_LOCK_MINUTES`; RN-001) y credenciales (RN-007).
3. Sistema: abre la sesión y muestra la página de su rol (API-001-01).
4. Usuario: abre una página privada; Sistema: autoriza con sesión y rol, caduca tras `SESSION_IDLE_MINUTES` sin actividad (API-001-08; INV-SOC-005, RN-002).

## Extensions
- 3a. `mustChangePassword` → se muestra Cambiar contraseña (UC-004; INV-SOC-006).
- 2a. pasados `LOGIN_LOCK_MINUTES` desde el bloqueo, la contraseña correcta entra. (AC-001-05)
- 3b. rol encargado → Panel del encargado. (AC-001-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | contraseña errónea, correo desconocido o cuenta de baja | `E_CREDENCIALES` | sin sesión; se muestra Entrar con el mensaje (INV-SOC-008) | AC-001-03 |
| E2 | 2 | cuenta bloqueada, aunque la contraseña sea correcta | `E_CUENTA_BLOQUEADA` | sin sesión; contador sin cambios | AC-001-04 |
| E3 | 4 | sin sesión o sesión caducada | `—` | se muestra el formulario Entrar (RN-020) | AC-001-06, AC-001-07 |
| E4 | 4 | página no permitida para el rol | `E_PAGINA_PROHIBIDA` | se informa; sin datos ajenos (RN-020, INV-SEC-001) | AC-001-08 |
| E5 | 3 | replay: segundo envío válido | `—` | se abre otra sesión sin duplicar cuentas ni estado | AC-001-09 |

## Supuestos
- RN-023: la página de inicio de la junta es «Historial del socio».
