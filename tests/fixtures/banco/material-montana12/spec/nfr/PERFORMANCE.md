# NFR — Performance

> Refs: REQ-NF-002; WF-001; UC-007, UC-010; values by name from VALUE-REGISTRY.md.

| ID | Metric / Control | Target | Fail point | Measurement / Enforcement | Refs |
|---|---|---|---|---|---|
| SPEC-PERF-001 | Visibilidad entre dispositivos: un cambio hecho en un navegador se ve desde otro al recargar | ≤ `SYNC_VISIBILITY_SECONDS` | > `SYNC_VISIBILITY_SECONDS` | Test: reserva creada desde un navegador y panel del encargado abierto desde otro; mide el tiempo hasta verla tras recargar | REQ-NF-002, UC-007, UC-017 |
| SPEC-PERF-002 | Datos compartidos: todos los usuarios leen y escriben en un único almacén de datos compartido en el servidor, nunca en el navegador | 0 datos de negocio guardados solo en el dispositivo | cualquier dato que un segundo dispositivo no vea | Test: dos sesiones independientes ven las mismas reservas, multas y material | REQ-NF-002, INV-RES-005 |
| SPEC-PERF-003 | Persistencia: tras reiniciar el servidor, las reservas, préstamos y multas anteriores siguen y el acceso funciona | 0 registros perdidos | ≥ 1 registro perdido | Test: crear reserva, reiniciar el servidor, entrar y listar (UC-001, UC-008) | REQ-NF-002, WF-001 |
