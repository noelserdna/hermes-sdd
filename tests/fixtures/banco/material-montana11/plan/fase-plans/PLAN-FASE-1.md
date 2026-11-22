# Implementation Plan — FASE-1: Reservar material, ver y cancelar mis reservas

> Spec v1.0 · 2026-11-21 · Depends on: FASE-0 · Enables: FASE-2
> Blocks: A serie

## 1. FASE Overview

**Objective:** añadir material, reservar, listar y cancelar lo propio · **Scope:** reservas, inventario, prestamos (solo no recogidas) · **Delivers:** API-002-01..04, API-003-03 (interna), API-004-01, 004-02

## 2. Specs to Implement

| Spec | Type | Implementation note |
|------|------|---------------------|
| UC-005 | UC | todo dentro de una transacción: validar, multa, solapes, asignar |
| UC-013 | UC | crea `cantidad` unidades con número propio dentro del tipo |
| UC-006 | UC | filtra por `socioId` de la sesión (INV-SEC-001) |
| UC-007 | UC | solo `Reservada` con `inicio` > hoy; Cancelada repetida no cambia (INV-RES-007) |
| INV-RES-001, 009 | INV | unidad libre de menor número en todo el rango |
| RN-011 | RN | replay: mismo socio, tipo, inicio y fin devuelve la existente |
| RN-004 | RN | `aplicarNoRecogidas` antes de leer o escribir reservas |

## 3. Technical Decisions (FASE-Specific)

| ID | Decision | Ref |
|----|----------|-----|
| D-PA-008 | `reservarMaterial` y `cancelarReserva` corren en `store.transaccion`; la cola da la ganadora única | ADR-005 |
| D-PA-003 | `aplicarNoRecogidas` es función interna del sistema, sin ruta ni fila de rol | CLARIFY-LOG |

## 4. Component Implementation

### 4.1 `src/domain/reservas.js` (A)

```js
export function consultarDisponibilidad(ctx, { material, inicio, fin })  // API-002-01
export function reservarMaterial(ctx, { material, inicio, fin })         // API-002-02
export function listarMisReservas(ctx)                                   // API-002-03
export function cancelarReserva(ctx, { reservaId })                      // API-002-04
```

**Notes:** orden de validación: sesión, rol, datos, fechas pasadas, invertidas, más de 14 días, multa pendiente, unidades; el rango incluye ambos extremos; días contiguos no solapan; replay antes de buscar unidad. Reserva ajena → `E_RESERVA_NO_ENCONTRADA` sin revelar existencia; mensaje `M_RESERVA_CANCELADA`.

### 4.2 `src/domain/inventario.js` (A)

```js
export function listarInventario(ctx)                    // API-004-01
export function anadirMaterial(ctx, { tipo, cantidad })  // API-004-02
```

**Notes:** tipo en `MATERIAL_TYPES`; cantidad ≥ 1; replay RN-016 (AC-013-08) no duplica unidades.

### 4.3 `src/domain/prestamos.js` (A)

```js
export function aplicarNoRecogidas(tx, hoy)   // API-003-03 interna
```

**Notes:** Reservada con `inicio` < hoy pasa a No recogida y libera la unidad; repetir no cambia nada.

### 4.4 `src/ui/pantallas/{reservar,mis-reservas,inventario}.js` (A)

**Notes:** disponibilidad "N libres" por tipo; error de fecha junto al campo (`aria-invalid`); "Cancelar reserva" con confirmación en línea; "No tienes reservas" si vacío.

### 4.5 Puertos con doble

No external ports in this FASE.

## 5. API Implementation Notes

| API-op | Handler | Note |
|--------|---------|------|
| API-002-02 | `plugin.js` | 422 en validación, 409 en `E_SIN_UNIDADES` (mapping) |
| API-002-03 | `plugin.js` | GET; llama `aplicarNoRecogidas` en la misma transacción |
| API-004-02 | `plugin.js` | solo encargado; junta y socio `E_ACCESO_NO_PERMITIDO` |

## 6. Data Changes

Sin migración: `unidades` y `reservas` ya existen vacías en el documento de FASE-0.

## 7. Test Strategy

### 7.1 Unit Tests

| Component | Test ids (test/) | Block |
|-----------|------------------|-------|
| `reservas.js` | AC-005-01..14, AC-006-01..04, AC-007-01..06, PROP-001..003, 006, 009, INV-RES-006, 007, 009 | A |
| `inventario.js` | AC-013-01..08, INV-STK-001, 002 | A |
| `prestamos.js` | INV-LOA-002 (GAP-002: repetición sin AC) | A |

### 7.2 Integration Tests

| Scenario | Test ids | Setup | Block |
|----------|----------|-------|-------|
| última unidad a la vez | AC-005-12, D-T-009 | in-memory repository | A |
| replay de reserva y de alta | AC-005-14, AC-013-08, D-T-008 | in-memory repository | A |
| lectura cruzada rechazada | SEC-T-001, GAP-003 | in-memory repository | A |

### 7.3 BDD / E2E Scenarios

| Source | Scenarios | Tier / Priority | Block |
|--------|-----------|-----------------|-------|
| `tests/BDD-UC-005.md`, `006`, `007`, `013` | AC-005-01..14, AC-006-01..04, AC-007-01..06, AC-013-01..08 | P0/P1 | A |
| `test/E2E-SCENARIOS.md` | Smoke: WF-001-01 · Critical: WF-001-02, WF-001-03 · Full: V-013 | por nivel | A |

### 7.4 Test Coverage Map (Source → Test)

| Source File | Type | Test File | Priority |
|------------|------|-----------|----------|
| src/domain/reservas.js | service | tests/unit/reservas.test.js (A) | HIGH |
| src/domain/inventario.js | service | tests/unit/inventario.test.js (A) | HIGH |
| src/domain/prestamos.js | state-machine | tests/unit/prestamos.test.js (A) | HIGH |
| src/ui/pantallas/reservar.js | page | tests/unit/ui-reservar.test.js (A) | MEDIUM |
| src/ui/pantallas/mis-reservas.js (completa la mínima de FASE-0) | page | tests/unit/ui-mis-reservas.test.js (A) | MEDIUM |
| src/ui/pantallas/inventario.js | page | tests/unit/ui-inventario.test.js (A) | MEDIUM |

**Exclusions (no unit test needed):**

| File | Reason |
|------|--------|
| src/ui/pantallas/inicio.js | cabecera sin lógica; cubierta por E2E |
| src/ui/componentes/confirmar.js | componente genérico; cubierto por E2E |

## 8. Dependencies on Shared Components

| Component | From FASE | Required for |
|-----------|-----------|--------------|
| `store.transaccion`, `permisos.js`, `reloj.js` | FASE-0 | escritura atómica, rol, `hoy` |

## 9. Acceptance Criteria

- [ ] Nunca dos reservas de una unidad en un día (INV-RES-001)
- [ ] Un socio nunca ve ni cancela reservas ajenas (INV-SEC-001); cancelar solo hasta el día antes (INV-RES-006)
- [ ] Mensajes literales de REQ-F-003 y REQ-F-004 (VO-010)
- [ ] All BDD scenarios of §7.3 pass

---

> Generated by sdd-plan-architect | Spec v1.0 | 2026-11-21
