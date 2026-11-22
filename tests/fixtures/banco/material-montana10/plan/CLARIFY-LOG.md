# Clarify Log — material-montana10

> Modo arnés (`--skip-clarify`): ninguna pregunta presentada. Las decisiones del cliente ya tomadas se aplican tal cual.

## System Vision Gate

Web de club pequeño (decenas de socios), SPA + API en un proceso Node; socio, encargado y junta; clave: REQ-C-002/003 e indivisibilidad por tipo (ADR-002).

| Dimensión | Estado | Evidencia |
|-----------|--------|-----------|
| Canales | Covered | TECHNICAL-DESIGN §3, `ux/WIREFRAMES.md` |
| Datos | Covered | ADR-DRAFT-001, ADR-002 |
| Auth | Covered | ADR-DRAFT-003, PERMISSIONS-MATRIX, decisiones del cliente (D-PA-003/004) |
| Integraciones | Covered | ninguna (SYSTEM-CONTEXT) |
| Calidad | Covered | QUALITY-ATTRIBUTES (seguridad, integridad, testabilidad) |

Coverage Gate: PASS (5/5).

## Decisions Without a Question

| ID | Categoría | Decisión | Evidencia | ADR |
|----|-----------|----------|-----------|-----|
| D-PA-001 | CL-SCOPE | 4 FASEs por viaje: reservar · cuidar y entregar · devolver y multar · socios y datos | R1-R5, TEST-PLAN R-7; REQ-F-002 es Should y su baja depende de préstamos (INV-ACC-007) | no |
| D-PA-002 | CL-UI | SPA vanilla con rutas por hash (`#/reservar`), sin fallback de servidor | TECHNICAL-DESIGN §5; ux/WIREFRAMES | no |
| D-PA-003 | CL-SEC | Las cuentas de encargado y junta las deja preparadas quien instala (`npm run cuentas`, idempotente, contraseña por entorno); `crearSocio` solo crea socios; `restablecerContrasena` solo sobre socios; el encargado solo gestiona socios | cliente Q-security-auditor-002; sustituye Supuesto 1 de TECHNICAL-DESIGN | no |
| D-PA-004 | CL-SEC | Baja de un socio con sesión abierta: la sesión deja de valer al instante (cada petición relee la cuenta; la baja borra sus sesiones en la misma transacción) | cliente Q-spec-auditor-001; INV-ACC-006, INV-ACC-008 | no |
| D-PA-005 | CL-DATA | Al purgar, una cuenta en Baja sin reservas, préstamos ni multas conservados se borra entera (nombre, correo, hash) | cliente Q-security-auditor-001; REQ-NF-001, SEC-006 | Needs ADR (spec) |
| D-PA-006 | CL-TEST | Reloj de pruebas por variable `CLOCK_FIXED` leída solo si `NODE_ENV!=production`; semillas de fixtures por la capa de datos | TEST-PLAN D-T-E2E2, R-1 | no |
| D-PA-007 | CL-OPS | Una sola cola de promesas (mutex global) para `transaction`; más grueso que «por tipo» y cumple ADR-002 | TECHNICAL-DESIGN §6 | no |
| D-PA-008 | CL-TEST | `API-003-07` se aplica al leer (derivado) y por tarea diaria; entra en FASE-1; `API-003-08` en FASE-3 | INV-RES-007, TECHNICAL-DESIGN Supuesto 2 | no |
