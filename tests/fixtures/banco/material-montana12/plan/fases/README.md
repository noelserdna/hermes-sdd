# Incrementos del plan

| FASE | Incremento | Requisitos | UC | Depende de |
|------|-----------|------------|----|------------|
| FASE-0-SKELETON | Entrar y cargar material | REQ-F-001, REQ-F-007 | 001, 002, 015, 016 | — |
| FASE-1-RESERVAS | Reservar, ver y cancelar | REQ-F-003, REQ-F-004 | 007, 008, 009 | 0 |
| FASE-2-ENTREGAS | Entregar, recibir, panel, datos compartidos | REQ-F-005, REQ-F-008, REQ-NF-002 | 010, 011, 017 | 1 |
| FASE-3-SOCIOS | Alta, baja y contraseña | REQ-F-002 | 003, 004, 005, 006 | 2 |
| FASE-4-MULTAS | Ver y pagar multas | REQ-F-006 | 012, 013, 014 | 2, 3 |
| FASE-5-JUNTA | Historial, aislamiento, depuración | REQ-F-009, REQ-NF-001, REQ-NF-003 | 018, 019 | 4 |

Cobertura: los 9 REQ-F y 3 REQ-NF están en exactamente una FASE; REQ-C-001 y REQ-C-002 son criterios transversales.

```
 0 ─► 1 ─► 2 ─► 3 ─► 4 ─► 5
          └──────────┘ (4 depende también de 2)
```
