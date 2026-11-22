# FASE 5: Historial para la junta y datos personales protegidos

> **Estado:** Implementable
> **Incremento:** La junta consulta el historial de un socio sin poder cambiar nada, cada rol solo ve lo suyo y los datos viejos se borran solos
> **Requisitos:** REQ-F-009, REQ-NF-001, REQ-NF-003
> **Escenarios:** AC-018-01, AC-018-02, AC-018-03, AC-018-04, AC-018-05, AC-018-06, AC-019-01, AC-019-02, AC-019-03, REQ-NF-001 AC1, REQ-NF-001 AC2, REQ-NF-001 AC3, REQ-NF-001 AC4, REQ-NF-003 AC1
> **Necesidades:** N-009, N-010
> **Dependencias:** Fase 4

---

## Objetivo

Permitir que la **junta** busque a un socio y vea su historial de solo lectura, y cerrar la privacidad: aislamiento por rol verificado de punta a punta y borrado de datos antiguos (préstamos y multas a los 3 años; datos personales a los 3 años de la baja). Un solo bloque (serie).

## Criterios de Éxito

### UC-018 — Consultar historial de un socio
- [ ] Buscar por nombre o correo muestra préstamos y multas, también la pagada (AC-018-01, REQ-F-009)
- [ ] Socio sin préstamos, sin coincidencias, varios resultados: mensajes propios (AC-018-02, AC-018-03, AC-018-05)
- [ ] La junta solo lee: gestionar da «Acceso denegado» sin cambios (AC-018-04, INV-SEC-002); otros roles, rechazo (AC-018-06)

### UC-019 — Depurar historial antiguo
- [ ] Se borran los cerrados con `endDate` anterior a hoy − `RETENTION_YEARS`; el de límite exacto se queda (AC-019-01, AC-019-02, REQ-NF-003 AC2)
- [ ] Depurar dos veces deja el mismo estado; nunca borra deudas pendientes ni vivos (AC-019-03, RN-033)
- [ ] A los 3 años de la baja se borran nombre y correo de la cuenta (D-PA-003, REQ-NF-003)

### Transversal
- [ ] Un socio no ve reservas ni multas de otro; socio sin acceso a `/socios` (REQ-NF-001 AC1, AC3)
- [ ] La junta no puede entregar ni marcar pagada (REQ-NF-001 AC2); ninguna contraseña en claro (REQ-NF-001 AC4)
- [ ] El registro guardado solo tiene nombre, correo y hash (REQ-NF-003 AC1, INV-SOC-009)

## Specs a Leer

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-018`, `UC-019` | flujo, excepciones | historial, depuración |
| `adr/ADR-003-baja-logica.md` | §Decision | baja lógica y anonimizado |
| `domain/05-INVARIANTS.md` | INV-RES-011, INV-SEC-001..003, INV-SOC-009 | ver Invariantes |
| `contracts/API-cuentas.md`, `API-prestamos.md` | API-001-07, API-002-07 | firmas |
| `contracts/PERMISSIONS-MATRIX.md` | toda | matriz rol × operación |
| `nfr/SECURITY.md` | SPEC-SEC-001..007 | controles |
| `audits/SECURITY-AUDIT-BASELINE.md` | COMPLY-001 | plazo de datos de bajas |
| `test/TEST-PLAN.md` | PROP-016, 024; SEC-T-001..004; GAP-003 | seguridad |
| `test/E2E-SCENARIOS.md` | E2E-ACC-07, E2E-SEC-01 | E2E |

## Invariantes Aplicables

> Acumulativas: hereda las de FASE-0..FASE-4.

| ID | Dónde se aplica (bloque · función) |
|----|------------------------------------|
| INV-SEC-001, INV-SEC-002, INV-SEC-003 | A · `authorize`, `getMemberHistory` |
| INV-RES-011 | A · `depurar.purgeOldRecords` |
| INV-SOC-009 | A · `depurar` (datos personales de bajas) |

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | historial y depuración | `src/server/servicios/{historial,depurar}.js`, `src/server/servicios/cuentas.js` (solo `getMemberHistory` y campo de fecha de baja), `src/ui/paginas/historial.js`, `tests/**` de historial, depuración y seguridad | resto de servicios | FASE-4 |

## Contratos Resultantes

| Contrato | Firma / Ruta | Descripción (≤ 80 chars) |
|----------|--------------|--------------------------|
| API-001-07 | `getMemberHistory(ctx, {q, id?})` | historial de solo lectura |
| API-002-07 | `purgeOldRecords(ctx, {hoy})` | tarea interna, fecha inyectable (R-7) |

## Entregables de UI

| Ruta | Componente | UC | Wireframe | Descripción |
|------|------------|----|-----------|-------------|
| `/historial` | `historial.js` | UC-018 | SCR-010 | «Buscar socio» y enlaces de resultados |

## Verificación

```bash
npx vitest run tests/integration/historial.test.js tests/integration/depurar.test.js --maxWorkers=2  # UC-018/019 verdes
npx vitest run tests/security --maxWorkers=2   # SEC-T-001..004: rol × operación, almacén sin contraseña en claro
npm test && npm run lint                       # verdes
npx playwright test                            # E2E-ACC-07, E2E-SEC-01 verdes
```

## Demo

> Desde un checkout limpio: `npm install` · `node demo/sembrar.mjs fase-5` (Lucía con préstamos y una multa pagada, Marta con un préstamo de 2023, un miembro de junta) · `npx vite --host 127.0.0.1 --port 5173`.

| # | Acción | Resultado esperado | Escenario |
|---|--------|--------------------|-----------|
| 1 | Entrar como la junta y buscar «Lucía» | préstamos y multa pagada | AC-018-01 · N-009 |
| 2 | Buscar un nombre inexistente | mensaje de sin coincidencias | AC-018-03 · N-009 |
| 3 | La junta intenta «Entregar» o «Marcar pagada» | «Acceso denegado», sin cambios | AC-018-04, REQ-NF-001 AC2 · N-009, N-010 |
| 4 | Entrar como Lucía y pedir la reserva de otro socio | «Acceso denegado», sin datos | REQ-NF-001 AC1 · N-010 |
| 5 | Lucía abre `/socios` | «Acceso denegado» | REQ-NF-001 AC3 · N-010 |
| 6 | Abrir `data/datos.json` | solo nombre, correo y hash; ninguna contraseña | REQ-NF-001 AC4, REQ-NF-003 AC1 · N-010 |
| 7 | Lanzar la depuración con hoy = 2026-11-22 | desaparece el préstamo terminado en 2023-11-01; el de 2025-01-10 queda | AC-019-01, AC-019-02 · N-010 |
| 8 | Lanzar la depuración otra vez | sin cambios | AC-019-03 · N-010 |

## Alcance

**Incluye:** historial, depuración, verificación de aislamiento por rol, borrado de datos personales a los 3 años de la baja.
**Excluye:** nuevas operaciones; todo lo demás está en FASE-0..FASE-4.
