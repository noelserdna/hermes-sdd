# FASE 3: Socios y datos personales

> **Estado:** Implementable
> **Incremento:** El encargado da de alta y de baja socios y restablece contraseñas; una baja corta la sesión al instante y los datos personales se borran cuando ya no hacen falta.
> **Requisitos:** REQ-F-002, REQ-NF-001
> **Escenarios:** AC-002-01, AC-002-02, AC-002-03, AC-002-04, AC-002-05, AC-002-06, AC-002-07, AC-002-08, AC-002-09, AC-002-10, AC-002-11, AC-002-12, REQ-NF-001 AC1, REQ-NF-001 AC2
> **Workflows:** —
> **Necesidades:** N-002, N-011
> **Dependencias:** FASE-2

---

## Objetivo

Permitir que el **encargado** gestione solo socios (alta, baja, restablecer contraseña) y que el club cumpla la protección de datos: contraseñas con hash y borrado de préstamos, multas y cuentas dadas de baja cuando caduca su retención (D-PA-003, D-PA-004, D-PA-005). Un solo bloque serial.

## Criterios de Éxito

### UC-002 — Gestionar socios
- [ ] Alta de un socio con contraseña válida; correo duplicado, contraseña corta o datos inválidos rechazados (AC-002-01, AC-002-02, AC-002-03, AC-002-12, REQ-F-002)
- [ ] Baja de un socio sin préstamo Prestado ni multa Pendiente; si los tiene, se bloquea; repetirla no cambia nada (AC-002-04, AC-002-05, AC-002-10)
- [ ] Restablecer sustituye el hash; contraseña corta rechazada; repetir sin cambios (AC-002-06, AC-002-08, AC-002-11)
- [ ] Solo el encargado; ninguna operación crea ni cambia cuentas de encargado o junta (AC-002-07, D-PA-003)
- [ ] Altas simultáneas con el mismo correo: gana una (AC-002-09)
- [ ] Un socio dado de baja con la sesión abierta deja de poder usar la web al instante (INV-ACC-006, D-PA-004, REQ-F-002)

### UC-006 / API-003-08 — Retención
- [ ] Préstamos y multas cerrados hace más de `RETENTION_YEARS` se borran; una multa Pendiente nunca (REQ-NF-001 AC2, INV-LOA-006)
- [ ] Una cuenta en Baja sin reservas ni multas conservadas se borra con nombre y correo (REQ-NF-001 AC2, D-PA-005)

### Transversal
- [ ] Ninguna contraseña en claro en el almacén ni en las salidas (REQ-NF-001 AC1, SEC-001, SEC-002)

## Specs a Leer

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-002-gestionar-socios.md` | flujo y excepciones | comportamiento |
| `contracts/API-acceso.md`, `API-prestamos.md` | API-001-03..06, API-003-08 | firmas |
| `domain/04-STATES.md` | SM-004 | Cuenta Activa/Baja |
| `nfr/SECURITY.md`, `LIMITS.md` | SEC-001, 002, 006; LIM-004, 005 | datos |
| `CLARIFICATIONS.md` | RN-010, 013, 014, 021 | reglas |
| `design/OPERATION-MAPPING.md`, `ux/WIREFRAMES.md` | SCR-006 | rutas y pantalla |
| `tests/BDD-UC-002.md`; `test/TEST-MATRIX-UC-002.md`; `test/TEST-PLAN.md` | AC-002-*, SEC-T-001/002/005, LIM-T-004 | tests |

## Invariantes Aplicables

> Acumulativas: hereda las de FASE-0..2.

| ID | Dónde se aplica |
|----|-----------------|
| INV-ACC-007 | `socios.darDeBajaSocio` |
| INV-ACC-103 | `socios.restablecerContrasena` |
| INV-ACC-001..003 | `socios.crearSocio` (ya vigentes en login) |
| INV-LOA-006 | `tareas.purgarRegistrosAntiguos` |

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | dominio + SPA | `src/domain/{socios,tareas}.js`, `src/server/{http,sesiones}.js`, `src/ui/pantallas/socios.js`, `src/ui/{router,textos}.js`, `tests/unit/**` | `tests/e2e/**` | FASE-2 |
| Integración | e2e | `tests/e2e/**` | código de producción | A |

## Contratos Resultantes

- API-001-03 crearSocio · API-001-04 darDeBajaSocio · API-001-05 restablecerContrasena · API-001-06 listarSocios
- API-003-08 purgarRegistrosAntiguos (tarea diaria y `/api/tareas-diarias`)

## Entregables de UI

| Página / ruta | UC | Wireframe |
|---------------|----|-----------|
| `#/socios` Socios (encargado) | UC-002 | SCR-006 |

## Verificación

```
npm test            # unit + integración UC-002, SEC-T-001/002/005, LIM-T-004
npm run lint
npx playwright test --grep "ADM-01"
```

## Demo

Semilla: `CLOCK_FIXED=2026-11-21`; devolución de 2024-11-01 y otra de 2025-01-10; Pablo con sesión abierta.

| # | Acción | Resultado esperado | Escenario · Necesidad |
|---|--------|--------------------|-----------------------|
| 1 | Encargado da de alta a Marta | aparece en Socios | AC-002-01 · N-002 |
| 2 | Repite el alta con el mismo correo | correo duplicado | AC-002-02 · N-002 |
| 3 | Intenta dar de baja a quien tiene una multa Pendiente | bloqueado | AC-002-05 · N-011 |
| 4 | Da de baja a Pablo mientras tiene la sesión abierta | Pablo recibe «sin sesión» en su siguiente acción | AC-002-04 · N-011 |
| 5 | Restablece la contraseña de Marta | Marta entra con la nueva | AC-002-06 · N-002 |
| 6 | Ejecuta la limpieza diaria | la devolución de 2024 desaparece, la de 2025 queda | REQ-NF-001 AC2 · N-011 |
| 7 | Mira el fichero de datos | solo hashes, sin contraseñas | REQ-NF-001 AC1 · N-011 |

## Alcance

**Incluye:** socios, revocación de sesión, purga y borrado de cuentas en Baja.
**Excluye:** altas de encargado o junta (las prepara quien instala).
