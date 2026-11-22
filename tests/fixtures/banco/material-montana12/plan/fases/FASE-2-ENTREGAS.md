# FASE 2: Entregar y recibir el material, y el panel del día

> **Estado:** Implementable
> **Incremento:** El encargado entrega lo reservado, recibe las devoluciones (con multa si hay retraso) y ve qué hay prestado y qué vuelve cada día desde cualquier dispositivo
> **Requisitos:** REQ-F-005, REQ-F-008, REQ-NF-002
> **Escenarios:** AC-010-01, AC-010-02, AC-010-03, AC-010-04, AC-010-05, AC-010-06, AC-010-07, AC-011-01, AC-011-02, AC-011-03, AC-011-04, AC-011-05, AC-011-06, AC-011-07, AC-017-01, AC-017-02, AC-017-03, AC-017-04, AC-017-05, AC-017-06, AC-017-07, AC-017-08, AC-017-09, REQ-NF-002 AC1, REQ-NF-002 AC2
> **Necesidades:** N-004, N-005, N-008
> **Dependencias:** Fase 1

---

## Objetivo

Permitir que el **encargado** registre entregas y devoluciones, genere la multa por retraso y consulte el panel. Cierra las medidas de datos compartidos y persistencia (REQ-NF-002) porque el panel es lo que se ve desde otro dispositivo. Un solo bloque (serie).

## Criterios de Éxito

### UC-010 — Entregar reserva
- [ ] Entrega en fecha: la reserva pasa a Prestada; repetir avisa sin cambios (AC-010-01, AC-010-02, REQ-F-005)
- [ ] Antes de `startDate` no se entrega; vencida sin recoger queda «No recogida» y libera unidades (AC-010-03, AC-010-04)
- [ ] Inexistente, Cancelada, Devuelta o rol no permitido: error y sin cambios (AC-010-05, AC-010-06, AC-010-07)

### UC-011 — Recibir devolución
- [ ] A tiempo, sin multa; con 3 días de retraso multa de `FINE_PER_DAY_EUR` × 3; con 1 día × 1 (AC-011-01, AC-011-02, AC-011-03, REQ-F-005)
- [ ] Una multa por préstamo; devolver otra vez avisa sin multa nueva (AC-011-04, INV-MUL-001)
- [ ] No entregada, inexistente o rol no permitido: error (AC-011-05, AC-011-06, AC-011-07)

### UC-017 — Panel del encargado
- [ ] Muestra lo prestado, lo que vuelve hoy y lo que toca entregar; con fecha elegida; sin préstamos, mensaje vacío (AC-017-01, AC-017-02, AC-017-03, AC-017-04, AC-017-05)
- [ ] Lo vencido muestra 3 días o 1 día de retraso (AC-017-08, AC-017-09, REQ-F-005)
- [ ] Socio y junta no entran al panel (AC-017-06, AC-017-07, REQ-F-008)

### Transversal
- [ ] Reserva de un navegador visible en el panel de otro al recargar en ≤ `SYNC_VISIBILITY_SECONDS` (REQ-NF-002 AC1, SPEC-PERF-001)
- [ ] Tras reiniciar el servidor las reservas y préstamos siguen (REQ-NF-002 AC2, SPEC-PERF-003)
- [ ] Multa creada solo al devolver (ADR-004); precedencia `E_YA_*` y `E_NO_PRESTADA` fijada en D-PA-005 (GAP-007, AC-011-04, AC-010-02)

