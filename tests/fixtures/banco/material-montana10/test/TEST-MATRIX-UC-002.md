# Test Matrix: UC-002 — Gestionar socios
> Refs: UC-002, API-001-03..06, BDD-UC-002 (AC-002-01..12), INV-ACC-001..003, INV-ACC-006..008, INV-ACC-103, RN-010, RN-014, RN-016, RN-021, SM-004
> Techniques: EP, BVA, decision table, state transition, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs
| Input | Type | Valid classes | Invalid classes | Boundaries |
|---|---|---|---|---|
| nombre | string | no vacío | vacío / solo espacios | — |
| correo | Correo (VO-002) | formato válido y no existente | sin formato ("marta"); duplicado (también con otra capitalización) | — |
| contrasena | string | ≥ 8 caracteres | < 8 | 7 / 8 (`PASSWORD_MIN_LENGTH`) |
| cuentaId | number | socio Activa sin préstamo Prestado ni multa Pendiente; ya en Baja | con Prestado o Pendiente; inexistente; no socio | — |
| rol y sesión | sesión | encargado vigente | socio, junta; sin sesión; caducada | — |

## Cases
| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|---|---|---|---|---|
| T01 | encargado crea "Marta Ruiz", marta@club.es, "Glaciar2026" | cuenta Activa rol socio, solo hash; "Marta Ruiz" en la lista sin hash; Marta puede entrar | happy | AC-002-01, INV-ACC-003 |
| T02 | marta@club.es existe; alta con ese correo y otro nombre | `E_CORREO_DUPLICADO` "Ya existe un socio con ese correo"; la lista mantiene un solo "Marta Ruiz" | error | AC-002-02, INV-ACC-001 |
| T03 | alta con "MARTA@Club.es" | `E_CORREO_DUPLICADO`; correo comparado en minúsculas | derived | INV-ACC-001, RN-014 |
| T04 | alta con el correo de una cuenta en Baja | undefined in spec | error | — |
| T05 | contraseña "corta" (5) | `E_CONTRASENA_CORTA` "La contraseña debe tener al menos 8 caracteres"; no se crea cuenta | error | AC-002-03 |
| T06 | contraseña de 7 caracteres | `E_CONTRASENA_CORTA`; no se crea cuenta | boundary | INV-ACC-002 |
| T07 | contraseña de 8 caracteres | cuenta creada | boundary | INV-ACC-002 |
| T08 | nombre vacío; correo "marta" (expand: nombre "  ", correo sin @) | `E_DATOS_SOCIO_INVALIDOS` "Indica un nombre y un correo válido"; no se crea cuenta | error | AC-002-12, RN-021 |
| T09 | alta idéntica repetida (replay) | `E_CORREO_DUPLICADO`; una sola cuenta | replay | AC-002-02 |
| T10 | dos altas simultáneas con marta@club.es | una crea la cuenta; la otra `E_CORREO_DUPLICADO` | race | AC-002-09, INV-ACC-001 |
| T11 | pablo sin préstamo Prestado ni multa Pendiente; baja | cuenta Baja; lista muestra "Baja"; Pablo no puede entrar (`E_CREDENCIALES_INVALIDAS`) | happy | AC-002-04, INV-ACC-006 |
| T12 | lucia con "Casco 2" prestado; baja | `E_BAJA_SOCIO_BLOQUEADA` "No se puede dar de baja: tiene material prestado o multas pendientes"; sigue Activa | error | AC-002-05, INV-ACC-007 |
| T13 | socio con multa Pendiente y sin préstamo; baja | `E_BAJA_SOCIO_BLOQUEADA`; sigue Activa | derived | INV-ACC-007, RN-010 |
| T14 | socio con multa Pagada y préstamo Devuelto; baja | cuenta Baja | derived | INV-ACC-007, RN-010 |
| T15 | socio con reserva Reservada (sin entregar) y sin multa; baja | undefined in spec | state | — |
| T16 | baja de pablo ya en Baja (replay) | sigue "Baja" sin cambios | replay | AC-002-10 |
| T17 | baja de cuentaId inexistente o de una cuenta no socio | undefined in spec | error | — |
| T18 | baja de socio mientras se registra su entrega (dos actores) | undefined in spec | race | — |
| T19 | restablecer marta con "Nieve2026" | "Contraseña restablecida"; Marta entra con ella; la antigua da `E_CREDENCIALES_INVALIDAS` | happy | AC-002-06, INV-ACC-103 |
| T20 | restablecer con "corta" | `E_CONTRASENA_CORTA`; la contraseña vigente sigue valiendo | error | AC-002-08, INV-ACC-002 |
| T21 | repetir "Nieve2026" a marta (replay) | "Contraseña restablecida"; Marta sigue entrando con ella | replay | AC-002-11 |
| T22 | restablecer cuentaId inexistente o cuenta en Baja | undefined in spec | error | — |
| T23 | dos restablecimientos simultáneos con contraseñas distintas | undefined in spec | race | — |
| T24 | socio abre Socios y llama alta, baja, restablecer (expand: 3 ops) | `E_SIN_PERMISO` "No tienes permiso para ver esta pantalla"; nada cambia | error | AC-002-07, INV-ACC-008 |
| T25 | junta llama crearSocio | `E_SIN_PERMISO`; no se crea cuenta | derived | INV-ACC-008, RN-016 |
| T26 | sin sesión; sesión caducada | `E_NO_AUTENTICADO` "Entrar"; `E_SESION_CADUCADA` "Tu sesión ha caducado"; sin cambios | derived | INV-ACC-008 |
| T27 | socio crea con datos inválidos | `E_SIN_PERMISO` (permiso antes que validación) | derived | INV-ACC-008, D-T-009 |
| T28 | listarSocios como encargado tras T01 y T11 | nombre, correo, estado de cada socio; sin hash; sin cambios | happy | AC-002-01, AC-002-04, INV-ACC-003 |
| T29 | fallo de almacén en alta (D-T-003) | `E_ALMACEN_NO_DISPONIBLE` "No se pudo completar la operación. Inténtalo de nuevo"; no se crea cuenta | error | D-T-003, INV-ACC-001 |

## State Transitions
| SM | From | Event / guard | To | Postcondition (≤80 chars) | Cases |
|---|---|---|---|---|---|
| SM-004 | Activa | baja, sin Prestado ni Pendiente | Baja | no puede entrar; la lista muestra "Baja" | T11, T14 |
| SM-004 | Activa | baja, con Prestado o Pendiente | Activa | `E_BAJA_SOCIO_BLOQUEADA`; sin cambios | T12, T13 |
| SM-004 | Baja | baja repetida | Baja | sin cambios | T16 |
| SM-004 | Baja | restablecer / alta con su correo | — | undefined in spec | T04, T22 |

## Findings for sdd-spec-auditor
| ID | Observation (≤120 chars) | Suggested action |
|---|---|---|
| F01 | AC-002-04 dice "sin reserva en curso"; INV-ACC-007 solo bloquea Prestado o Pendiente | Aclarar si Reservada bloquea la baja |
| F02 | Alta con correo de cuenta en Baja: no se dice si es duplicado | Definir en INV-ACC-001 |
| F03 | baja/restablecer con cuentaId inexistente, no socio o en Baja: sin error | Añadir error y AC |
| F04 | Sesión abierta de una cuenta que pasa a Baja o cambia contraseña: sin regla | Definir si se invalida |
| F05 | Baja concurrente con entrega, y restablecimientos concurrentes: sin AC | Añadir AC de carrera |
