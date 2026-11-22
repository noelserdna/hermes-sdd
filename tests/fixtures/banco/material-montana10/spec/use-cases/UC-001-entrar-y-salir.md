# UC-001 — Entrar y salir

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-001 (primary); WF-002 steps 1-4; API-001-01, API-001-02; INV-ACC-003, INV-ACC-004, INV-ACC-005, INV-ACC-006, INV-ACC-008, INV-ACC-101, INV-ACC-102; RN-005, RN-006, RN-014, RN-015; BDD-UC-001 |
| Actors | Primary: cualquier cuenta (Socio, Encargado, Junta). Secondary: reloj (ADR-001) |
| Trigger | La cuenta abre Entrar o pulsa "Salir" |
| Priority / Status | Must / Approved |

La cuenta entra con su correo y contraseña, ve la pantalla que le toca y puede salir; la sesión caduca sola.

## Input / Output

```typescript
interface IniciarSesionInput  { correo: Correo /* VO-002 */; contrasena: string }
interface IniciarSesionOutput { nombre: string; rol: Rol /* VO-001 */; pantallaInicial: string /* RN-015 */ }
// cerrarSesion(): void
```

## Preconditions
1. Para entrar: ninguna sesión vigente de esa cuenta es necesaria (INV-ACC-008 no aplica a API-001-01).
2. Para salir: sesión vigente.

## Postconditions
- Success: una sola sesión nueva y contador de fallos a cero (INV-ACC-004, INV-ACC-101); o sesión cerrada (INV-ACC-102).
- Failure: sin sesión nueva; contraseña nunca mostrada (INV-ACC-003); error según la tabla.

## Main flow
1. Cuenta: abre Entrar y envía correo y contraseña (WF-002 step 1).
2. System: normaliza el correo (RN-014) y busca una cuenta Activa (INV-ACC-006).
3. System: comprueba que no está bloqueada (INV-ACC-004, WF-002 step 2).
4. System: verifica la contraseña; el acierto reinicia el contador (RN-005).
5. System: crea la sesión, una sola por envío repetido (INV-ACC-101).
6. System: muestra la pantalla inicial de su rol con "Hola, {nombre}" (RN-015).
7. System: cada operación renueva la actividad; pasado `SESSION_IDLE_HOURS` la sesión caduca (RN-006, WF-002 step 3).
8. Cuenta: pulsa "Salir" (WF-002 step 4).
9. System: cierra la sesión y muestra Entrar (INV-ACC-102). (AC-001-07)

## Extensions
- 4a. Fallo número `LOGIN_MAX_FAILURES` → la cuenta se bloquea `LOGIN_LOCK_MINUTES` (RN-005). (AC-001-11)
- 6a. Encargado o Junta → su pantalla inicial según RN-015. (AC-001-12)
- 3a. Bloqueo ya cumplido → se entra con normalidad. (AC-001-05)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 4 | contraseña incorrecta de cuenta existente | `E_CREDENCIALES_INVALIDAS` | suma 1 al contador; sigue en Entrar | AC-001-03 |
| E2 | 2 | correo desconocido o cuenta en Baja | `E_CREDENCIALES_INVALIDAS` | mismo mensaje; contador sin cambios (RN-005) | AC-001-10 |
| E3 | 3 | cuenta bloqueada | `E_CUENTA_BLOQUEADA` | sin sesión; el bloqueo no se alarga | AC-001-04 |
| E4 | 7 | `SESSION_IDLE_HOURS` sin actividad | `E_SESION_CADUCADA` | se muestra Entrar con el aviso | AC-001-06 |
| E5 | 7 | operación sin sesión (abrir una pantalla directamente) | `E_NO_AUTENTICADO` | se muestra Entrar | AC-001-08 |
| E6 | 5 | replay o doble envío simultáneo del mismo formulario correcto | `—` | una sola sesión; entra con normalidad | AC-001-09 |
| E7 | 9 | replay: "Salir" sin sesión | `—` | se muestra Entrar, sin cambios | AC-001-13 |
