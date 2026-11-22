# Especificaciones derivadas

> Tier 1 = comportamiento nuevo visible (necesita REQ o aceptación explícita). Tier 2 = detalle técnico derivado de un REQ. Tier 3 = cosmético (no se registra).

| Métrica | Valor | Umbral | Estado |
|---|---|---|---|
| Tier 1 pendiente de REQ | 1 | ≤ 3 | PASS |
| Tier 2 registradas | 9 filas | — | Info |

## Spec-engineer derived

| Artefacto | Tipo | Derivado de | Tier | Justificación | Estado |
|---|---|---|---|---|---|
| RN-011 + `E_UNIDAD_NO_DISPONIBLE` | Regla + excepción | REQ-F-008, REQ-F-005 | 1 | baja de unidad con reservas futuras puede dejar sin unidad al entregar | **[PENDING REQ]** (valor adoptado: permitir la baja) |
| INV-ACC-101..103, INV-LOA-301, INV-LOA-401..402 | Invariante | REQ-F-001, REQ-F-002, REQ-F-005, REQ-F-009, REQ-F-010 | 2 | formaliza replay y solo lectura | Registered |
| `E_RESERVA_NO_ENCONTRADA`, `E_MULTA_NO_ENCONTRADA`, `E_UNIDAD_NO_ENCONTRADA`, `E_SOCIO_NO_ENCONTRADO` | Excepción | REQ-F-004..REQ-F-010 | 2 | identificador inexistente | Registered |
| `E_TIPO_INVALIDO`, `E_CANTIDAD_INVALIDA`, `E_DATOS_SOCIO_INVALIDOS`, `E_RESERVA_NO_ENTREGABLE` | Excepción | REQ-F-002, REQ-F-003, REQ-F-005, REQ-F-008 | 2 | entrada o estado inválido | Registered |
| RN-001..RN-010, RN-012..RN-024 | Reglas | Supuestos de REQUIREMENTS.md | 2 | concretan supuestos aprobados | Registered |
| API-003-07, API-003-08 | Operación | REQ-F-005, REQ-NF-001 | 2 | No recogida y retención | Registered |

## Audit derived
None.

## Resolution log
None.
