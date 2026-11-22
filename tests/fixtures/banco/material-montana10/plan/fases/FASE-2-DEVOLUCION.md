# FASE 2: Devolver, multar y consultar el historial

> **Estado:** Implementable
> **Incremento:** El encargado marca la devolución, se pone la multa si hay retraso y la marca pagada; la junta consulta el historial de un socio.
> **Requisitos:** REQ-F-006, REQ-F-007, REQ-F-010
> **Escenarios:** AC-006-01, AC-006-02, AC-006-03, AC-006-04, AC-006-05, AC-006-06, AC-007-01, AC-007-02, AC-007-03, AC-007-04, AC-007-05, AC-010-01, AC-010-02, AC-010-03, AC-010-04, AC-010-05, AC-010-06
> **Workflows:** WF-001
> **Necesidades:** N-005, N-006, N-007, N-010, N-011
> **Dependencias:** FASE-1

---

## Objetivo

Permitir que el **encargado** cierre el préstamo con la devolución (multa si hay retraso) y cobre la multa, y que la **junta** consulte el historial de un socio. Cierra el ciclo WF-001. Un solo bloque serial.

## Criterios de Éxito

### UC-006 — Devolver y multar
- [ ] Devolución a tiempo: Devuelta, sin multa (AC-006-01, REQ-F-006)
- [ ] Retraso de 3 días: multa de 6 €; de 1 día: 2 € (AC-006-02, AC-006-03)
- [ ] Repetir la devolución no cambia ni duplica multa; reserva no prestada o inexistente con su error (AC-006-04, AC-006-05, AC-006-06)

### UC-007 — Pagar multa
- [ ] Pagar desbloquea al socio para reservar; con otra multa Pendiente sigue bloqueado (AC-007-01, AC-007-02, REQ-F-007)
- [ ] Pagar de nuevo no cambia la fecha de pago; socio sin permiso; multa inexistente (AC-007-03, AC-007-04, AC-007-05)

### UC-010 — Consultar historial
- [ ] Junta y encargado ven préstamos y multas de un socio, sin acciones (AC-010-01, AC-010-03, AC-010-05, REQ-F-010)
- [ ] Sin historial: mensaje; socio sin permiso; socio inexistente (AC-010-02, AC-010-04, AC-010-06)

### Transversal
- [ ] Multa = 2 € × días naturales de retraso, una por préstamo (INV-LOA-004, REQ-F-006)
- [ ] El socio ve su multa en Mis reservas (REQ-F-006)

## Specs a Leer

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-006-…`, `UC-007-…`, `UC-010-…` | flujos y excepciones | comportamiento |
| `workflows/WF-001-ciclo-de-un-prestamo.md` | pasos | vídeo del ciclo |
| `domain/04-STATES.md` | SM-001, SM-002 | transiciones |
| `contracts/API-prestamos.md` | API-003-02, 03-03, 03-04, 03-06 | firmas |
| `domain/01-GLOSSARY.md`, `CLARIFICATIONS.md` | RN-009, 012, 023, 024 | reglas |
| `design/OPERATION-MAPPING.md`, `ux/WIREFRAMES.md` | SCR-004, SCR-005, SCR-008 | rutas y pantallas |
| `tests/BDD-UC-006.md`, `-007.md`, `-010.md`; `test/TEST-MATRIX-UC-006/007/010.md` | AC-006-*, 007-*, 010-* | tests |
| `test/E2E-SCENARIOS.md` | E2E-WF-001-01, 02, 03, 05, EX09, EX11 | E2E |

## Invariantes Aplicables

> Acumulativas: hereda las de FASE-0 y FASE-1.

| ID | Dónde se aplica |
|----|-----------------|
| INV-LOA-003, 004 | `prestamos.devolverPrestamo` en transacción |
| INV-LOA-005 | `prestamos.pagarMulta` |
| INV-LOA-402 | `prestamos.consultarHistorial` solo lectura |
| INV-RES-005 | ya aplicado en FASE-0; aquí se desbloquea al pagar |

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | dominio + SPA | `src/domain/prestamos.js`, `src/server/http.js`, `src/ui/pantallas/{entregas,multas,historial}.js`, `src/ui/{router,textos}.js`, `tests/unit/**` | `tests/e2e/**` | FASE-1 |
| Integración | e2e | `tests/e2e/**` | código de producción | A |

## Contratos Resultantes

- API-003-02 devolverPrestamo · API-003-03 pagarMulta · API-003-04 listarMultas · API-003-06 consultarHistorial

## Entregables de UI

| Página / ruta | UC | Wireframe |
|---------------|----|-----------|
| `#/entregas` acción Devolver | UC-006 | SCR-004 |
| `#/multas` Multas | UC-007 | SCR-005 |
| `#/historial` Historial | UC-010 | SCR-008 |

## Verificación

```
npm test            # unit + integración UC-006, UC-007, UC-010 en verde
npm run lint
npx playwright test --grep "WF-001"   # un vídeo WF-001 en evidencias/FASE-2/
```

## Demo

Semilla: `CLOCK_FIXED=2026-12-08`; Lucía con un piolet Prestado hasta el 5 dic (3 días de retraso).

| # | Acción | Resultado esperado | Escenario · Necesidad |
|---|--------|--------------------|-----------------------|
| 1 | Encargado marca la devolución de Lucía | Devuelta; multa Pendiente de 6 € | AC-006-02 · N-005, N-006 |
| 2 | Encargado repite la devolución | no hay segunda multa | AC-006-04 · N-005 |
| 3 | Lucía intenta reservar | rechazado por multa Pendiente | AC-003-08 · N-006 |
| 4 | Encargado marca la multa como pagada | Pagada con su fecha | AC-007-01 · N-007 |
| 5 | Lucía reserva de nuevo | se crea | AC-003-09 · N-006 |
| 6 | Junta abre Historial de Lucía | ve préstamo y multa, sin acciones | AC-010-01, AC-010-03 · N-010 |
| 7 | Socio abre Historial | sin permiso | AC-010-04 · N-011 |

## Alcance

**Incluye:** devolver, multas, pagar, historial.
**Excluye:** altas/bajas de socios, purga de datos (FASE-3).
