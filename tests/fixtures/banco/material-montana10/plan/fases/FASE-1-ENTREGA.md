# FASE 1: Cuidar las reservas y entregar

> **Estado:** Implementable
> **Incremento:** El socio ve y cancela sus reservas; el encargado entrega lo reservado y ve lo prestado y lo que vuelve cada día.
> **Requisitos:** REQ-F-004, REQ-F-005, REQ-F-009
> **Escenarios:** AC-004-01, AC-004-02, AC-004-03, AC-004-04, AC-004-05, AC-004-06, AC-004-07, AC-004-08, AC-005-01, AC-005-02, AC-005-03, AC-005-04, AC-005-05, AC-005-06, AC-005-07, AC-009-01, AC-009-02, AC-009-03, AC-009-04, AC-009-05, AC-009-06, AC-009-07
> **Workflows:** —
> **Necesidades:** N-004, N-005, N-009, N-011
> **Dependencias:** FASE-0

---

## Objetivo

Permitir que el **socio** consulte y cancele sus reservas y que el **encargado** entregue el material reservado y vea qué está prestado y qué vuelve cada día; la **junta** lo ve en solo lectura. Un solo bloque serial.

## Criterios de Éxito

> «Mis reservas» existe desde FASE-0 en versión mínima (saludo y lista de solo lectura); esta FASE la completa con Cancelar y multas.

### UC-004 — Ver y cancelar mis reservas
- [ ] El socio ve solo sus reservas; sin ellas, mensaje vacío (AC-004-01, AC-004-02, AC-004-07, REQ-F-004)
- [ ] Cancela una Reservada hasta el día antes de `desde`; repetir no cambia nada (AC-004-03, AC-004-04)
- [ ] Cancelación el mismo día o posterior rechazada; con multa Pendiente sigue pudiendo cancelar (AC-004-05, AC-004-06)
- [ ] Reserva inexistente con su error (AC-004-08)

### UC-005 — Entregar reserva
- [ ] Entrega asigna una unidad libre y pasa a Prestada; repetir no asigna otra (AC-005-01, AC-005-02, REQ-F-005)
- [ ] Antes de `desde` se rechaza; unidad ocupada o reserva no entregable con su error (AC-005-03, AC-005-06, AC-005-07)
- [ ] Reserva pasada de `hasta` sin recoger es No recogida y libera unidades (AC-005-04, AC-005-05)

### UC-009 — Ver entregas y devoluciones
- [ ] Lista lo prestado y lo que vuelve hoy, con retrasos y entregas del día (AC-009-01, AC-009-02, AC-009-03, REQ-F-009)
- [ ] Nada prestado: mensaje; No recogida no figura como prestada (AC-009-04, AC-009-07)
- [ ] Junta en solo lectura; socio sin permiso (AC-009-05, AC-009-06)

### Transversal
- [ ] Textos en español y datos en el almacén compartido (REQ-C-001, REQ-C-003)

## Specs a Leer

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-004-…`, `UC-005-…`, `UC-009-…` | flujos y excepciones | comportamiento |
| `domain/04-STATES.md` | SM-001, SM-003 | transiciones y unidad |
| `contracts/API-reservas.md`, `API-prestamos.md` | API-002-02/03, API-003-01, 03-05, 03-07 | firmas |
| `domain/01-GLOSSARY.md`, `CLARIFICATIONS.md` | RN-008, 019, 020, 022 | reglas |
| `design/OPERATION-MAPPING.md`, `ux/WIREFRAMES.md` | SCR-002, SCR-004 | rutas y pantallas |
| `tests/BDD-UC-004.md`, `-005.md`, `-009.md`; `test/TEST-MATRIX-UC-004/005/009.md` | AC-004-*, 005-*, 009-* | tests |
| `test/E2E-SCENARIOS.md` | E2E-WF-001-04, 05, EX05..EX08, EX10 | E2E |

## Invariantes Aplicables

> Acumulativas: hereda las de FASE-0.

| ID | Dónde se aplica |
|----|-----------------|
| INV-RES-006, 007 | `reservas.cancelarReserva`, derivación al leer |
| INV-LOA-001, 002, 301 | `prestamos.entregarReserva` en transacción |
| INV-LOA-401 | `prestamos.consultarEntregasYDevoluciones` solo lectura |
| INV-ACC-009 | `listarMisReservas`, `cancelarReserva` |

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | dominio + servidor + SPA | `src/domain/{reservas,prestamos,tareas}.js`, `src/server/{http,tareas-diarias}.js`, `src/ui/pantallas/{mis-reservas,entregas}.js`, `src/ui/{router,textos}.js`, `tests/unit/**` | `tests/e2e/**` | FASE-0 |
| Integración | e2e | `tests/e2e/**` | código de producción | A |

## Contratos Resultantes

- API-002-02 listarMisReservas · API-002-03 cancelarReserva
- API-003-01 entregarReserva · API-003-05 consultarEntregasYDevoluciones
- API-003-07 resolverNoRecogidas (al leer y en tarea diaria, D-PA-008)

## Entregables de UI

| Página / ruta | UC | Wireframe |
|---------------|----|-----------|
| `#/mis-reservas` (socio) | UC-004 | SCR-002 |
| `#/entregas` (encargado; junta solo lectura) | UC-005, UC-009 | SCR-004 |

## Verificación

```
npm test            # unit + integración UC-004, UC-005, UC-009 en verde
npm run lint
npx playwright test --grep "WF-001-04|WF-001-05|EX05|EX10"
```

## Demo

Semilla: `CLOCK_FIXED=2026-12-03`, reservas de Lucía (3–5 dic) y Pablo (10–12 dic), 2 piolets.

| # | Acción | Resultado esperado | Escenario · Necesidad |
|---|--------|--------------------|-----------------------|
| 1 | Pablo abre Mis reservas | ve solo la suya | AC-004-01 · N-004 |
| 2 | Pablo cancela la suya (10 dic) | pasa a Cancelada | AC-004-03 · N-004 |
| 3 | Lucía intenta cancelar la suya (empezó) | rechazada | AC-004-05 · N-004 |
| 4 | Encargado abre Entregas y devoluciones | Lucía figura por entregar hoy | AC-009-03 · N-009 |
| 5 | Encargado entrega a Lucía | Prestada con una unidad | AC-005-01 · N-005 |
| 6 | Encargado repite la entrega | no asigna otra unidad | AC-005-02 · N-005 |
| 7 | Junta entra en Entregas y devoluciones | lo ve sin botones | AC-009-05 · N-009 |

## Alcance

**Incluye:** completar Mis reservas (Cancelar, multas, No recogida derivada), cancelar, entregar, listado diario, no recogidas.
**Excluye:** devolver, multas (FASE-2); purga (FASE-3).
