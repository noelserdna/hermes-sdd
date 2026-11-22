# Test Matrix: UC-001 — Entrar

> Refs: UC-001, API-001-01, API-001-08, BDD-UC-001 (AC-001-01..09), INV-SOC-004, INV-SOC-005, INV-SOC-006, INV-SOC-008, INV-SEC-001, RN-001, RN-002, RN-007, RN-020, RN-023, SM-003
> Techniques: EP, BVA, decision table, state transition, replay · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| email | Email (VO-002) | cuenta activa de socio / encargado / junta | desconocido; cuenta de baja | — |
| password | string (VO-003) | la vigente de la cuenta | incorrecta | — |
| fallos seguidos | int | 0..`LOGIN_MAX_FAILURES`-1 | ≥ `LOGIN_MAX_FAILURES` (bloqueo) | `LOGIN_MAX_FAILURES`-1, `LOGIN_MAX_FAILURES` |
| tiempo desde bloqueo | min | ≥ `LOGIN_LOCK_MINUTES` | < `LOGIN_LOCK_MINUTES` | `LOGIN_LOCK_MINUTES`-1, `LOGIN_LOCK_MINUTES` |
| inactividad de sesión | min | < `SESSION_IDLE_MINUTES` | > `SESSION_IDLE_MINUTES` | `SESSION_IDLE_MINUTES`-1, `SESSION_IDLE_MINUTES`, +1 |
| página pedida | página | propia del rol | de otro rol; privada sin sesión | — |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | socio activo, credenciales correctas | sesión abierta · "Hola, Lucía" en "Mis reservas" | happy | AC-001-01 |
| T02 | encargado activo, credenciales correctas | sesión abierta · "Hola, Pablo" en "Panel del encargado" | happy | AC-001-02 |
| T03 | junta activa, credenciales correctas | sesión abierta · página "Historial del socio" | derived | RN-023 |
| T04 | cuenta Provisional, credenciales correctas | sesión abierta · Cambiar contraseña, `mustChangePassword` true | state | INV-SOC-006, SM-003 |
| T05 | contraseña incorrecta, cuenta existente | `E_CREDENCIALES` · "Correo o contraseña incorrectos" · sin sesión, fallos +1 | error | AC-001-03, INV-SOC-004 |
| T06 | correo desconocido | `E_CREDENCIALES` · mismo mensaje · sin sesión, ningún contador cambia | error | AC-001-03, RN-007 |
| T07 | cuenta de baja, contraseña correcta | `E_CREDENCIALES` · mismo mensaje · sin sesión | error | AC-001-03, INV-SOC-008 |
| T08 | 4 fallos seguidos y luego contraseña correcta | sesión abierta · fallos a cero (un nuevo fallo cuenta 1) | boundary | INV-SOC-004 |
| T09 | 5 fallos seguidos; 1 min después contraseña correcta | `E_CUENTA_BLOQUEADA` · "Cuenta bloqueada. Vuelve a intentarlo en 15 minutos" · sin sesión, contador sin cambios | error | AC-001-04, RN-001 |
| T10 | respuesta del 5.º fallo en sí (el que activa el bloqueo) | undefined in spec | boundary | — |
| T11 | bloqueada hace 14 min, contraseña correcta | `E_CUENTA_BLOQUEADA` · mensaje del catálogo · sin sesión | boundary | AC-001-04, INV-SOC-004 |
| T12 | bloqueada hace 15 min, contraseña correcta | sesión abierta · "Hola, Lucía" · fallos a cero | boundary | AC-001-05 |
| T13 | sesión con 29 min sin actividad, abre página propia | página mostrada · caducidad renovada | boundary | INV-SOC-005, RN-002 |
| T14 | sesión con exactamente 30 min sin actividad | undefined in spec (AC-001-06 caduca; INV-SOC-005 solo > 30) | boundary | AC-001-06, INV-SOC-005 |
| T15 | sesión con 31 min sin actividad, abre página | formulario "Entrar" · sesión caducada, sin datos privados | boundary | AC-001-06, RN-020 |
| T16 | sin sesión, abre "/mis-reservas" | formulario "Entrar" · sin datos | error | AC-001-07, RN-020 |
| T17 | socio con sesión abre página del encargado | `E_PAGINA_PROHIBIDA` · "No tienes permiso para ver esta página" · sin datos de otros socios | error | AC-001-08, INV-SEC-001 |
| T18 | socio con sesión; expand: enum(páginas de encargado, de junta) | `E_PAGINA_PROHIBIDA` · sin datos ajenos | error | AC-001-08, RN-020 |
| T19 | sesión abierta, reenvía credenciales correctas | segunda sesión abierta · "Hola, Lucía" · cuentas y estado sin duplicar | replay | AC-001-09 |
| T20 | almacén no disponible al entrar | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · sin sesión, fallos sin cambios | error | UC-001 Refs, D-T-002 |

## State Transitions

| SM | From | Event / guard | To | Postcondition (≤ 80 chars) | Cases |
|----|------|---------------|----|----------------------------|-------|
| SM-003 | Provisional | login correcto; sin cambio de estado | Provisional | muestra Cambiar contraseña, no su página | T04 |
| SM-003 | Baja | login con credenciales correctas | Baja | `E_CREDENCIALES`, sin sesión | T07 |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-001-01 | Borde de 30 min: AC-001-06 caduca a 30; INV-SOC-005 solo a más de 30 | Unificar a ≥ o > en INV-SOC-005 y AC-001-06 |
| F-001-02 | No se define la respuesta del 5.º fallo (E_CREDENCIALES o E_CUENTA_BLOQUEADA) | Fijar en UC-001 / RN-001 |
