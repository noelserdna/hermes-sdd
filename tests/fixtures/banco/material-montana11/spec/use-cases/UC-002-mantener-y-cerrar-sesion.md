# UC-002 — Mantener y cerrar la sesión

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-001 (primary); WF-002 steps 2, 3, 4; API-001-02, API-001-03; INV-ACC-005, INV-ACC-007, INV-SEC-003; ADR-001, ADR-002; BDD-UC-002 |
| Actors | Primary: socio, encargado o junta. Secondary: almacén, reloj del sistema |
| Trigger | La persona abre una pantalla con sesión, pulsa "Salir" o abre una pantalla sin sesión |
| Priority / Status | Must / Approved |

La sesión sigue abierta mientras haya actividad, termina al pulsar "Salir" y protege las pantallas de socio frente a visitantes anónimos.

## Input / Output

```typescript
interface ComprobarSesionInput { sesion?: Sesion /* ENT-005 */ }
interface ComprobarSesionOutput { cuenta: Cuenta; rol: Rol /* VO-005 */ }
interface CerrarSesionInput { sesion: Sesion }
```

## Preconditions
1. La sesión fue abierta en UC-001 (INV-ACC-005).

## Postconditions
- Success: cada operación con sesión válida renueva la actividad (INV-ACC-005); tras "Salir" la sesión deja de valer.
- Failure: no se muestra ningún dato de la cuenta (INV-SEC-001); se muestra Entrar.

## Main flow
1. Socio: abre cualquier pantalla.
2. System: comprueba la sesión (API-001-03) frente a `SESSION_IDLE_MINUTES` sin actividad (INV-ACC-005).
3. System: renueva la última actividad y muestra la pantalla (INV-SEC-003).
4. Socio: pulsa "Salir".
5. System: cierra la sesión (API-001-02) y muestra el formulario Entrar.

## Extensions
- 5a. Volver a una pantalla de socio tras "Salir" → Entrar (E1). (AC-002-02)
- 3a. Actividad dentro del plazo → la caducidad se cuenta desde la última actividad. (AC-002-04)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | Sin sesión (visitante anónimo o tras "Salir") | `E_NO_AUTENTICADO` | Se muestra Entrar; sin datos de la cuenta | AC-002-03 |
| E2 | 2 | Pasaron `SESSION_IDLE_MINUTES` sin actividad | `E_SESION_CADUCADA` | Se muestra Entrar con el aviso; la sesión ya no vale | AC-002-05 |
| E3 | 3, 5 | Almacén no disponible (compartido, ver VO-010) | `E_ALMACEN_NO_DISPONIBLE` | La actividad no se renueva y la sesión sigue como estaba (INV-SEC-003) | AC-002-06 |
| E4 | 5 | Replay: "Salir" sobre una sesión ya cerrada | `E_NO_AUTENTICADO` | Se muestra Entrar; nada cambia | AC-002-07 |
