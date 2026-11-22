# Implementation Plan — FASE-0: Skeleton

> Spec v1.0 · 2026-11-21 · Depends on: — · Enables: FASE-1
> Blocks: A serie (ver FASE-0 §Módulos y Conjuntos de Escritura)

## 1. FASE Overview

**Objective:** entrar, salir, crear socios y persistir · **Scope:** domain, server, ui base · **Delivers:** API-001-01..05

## 2. Specs to Implement

| Spec | Type | Implementation note |
|------|------|---------------------|
| UC-001 | UC | bloqueo con contador y `bloqueadaHasta` en la cuenta; mismo error para Baja (INV-ACC-006) |
| UC-002 | UC | sesión opaca en el almacén; cada operación válida renueva `ultimaActividad` |
| UC-003 | UC | correo único sin mayúsculas (INV-ACC-001), hash scrypt (INV-ACC-003) |
| ADR-002 | ADR | `reloj.js` único punto de `hoy()` y `ahora()` |
| ADR-005 | ADR | `store.transaccion(fn)`: copia, validar, volcar |

## 3. Technical Decisions (FASE-Specific)

| ID | Decision | Ref |
|----|----------|-----|
| D-PA-001 | `scripts/seed.js` crea encargado (o junta con `SEED_ROL`); idempotente | CLARIFY-LOG |
| D-PA-002 | `vitest.config.js` con `maxWorkers: 2` y entorno jsdom por fichero | CLARIFY-LOG |
| D-PA-004 | `cerrarSesion` y `comprobarSesion` admiten los tres roles | CLARIFY-LOG |
| D-PA-020 | `#/reservas` nace en FASE-0 como ruta protegida mínima (anónimo → Entrar; socio: cabecera + título «Mis reservas», sin lista) para cumplir REQ-F-001 AC8; FASE-1 la completa en el mismo `mis-reservas.js` | REQ-F-001 AC8 |

## 4. Component Implementation

### 4.1 `src/domain/errores.js` (A)

**Responsibility:** VO-010, ADR-004

```js
export const ERRORES = { E_NO_AUTENTICADO: 'No has entrado', /* literales de VO-010 */ };
export function ErrorDominio(codigo) {}   // lleva codigo y mensaje literal
```

**Notes:** los literales se copian de VO-010, nunca se escriben a mano en la UI.

### 4.2 `src/domain/reloj.js` y `src/server/store.js` (A)

```js
export function crearReloj({ fijo, ahora }) {}      // hoy(): 'AAAA-MM-DD' Europe/Madrid; ahora(): ms
export function crearStore({ archivo, falloEscritura }) {}  // transaccion(fn), leer()
```

**Notes:** `CLOCK_FIXED` se ignora si `NODE_ENV === 'production'`; `falloEscritura` inyectable (D-T-003); `.tmp` residual ignorado.

### 4.3 `src/domain/{validacion,permisos,cuentas}.js` (A)

```js
export function iniciarSesion(ctx, { correo, contrasena })   // API-001-01
export function cerrarSesion(ctx)                            // API-001-02
export function comprobarSesion(ctx)                         // API-001-03
export function crearSocio(ctx, { nombre, correo, contrasena })  // API-001-04
export function listarSocios(ctx)                            // API-001-05
export function autorizar(ctx, operacion)                    // sesión -> rol -> lanza E_*
```

**Notes:** orden de errores sesión → rol → validación (D-T-006); 5.º fallo bloquea 15 min incluso con clave buena; el 6.º con bloqueo vencido entra; nunca se devuelve ni registra la contraseña.

### 4.4 `src/server/{plugin,sesiones,hash}.js`, `scripts/seed.js` (A)

**Notes:** cuerpo ≤ 16 KB, `Content-Type` obligatorio en POST, cookie `sid` HttpOnly SameSite=Strict, `Cache-Control: no-store`, una línea de log JSON por petición.

