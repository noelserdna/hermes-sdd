# WF-002 — Sesión de acceso

| Campo | Valor |
|---|---|
| Disparador | una persona abre la web |
| Actores | socio, encargado, junta |
| Refs | REQ-F-001, REQ-F-002, REQ-NF-001; UC-001..UC-004; INV-ACC-004, INV-ACC-005, INV-ACC-007; RN-006, RN-013 |

## Pasos

| # | Nombre | Tipo | Entrada → Salida | Si falla | Compensación |
|---|---|---|---|---|---|
| 1 | Entrar (UC-001) | sync | correo + contraseña → sesión e inicio del rol | `E_CREDENCIALES_INVALIDAS`, `E_CUENTA_BLOQUEADA` | — |
| 2 | Operar con sesión (UC-002) | sync | operación → resultado y actividad renovada | `E_NO_AUTENTICADO` | — |
| 3 | Caducidad (UC-002) | sync | `SESSION_IDLE_MINUTES` sin actividad → sesión inválida | `E_SESION_CADUCADA`: se muestra Entrar | volver a entrar |
| 4 | Salir (UC-002) | manual | "Salir" → sesión invalidada | — | — |
| 5 | Gestionar cuentas (UC-003, UC-004) | manual | encargado → socio creado, contraseña nueva o baja | `E_CORREO_DUPLICADO`, `E_CONTRASENA_CORTA`, `E_SOCIO_CON_MATERIAL` | — |

## Navegación

| # | Pantalla | Rol | Cómo llegar | Qué hace |
|---|---|---|---|---|
| 1 | Entrar | cualquiera | dirección de la web | envía correo y contraseña |
| 2 | Inicio del socio / Inicio del encargado / Historial del socio | por rol | tras entrar | usa el menú (RN-012) |
| 4 | Entrar | cualquiera | botón "Salir" | vuelve al formulario |
| 5 | Socios | encargado | menú del Panel del encargado | crea, restablece o da de baja |

## Escenarios de error

| Error | Paso | Acción | Estado resultante |
|---|---|---|---|
| `E_ALMACEN_NO_DISPONIBLE` | 1, 5 | no se abre sesión ni se cambia la cuenta | sin cambios |

## Eventos emitidos
None.

## Métricas
None.
