# FASE 4: Restablecer contraseñas y dar de baja

> **Estado:** Implementable
> **Incremento:** El encargado restablece la contraseña de quien la olvida, da de baja a un socio y da de baja unidades rotas; se cancelan las reservas afectadas.
> **Requisitos:** REQ-F-002, REQ-F-008
> **Escenarios:** AC-004-01, AC-004-02, AC-004-03, AC-004-04, AC-004-05, AC-004-06, AC-004-07, AC-004-08, AC-004-09, AC-014-01, AC-014-02, AC-014-03, AC-014-04, AC-014-05, AC-014-06, AC-014-07, AC-014-08
> **Workflows:** Ninguno
> **Necesidades:** N-002, N-008
> **Dependencias:** Fase 3

---

## Objetivo

Permitir que el **encargado** cierre la gestión de cuentas e inventario: restablecer contraseña, dar de baja socio y dar de baja unidad. Antes no se podía: las bajas necesitan reservas y préstamos para sus reglas (INV-LOA-004, INV-STK-003).

---

## Criterios de Éxito

### UC-004 — Restablecer contraseña y dar de baja socio
- [ ] Con la nueva clave entra, con la vieja no, y se ve "Contraseña restablecida" (AC-004-01, REQ-F-002 AC4)
- [ ] Baja: "Baja" en la lista y sus reservas futuras canceladas (AC-004-02, REQ-F-002 AC5)
- [ ] Con material sin devolver: "No se puede dar de baja: tiene material sin devolver" (AC-004-05, REQ-F-002 AC6)
- [ ] Contraseña corta, socio inexistente, rol y almacén caído (AC-004-03, AC-004-04, AC-004-06, AC-004-07)
- [ ] Repetir restablecer o baja no cambia nada (AC-004-08, AC-004-09)

### UC-014 — Dar de baja unidad
- [ ] "Casco: 3 unidades" y "Casco 3" De baja (AC-014-01, REQ-F-008 AC2)
- [ ] Unidad prestada: "No se puede dar de baja: está prestada" (AC-014-03, REQ-F-008 AC3)
- [ ] Reservas futuras canceladas: "1 reserva cancelada por la baja" (AC-014-02, REQ-F-008 AC4)
- [ ] Baja repetida no cambia el recuento (AC-014-07, REQ-F-008 AC5)
- [ ] Unidad inexistente, rol, entrega y baja a la vez, almacén caído (AC-014-04, AC-014-05, AC-014-06, AC-014-08)

### Transversal
- [ ] Restablecer o dar de baja cierra las sesiones abiertas de esa cuenta (INV-ACC-008, REQ-F-002)
- [ ] Una cuenta en Baja conserva su historial (RN-007, REQ-F-002)

---

## Specs a Leer

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-004-restablecer-contrasena-y-baja.md`, `UC-014-dar-de-baja-unidad.md` | flujos y errores | dominio y UI |
| `domain/04-STATES.md` | SM-003, SM-004 | unidad, cuenta |
| `domain/05-INVARIANTS.md` | INV-ACC-008, 009; INV-LOA-004; INV-STK-003..005 | ver Invariantes |
| `contracts/API-acceso.md` | API-001-06, API-001-07 | firmas |
| `contracts/API-inventario.md` | API-004-03 | firma |
| `CLARIFICATIONS.md` | RN-007, RN-013, RN-014 | baja y sesiones |
| `tests/BDD-UC-004.md`, `BDD-UC-014.md`, `PROPERTY-TESTS.md` | AC-004-*, AC-014-*, PROP-008 | unit |
| `test/TEST-PLAN.md` | D-T-009, SEC-T-005 | carrera baja-entrega |

---

## Invariantes Aplicables

| ID | Dónde se aplica |
|----|-----------------|
| INV-ACC-008, 009 | A · `restablecerContrasena`, `darDeBajaSocio` (invalida sesiones) |
| INV-LOA-004 | A · `darDeBajaSocio` |
| INV-STK-003, 004, 005 | A · `darDeBajaUnidad` |

---

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | cuentas e inventario (serie) | `src/domain/{cuentas,inventario}.js`, `src/domain/permisos.js`, `src/server/{plugin,sesiones}.js`, `src/ui/pantallas/{socios,inventario}.js`, `src/ui/textos.js`, `tests/unit/{cuentas,inventario}.test.js`, `tests/api/**`, `tests/e2e/fase-4-*.spec.js` | `src/domain/{reservas,multas}.js` | FASE-3 |

---

## Contratos Resultantes

| Contrato | Firma / Ruta | Descripción |
|----------|--------------|-------------|
| API-001-06 | `POST /api/restablecerContrasena` | hash nuevo; sesiones cerradas |
| API-001-07 | `POST /api/darDeBajaSocio` | Baja y reservas Reservada canceladas en una escritura |
| API-004-03 | `POST /api/darDeBajaUnidad` | De baja; `M_RESERVAS_CANCELADAS_BAJA` |

---

## Entregables de UI

| Ruta | Componente | UC | Wireframe | Descripción |
|------|------------|----|-----------|-------------|
| `#/socios` | `pantallas/socios.js` | UC-004 | SCR-006 | "Restablecer contraseña" y "Dar de baja" por fila |
| `#/inventario` | `pantallas/inventario.js` | UC-014 | SCR-009 | "Dar de baja" por unidad con confirmación |

---

## Verificación

```bash
npx vitest run tests/unit/cuentas.test.js --maxWorkers=2     # AC-004-* verdes
npx vitest run tests/unit/inventario.test.js --maxWorkers=2  # AC-014-*, PROP-008 verdes
SDD_FASE=4 npx playwright test                               # capturas de Socios e Inventario
```

---

## Demo

> Desde un checkout limpio como en FASE-2 (Lucía con reserva futura, Pablo con un Casco entregado).

| # | Acción | Resultado esperado | Escenario |
|---|--------|--------------------|-----------|
| 1 | Encargado restablece la clave de Lucía a `Hielo2026x` | "Contraseña restablecida"; ella entra con la nueva | AC-004-01 · N-002 |
| 2 | Dar de baja a Pablo (Casco sin devolver) | "No se puede dar de baja: tiene material sin devolver" | AC-004-05 · N-002 |
| 3 | Devolver el Casco y dar de baja a Pablo | "Baja" en la lista | AC-004-02 · N-002 |
| 4 | Inventario: dar de baja "Casco 3" | "Casco: 3 unidades" y "Casco 3" De baja | AC-014-01 · N-008 |
| 5 | Dar de baja una unidad prestada | "No se puede dar de baja: está prestada" | AC-014-03 · N-008 |
| 6 | Dar de baja la única Tienda con reserva futura | "1 reserva cancelada por la baja" | AC-014-02 · N-008 |

---

## Alcance

| Incluye | Excluye |
|---------|---------|
| UC-004, UC-014; cierre de REQ-F-002 y REQ-F-008 | Cambio de contraseña por el socio (D-PA-005, sin caso de uso) |
