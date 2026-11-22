# Plan de FASE 0 — Esqueleto

> Fuente: `plan/fases/FASE-0-SKELETON.md` · Plan-Style vertical

## 1. Visión

Infraestructura mínima y tres casos de uso (UC-001, UC-008, UC-003) en un solo bloque serial. Depende de: nada.

## 2. Specs a implementar

| Id | Nota de implementación |
|----|------------------------|
| UC-001 / API-001-01/02 | login por correo normalizado; bloqueo y caducidad en `sesiones` |
| UC-008 / API-004-01..03 | `anadirUnidades` suma n sin idempotencia (INV-STK-003) |
| UC-003 / API-002-01 | comprobación de disponibilidad por día dentro de `transaction` |
| ADR-001 / ADR-002 | `reloj.hoy()` y `store.transaction` inyectados en cada caso de uso |

## 3. Decisiones de la FASE

- D-PA-002 rutas por hash; D-PA-006 reloj de pruebas `CLOCK_FIXED`; D-PA-007 mutex global.
- D-PA-003: `npm run cuentas` crea encargado y junta leyendo correo y contraseña de argumentos/entorno; idempotente; sin API.
- D-PA-004: `sesiones.validar` relee la cuenta (Activa) en cada petición, ya desde esta FASE.

## 4. Componentes

### 4.1 `src/server/store.js` (A)
`load() → estado` · `transaction(fn(estado) → resultado)`; serializa en cola de promesas; escritura temporal + `rename`; fallo inyectable → `E_ALMACEN_NO_DISPONIBLE`. Memoria en tests.

### 4.2 `src/domain/{config,reloj,errores,permisos}.js` (A)
`config` exporta cada valor de `VALUE-REGISTRY.md`; `reloj.hoy()` fecha `Europe/Madrid`; `errores` = catálogo VO-010; `permisos.puede(rol, operacion)` = PERMISSIONS-MATRIX.

### 4.3 `src/domain/acceso.js` y `src/server/sesiones.js` (A)
`iniciarSesion({correo, contrasena}, ctx) → {sesion, rol}` · `cerrarSesion(sesion)` · `validar(sesionId) → cuenta|E_NO_AUTENTICADO|E_SESION_CADUCADA`. scrypt con sal por cuenta; contador de fallos en la cuenta. Notas: mismo error para correo desconocido, en Baja y contraseña mala; un acierto reinicia el contador.

### 4.4 `src/domain/{inventario,reservas}.js` (A)
`anadirUnidades(actor, {tipo, cantidad})` · `darDeBajaUnidad(actor, {unidadId})` · `listarInventario(actor)` · `reservarMaterial(actor, {tipo, desde, hasta})` · `listarMisReservas(actor) → {reservas, multas: []}` (mínima: filtra por propietario, INV-ACC-009; multas y derivación en FASE-1). Notas: orden de validación sesión > rol > formato > estado (D-T-009); repetición idéntica devuelve la reserva existente.

### 4.5 `src/server/{http,vite-plugin,preparar-cuentas}.js`, `src/ui/**` (A)
Rutas de `OPERATION-MAPPING`; comprobación de `Origin`; log JSON sin cuerpos. SPA: `main`, `router`, `api`, `textos`, pantallas `entrar`, `mis-reservas` (mínima, solo lectura; la completa FASE-1), `reservar`, `inventario`. Tras entrar o reservar el router lleva a `#/mis-reservas`.

### 4.6 Puertos con doble

Ninguno: no hay sistemas externos (el almacén en memoria no es un puerto externo).

## 5. Notas de API

Mapeo en `design/OPERATION-MAPPING.md`; el 429/423 del bloqueo se emite como `E_CUENTA_BLOQUEADA` según el contrato; cookie `HttpOnly; SameSite=Strict`.

## 6. Cambios de datos

Crea `data/store.json` con `schemaVersion: 1` y colecciones `cuentas`, `unidades`, `reservas`, `multas`, `sesiones`.

## 7. Estrategia de tests

### 7.1 Unit
INV-ACC-001..006, 102; INV-RES-001..005, 008; INV-STK-001..004; reloj.

### 7.2 Integración
TEST-MATRIX-UC-001, UC-003, UC-008 (almacén en memoria como `in-memory repository`; reloj fijo; filas `race`, `replay`); SEC-T-003, 004, 005, 007; MNT-T-001..003.

### 7.3 E2E
E2E-WF-002-01, 02, IV01, EX01..EX04, E2E-ADM-02, E2E-WF-001-03 (reserva), INT-T-001.

### 7.4 Test Coverage Map (Source → Test)

| Source File | Type | Test File | Priority |
|-------------|------|-----------|----------|
| `src/domain/acceso.js` | service | `tests/unit/domain/acceso.test.js` (A) | HIGH |
| `src/domain/reservas.js` | service | `tests/unit/domain/reservas.test.js` (A) | HIGH |
| `src/domain/inventario.js` | service | `tests/unit/domain/inventario.test.js` (A) | HIGH |
| `src/domain/permisos.js` | logic | `tests/unit/domain/permisos.test.js` (A) | HIGH |
| `src/domain/reloj.js` | logic | `tests/unit/domain/reloj.test.js` (A) | HIGH |
| `src/server/sesiones.js` | state-machine | `tests/unit/server/sesiones.test.js` (A) | HIGH |
| `src/server/store.js` | infrastructure | `tests/unit/server/store.test.js` (A) | MEDIUM |
| `src/server/http.js` | service | `tests/unit/server/http.test.js` (A) | MEDIUM |
| `src/ui/pantallas/entrar.js` | page | `tests/unit/ui/entrar.test.js` (A) | MEDIUM |
| `src/ui/pantallas/mis-reservas.js` | page | `tests/unit/ui/mis-reservas.test.js` (A) | MEDIUM |
| `src/ui/pantallas/reservar.js` | page | `tests/unit/ui/reservar.test.js` (A) | MEDIUM |
| `src/ui/pantallas/inventario.js` | page | `tests/unit/ui/inventario.test.js` (A) | MEDIUM |

**Exclusions (no unit test needed):**

| File | Reason |
|------|--------|
| `src/domain/config.js`, `src/domain/errores.js` | constantes; cubiertas por integración |
| `src/server/vite-plugin.js`, `src/server/preparar-cuentas.js` | envoltorios finos; cubiertos por E2E y un test de arranque |
| `src/ui/{main,router,api,textos}.js` | cubiertos por E2E y MNT-T-001 |

## 8. Dependencias

Ninguna (fase inicial). Las FASEs 1..3 reutilizan `store`, `reloj`, `permisos`, `sesiones`, `errores`.

## 9. Criterios de aceptación

- [ ] Todos los escenarios de §7.3 y matrices pasan; `npm test` y `npm run lint` limpios
- [ ] Sin hallazgos de seguridad nuevos (SEC-001..007)
