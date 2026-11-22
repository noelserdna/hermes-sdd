# Plan de FASE 3 — Socios y datos personales

> Fuente: `plan/fases/FASE-3-SOCIOS.md` · Depende de FASE-2

## 1. Visión

Gestión de socios por el encargado, corte inmediato de sesión en la baja y retención/borrado de datos. Un bloque serial.

## 2. Specs a implementar

| Id | Nota |
|----|------|
| UC-002 / API-001-03..06 | `crearSocio` solo crea rol Socio (D-PA-003); correo normalizado único |
| API-003-08 | purga por `RETENTION_YEARS`; nunca multa Pendiente (INV-LOA-006) |
| REQ-NF-001 | hash ya desde FASE-0; aquí se mide AC1 y AC2 |

## 3. Decisiones de la FASE

- D-PA-004: `darDeBajaSocio` borra las sesiones de la cuenta en la misma transacción; además `sesiones.validar` ya rechaza cuentas no Activas.
- D-PA-005: la purga elimina cuentas en Baja sin reservas ni multas conservadas (nombre, correo, hash). Pendiente de spec (Spec Gaps).

## 4. Componentes

### 4.1 `src/domain/socios.js` (A)
`crearSocio(actor, {nombre, correo, contrasena})` · `darDeBajaSocio(actor, {socioId})` · `restablecerContrasena(actor, {socioId, contrasena})` · `listarSocios(actor)`. Notas: baja bloqueada con Prestada o multa Pendiente (INV-ACC-007); restablecer sustituye el hash; nunca opera sobre encargado ni junta.

### 4.2 `src/domain/tareas.js` (A)
`purgarRegistrosAntiguos({store, reloj}) → contadores`. Notas: cierre de préstamo = devolución (o `hasta` si Cancelada o No recogida); de multa = fecha de pago (RN-013); idempotente.

### 4.3 `src/server/sesiones.js` (A)
`revocarDeCuenta(estado, cuentaId)`.

### 4.4 `src/ui/pantallas/socios.js` (A)
SCR-006: tabla Socios, alta, Dar de baja, Restablecer contraseña.

### 4.5 Puertos con doble

Ninguno.

## 5. Notas de API

La baja responde 409 `E_BAJA_SOCIO_BLOQUEADA` según OPERATION-MAPPING.

## 6. Cambios de datos

Ninguno de esquema; la purga elimina registros y cuentas.

## 7. Estrategia de tests

### 7.1 Unit
INV-ACC-001..003, 007, 103; INV-LOA-006; test sin id AC para la sesión cortada.

### 7.2 Integración
TEST-MATRIX-UC-002 (almacén en memoria como `in-memory repository`); SEC-T-001, 002, 005, 006; LIM-T-004.

### 7.3 E2E
E2E-ADM-01.

### 7.4 Test Coverage Map (Source → Test)

| Source File | Type | Test File | Priority |
|-------------|------|-----------|----------|
| `src/domain/socios.js` | service | `tests/unit/domain/socios.test.js` (A) | HIGH |
| `src/domain/tareas.js` (purga) | logic | `tests/unit/domain/purga.test.js` (A) | HIGH |
| `src/server/sesiones.js` (revocar) | state-machine | `tests/unit/server/sesiones-baja.test.js` (A) | HIGH |
| `src/ui/pantallas/socios.js` | page | `tests/unit/ui/socios.test.js` (A) | MEDIUM |

**Exclusions (no unit test needed):** ninguna.

## 8. Dependencias

| Componente | De FASE | Para |
|------------|---------|------|
| `sesiones`, `acceso` | 0 | revocación |
| `prestamos`, multas | 2 | INV-ACC-007, purga |

## 9. Criterios de aceptación

- [ ] Escenarios de §7.3, SEC-T y LIM-T-004 pasan
- [ ] Sesión de un socio dado de baja inválida en la siguiente petición
