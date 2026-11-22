# ADR-001 — «Hoy» es la fecha natural de Europe/Madrid y el reloj se inyecta

| Field | Value |
|---|---|
| Status | Accepted · 2026-11-21 |
| Refs | REQ-F-003, REQ-F-004, REQ-F-005, REQ-F-006; RN-001, RN-008, RN-009 |

## Context
Reservas, cancelaciones, entregas y multas dependen de comparar fechas con «hoy». Los criterios fijan «hoy» en ejemplos (2026-12-05) que los tests deben poder reproducir.

## Decision
1. «Hoy» es el día natural de `ZONA_HORARIA` (RN-001).
2. Toda operación recibe el reloj como dependencia; ninguna lee la hora del sistema directamente.

## Alternatives
| Option | Why not |
|---|---|
| Hora UTC | el día cambia a las 01:00 o 02:00 locales y desplaza multas |
| Hora del navegador del socio | cada dispositivo daría un «hoy» distinto (REQ-C-003) |

## Consequences
- + Los tests fijan el día y comprueban los límites (cancelar el día antes, devolver el día `hasta`).
- − Un cambio de zona horaria del club exige cambiar el registro de valores.
