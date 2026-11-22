# UC-001 — Entrar con correo y contraseña

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-001 (primary); WF-001 step 1, WF-002 step 1; API-001-01; INV-ACC-004, INV-ACC-006, INV-ACC-007, INV-SEC-003; RN-006, RN-008; ADR-001, ADR-005; BDD-UC-001 |
| Actors | Primary: socio, encargado o junta. Secondary: almacén |
| Trigger | La persona envía su correo y contraseña en el formulario Entrar |
| Priority / Status | Must / Approved |

La persona abre una sesión y llega al inicio de su rol. Las cuentas de encargado y junta existen desde el despliegue (RN-006).

## Input / Output

```typescript
interface EntrarInput  { correo: Correo /* VO-002 */; contrasena: string }
interface EntrarOutput { rol: Rol /* VO-005 */; sesion: Sesion /* ENT-005 */ }
```

## Preconditions
1. La cuenta existe y está Activa (INV-ACC-006, SM-004).
2. No hay sesión abierta para este envío (API-001-01 es la única operación sin sesión, INV-ACC-007).

## Postconditions
- Success: sesión abierta; fallos seguidos a 0 (INV-ACC-004); se muestra el inicio del rol.
- Failure: no se abre sesión; solo cambia el contador de fallos o el bloqueo (INV-ACC-004); error según la tabla.

## Main flow
1. Socio: envía correo y contraseña.
2. System: comprueba que ambos datos vienen informados.
3. System: rechaza si la cuenta está bloqueada, incluso con contraseña correcta (INV-ACC-004).
4. System: verifica contraseña y estado Activa (INV-ACC-006); si falla, suma un fallo y, al llegar a `LOGIN_MAX_FAILURES`, bloquea `LOCK_MINUTES` (INV-ACC-004, SM-004).
5. System: pone los fallos a 0 y abre la sesión (INV-SEC-003).
6. System: muestra el inicio del rol: "Inicio del socio".

## Extensions
- 6a. Rol encargado → "Inicio del encargado". (AC-001-02)
- 6b. Rol junta → inicio de la junta. (AC-001-03)
- 3a. Bloqueo ya cumplido `LOCK_MINUTES` → sigue en 4 con fallos a 0. (AC-001-04)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | Correo o contraseña vacíos o mal formados | `E_DATOS_INVALIDOS` | Se queda en Entrar; no cuenta como fallo | AC-001-05 |
| E2 | 4 | Contraseña errónea o correo inexistente (RN-008, sin contador si no existe) | `E_CREDENCIALES_INVALIDAS` | Se queda en Entrar; suma un fallo si la cuenta existe | AC-001-06 |
| E3 | 3, 4 | Fallo número `LOGIN_MAX_FAILURES` o intento durante el bloqueo | `E_CUENTA_BLOQUEADA` | Se queda en Entrar; no se abre sesión | AC-001-07 |
| E4 | 4 | Cuenta en Baja con contraseña correcta (INV-ACC-006) | `E_CREDENCIALES_INVALIDAS` | Mismo resultado que E2; no se revela la baja | AC-001-08 |
| E5 | 5 | Almacén no disponible (compartido, ver VO-010) | `E_ALMACEN_NO_DISPONIBLE` | No se abre sesión ni cambia el contador (INV-SEC-003); reintentar | AC-001-09 |
| E6 | 5 | Replay: el mismo envío correcto otra vez | `—` | Se abre otra sesión; fallos siguen a 0; sin duplicar cuenta | AC-001-10 |

## Open questions
Ninguna. El inicio de la junta ("Historial del socio") está decidido en RN-012.
