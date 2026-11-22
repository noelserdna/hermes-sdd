# UC-004 — Cambiar contraseña provisional

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-002 (primary), REQ-F-001; WF-002 step 3; API-001-03, API-001-08; INV-SOC-002, INV-SOC-003, INV-SOC-006; RN-004, RN-020; SM-003; VO-003; E_ALMACEN_NO_DISPONIBLE (fallo de almacén compartido, mensaje en VO-010); BDD-UC-004 |
| Actors | Primary: socio. Secondary: almacén de datos |
| Trigger | El socio con contraseña provisional entra o intenta abrir otra página |
| Priority / Status | Must / Approved |

El socio sustituye la contraseña provisional por la suya y accede a su página.

## Input / Output

```typescript
interface ChangePasswordInput  { password: string /* VO-003, INV-SOC-002 */ }
interface ChangePasswordOutput { role: Role; mustChangePassword: false }
```

## Preconditions
1. Sesión abierta con `mustChangePassword` (INV-SOC-006).

## Postconditions
- Success: contraseña nueva guardada solo cifrada (INV-SOC-003); cuenta Provisional → Activa (SM-003); se muestra la página de su rol.
- Failure: contraseña y estado sin cambios; sigue en Cambiar contraseña (INV-SOC-006).

## Main flow
1. Socio: entra con la provisional (UC-001); Sistema: muestra Cambiar contraseña (INV-SOC-006).
2. Sistema: toda otra página vuelve a Cambiar contraseña (API-001-08).
3. Socio: envía la contraseña nueva.
4. Sistema: valida mínimo `PASSWORD_MIN_LENGTH` (INV-SOC-002).
5. Sistema: guarda cifrada y quita `mustChangePassword` (API-001-03); muestra su página.

## Extensions
- 2a. el socio abre otra página sin cambiarla → se muestra Cambiar contraseña. (AC-004-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 3 | sin sesión | `—` | se muestra el formulario Entrar (RN-020) | AC-004-05 |
| E2 | 4 | contraseña más corta que el mínimo | `E_CONTRASENA_CORTA` | sin cambios; sigue en Cambiar contraseña | AC-004-03 |
| E3 | 5 | replay: se envía otra vez tras el cambio | `—` | se guarda la última enviada; sin duplicados | AC-004-06 |

## Supuestos
- RN-025: el socio Activo no cambia su contraseña por su cuenta; si la olvida, la restablece el encargado (UC-005).
