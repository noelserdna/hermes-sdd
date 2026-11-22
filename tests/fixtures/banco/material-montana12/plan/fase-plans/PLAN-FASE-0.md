# Implementation Plan — FASE-0: Entrar y cargar el material

> Spec v1.0 · 2026-11-22 · Depends on: — · Enables: FASE-1
> Blocks: A (todo el producto, serie) — ver FASE-0 §Módulos y Conjuntos de Escritura

## 1. FASE Overview

**Objective:** entrar/salir y gestionar material sobre un almacén compartido · **Scope:** dominio, store, http, cuentas (login), material, UI base · **Delivers:** API-001-01, -02, -08, API-003-01..03

## 2. Specs to Implement

| Spec | Type | Implementation note (≤ 100 chars) |
|------|------|-----------------------------------|
| UC-001, UC-002 | UC | sesión opaca; bloqueo por cuenta; `hoy`/hora del reloj inyectado |
| UC-015, UC-016 | UC | `retirar` usa `disponibilidad` sobre las reservas del almacén |
| ADR-001, ADR-005 | ADR | ocupadas por día; replay devuelve `{aviso}` |
| INV-SOC-003..005, 008 | INV | hash `scrypt`; error único `E_CREDENCIALES` |
| INV-MAT-001..004 | INV | validación en el servicio de material |

## 3. Technical Decisions (FASE-Specific)

| ID | Decision (≤ 140 chars) | Ref |
|----|-------------------------|-----|
| D-PA-001 | Caducidad: sesión viva mientras `ahora − ultimaActividad ≤ SESSION_IDLE_MINUTES` | Q-spec-auditor-001 |
| D-PA-004 | `demo/sembrar.mjs` crea cuentas con el mismo hash que el login y reservas sembradas | TEST-PLAN R-5 |
| D-PA-008 | `crearApp({store, reloj})` construye servicios; el plugin de Vite y los tests usan la misma fábrica | ADR-DRAFT-001 |

## 4. Component Implementation

### 4.1 `src/server/store/almacen-json.js` (A)

**Responsibility:** persistencia atómica, INV de almacén · **Refs:** ADR-DRAFT-002

```js
export function crearAlmacenJson(ruta) // { leer(), transaccion(fn) }  // fallo => E_ALMACEN_NO_DISPONIBLE, sin cambios
```

**Notes:** cola de promesas; escribe a `.tmp` y `rename`; `version` y migraciones al arrancar.

### 4.2 `src/server/servicios/cuentas.js` (A)

**Responsibility:** UC-001, UC-002, API-001-01/02 · **Refs:** INV-SOC-004, 005, 008

```js
export function login(ctx, { correo, contrasena }) // → { rol, destino }
export function logout(ctx)                        // replay → aviso
```

**Notes:** comparar con `timingSafeEqual`; baja y desconocido dan el mismo error; un acierto reinicia fallos; entrar con sesión abierta no cambia nada (AC-001-09).

### 4.3 `src/server/servicios/material.js` (A)

```js
export function addUnits(ctx, { nombre, cantidad })     // API-003-01
export function withdrawUnits(ctx, { id, cantidad })    // API-003-02
export function listMaterial(ctx)                       // API-003-03
```

**Notes:** nombre único sin mayúsculas; retirar exige `total − n ≥ ocupadas` cada día ≥ hoy; el envío repetido avisa (AC-015-06).

### 4.4 `src/server/http/autorizar.js` (A)

```js
export function authorize(sesion, operacion)  // API-001-08 → ok | E_ACCESO_DENEGADO | E_PAGINA_PROHIBIDA
```

**Notes:** tabla rol × operación de `PERMISSIONS-MATRIX.md`; renueva la actividad solo si autoriza.

### 4.5 `src/ui/` (A)

`router.js` (History API, guardia por `authorize`), `paginas/{entrar,mis-reservas,panel,material,reservar,sin-permiso}.js` (`reservar.js`: solo lista de tipos con unidades vía `listMaterial`, REQ-F-007 AC6; FASE-1 añade el formulario), `textos.js`.

### 4.6 Puertos con doble

No external ports in this FASE.

## 5. API Implementation Notes

