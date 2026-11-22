# ADR-005 — Cada escritura es atómica y las concurrentes se serializan

| Campo | Valor |
|---|---|
| Estado | Aceptada · 2026-11-21 |
| Refs | REQ-F-003, REQ-F-005, REQ-F-008, REQ-C-003; INV-RES-001, INV-SEC-003; RN-011 |

## Contexto
Dos socios pueden pedir la última unidad a la vez; dos encargados pueden entregar, devolver o pagar lo mismo. Una baja de unidad o de socio cancela varias reservas.

## Decisión
1. Cada operación de escritura comprueba sus precondiciones y aplica todos sus cambios como una unidad; si falla, no queda nada a medias.
2. Las escrituras que tocan la misma unidad, reserva o multa se aplican una detrás de otra: gana la primera confirmada y la segunda ve el estado ya cambiado (`E_SIN_UNIDADES`, `E_ESTADO_INVALIDO` o la fila replay del caso de uso).

## Alternativas
| Opción | Por qué no |
|---|---|
| Comprobar y luego escribir sin bloqueo | permite dos reservas de una unidad (INV-RES-001) |

## Consecuencias
- + nunca hay dos reservas activas de una unidad en los mismos días
- − las escrituras compiten por turno; el volumen del club lo permite
