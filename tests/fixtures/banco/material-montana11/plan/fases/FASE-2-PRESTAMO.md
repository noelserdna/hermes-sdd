# FASE 2: Entregar y recibir el material

> **Estado:** Implementable
> **Incremento:** El encargado entrega lo reservado el día de inicio y marca la devolución; lo no recogido se libera; una devolución tardía deja una multa.
> **Requisitos:** REQ-F-005
> **Escenarios:** AC-008-01, AC-008-02, AC-008-03, AC-008-04, AC-008-05, AC-008-06, AC-008-07, AC-009-01, AC-009-02, AC-009-03, AC-009-04, AC-009-05, AC-009-06, AC-009-07, AC-010-01, AC-010-02, AC-010-03, AC-010-05, AC-010-06
> **Workflows:** Ninguno
> **Necesidades:** N-005, N-006
> **Dependencias:** Fase 1

---

## Objetivo

Permitir que el **encargado** liste préstamos y reservas, entregue el día de inicio y registre la devolución; si hay retraso, la misma escritura crea la multa de 2 € por día (UC-010). Un solo bloque en serie.

---

## Criterios de Éxito

### UC-008 — Entregar material
- [ ] Entregar el día de inicio deja "Entregado" (AC-008-01, REQ-F-005 AC1)
- [ ] Antes de la fecha: "No se puede entregar antes de la fecha de inicio" (AC-008-03, REQ-F-005 AC3)
- [ ] Sin recoger, al día siguiente "No recogida" y unidad libre (AC-008-02, REQ-F-005 AC4)
- [ ] Un socio ve "Acceso no permitido" en Préstamos (AC-008-04, REQ-F-005 AC6)
- [ ] Reserva inexistente, entrega doble concurrente y almacén caído (AC-008-05, AC-008-06, AC-008-07)

### UC-009 — Registrar devolución
- [ ] Devolver deja "Devuelto" y la unidad libre (AC-009-01, REQ-F-005 AC2)
- [ ] Repetir la devolución conserva la primera fecha y no crea otra multa (AC-009-03, REQ-F-005 AC5)
- [ ] Devolución tardía crea la multa en la misma escritura (AC-009-02)
- [ ] Rol, reserva inexistente, no entregada y almacén caído (AC-009-04, AC-009-05, AC-009-06, AC-009-07)

### UC-010 — Aplicar multa por retraso
- [ ] 3 días de retraso = 6,00 € Pendiente; 1 día = 2,00 €; sin retraso, sin multa (AC-010-01, AC-010-03, AC-010-02, REQ-F-006 AC1, REQ-F-006 AC2, REQ-F-006 AC3)
- [ ] Una reserva genera como mucho una multa; fallo de almacén no deja multa a medias (AC-010-06, AC-010-05)

---

## Specs a Leer

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-008-entregar-material.md`, `UC-009-registrar-devolucion.md`, `UC-010-aplicar-multa-por-retraso.md` | flujos y errores | dominio y pantalla |
| `domain/02-ENTITIES.md` | ENT-003, ENT-004 | reserva, multa |
| `domain/03-VALUE-OBJECTS.md` | VO-007, VO-008 | estado e importe de multa |
| `domain/04-STATES.md` | SM-001, SM-002 | transiciones |
| `domain/05-INVARIANTS.md` | INV-LOA-001..003; INV-FIN-001, 002, 004 | ver Invariantes |
| `contracts/API-prestamos.md` | API-003-01, 02, 04, 05 | firmas |
| `CLARIFICATIONS.md` | RN-003, RN-004, RN-008, RN-009 | entrega, multa |
| `tests/BDD-UC-008.md`, `BDD-UC-009.md`, `BDD-UC-010.md`, `PROPERTY-TESTS.md` | AC-008-*..AC-010-*, PROP-004, 005 | unit |
| `test/TEST-PLAN.md` | D-T-008, D-T-009 | carrera y replay |

---

## Invariantes Aplicables

| ID | Dónde se aplica |
|----|-----------------|
| INV-LOA-001, 003 | A · `entregarReserva`, `registrarDevolucion` |
| INV-LOA-002 | A · `aplicarNoRecogidas` en `listarPrestamosYReservas` |
| INV-FIN-001, 002, 004 | A · `aplicarMultaPorRetraso` llamada desde `registrarDevolucion` |

---

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | préstamos y multas (serie) | `src/domain/{prestamos,multas}.js`, `src/domain/permisos.js`, `src/server/plugin.js`, `src/ui/pantallas/prestamos.js`, `src/ui/textos.js`, `tests/unit/{prestamos,multas}.test.js`, `tests/api/**`, `tests/e2e/fase-2-*.spec.js` | `src/domain/cuentas.js` | FASE-1 |

---

## Contratos Resultantes

| Contrato | Firma / Ruta | Descripción |
|----------|--------------|-------------|
| API-003-01 | `POST /api/entregarReserva` | Reservada → Entregado el día de inicio |
| API-003-02 | `POST /api/registrarDevolucion` | Entregado → Devuelto; multa si hay retraso |
| API-003-04 | `GET /api/listarPrestamosYReservas` | todas con estado; aplica No recogida |
| API-003-05 | `aplicarMultaPorRetraso(tx, reservaId)` (interna) | multa Pendiente de 2 € × días |

---

## Entregables de UI

| Ruta | Componente | UC | Wireframe | Descripción |
|------|------------|----|-----------|-------------|
| `#/prestamos` | `pantallas/prestamos.js` | UC-008, 009, 010 | SCR-007 | lista, "Entregar", "Registrar devolución" |

---

## Verificación

```bash
npx vitest run tests/unit/prestamos.test.js --maxWorkers=2   # AC-008-*, AC-009-*, PROP-004, 005 verdes
npx vitest run tests/unit/multas.test.js --maxWorkers=2      # AC-010-* verdes
SDD_FASE=2 npx playwright test                               # entrega y devolución con capturas
```

---

## Demo

> Desde un checkout limpio como en FASE-1. Reserva de Lucía: Piolet 12-05 a 12-07; de Pablo: Casco 12-05 a 12-07.

| # | Acción | Resultado esperado | Escenario |
|---|--------|--------------------|-----------|
| 1 | Con `CLOCK_FIXED=2026-12-04`, encargado entrega la de Lucía | "No se puede entregar antes de la fecha de inicio" | AC-008-03 · N-005 |
| 2 | Con `2026-12-05`, entregar Piolet de Lucía | "Entregado" | AC-008-01 · N-005 |
| 3 | Con `2026-12-07`, devolver el Piolet | "Devuelto"; unidad libre | AC-009-01 · N-005 |
| 4 | Repetir la devolución | sigue "Devuelto", fecha original | AC-009-03 · N-005 |
| 5 | Entregar el Casco de Pablo el 12-05; con `2026-12-10` devolverlo | multa "6,00 €" Pendiente creada | AC-009-02, AC-010-01 · N-006 |
| 6 | Con `2026-12-06`, una reserva sin entregar | pasa a "No recogida" | AC-008-02 · N-005 |
| 7 | Un socio abre `#/prestamos` | "Acceso no permitido" | AC-008-04 · N-005 |

---

## Alcance

| Incluye | Excluye |
|---------|---------|
| UC-008, UC-009, UC-010 | Pantalla "Multas" y pagar → FASE-3; "Prestado" → FASE-5 |

## Notas

- REQ-F-006 se cierra en FASE-3; aquí solo se crea la multa.
