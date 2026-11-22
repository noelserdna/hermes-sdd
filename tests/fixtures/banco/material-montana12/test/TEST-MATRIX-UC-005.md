# Test Matrix: UC-005 — Restablecer contraseña de socio

> Refs: UC-005, API-001-05, BDD-UC-005 (AC-005-01..06), INV-SOC-002, INV-SOC-003, INV-SOC-006, INV-SOC-102, INV-SEC-003, RN-004, RN-020, RN-027, SM-003
> Techniques: EP, BVA, decision table, state transition, replay · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| accountId (VO-001) | AccountId | socio Activa | inexistente; de Baja | — |
| password (VO-003) | string | longitud ≥ `PASSWORD_MIN_LENGTH` | longitud < mínimo | `PASSWORD_MIN_LENGTH`-1, `PASSWORD_MIN_LENGTH` |
| sesión | rol | encargado | socio, junta | — |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Encargado fija "Otra12345" a Marta (Activa) | OK · "Contraseña provisional guardada para Marta Ruiz" · Activa → Provisional | happy | AC-005-01, INV-SOC-006 |
| T02 | Tras T01 Marta entra con "Otra12345" | OK · "Elige una contraseña nueva" en Cambiar contraseña | state | AC-005-02 |
| T03 | Tras T01 Marta entra con la contraseña antigua | `E_CREDENCIALES` · "Correo o contraseña incorrectos" | error | AC-005-03, INV-SOC-102 |
| T04 | Tras T01 el almacén no contiene "Otra12345" en claro (D-T-009) | solo hash con sal | derived | INV-SOC-003 |
| T05 | Contraseña "corta" (`PASSWORD_MIN_LENGTH`-1) | `E_CONTRASENA_CORTA` · "La contraseña debe tener al menos 8 caracteres" · contraseña y estado sin cambios | boundary | AC-005-04 |
| T06 | Contraseña de exactamente `PASSWORD_MIN_LENGTH` caracteres | OK · guardada, Provisional | boundary | AC-005-01, RN-004 |
| T07 | Sesión de socio intenta restablecer a Marta | `E_ACCESO_DENEGADO` · "Acceso denegado" · sin cambios | error | AC-005-05 |
| T08 | Sesión de junta intenta restablecer | `E_ACCESO_DENEGADO` · sin cambios | error | INV-SEC-003, RN-020 |
| T09 | accountId inexistente | `E_SOCIO_NO_ENCONTRADO` · "El socio no existe o ya está de baja" · sin cambios | error | RN-027 |
| T10 | accountId de socio en Baja | `E_SOCIO_NO_ENCONTRADO` · sin cambios | error | RN-027 |
| T11 | Marta ya fijó "Otra12345"; el encargado repite lo mismo | OK · Marta entra con "Otra12345"; sin duplicados | replay | AC-005-06 |
| T12 | Restablecer con otra contraseña "Tercera123" tras T01 | queda la última; "Otra12345" ya no vale | replay | UC-005 E3 |
| T13 | Restablecer a socio ya Provisional (no ha cambiado aún) | `undefined in spec` | state | — |
| T14 | Fallo simulado del almacén | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · contraseña sin cambios | error | D-T-002 |

## State Transitions

| SM | From | Event / guard | To | Postcondition (≤ 80 chars) | Cases |
|----|------|---------------|----|----------------------------|-------|
| SM-003 | Activa | restablecer, contraseña válida | Provisional | nueva provisional; la anterior no autentica | T01, T03 |
| SM-003 | Activa | restablecer, contraseña corta | Activa | contraseña sin cambios | T05 |
| SM-003 | Baja | restablecer | Baja | sin cambios, `E_SOCIO_NO_ENCONTRADO` | T10 |
| SM-003 | Provisional | restablecer | undefined in spec | transición no definida en SM-003 | T13 |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-005-01 | SM-003 no define restablecer sobre cuenta ya Provisional (T13) | Añadir transición Provisional → Provisional o error |
