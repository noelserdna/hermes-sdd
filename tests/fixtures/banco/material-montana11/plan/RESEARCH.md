# Technical Research — material-montana11

> Phase 3 skipped: todos los ítems los deciden ADR, design/ o el plan de pruebas. Fuérzala con `/sdd-plan-architect --research`.

| Item | Category | Decided by | Decision | Ref |
|------|----------|------------|----------|-----|
| Almacén: JSON vs SQLite | CL-DATA | ADR-DRAFT-002 | fichero JSON atómico tras interfaz `store` | D-PA-008 |
| Servidor sin framework | CL-TECH | ADR-DRAFT-001 | plugin Vite + `node:http` | design §5 |
| Hash de contraseñas | CL-SEC | ADR-003 | scrypt con sal por cuenta (`node:crypto`) | design §7 |
| Primer encargado | CL-ENV | Q-tech-designer-001 | `npm run seed` | D-PA-001 |
| Reloj en pruebas | CL-TEST | TEST-PLAN R-1 | `hoy()` inyectable | D-PA-002 |