| API-op | Handler | Note (≤ 80 chars) |
|--------|---------|--------------------|
| API-001-01 | `http/rutas.js#entrar` | fija cookie; `Cache-Control: no-store` |
| API-001-02 | `http/rutas.js#salir` | invalida en servidor y borra cookie |
| API-003-01..03 | `http/rutas.js#material` | solo encargado salvo lectura |

## 6. Data Changes

Esquema inicial `version: 1` con `cuentas`, `material`, `reservas`, `multas`; reversible borrando el fichero.

## 7. Test Strategy

### 7.1 Unit Tests

| Component | Test ids (test/) | Block |
|-----------|------------------|-------|
| `dominio/disponibilidad.js` | PROP-021, 022, 023 | A |
| `servicios/sesiones.js`, `cuentas.js` | PROP-004, 005, MATRIX-UC-001, 002 | A |
| `http/autorizar.js` | SEC-T-001, SEC-T-003 | A |

### 7.2 Integration Tests

| Scenario | Test ids (test/) | Setup | Block |
|----------|------------------|-------|-------|
| Login, bloqueo, caducidad, salir | MATRIX-UC-001, 002, INT-T-001 | in-memory repository, reloj fijo 2026-11-22 | A |
| Añadir y retirar material | MATRIX-UC-015, 016 | in-memory repository con reservas sembradas | A |
| Fallo de almacén | D-T-002 | almacén en memoria con fallo simulado | A |

### 7.3 BDD / E2E Scenarios

| Source | Scenarios | Tier / Priority | Block |
|--------|-----------|-----------------|-------|
| `spec/tests/BDD-UC-001, 002, 015, 016.md` | los de FASE-0 §Escenarios | P0/P1 | A |
| `test/E2E-SCENARIOS.md` | Critical: E2E-ACC-01, -02, -05, -06 | per tier | A |

### 7.4 Test Coverage Map (Source → Test)

| Source File | Type | Test File | Priority |
|------------|------|-----------|----------|
| `src/server/dominio/fechas.js` | logic | `tests/unit/fechas.test.js` (A) | HIGH |
| `src/server/dominio/disponibilidad.js` | logic | `tests/unit/disponibilidad.test.js` (A) | HIGH |
| `src/server/store/almacen-json.js` | service | `tests/unit/almacen-json.test.js` (A) | HIGH |
| `src/server/servicios/sesiones.js` | state-machine | `tests/unit/sesiones.test.js` (A) | HIGH |
| `src/server/servicios/cuentas.js` | service | `tests/integration/cuentas.test.js` (A) | HIGH |
| `src/server/servicios/material.js` | service | `tests/integration/material.test.js` (A) | HIGH |
| `src/server/http/autorizar.js` | logic | `tests/unit/autorizar.test.js` (A) | HIGH |
| `src/ui/router.js` | component | `tests/unit/ui/router.test.js` (A) | MEDIUM |
| `src/ui/paginas/entrar.js` | page | `tests/unit/ui/entrar.test.js` (A) | MEDIUM |
| `src/ui/paginas/material.js` | page | `tests/unit/ui/material.test.js` (A) | MEDIUM |
| `src/ui/paginas/reservar.js` | page | `tests/unit/ui/reservar.test.js` (A) | MEDIUM |
| `src/ui/textos.js` | logic | `tests/unit/textos.test.js` (MNT-T-001) (A) | MEDIUM |

**Exclusions (no unit test needed):**

| File | Reason |
|------|--------|
| `src/server/store/almacen-memoria.js` | doble de test, ejercitado por toda la integración |
| `src/server/http/plugin.js`, `rutas.js` | infraestructura delgada, cubierta por E2E |
| `src/ui/paginas/{mis-reservas,panel,sin-permiso}.js` | cabecera sin lógica; cubiertas por E2E |
| `demo/sembrar.mjs` | script de demo |

## 8. Dependencies on Shared Components

Ninguna: esta FASE crea reloj, store, sesiones, `authorize` y router.

## 9. Acceptance Criteria

- [ ] Todos los escenarios de §7.3 pasan (INV-SOC-004, 005, 008; INV-MAT-001..004)
- [ ] Reinicio del servidor conserva el material (AC-015-01)
- [ ] MNT-T-001 y MNT-T-002 verdes
- [ ] Sin contraseñas en claro en `datos.json` (D-T-009)

> Generated by sdd-plan-architect | Spec v1.0 | 2026-11-22
