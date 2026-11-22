# WF-002 — Alta y primer acceso de un socio

| Field | Value |
|---|---|
| Trigger | el encargado da de alta a un socio (UC-003) |
| Total timeout | — |
| Actors | encargado, socio |
| Refs | REQ-F-001, REQ-F-002; UC-001, UC-003, UC-004, UC-005, UC-007; SM-003; INV-SOC-001..006 |

## Steps

| # | Name | Type | Timeout | Retry | Input → Output | On failure | Compensation |
|---|---|---|---|---|---|---|---|
| 1 | Alta del socio (UC-003) | manual | — | — | nombre, correo, provisional → cuenta Provisional | `E_SOCIO_DUPLICADO`, `E_CONTRASENA_CORTA`, `E_SOCIO_DATOS_INVALIDOS` | — |
| 2 | Primer acceso con la provisional (UC-001) | manual | — | — | correo, provisional → sesión que exige cambiar | `E_CREDENCIALES`, `E_CUENTA_BLOQUEADA` | — |
| 3 | Cambio de contraseña (UC-004) | manual | — | — | contraseña nueva → cuenta Activa | `E_CONTRASENA_CORTA`: sigue en Cambiar contraseña | — |
| 4 | Primera reserva (UC-007) | manual | — | — | ver WF-001 | ver WF-001 | — |

Olvido: UC-005 deja la cuenta otra vez Provisional y se repiten los pasos 2 y 3.

## Navigation

| # | Screen | Actor | How to get there | What the user does |
|---|---|---|---|---|
| 1 | Socios | encargado | entrada «Socios» | rellena nombre, correo y contraseña provisional |
| 2 | Entrar | socio | dirección de la web | escribe correo y provisional |
| 3 | Cambiar contraseña | socio | se muestra al entrar con provisional | escribe la contraseña nueva |
| 4 | Mis reservas | socio | tras cambiar la contraseña | abre «Reservar» |

## Error scenarios

| Error | Step | Action | Result state |
|---|---|---|---|
| `E_ALMACEN_NO_DISPONIBLE` | 1, 3 | abortar, avisar | sin cambios |

## Events emitted
None.

## Metrics
None.
