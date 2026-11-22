# Plan de FASEs — material-montana11

Cada FASE es un incremento que se ve funcionar en una demo (`Plan-Style: vertical`). Seis FASEs: una por viaje de usuario.

## Incrementos

| FASE | Incremento | Requisitos | UC | Depende de |
|------|-----------|------------|----|------------|
| 0 SKELETON | Entrar, crear socios, persistir | REQ-F-001 | 001, 002, 003 | — |
| 1 RESERVAS | Añadir material; reservar, ver y cancelar mis reservas | REQ-F-003, REQ-F-004 | 005, 006, 007, 013 | 0 |
| 2 PRESTAMO | Entregar, devolver, multa por retraso | REQ-F-005 | 008, 009, 010 | 1 |
| 3 MULTAS | Ver, bloquear y pagar multas | REQ-F-006, REQ-F-007 | 011, 012 | 2 |
| 4 BAJAS | Restablecer, baja de socio y de unidad | REQ-F-002, REQ-F-008 | 004, 014 | 3 |
| 5 CONSULTAS | Prestado, historial, datos cerrados | REQ-F-009, REQ-F-010, REQ-NF-001 | 015, 016 | 4 |

## Cobertura de requisitos

| Requisito | FASE que lo cierra | Prioridad |
|-----------|--------------------|-----------|
| REQ-F-001 | 0 | Must |
| REQ-F-002 | 4 (AC1-3, AC7 se ven desde la 0) | Must |
| REQ-F-003 | 1 | Must |
| REQ-F-004 | 1 | Must |
| REQ-F-005 | 2 | Must |
| REQ-F-006 | 3 (la multa nace en 2) | Must |
| REQ-F-007 | 3 | Must |
| REQ-F-008 | 4 (AC1, AC6, AC7 se ven desde la 1) | Must |
| REQ-F-009 | 5 | Must |
| REQ-F-010 | 5 | Must |
| REQ-NF-001 | 5 (se comprueba desde la 0) | Must |
| REQ-C-001..003 | criterios de todas las FASEs | — |

## Dependencias

```
FASE-0 -> FASE-1 -> FASE-2 -> FASE-3 -> FASE-4 -> FASE-5
```
