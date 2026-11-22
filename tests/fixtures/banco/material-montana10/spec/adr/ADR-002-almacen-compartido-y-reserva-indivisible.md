# ADR-002 — Un único almacén compartido y reserva indivisible por tipo

| Field | Value |
|---|---|
| Status | Accepted · 2026-11-21 |
| Refs | REQ-C-003, REQ-F-003, REQ-F-005, REQ-NF-001; RN-018; INV-RES-004, INV-LOA-002 |

## Context
Cuentas, reservas, inventario y multas deben verse desde cualquier dispositivo (REQ-C-003). Dos socios pueden pedir a la vez la última unidad (INV-RES-004) y dos entregas pueden asignar la misma unidad (INV-LOA-002).

## Decision
1. Los datos de negocio viven en un único almacén en servidor; nada de negocio en `localStorage` ni `sessionStorage`.
2. Comprobar las unidades libres y crear la reserva es una sola operación indivisible por tipo de material; igual con la asignación de unidad al entregar.
3. La tecnología concreta del almacén se decide en el diseño técnico, no aquí.

## Alternatives
| Option | Why not |
|---|---|
| Datos en el navegador de cada persona | incumple REQ-C-003 |
| Comprobar y luego escribir sin indivisibilidad | dos reservas sobre la última unidad (RN-018) |

## Consequences
- + La segunda petición concurrente recibe `E_SIN_UNIDADES_LIBRES`.
- − Se serializan las reservas del mismo tipo; asumible con el volumen de un club.
