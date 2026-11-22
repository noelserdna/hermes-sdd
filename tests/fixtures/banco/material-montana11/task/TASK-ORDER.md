# Implementation Order

> **Generated:** 2026-11-21
> **Total FASEs:** 6
> **Recommended approach:** Incremental delivery per FASE (cada FASE es un viaje que se ve funcionando)

## FASE Dependency Graph

```text
FASE-0 ──► FASE-1 ──► FASE-2 ──► FASE-3 ──► FASE-4 ──► FASE-5
```

Cadena lineal: cada FASE amplía los mismos módulos (`permisos.js`, `plugin.js`, `textos.js`), por eso no se solapan.

## Recommended Implementation Sequence

### Wave 1: Skeleton
**FASE-0** (sin dependencias — empezar aquí)
- 9 tareas, 2 paralelizables
- Critical path: 8 tareas secuenciales (TASK-F0-001 → 002 → 004 → 005 → 006 → 007 → 008 → 009)
- Streams: base(3) → A(5) → verificación(1)

### Wave 2: Reservas
**FASE-1** (depende de FASE-0)
- 6 tareas, 0 paralelizables
- Critical path: 6 tareas
- Streams: serial

### Wave 3: Préstamo
**FASE-2** (depende de FASE-1)
- 5 tareas, 0 paralelizables
- Critical path: 5 tareas
- Streams: serial

### Wave 4: Multas
**FASE-3** (depende de FASE-2)
- 5 tareas, 0 paralelizables
- Critical path: 5 tareas
- Streams: serial

### Wave 5: Bajas
**FASE-4** (depende de FASE-3)
- 6 tareas, 0 paralelizables
- Critical path: 6 tareas
- Streams: serial

### Wave 6: Consultas
**FASE-5** (depende de FASE-4)
- 7 tareas, 0 paralelizables
- Critical path: 7 tareas
- Streams: serial

**Critical path global:** las 38 tareas, en cadena FASE-0 → FASE-5 (cada FASE termina en su tarea de recorrido, que cierra la puerta de aceptación antes de empezar la siguiente).

## Cross-FASE Dependencies

| From (Stream) | To (Stream) | Reason |
|---------------|-------------|--------|
| TASK-F0-009 (verificación) | TASK-F1-001 (A) | FASE-1 construye sobre el acceso, el almacén y el plugin de FASE-0 |
| TASK-F1-006 (verificación) | TASK-F2-001 (A) | entregar/recibir necesita reservas e inventario |
| TASK-F2-005 (verificación) | TASK-F3-001 (A) | las multas nacen de la devolución tardía de FASE-2 |
| TASK-F3-005 (verificación) | TASK-F4-001 (A) | la baja de socios y unidades comprueba reservas, préstamos y multas |
| TASK-F4-006 (verificación) | TASK-F5-001 (A) | consultas e historial leen todos los datos anteriores |

## MVP Strategy

El MVP es FASE-0 + FASE-1: el encargado da de alta socios y material, y el socio reserva y cancela. FASE-2 y FASE-3 completan el ciclo de préstamo y multas; FASE-4 y FASE-5 añaden bajas, consultas y cierre de seguridad.

## Delivery Checkpoints

| Checkpoint | Tras | Tag |
|------------|------|-----|
| Foundation FASE-0 | TASK-F0-003 | `fase-0-foundation` |
| Verified FASE-N | último TASK-FN de cada FASE | `fase-{N}-verified` |