### 4.5 `src/ui/**` (A)

**Notes:** router por hash; `textos.js` único con literales; `textContent`, nunca HTML; `role=alert` en errores.

### 4.6 Puertos con doble

No external ports in this FASE.

## 5. API Implementation Notes

Transporte en `design/OPERATION-MAPPING.md`.

| API-op | Handler | Note |
|--------|---------|------|
| API-001-01 | `plugin.js` | pública; fija la cookie; resto exige sesión (INV-ACC-007) |
| API-001-03 | `plugin.js` | GET; lleva a Entrar si `E_SESION_CADUCADA` |

## 6. Data Changes

Se crea el almacén `{version:1, contadores, cuentas, unidades, reservas, multas, sesiones}` con `migrar(version)`.

## 7. Test Strategy

### 7.1 Unit Tests

| Component | Test ids (test/) | Block |
|-----------|------------------|-------|
| `cuentas.js` | AC-001-01..10, AC-002-01..07, AC-003-01..07, PROP-007, PROP-010, INV-ACC-001..009 | A |
| `store.js`, `reloj.js` | INT-T-001, D-T-001..003 | A |

### 7.2 Integration Tests

| Scenario | Test ids | Setup | Block |
|----------|----------|-------|-------|
| sin sesión → `E_NO_AUTENTICADO` en toda operación | SEC-T-002 | in-memory repository | A |
| solo hash en el almacén | SEC-T-003 | in-memory repository | A |
| bloqueo y caducidad | SEC-T-004 | reloj falso | A |

### 7.3 BDD / E2E Scenarios

| Source | Scenarios | Tier / Priority | Block |
|--------|-----------|-----------------|-------|
| `tests/BDD-UC-001..003.md` | AC-001-01..AC-003-07 | P0/P1 | A |
| `test/E2E-SCENARIOS.md` | Smoke: WF-002-01 · Critical: WF-002-02..07 | por nivel | A |

### 7.4 Test Coverage Map (Source → Test)

| Source File | Type | Test File | Priority |
|------------|------|-----------|----------|
| src/domain/cuentas.js | service | tests/unit/cuentas.test.js (A) | HIGH |
| src/domain/permisos.js | logic | tests/unit/permisos.test.js (A) | HIGH |
| src/domain/validacion.js | logic | tests/unit/validacion.test.js (A) | MEDIUM |
| src/domain/reloj.js | logic | tests/unit/reloj.test.js (A) | MEDIUM |
| src/server/store.js | infrastructure | tests/unit/store.test.js (A) | HIGH |
| src/server/sesiones.js | service | tests/unit/sesiones.test.js (A) | HIGH |
| src/ui/pantallas/entrar.js | page | tests/unit/ui-entrar.test.js (A) | MEDIUM |
| src/ui/pantallas/socios.js | page | tests/unit/ui-socios.test.js (A) | MEDIUM |
| src/ui/pantallas/mis-reservas.js (mínima) | page | tests/unit/ui-mis-reservas.test.js (A) | MEDIUM |

**Exclusions (no unit test needed):**

| File | Reason |
|------|--------|
| src/domain/errores.js | constantes; las usa cada test |
| src/server/plugin.js | tested via `tests/api` |
| src/server/hash.js | envoltorio de `node:crypto`; cubierto por SEC-T-003 |
| scripts/seed.js | tested via integración del comando |

## 8. Dependencies on Shared Components

Ninguna (fase inicial); todo lo que crea lo reutilizan las demás.

## 9. Acceptance Criteria

- [ ] Los tres roles entran y ven su inicio (UC-001)
- [ ] Bloqueo a los 5 fallos y caducidad a 30 min sin esperas reales (INV-ACC-004, INV-ACC-005)
- [ ] Contraseñas solo con hash (INV-ACC-003)
- [ ] All BDD scenarios of §7.3 pass

---

> Generated by sdd-plan-architect | Spec v1.0 | 2026-11-21
