# Implementation Order

> **Generated:** 2026-11-21
> **Total FASEs:** 4
> **Recommended approach:** Incremental delivery per FASE (un viaje de usuario por entrega)

## FASE Dependency Graph

```text
FASE-0 ──► FASE-1 ──► FASE-2 ──► FASE-3
```

## Recommended Implementation Sequence

### Wave 1: Esqueleto
**FASE-0** (sin dependencias — empezar aquí)
- 10 tasks, 1 parallelizable
- Critical path: 9 sequential tasks
- Streams: base(4) → A(5) → integración(0) → verificación(1)

### Wave 2: Cuidar y entregar
**FASE-1** (depende de: FASE-0)
- 7 tasks, 0 parallelizable
- Critical path: 5 sequential tasks
- Streams: serial

### Wave 3: Devolver y multar
**FASE-2** (depende de: FASE-1)
- 6 tasks, 0 parallelizable
- Critical path: 5 sequential tasks
- Streams: serial

### Wave 4: Socios y datos personales
**FASE-3** (depende de: FASE-2)
- 6 tasks, 0 parallelizable
- Critical path: 5 sequential tasks
- Streams: serial

## Cross-FASE Dependencies

| From (Stream) | To (Stream) | Reason |
|---------------|-------------|--------|
| TASK-F0-008 (A) | TASK-F1-001 (A) | la derivación No recogida lee y amplía `reservas.js` |
| TASK-F0-009 (A) | TASK-F1-003 (A) | completa la pantalla Mis reservas mínima |
| TASK-F1-004 (A) | TASK-F2-001 (A) | devolver parte de una reserva Prestada |
| TASK-F1-006 (A) | TASK-F2-004 (A) | Devolver se añade a la pantalla Entregas |
| TASK-F1-001 (A) | TASK-F3-004 (A) | la purga amplía `tareas.js` y la tarea diaria |
| TASK-F2-002 (A) | TASK-F3-002 (A) | la baja se bloquea con multa Pendiente |
| TASK-F0-005 (A) | TASK-F3-002 (A) | la baja revoca sesiones (`sesiones.js`) |

## MVP Strategy

**Minimum Viable Product:** FASE-0 + FASE-1
- 17 total tasks
- Core capability: el encargado gestiona el inventario, los socios reservan, cancelan y reciben el material.

## Incremental Delivery Checkpoints

| Checkpoint | FASEs Complete | Capability |
|-----------|---------------|------------|
| CP-1 | FASE-0 | Entrar, inventario y reservar, ya desplegable |
| CP-2 | FASE-0,1 | Cancelar, entregar y ver lo que vuelve cada día |
| CP-3 | FASE-0,1,2 | Devolver, multas, pago e historial |
| CP-4 | FASE-0,1,2,3 | Altas y bajas de socios y borrado de datos personales |
