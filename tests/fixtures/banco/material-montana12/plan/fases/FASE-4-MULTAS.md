# FASE 4: Multas y bloqueo hasta pagarlas

> **Estado:** Implementable
> **Incremento:** El socio ve sus multas y no puede reservar mientras tenga alguna Pendiente; el encargado las lista y las marca pagadas, y se levanta el bloqueo
> **Requisitos:** REQ-F-006
> **Escenarios:** AC-012-01, AC-012-02, AC-012-03, AC-012-04, AC-013-01, AC-013-02, AC-013-03, AC-013-04, AC-013-05, AC-014-01, AC-014-02
> **Workflows:** WF-001
> **Necesidades:** N-005, N-006
> **Dependencias:** Fase 2, Fase 3

---

## Objetivo

Permitir que el **socio** consulte sus multas y que el **encargado** las gestione hasta el pago, cerrando el ciclo completo del préstamo (reservar, entregar, devolver con retraso, pagar, volver a reservar). Un solo bloque (serie).

## Criterios de Éxito

### UC-012 — Ver mis multas
- [ ] El socio ve su multa Pendiente con importe y días; sin multas, mensaje vacío (AC-012-01, AC-012-02, REQ-F-006)
- [ ] La multa de otro socio no aparece; otro rol recibe rechazo (AC-012-03, AC-012-04)

### UC-013 — Marcar multa pagada
- [ ] Marcar pagada levanta el bloqueo si no quedan otras Pendientes (AC-013-01, AC-013-03, INV-MUL-003)
- [ ] Repetir avisa «ya estaba pagada» sin cambios (AC-013-02, ADR-005)
- [ ] Multa inexistente o rol no permitido: error (AC-013-04, AC-013-05)

### UC-014 — Ver todas las multas
- [ ] Lista de todas con su estado; solo el encargado (AC-014-01, AC-014-02, REQ-F-006)

### Transversal
- [ ] Con una multa Pendiente no se reserva, pero las reservas hechas siguen (INV-MUL-002, REQ-F-006)
- [ ] Recorrido completo del ciclo del préstamo en un vídeo (WF-001, AC-013-01, REQ-F-006)

## Specs a Leer

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-012`, `UC-013`, `UC-014` | flujo, excepciones | multas |
| `adr/ADR-004-multa-al-devolver.md`, `ADR-005` | §Decision | multa y replay |
| `domain/02-ENTITIES.md`, `04-STATES.md` | ENT-004, SM-002 | multa |
| `domain/05-INVARIANTS.md` | INV-MUL-* | ver Invariantes |
| `contracts/API-multas.md` | API-004-01..03 | firmas |
| `workflows/WF-001-ciclo-prestamo.md` | todos los pasos | vídeo |
| `test/TEST-PLAN.md` | PROP-018, 019, 024 | propiedades |
| `test/E2E-SCENARIOS.md` | E2E-WF-001-01 | recorrido |

## Invariantes Aplicables

> Acumulativas: hereda las de FASE-0..FASE-3.

| ID | Dónde se aplica (bloque · función) |
|----|------------------------------------|
| INV-MUL-002 | A · `reserve` (ya existe); verificado con multas reales |
| INV-MUL-003 | A · `payFine` |
| INV-SEC-001, INV-SEC-003 | A · `listMyFines`, `payFine`, `listFines` |

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | multas | `src/server/servicios/multas.js`, `src/ui/paginas/{mis-multas,multas}.js`, `tests/**` de multas, `tests/e2e/ciclo-prestamo.spec.js` | `src/server/servicios/{prestamos,cuentas}.js` | FASE-3 |

## Contratos Resultantes

| Contrato | Firma / Ruta | Descripción (≤ 80 chars) |
|----------|--------------|--------------------------|
| API-004-01 | `listMyFines(ctx)` | multas propias |
| API-004-02 | `payFine(ctx, {id})` | Pendiente → Pagada; replay avisa |
| API-004-03 | `listFines(ctx)` | todas las multas |

## Entregables de UI

| Ruta | Componente | UC | Wireframe | Descripción |
|------|------------|----|-----------|-------------|
| `/mis-multas` | `mis-multas.js` | UC-012 | SCR-005 | multas del socio |
| `/multas` | `multas.js` | UC-013, UC-014 | SCR-009 | lista y «Marcar pagada» por fila |

## Verificación

```bash
npx vitest run tests/integration/multas.test.js --maxWorkers=2  # UC-012..014 verdes
npm test && npm run lint                                        # verdes
npx playwright test                                             # E2E-WF-001-01 (con vídeo) verde
```

## Demo

> Desde un checkout limpio: `npm install` · `node demo/sembrar.mjs fase-4` (Lucía con un préstamo vencido hace 3 días) · `npx vite --host 127.0.0.1 --port 5173`.

| # | Acción | Resultado esperado | Escenario |
|---|--------|--------------------|-----------|
| 1 | Pablo devuelve el préstamo vencido de Lucía | se crea la multa de 3 días | AC-011-02 · N-005 |
| 2 | Lucía abre «Mis multas» | multa Pendiente con importe | AC-012-01 · N-005 |
| 3 | Lucía intenta reservar | error por multa pendiente | AC-007-09 · N-005 |
| 4 | Pablo abre «Multas» | lista con la multa Pendiente | AC-014-01 · N-006 |
| 5 | Pablo pulsa «Marcar pagada» | pasa a Pagada | AC-013-01 · N-006 |
| 6 | Pablo vuelve a pulsarlo desde otra pestaña | aviso «ya estaba pagada» | AC-013-02 · N-006 |
| 7 | Lucía reserva de nuevo | reserva creada | AC-013-01 · N-005 |
| 8 | Lucía abre «Mis multas» | solo la multa pagada, sin Pendientes | AC-012-02 · N-005 |

## Alcance

**Incluye:** consulta y pago de multas, vídeo del ciclo WF-001.
**Excluye:** historial para la junta y depuración (FASE-5).
