# Test Matrix: UC-015 — Añadir unidades de material

> Refs: UC-015, API-003-01, API-003-03, BDD-UC-015 (AC-015-01..06), INV-MAT-001, INV-MAT-003, INV-MAT-004, INV-SEC-003, RN-017, RN-020, RN-035
> Techniques: EP, BVA, decision table, replay · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs

| Input | Type | Valid classes | Invalid classes | Boundaries |
|-------|------|---------------|-----------------|------------|
| name | string | tipo existente; tipo nuevo; mismo tipo con otras mayúsculas | vacío; solo espacios (sin definir) | vacío / 1 carácter |
| quantity | Quantity (VO-006) | entero ≥ 1 | 0, negativo, decimal, no numérico | 0 / 1 / 2 |
| rol | sesión | encargado | socio, junta | — |

## Cases

`Type`: happy · error · boundary · state · replay · race · derived (sin AC propio: cita la regla en Refs).

| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|----|----------------------|-------------------------------------|------|------|
| T01 | Encargado; "Cuerda" 4; añade 2 Cuerda | OK · "Cuerda: 6 unidades" · total 6 | happy | AC-015-01 |
| T02 | Encargado; "Mosquetón" no existe; añade 10 | OK · "Mosquetón: 10 unidades" · tipo creado, total 10 | happy | AC-015-02 |
| T03 | quantity = 1 (mínimo) sobre "Cuerda" 4 | OK · "Cuerda: 5 unidades" | boundary | AC-015-01, VO-006 |
| T04 | expand: BVA(quantity: 0, -1, 1.5, "abc") | `E_CANTIDAD_INVALIDA` · "La cantidad debe ser un número entero de 1 o más" · totales sin cambios | error | AC-015-03, RN-017 |
| T05 | name vacío, quantity 3 | `E_NOMBRE_VACIO` · "El nombre del material no puede estar vacío" · sin cambios | error | AC-015-04, RN-017 |
| T06 | name vacío y quantity 0 a la vez | undefined in spec (qué error primero; paso 3 no fija orden) · sin cambios | error | — |
| T07 | expand: enum(socio, junta) añade 2 Cuerda | `E_PAGINA_PROHIBIDA` o `E_ACCESO_DENEGADO` · sin lista ni cambios | error | AC-015-05, RN-020, INV-SEC-003 |
| T08 | Sin sesión añade 2 Cuerda | undefined in spec (UC solo define rol distinto de encargado) · sin cambios | error | — |
| T09 | "Cuerda" 4; añade 2 con name "cuerda" y con "CUERDA" | OK · un solo tipo "Cuerda" con 6; no se crea duplicado | derived | INV-MAT-004 |
| T10 | name " Cuerda " con espacios alrededor | undefined in spec (recorte de espacios) | error | — |
| T11 | Tipo con total 0 (retirado) y añade 3 | OK · total 3 · pasa a `reservable` en listMaterial | derived | INV-MAT-003, API-003-03 |
| T12 | "Cuerda" 4; añade 2 y repite el mismo envío | OK ambos · "Cuerda: 8 unidades"; sin aviso «ya estaba» | replay | AC-015-06, RN-035, RN-012 |
| T13 | Almacén caído (D-T-002); añade 2 Cuerda | `E_ALMACEN_NO_DISPONIBLE` · "No se pudo guardar. Inténtalo de nuevo" · sin cambios | error | D-T-002 |
| T14 | Dos altas del mismo tipo nuevo "Mosquetón" a la vez | undefined in spec (¿un tipo con suma o duplicado?) | race | — |

## Findings for sdd-spec-auditor

| ID | Observation (≤ 120 chars) | Suggested action |
|----|---------------------------|------------------|
| F-015-01 | Nombre solo con espacios o con espacios alrededor: sin regla de recorte/normalización (INV-MAT-004) | Fijar trim y si " " es `E_NOMBRE_VACIO` |
| F-015-02 | Dos altas simultáneas de un tipo nuevo: sin regla de unicidad bajo concurrencia | Añadir excepción/AC de race |
| F-015-03 | Orden de validación nombre vs cantidad no fijado (paso 3) | Fijar orden como en UC-007 paso 4 |
| F-015-04 | Sesión ausente/caducada en UC-015 no tiene código de error propio | Indicar código para sin sesión |
