# Test Matrix: UC-003 — Dar de alta socio

> Refs: UC-003, API-001-04, BDD-UC-003 (AC-003-01..04), INV-SOC-001, INV-SOC-002, INV-SOC-003, INV-SOC-009, INV-SEC-003, RN-004, RN-005, RN-020, RN-024, SM-003
> Techniques: EP, BVA, decision table, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| name | string | no vacío | vacío; solo espacios (sin definir) | 1 carácter |
| email (VO-002) | Email | formato válido, nuevo | mal formado; ya existente (activo, de baja, otras mayúsculas) | — |
| password (VO-003) | string | longitud ≥ `PASSWORD_MIN_LENGTH` | longitud < mínimo | `PASSWORD_MIN_LENGTH`-1, `PASSWORD_MIN_LENGTH` |
| sesión | rol | encargado | socio, junta, sin sesión | — |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Encargado; "Marta Ruiz", "marta@club.test", "Provisional1" | OK · "Socio creado: Marta Ruiz" · fila "Marta Ruiz — Activo"; cuenta Provisional con `mustChangePassword` | happy | AC-003-01 |
| T02 | Tras T01, el almacén no contiene "Provisional1" en claro (D-T-009) | solo hash con sal; sin otros campos personales | derived | INV-SOC-003, INV-SOC-009 |
| T03 | Correo existente "marta@club.test" | `E_SOCIO_DUPLICADO` · "Ya existe un socio con ese correo" · una sola fila | error | AC-003-02 |
| T04 | Correo existente con otras mayúsculas "MARTA@club.test" | `E_SOCIO_DUPLICADO` · sin cuenta nueva | derived | INV-SOC-001 |
| T05 | Correo de una cuenta en Baja | `E_SOCIO_DUPLICADO` · sin cuenta nueva | derived | RN-005, INV-SOC-001 |
| T06 | Contraseña de `PASSWORD_MIN_LENGTH`-1 caracteres ("corta") | `E_CONTRASENA_CORTA` · "La contraseña debe tener al menos 8 caracteres" · sin cuenta | boundary | AC-003-03 |
| T07 | Contraseña de exactamente `PASSWORD_MIN_LENGTH` caracteres | OK · cuenta Provisional creada | boundary | AC-003-03, RN-004 |
| T08 | Nombre vacío | `E_SOCIO_DATOS_INVALIDOS` · "Escribe un nombre y un correo válidos" · sin cuenta | error | RN-024 |
| T09 | Correo mal formado (expand: enum(sin @, sin dominio)) | `E_SOCIO_DATOS_INVALIDOS` · sin cuenta | error | RN-024 |
| T10 | Nombre solo con espacios | `undefined in spec` | error | — |
| T11 | Nombre vacío y contraseña corta a la vez | `undefined in spec` (orden de validación) | error | — |
| T12 | Sesión de socio envía alta | `E_ACCESO_DENEGADO` · "Acceso denegado" · sin cuenta | error | AC-003-04 |
| T13 | Sesión de junta envía alta | `E_ACCESO_DENEGADO` · sin cuenta | error | INV-SEC-003, RN-020 |
| T14 | Socio abre la página Socios | `E_PAGINA_PROHIBIDA` | error | UC-003 E1, RN-020 |
| T15 | Se repite el alta de T01 (mismo payload) | `E_SOCIO_DUPLICADO` · sigue una sola fila | replay | AC-003-02 |
| T16 | Dos altas simultáneas con el mismo correo | una OK y otra `E_SOCIO_DUPLICADO` · una sola cuenta | race | AC-003-02, INV-SOC-001 |
| T17 | Fallo simulado del almacén en el alta | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · sin cuenta | error | D-T-002 |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-003-01 | Nombre solo con espacios no definido en RN-024 (T10) | Definir si se recorta y si cuenta como vacío |
| F-003-02 | Orden de validación del alta no definido: datos, contraseña, duplicado (T11) | Fijar orden en UC-003 paso 3-4 |
