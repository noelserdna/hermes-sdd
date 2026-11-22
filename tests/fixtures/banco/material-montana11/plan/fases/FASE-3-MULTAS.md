# FASE 3: Multas, bloqueo y pago

> **Estado:** Implementable
> **Incremento:** El socio ve sus multas; con una pendiente no puede reservar; el encargado la marca pagada y el socio vuelve a reservar. Cierra el ciclo completo del préstamo.
> **Requisitos:** REQ-F-006, REQ-F-007
> **Escenarios:** AC-010-04, AC-011-01, AC-011-02, AC-011-03, AC-012-01, AC-012-02, AC-012-03, AC-012-04, AC-012-05, AC-012-06
> **Workflows:** WF-001
> **Necesidades:** N-006, N-007
> **Dependencias:** Fase 2

---

## Objetivo

Permitir que el **socio** consulte sus multas y que el **encargado** las liste y las marque pagadas, desbloqueando al socio. El recorrido de WF-001 (reservar → entregar → devolver tarde → bloqueo → pagar → reservar) se ve de punta a punta.

---

## Criterios de Éxito

### UC-011 — Ver mis multas
- [ ] "6,00 €" y "Pendiente" en Mis multas (AC-011-01, REQ-F-006 AC6)
- [ ] Solo las propias; almacén caído (AC-011-02, AC-011-03)

### UC-012 — Marcar multa pagada
- [ ] Pagar la única multa: "Pagada" y el socio reserva otra vez (AC-012-01, REQ-F-007 AC1)
- [ ] Con otra pendiente sigue bloqueado (AC-012-02, REQ-F-006 AC5)
- [ ] Repetir el pago conserva la primera fecha (AC-012-03, REQ-F-007 AC2)
- [ ] Un socio ve "Acceso no permitido" en Multas (AC-012-04, REQ-F-007 AC3)
- [ ] Multa inexistente y almacén caído (AC-012-05, AC-012-06)

### Transversal
- [ ] Con multa pendiente la reserva se rechaza y las existentes se conservan (AC-010-04, REQ-F-006 AC4)
- [ ] 6,00 € por 3 días, 2,00 € por 1 día y "Sin multas" sin retraso se ven en Multas (REQ-F-006 AC1, REQ-F-006 AC2, REQ-F-006 AC3)

---

## Specs a Leer

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-011-ver-mis-multas.md`, `UC-012-marcar-multa-pagada.md` | flujos y errores | pantallas |
| `workflows/WF-001-ciclo-del-prestamo.md` | pasos 1-8, navegación | vídeo del gate |
| `domain/04-STATES.md` | SM-002 | Pendiente → Pagada |
| `domain/05-INVARIANTS.md` | INV-FIN-003, 004; INV-RES-005; INV-SEC-001 | ver Invariantes |
| `contracts/API-prestamos.md` | API-003-06, 07, 08 | firmas |
| `tests/BDD-UC-010.md`, `BDD-UC-011.md`, `BDD-UC-012.md` | AC-010-04, AC-011-*, AC-012-* | unit, E2E |
| `test/TEST-PLAN.md` | SEC-T-001, SEC-T-005 | cruce de socios |

---

## Invariantes Aplicables

| ID | Dónde se aplica |
|----|-----------------|
| INV-FIN-003, 004 | A · `marcarMultaPagada` |
| INV-RES-005 | A · ya en `reservarMaterial`; ahora con multas reales |
| INV-SEC-001 | A · `listarMisMultas` filtra por dueño |

---

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | multas (serie) | `src/domain/multas.js`, `src/domain/permisos.js`, `src/server/plugin.js`, `src/ui/pantallas/{mis-multas,multas}.js`, `src/ui/textos.js`, `tests/unit/multas.test.js`, `tests/api/**`, `tests/e2e/fase-3-*.spec.js` | `src/domain/reservas.js` | FASE-2 |

---

## Contratos Resultantes

| Contrato | Firma / Ruta | Descripción |
|----------|--------------|-------------|
| API-003-06 | `GET /api/listarMisMultas` | multas propias con importe y estado |
| API-003-07 | `GET /api/listarMultas` | todas, con socio (encargado) |
| API-003-08 | `POST /api/marcarMultaPagada` | Pendiente → Pagada; idempotente |

---

## Entregables de UI

| Ruta | Componente | UC | Wireframe | Descripción |
|------|------------|----|-----------|-------------|
| `#/mis-multas` | `pantallas/mis-multas.js` | UC-011 | SCR-004 | lista de multas del socio |
| `#/multas` | `pantallas/multas.js` | UC-012 | SCR-008 | tabla y "Marcar pagada" con confirmación |

---

## Verificación

```bash
npx vitest run tests/unit/multas.test.js --maxWorkers=2   # AC-011-*, AC-012-* verdes
SDD_FASE=3 npx playwright test                            # WF-001 completo con vídeo y capturas
```

---

## Demo

> Desde un checkout limpio como en FASE-2; Pablo ya devolvió su Casco con 3 días de retraso (multa 6,00 €).

| # | Acción | Resultado esperado | Escenario |
|---|--------|--------------------|-----------|
| 1 | Pablo abre "Mis multas" | "6,00 €" y "Pendiente" | AC-011-01 · N-006 |
| 2 | Pablo intenta reservar Casco 12-05 a 12-06 | "Tienes una multa pendiente: no puedes reservar hasta pagarla" | AC-010-04 · N-006 |
| 3 | Encargado abre "Multas" y marca pagada | "Pagada" | AC-012-01 · N-007 |
| 4 | Repetir el pago | sigue "Pagada" | AC-012-03 · N-007 |
| 5 | Pablo reserva Casco otra vez | "Reserva creada: Casco, …" | AC-012-01 · N-007 |
| 6 | Un socio abre `#/multas` | "Acceso no permitido" | AC-012-04 · N-007 |

---

## Alcance

| Incluye | Excluye |
|---------|---------|
| UC-011, UC-012; cierre de REQ-F-006 | Baja de socios con multas → FASE-4; historial → FASE-5 |
