# Test Matrix: UC-004 — Cambiar contraseña provisional

> Refs: UC-004, API-001-03, API-001-08, BDD-UC-004 (AC-004-01..06), INV-SOC-002, INV-SOC-003, INV-SOC-006, RN-004, RN-020, RN-025, SM-003
> Techniques: EP, BVA, decision table, state transition, replay · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| password | string (VO-003) | longitud ≥ `PASSWORD_MIN_LENGTH` | longitud < `PASSWORD_MIN_LENGTH`; vacía | `PASSWORD_MIN_LENGTH`-1, `PASSWORD_MIN_LENGTH`, +1 |
| sesión | sesión | abierta con `mustChangePassword` | sin sesión; abierta de socio Activo | — |
| página pedida | página | Cambiar contraseña, Salir | cualquier otra | — |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Marta entra con la provisional | "Elige una contraseña nueva" en Cambiar contraseña · cuenta Provisional | happy | AC-004-01, INV-SOC-006 |
| T02 | Marta sin cambiar abre "/mis-reservas"; expand: enum(otras páginas de socio) | "Elige una contraseña nueva" en Cambiar contraseña | state | AC-004-02, INV-SOC-006 |
| T03 | Marta sin cambiar pulsa "Salir" | sesión cerrada · formulario "Entrar" (excepción de INV-SOC-006) | derived | INV-SOC-006, API-001-02 |
| T04 | envía "corta" | `E_CONTRASENA_CORTA` · "La contraseña debe tener al menos 8 caracteres" · contraseña y estado sin cambios | error | AC-004-03, INV-SOC-002 |
| T05 | expand: BVA(`PASSWORD_MIN_LENGTH`-1, `PASSWORD_MIN_LENGTH`, `PASSWORD_MIN_LENGTH`+1) | -1: `E_CONTRASENA_CORTA`; resto: cambio correcto | boundary | AC-004-03, AC-004-04 |
| T06 | envía cadena vacía | `E_CONTRASENA_CORTA` · sin cambios | boundary | AC-004-03 |
| T07 | envía contraseña de 8 o más caracteres | su página de socio · cuenta Activa · `mustChangePassword` false | happy | AC-004-04, RN-004 |
| T08 | tras T07, la provisional anterior | `E_CREDENCIALES` · no autentica | derived | INV-SOC-102, INV-SOC-003 |
| T09 | tras T07, el almacén guardado | no contiene la contraseña en claro | derived | INV-SOC-003, D-T-009 |
| T10 | visitante sin sesión envía contraseña nueva | formulario "Entrar" · nada cambia | error | AC-004-05, RN-020 |
| T11 | Marta ya cambió y envía la misma contraseña | sin duplicados · vigente = la enviada · cuenta Activa | replay | AC-004-06 |
| T12 | tras cambio, reenvía otra distinta | vigente = la última enviada | replay | UC-004 E3, AC-004-06 |
| T13 | socio Activo (sin provisional) envía contraseña | undefined in spec | error | — |
| T14 | almacén no disponible al guardar | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · contraseña y estado sin cambios | error | UC-004 Refs, D-T-002 |
| T15 | dos envíos simultáneos de Marta con contraseñas distintas | undefined in spec | race | — |

## State Transitions

| SM | From | Event / guard | To | Postcondition (≤ 80 chars) | Cases |
|----|------|---------------|----|----------------------------|-------|
| SM-003 | Provisional | cambiar contraseña, longitud ≥ mínimo | Activa | `mustChangePassword` false; hash guardado | T07 |
| SM-003 | Provisional | cambiar contraseña, longitud < mínimo | Provisional | sin cambios; sigue en Cambiar contraseña | T04, T05, T06 |
| SM-003 | Activa | cambiar contraseña, replay | Activa | vigente = la última enviada | T11, T12 |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-004-01 | Socio Activo que invoca changePassword: ni UC ni API definen resultado (RN-025 solo lo supone) | Definir error o permiso en API-001-03 |
| F-004-02 | Dos envíos concurrentes: E3 dice "última enviada" sin definir orden en simultáneo | Aclarar en UC-004 E3 |
| F-004-03 | Cambiar contraseña con almacén caído no tiene AC (solo Refs) | Añadir AC-004-07 |
