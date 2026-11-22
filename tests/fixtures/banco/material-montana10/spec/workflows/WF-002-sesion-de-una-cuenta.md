# WF-002 — Sesión de una cuenta

| Field | Value |
|---|---|
| Trigger | una persona abre la web |
| Total timeout | `SESSION_IDLE_HOURS` sin actividad |
| Actors | cualquier cuenta, reloj (ADR-001) |
| Refs | REQ-F-001; UC-001; INV-ACC-004, INV-ACC-005; RN-005, RN-006, RN-015 |

## Steps

| # | Name | Type | Timeout | Retry | Input → Output | On failure | Compensation |
|---|---|---|---|---|---|---|---|
| 1 | entrar | sync | — | — | correo, contraseña → sesión y pantalla inicial | `E_CREDENCIALES_INVALIDAS` | — |
| 2 | bloqueo tras fallos | sync | `LOGIN_LOCK_MINUTES` | — | `LOGIN_MAX_FAILURES` fallos → cuenta bloqueada | `E_CUENTA_BLOQUEADA` | se libera con el tiempo |
| 3 | caducidad por inactividad | sync | `SESSION_IDLE_HOURS` | — | sesión sin uso → sesión caducada | `E_SESION_CADUCADA` | volver a entrar |
| 4 | salir | sync | — | — | sesión → sesión cerrada | — | — |

## Navigation

| # | Screen | Actor | How to get there | What the user does |
|---|---|---|---|---|
| 1 | Entrar | cualquier cuenta | dirección de la web | envía correo y contraseña |
| 4 | Mis reservas (o la pantalla inicial del rol) | cualquier cuenta | botón Salir | pulsa Salir y vuelve a Entrar |

## Error scenarios

| Error | Step | Action | Result state |
|---|---|---|---|
| `E_NO_AUTENTICADO` | cualquiera | mostrar Entrar | sin sesión |

## Events emitted
None.