## Specs a Leer

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-010`, `UC-011`, `UC-017` | flujo, excepciones | entregar, devolver, panel |
| `adr/ADR-002`, `ADR-004`, `ADR-005` | §Decision | estados derivados, multa al devolver, replay |
| `domain/02-ENTITIES.md`, `04-STATES.md` | ENT-003, ENT-004, SM-001, SM-002 | reserva y multa |
| `domain/05-INVARIANTS.md` | INV-RES-*, INV-MUL-001, 004 | ver Invariantes |
| `contracts/API-prestamos.md` | API-002-04..06 | firmas |
| `workflows/WF-001-ciclo-prestamo.md` | pasos 3 a 5 | ciclo |
| `nfr/PERFORMANCE.md` | SPEC-PERF-001..003 | medidas |
| `test/TEST-PLAN.md` | PROP-011, 013, 014, 017, 020; GAP-007 | propiedades |
| `test/E2E-SCENARIOS.md`, `PERF-SCENARIOS.md` | E2E-WF-001-03; PERF-001..003 | E2E y medidas |

## Invariantes Aplicables

> Acumulativas: hereda las de FASE-0 y FASE-1.

| ID | Dónde se aplica (bloque · función) |
|----|------------------------------------|
| INV-RES-007, 008, 009 | A · `deliverReservation`, `dominio/estados` |
| INV-MUL-001, INV-MUL-004 | A · `returnLoan`, `dominio/multas` |
| INV-SEC-003 | A · `authorize` (entregar, devolver, panel) |

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | entregas y panel | `src/server/servicios/prestamos.js`, `src/server/dominio/multas.js`, `src/server/servicios/panel.js`, `src/ui/paginas/panel.js`, `demo/sembrar.mjs`, `tests/**` de entregas, panel y rendimiento | `src/server/servicios/{cuentas,material}.js` | FASE-1 |

## Contratos Resultantes

| Contrato | Firma / Ruta | Descripción (≤ 80 chars) |
|----------|--------------|--------------------------|
| API-002-04 | `deliverReservation(ctx, {id})` | Reservada → Prestada si `inicio ≤ hoy ≤ fin` |
| API-002-05 | `returnLoan(ctx, {id})` | cierra el préstamo y crea la multa si hay retraso |
| API-002-06 | `getPanel(ctx, {fecha?})` | prestado, vuelve hoy, por entregar |

## Entregables de UI

| Ruta | Componente | UC | Wireframe | Descripción |
|------|------------|----|-----------|-------------|
| `/panel` | `panel.js` | UC-017, UC-010, UC-011 | SCR-006 | fecha, «Entregar»/«Devolver» por fila |

## Verificación

```bash
npx vitest run tests/integration/entregas.test.js --maxWorkers=2  # UC-010/011 verdes
npx vitest run tests/integration/panel.test.js --maxWorkers=2     # UC-017 verde
npm test && npm run lint                                          # verdes
npx playwright test                                               # E2E-WF-001-03 verde; PERF-001..003 dentro del objetivo
```

## Demo

> Desde un checkout limpio: `npm install` · `node demo/sembrar.mjs fase-2` (reservas de Lucía para hoy y un préstamo vencido hace 3 días) · `npx vite --host 127.0.0.1 --port 5173`.

| # | Acción | Resultado esperado | Escenario |
|---|--------|--------------------|-----------|
| 1 | Entrar como Pablo, abrir el Panel | se ven lo prestado, lo que vuelve hoy y lo que toca entregar | AC-017-01, AC-017-05 · N-008 |
| 2 | Pulsar «Entregar» en la reserva de hoy | pasa a prestada | AC-010-01 · N-004 |
| 3 | Pulsar «Entregar» otra vez desde una pestaña vieja | aviso de que ya estaba entregada | AC-010-02 · N-004 |
| 4 | Pulsar «Devolver» en el préstamo vencido hace 3 días | multa de 3 días (importe `FINE_PER_DAY_EUR` × 3) | AC-011-02, AC-017-08 · N-005 |
| 5 | Devolver el prestado hoy | sin multa | AC-011-01 · N-004 |
| 6 | Elegir otra fecha en el Panel | lista de ese día | AC-017-03 · N-008 |
| 7 | Entrar como Lucía y abrir `/panel` | «Sin permiso» | AC-017-06 · N-008 |
| 8 | Lucía reserva en un navegador; Pablo recarga el Panel en otro | Pablo ve la reserva | REQ-NF-002 AC1 · N-004 |
| 9 | Reiniciar el servidor y entrar | reservas y préstamos siguen | REQ-NF-002 AC2 · N-004 |

## Alcance

**Incluye:** entrega, devolución, creación de la multa, panel, medidas de datos compartidos.
**Excluye:** ver y pagar multas, bloqueo de reservas por multa en vivo con datos reales (FASE-4; UC-007 ya lo aplica sobre multas existentes).
