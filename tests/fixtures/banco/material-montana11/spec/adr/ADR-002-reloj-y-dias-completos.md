# ADR-002 — "Hoy" sale del reloj del sistema y las fechas son días completos

| Campo | Valor |
|---|---|
| Estado | Aceptada · 2026-11-21 |
| Refs | REQ-F-003, REQ-F-004, REQ-F-005, REQ-F-006; RN-002, RN-004, RN-009; INV-RES-002, INV-LOA-002 |

## Contexto
Las reglas de reserva, cancelación, entrega y multa dependen de "hoy". Los criterios fijan fechas concretas y los tests necesitan controlarlas.

## Decisión
1. "Hoy" es la fecha del reloj del sistema, leída en un único punto inyectable.
2. Toda fecha de negocio es un día "AAAA-MM-DD" (VO-001); los instantes solo se usan para bloqueo y sesión.

## Alternativas
| Opción | Por qué no |
|---|---|
| Fecha del navegador | un dispositivo mal puesto cambiaría las reglas |
| Hora exacta en reservas | el club habla de días completos |

## Consecuencias
- + pruebas deterministas fijando el reloj
- − los días cambian a medianoche de la zona del servidor
