# Test Matrix: UC-008 — Gestionar inventario
> Refs: UC-008, API-004-01..03, BDD-UC-008 (AC-008-01..09), INV-STK-001..004, INV-ACC-008, RN-002, RN-011, RN-016, SM-003
> Techniques: EP, BVA, decision table, state transition, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs
| Input | Type | Valid classes | Invalid classes | Boundaries |
|---|---|---|---|---|
| tipo | TipoMaterial (VO-004) | Piolet, Crampones, Casco, Cuerda, Tienda | "Mochila"; "piolet"; vacío | — |
| cantidad | number | entero ≥ 1 | 0; negativo; 1.5; no numérico | 0 / 1; tope superior sin definir |
| unidadId | number | unidad Activa libre; ya DeBaja; Prestada | inexistente (0, negativo, no entero) | — |
| rol y sesión | sesión | encargado vigente | socio, junta; sin sesión; caducada | — |

## Cases
| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|---|---|---|---|---|
| T01 | 3 Piolet; añadir 2 | Inventario "Piolet · 5 unidades"; mensaje "Añadidas 2 unidades de Piolet" | happy | AC-008-01, INV-STK-003 |
| T02 | añadir cantidad 1 | 1 unidad Activa nueva; mensaje para n=1: undefined in spec | boundary | — |
| T03 | añadir 1 unidad de cada tipo (expand: 5 tipos) | cada tipo suma 1 unidad Activa | derived | INV-STK-004 |
| T04 | tipo "Mochila"; "piolet" (expand: minúscula, vacío) | `E_TIPO_INVALIDO` "Tipo de material no válido"; sin cambios | error | AC-008-07, INV-STK-004 |
| T05 | cantidad 0 de Casco (expand: -1, 1.5, "abc") | `E_CANTIDAD_INVALIDA` "La cantidad debe ser un número entero de 1 o más"; sin cambios | error | AC-008-08 |
| T06 | cantidad muy grande (sin tope definido) | undefined in spec | boundary | — |
| T07 | 3 Piolet; añadir 2 y repetir el mismo formulario | 7 unidades; "Añadidas 2 unidades de Piolet" cada vez | replay | AC-008-02, INV-STK-003 |
| T08 | dos añadidos simultáneos de 2 Piolet sobre 3 | 7 unidades; ambos con éxito; sin pérdida | race | INV-STK-003 |
| T09 | "Casco 3" libre; baja | "Casco 3 · De baja"; "Casco · 2 unidades"; no se puede reservar | happy | AC-008-03, INV-STK-001 |
| T10 | tras T09, reservar Casco con las demás bajas | no cuenta como libre (`E_SIN_UNIDADES_LIBRES`) | state | AC-008-03, INV-STK-001 |
| T11 | dar de baja la última unidad Activa de un tipo | "{tipo} · 0 unidades"; unidad "De baja" | boundary | INV-STK-001, RN-002 |
| T12 | "Casco 1" prestada a Pablo; baja | `E_BAJA_UNIDAD_PRESTADA` "No se puede dar de baja: está prestada"; sigue Activa | error | AC-008-04, INV-STK-002 |
| T13 | unidad con reservas futuras; baja | pasa a DeBaja; efecto sobre esas reservas: undefined in spec | derived | RN-011 |
| T14 | unidad ya DeBaja; baja otra vez (replay) | sigue "De baja" una sola vez; sin cambios | replay | AC-008-05 |
| T15 | dos bajas simultáneas de la misma unidad libre | una unidad DeBaja una sola vez; ninguna da error | race | AC-008-05 |
| T16 | baja y entrega de la misma unidad a la vez | si entrega gana: `E_BAJA_UNIDAD_PRESTADA`, sigue Activa; si baja gana: error de la entrega undefined in spec | race | AC-008-04 |
| T17 | unidad inexistente (expand: 0, -1, 1.5) | `E_UNIDAD_NO_ENCONTRADA` "No existe esa unidad"; sin cambios | error | AC-008-09 |
| T18 | pablo (socio) abre Inventario; junta; (expand: 3 ops) | `E_SIN_PERMISO` "No tienes permiso para ver esta pantalla"; nada cambia | error | AC-008-06, INV-ACC-008 |
| T19 | sin sesión; sesión caducada | `E_NO_AUTENTICADO` "Entrar"; `E_SESION_CADUCADA` "Tu sesión ha caducado" | derived | INV-ACC-008 |
| T20 | socio con tipo inválido | `E_SIN_PERMISO` (permiso antes que validación) | derived | INV-ACC-008, D-T-009 |
| T21 | listarInventario del encargado | por tipo "{material} · {n} unidades" (solo Activas) y cada unidad con estado; sin cambios | happy | AC-008-01, AC-008-03 |
| T22 | fallo de almacén al añadir (D-T-003) | `E_ALMACEN_NO_DISPONIBLE` "No se pudo completar la operación. Inténtalo de nuevo"; sin unidades nuevas | error | D-T-003, INV-STK-003 |

## State Transitions
| SM | From | Event / guard | To | Postcondition (≤80 chars) | Cases |
|---|---|---|---|---|---|
| SM-003 | Activa | baja, unidad no Prestada | DeBaja | deja de contar como libre | T09, T10, T13 |
| SM-003 | Activa | baja, unidad Prestada | Activa | `E_BAJA_UNIDAD_PRESTADA`; sin cambios | T12, T16 |
| SM-003 | DeBaja | baja repetida | DeBaja | sin cambios | T14, T15 |

## Findings for sdd-spec-auditor
| ID | Observation (≤120 chars) | Suggested action |
|---|---|---|
| F01 | Mensaje "Añadidas {n} unidades" sin forma para n=1 | Fijar literal o singular |
| F02 | Cantidad sin tope superior | Definir máximo en VALUE-REGISTRY |
| F03 | Baja con reservas futuras (RN-011): sin AC en BDD ni efecto sobre ellas | Añadir AC y definir efecto |
| F04 | Baja gana carrera contra entrega: error de la entrega no definido | Definir error en API-003-01 |
