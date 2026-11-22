# Implementation Order

> **Generated:** 2026-11-22
> **Total FASEs:** 6
> **Recommended approach:** Incremental delivery per FASE

## FASE Dependency Graph

```text
FASE-0 ──► FASE-1 ──► FASE-2 ──► FASE-3 ──► FASE-4 ──► FASE-5
                         └────────────────────┘ (FASE-4 depende también de FASE-2)
```

## Recommended Implementation Sequence

### Wave 1: Esqueleto
**FASE-0** (sin dependencias; empezar aquí)
- 9 tasks, 0 parallelizable
- Critical path: 8 sequential tasks
- Streams: base(3) → A(5) → verificación(1)

### Wave 2: Reservas
**FASE-1** (depende de: FASE-0)
- 7 tasks, 0 parallelizable
- Critical path: 6 sequential tasks
- Streams: base(1) → A(5) → verificación(1)

### Wave 3: Entregas
**FASE-2** (depende de: FASE-1)
- 7 tasks, 0 parallelizable
- Critical path: 5 sequential tasks
- Streams: base(1) → A(5) → verificación(1)

### Wave 4: Socios
**FASE-3** (depende de: FASE-2)
- 7 tasks, 0 parallelizable
- Critical path: 7 sequential tasks
- Streams: base(1) → A(5) → verificación(1)

### Wave 5: Multas
**FASE-4** (depende de: FASE-2, FASE-3)
- 5 tasks, 0 parallelizable
- Critical path: 5 sequential tasks
- Streams: serial (A(4) → verificación(1))

### Wave 6: Junta
**FASE-5** (depende de: FASE-4)
- 6 tasks, 0 parallelizable
- Critical path: 4 sequential tasks
- Streams: serial (A(4) → verificación(2))

## Cross-FASE Dependencies

| From (Stream) | To (Stream) | Reason |
|---------------|-------------|--------|
| TASK-F0-007 (A) | TASK-F1-002 (A) | `listMaterial` y `dominio/disponibilidad` |
| TASK-F0-003 (base) | TASK-F1-003 (A) | `authorize` y propiedad por socio |
| TASK-F1-004 (A) | TASK-F2-002 (A) | estados y `prestamos.js` |
| TASK-F2-003 (A) | TASK-F4-001 (A) | las multas se crean al devolver |
| TASK-F1-004 (A) | TASK-F3-005 (A) | la baja usa `cancelReservation` |
| TASK-F3-001 (base) | TASK-F5-004 (A) | campo `bajaEn` |

## MVP Strategy

FASE-0 y FASE-1 ya dan algo usable: entrar, cargar material y reservar. FASE-2 cierra el ciclo del préstamo, FASE-3 sustituye la siembra de socios, FASE-4 cierra el ciclo con multas y FASE-5 añade la junta y la depuración.

## Delivery Checkpoints

Cada FASE: `fase-{N}-foundation` tras su última tarea base y `fase-{N}-verified` tras su recorrido (solo en el checkout principal).
