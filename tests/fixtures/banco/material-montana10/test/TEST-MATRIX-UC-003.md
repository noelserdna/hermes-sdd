# Test Matrix: UC-003 — Reservar material
> Refs: UC-003, API-002-01, BDD-UC-003 (AC-003-01..12), INV-RES-001..005, INV-RES-008, INV-STK-004, INV-ACC-008, RN-002, RN-004, RN-017, RN-018
> Techniques: EP, BVA, decision table, replay, race · Default level: integration · Conventions: TEST-PLAN.md §3

## Inputs
| Input | Type | Valid classes | Invalid classes | Boundaries |
|---|---|---|---|---|
| tipo | TipoMaterial | uno de TIPOS_MATERIAL (rep. Piolet) | "Mochila", vacío | los 5 tipos (expand) |
| desde | Fecha | >= hoy | < hoy | hoy-1 / hoy / hoy+1 |
| hasta | Fecha | >= desde | < desde | desde-1 / desde |
| duración | días | 1..14 | >= 15 | 14 / 15 |
| unidades libres/día | entero | ocupadas < activas todos los días | algún día ocupadas = activas | última unidad |
| multa | Multa | ninguna o Pagada | Pendiente (2 €, 4 €) | importe literal |

## Cases
| ID | Precondition / Input | Expected (status · output · state) | Type | Refs |
|---|---|---|---|---|
| T01 | 3 Piolet libres; lucia Piolet 12-05..12-07 | "Reserva creada: Piolet del 2026-12-05 al 2026-12-07"; 1 Reservada | happy | AC-003-01 |
| T02 | expand: T01 con Piolet, Crampones, Casco, Cuerda, Tienda | una Reservada por tipo | derived | INV-STK-004 |
| T03 | Misma reserva Reservada, se envía de nuevo | sin error; una sola reserva; ocupación sin cambio | replay | AC-003-02, INV-RES-008 |
| T04 | 2 Tienda ocupadas 12-05..12-07; pablo Tienda 12-06 | `E_SIN_UNIDADES_LIBRES` "No quedan unidades libres de Tienda esas fechas"; sin reserva | error | AC-003-03 |
| T05 | 2 Tienda, una ocupada 12-05..12-06; pablo 12-07..12-08 | "Reserva creada: Tienda del 2026-12-07 al 2026-12-08" | happy | AC-003-04 |
| T06 | desde 2026-11-30 (hoy-1), Casco | `E_FECHA_PASADA` "Las fechas no pueden estar en el pasado"; sin reserva | boundary | AC-003-05 |
| T07 | desde = hoy 12-01, hasta 12-01, Casco libre | creada (1 día; desde=hoy válido) | boundary | AC-003-01, INV-RES-002 |
| T08 | Cuerda 12-10..12-09 | `E_FECHAS_INVERTIDAS` "La fecha final no puede ser anterior a la inicial" | boundary | AC-003-06 |
| T09 | Cuerda 12-10..12-10 (hasta=desde) | creada | boundary | AC-003-06, INV-RES-003 |
| T10 | Cuerda 12-10..12-23 (14 días) | creada | boundary | AC-003-07, INV-RES-001 |
| T11 | Cuerda 12-10..12-24 (15 días) | `E_RESERVA_MUY_LARGA` "Máximo 14 días por reserva" | boundary | AC-003-07 |
| T12 | Cuerda 12-10..12-25 (16 días) | `E_RESERVA_MUY_LARGA`; sin reserva | error | AC-003-07 |
| T13 | lucia multa Pendiente 4 €; Casco | `E_MULTA_PENDIENTE` "Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar" | error | AC-003-08 |
| T14 | pablo multa Pendiente 2 €; Casco | `E_MULTA_PENDIENTE` "...pendiente de 2 €..."; reservas previas se mantienen | error | AC-003-09, INV-RES-005 |
| T15 | 1 Crampones libre; dos socios envían a la vez | una Reservada; la otra `E_SIN_UNIDADES_LIBRES` "No quedan unidades libres de Crampones esas fechas" | race | AC-003-10, RN-018 |
| T16 | Sesión de encargado, Casco | `E_SIN_PERMISO` "No tienes permiso para ver esta pantalla"; sin reserva | error | AC-003-11 |
| T17 | tipo "Mochila" | `E_TIPO_INVALIDO` "Tipo de material no válido"; sin reserva | error | AC-003-12 |
| T18 | desde pasada + hasta invertida + 15 días | `E_FECHA_PASADA` (orden RN-017: pasado, orden, duración) | derived | RN-017, INV-RES-002 |
| T19 | rol no socio con tipo "Mochila" | `E_SIN_PERMISO` antes que `E_TIPO_INVALIDO` | derived | INV-ACC-008 |
| T20 | multa Pendiente y fechas pasadas | `E_FECHA_PASADA` antes que `E_MULTA_PENDIENTE` | derived | RN-017 |
| T21 | 2 Tienda; 1 Prestada + 1 Reservada el día | `E_SIN_UNIDADES_LIBRES` (Prestada cuenta) | state | INV-RES-004, RN-002 |
| T22 | 2 Tienda; 1 Cancelada/No recogida + 1 Reservada | creada (no ocupan) | state | INV-RES-004, RN-002 |
| T23 | 2 Tienda, 1 dada de baja, 1 Reservada | `E_SIN_UNIDADES_LIBRES` (solo activas) | derived | INV-RES-004 |
| T24 | multa Pagada, Casco | creada | derived | INV-RES-005 |
| T25 | Fallo del almacén inyectado | `E_ALMACEN_NO_DISPONIBLE` "No se pudo completar la operación. Inténtalo de nuevo"; sin reserva | error | D-T-003 |
| T26 | Sin sesión / sesión caducada | `E_NO_AUTENTICADO` / `E_SESION_CADUCADA`; sin reserva | error | INV-ACC-008 |
| T27 | Reservada previa idéntica fue Cancelada; se reenvía | undefined in spec | replay | — |

### Availability decision table (RN-002, por día)
| Ocupadas Reservada/Prestada vs activas | Resultado | Caso |
|---|---|---|
| todos los días ocupadas < activas | creada | T01, T05 |
| algún día ocupadas = activas | `E_SIN_UNIDADES_LIBRES` | T04, T21, T23 |
| ocupadas solo Cancelada/No recogida | creada | T22 |

## Findings for sdd-spec-auditor
| ID | Observation (≤120 chars) | Suggested action |
|---|---|---|
| F-003-01 | RN-004: "idéntica" no cubre reserva previa Cancelada; no se define si se crea otra | Definir en RN-004/UC-003 |
