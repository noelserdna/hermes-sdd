# Test Matrix: UC-001 — Entrar y salir
> Refs: UC-001, API-001-01, API-001-02, BDD-UC-001 (AC-001-01..13), INV-ACC-003..006, INV-ACC-008, INV-ACC-101, INV-ACC-102, RN-005, RN-006, RN-014, RN-015, SM-004
> Techniques: EP, BVA, decision table, state transition, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs
| Input | Type | Valid classes | Invalid classes | Boundaries |
|---|---|---|---|---|
| correo | Correo (VO-002) | cuenta Activa (también con mayúsculas/espacios, RN-014) | desconocido; cuenta en Baja; vacío | — |
| contrasena | string | la vigente de la cuenta | incorrecta; vacía | — |
| fallos seguidos | contador | 0..4 | 5 (bloquea) | 4 / 5 (`LOGIN_MAX_FAILURES`) |
| tiempo desde bloqueo | min | ≥ 15 | < 15 | 14:59 / 15:00 (`LOGIN_LOCK_MINUTES`) |
| inactividad de sesión | h | < 8 | ≥ 8 | 7:59 / 8:00 (`SESSION_IDLE_HOURS`) |
| sesión | token | vigente | ausente; caducada; cerrada | — |

## Cases
| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|---|---|---|---|---|
| T01 | lucia@club.es / Cumbre2026, Activa, 0 fallos | sesión nueva; "Hola, Lucía" en Mis reservas; contador 0 | happy | AC-001-01, INV-ACC-101 |
| T02 | pablo@club.es / Arista2026 | "Hola, Pablo" en Mis reservas | happy | AC-001-02 |
| T03 | entra un encargado; entra una cuenta de la junta | encargado ve Entregas y devoluciones; junta ve Historial | happy | AC-001-12, RN-015 |
| T04 | correo " Lucia@Club.ES " con contraseña correcta | entra como lucia@club.es | derived | RN-014 |
| T05 | lucia con "mala" | `E_CREDENCIALES_INVALIDAS` "Correo o contraseña incorrectos"; sin sesión; contador +1; sigue en Entrar | error | AC-001-03 |
| T06 | correo desconocido; cuenta en Baja con su contraseña correcta (expand: 2 casos) | `E_CREDENCIALES_INVALIDAS` mismo mensaje; contador sin cambios | error | AC-001-10, INV-ACC-006 |
| T07 | 3 fallos, acierto, luego 4 fallos | no bloquea; el acierto reinició el contador a 0 | boundary | RN-005, INV-ACC-004 |
| T08 | 4 fallos seguidos, contraseña correcta | entra; contador 0 | boundary | RN-005, INV-ACC-004 |
| T09 | 4 fallos seguidos, otra incorrecta (5.º) | cuenta bloqueada 15 min; mensaje del 5.º intento: undefined in spec | boundary | AC-001-11 |
| T10 | bloqueada, contraseña correcta a los 14:59 | `E_CUENTA_BLOQUEADA` "Cuenta bloqueada. Inténtalo de nuevo en 15 minutos"; sin sesión | error | AC-001-04 |
| T11 | bloqueada, contraseña incorrecta a los 5 min | `E_CUENTA_BLOQUEADA`; el bloqueo no se alarga (termina a los 15 min del inicio) | state | AC-001-04, INV-ACC-004 |
| T12 | bloqueada hace 15:00 min, contraseña correcta | entra; "Hola, Lucía" en Mis reservas | boundary | AC-001-05 |
| T13 | sesión con 7:59 h sin actividad, operación | vale y renueva la actividad | boundary | INV-ACC-005, RN-006 |
| T14 | sesión con 8:00 h sin actividad, abre cualquier pantalla | `E_SESION_CADUCADA` "Tu sesión ha caducado"; se muestra Entrar | error | AC-001-06 |
| T15 | operaciones cada 7 h durante 3 veces | sesión sigue vigente (cada operación renueva) | derived | RN-006, INV-ACC-005 |
| T16 | sin sesión, abrir Mis reservas | `E_NO_AUTENTICADO`; se muestra el formulario Entrar | error | AC-001-08, INV-ACC-008 |
| T17 | lucia dentro pulsa Salir; luego abre Mis reservas | formulario Entrar; Mis reservas → `E_NO_AUTENTICADO` | happy | AC-001-07, INV-ACC-102 |
| T18 | reutilizar el token de la sesión cerrada | `E_NO_AUTENTICADO`; no vuelve a valer | derived | INV-ACC-102 |
| T19 | Salir sin sesión (replay) | se muestra Entrar; sin cambios | replay | AC-001-13 |
| T20 | mismo envío correcto dos veces seguidas | una sola sesión; "Hola, Lucía" | replay | AC-001-09, INV-ACC-101 |
| T21 | dos envíos correctos simultáneos | una sola sesión; ambos entran con normalidad | race | AC-001-09, INV-ACC-101 |
| T22 | cualquier respuesta/error de entrar | nunca contiene contraseña ni hash | derived | INV-ACC-003 |
| T23 | fallo de almacén al entrar (D-T-003) | `E_ALMACEN_NO_DISPONIBLE` "No se pudo completar la operación. Inténtalo de nuevo"; sin sesión; contador sin cambios | error | D-T-003, INV-ACC-004 |
| T24 | correo o contraseña vacíos | undefined in spec | error | — |

## State Transitions
| SM | From | Event / guard | To | Postcondition (≤80 chars) | Cases |
|---|---|---|---|---|---|
| SM-004 | Baja | iniciarSesion, cuenta en Baja | Baja | rechazada como credenciales inválidas; sin sesión | T06 |
| SM-004 | Activa | iniciarSesion, 5 fallos seguidos | Activa | bloqueo temporal 15 min; no cambia el estado de cuenta | T09, T10, T12 |

## Findings for sdd-spec-auditor
| ID | Observation (≤120 chars) | Suggested action |
|---|---|---|
| F01 | AC-001-11 no dice qué error/mensaje devuelve el 5.º fallo que bloquea | Definir si es `E_CREDENCIALES_INVALIDAS` o `E_CUENTA_BLOQUEADA` |
| F02 | Correo o contraseña vacíos sin criterio ni error | Añadir AC o asimilar a `E_CREDENCIALES_INVALIDAS` |
| F03 | Renovación de actividad (RN-006, paso 7) sin AC propio | Añadir escenario de sesión deslizante |
