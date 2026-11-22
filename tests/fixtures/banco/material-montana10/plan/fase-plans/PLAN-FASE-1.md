# Plan de FASE 1 — Cuidar las reservas y entregar

> Fuente: `plan/fases/FASE-1-ENTREGA.md` · Depende de FASE-0

## 1. Visión

Socio: Mis reservas y cancelar. Encargado: entregar y listado diario. Junta: solo lectura del listado. Un bloque serial.

## 2. Specs a implementar

| Id | Nota |
|----|------|
| UC-004 / API-002-02/03 | filtro por propietario (INV-ACC-009); cancelar hasta el día antes de `desde` |
| UC-005 / API-003-01 | asigna la primera unidad activa libre del tipo, en transacción |
| UC-009 / API-003-05 | lectura pura; acciones solo al encargado (INV-LOA-401) |
| API-003-07 | derivada al leer y por tarea diaria (D-PA-008) |

## 3. Decisiones de la FASE

- D-PA-008: `reservas.derivarNoRecogidas(estado, hoy)` se invoca al leer; la tarea diaria solo persiste el resultado.

## 4. Componentes

### 4.1 `src/domain/reservas.js` (A)
`listarMisReservas(actor) → {reservas, multas}` (FASE-0 la entrega mínima con `multas: []` sin derivar No recogida; aquí se completa) · `cancelarReserva(actor, {reservaId})`. Notas: repetir cancelar devuelve la Cancelada; ajena = `E_SIN_PERMISO_CANCELAR`.

### 4.2 `src/domain/prestamos.js` (A)
`entregarReserva(actor, {reservaId})` · `consultarEntregasYDevoluciones(actor)`. Notas: `desde` ≤ hoy (INV-LOA-001); repetir una Prestada no asigna otra unidad (INV-LOA-301).

### 4.3 `src/domain/tareas.js`, `src/server/tareas-diarias.js` (A)
`resolverNoRecogidas({store, reloj}) → contadores`; programa `setInterval` y `/api/tareas-diarias` con `x-cron-secret`.

### 4.4 `src/ui/pantallas/{mis-reservas,entregas}.js` (A)
SCR-002 (amplía la versión mínima de FASE-0 con Cancelar y multas) y SCR-004; la junta ve el listado sin botones.

### 4.5 Puertos con doble

Ninguno.

## 5. Notas de API

Mapeo en OPERATION-MAPPING; el listado de la junta usa la misma operación con rol Junta.

## 6. Cambios de datos

Ninguno de esquema; `reservas` gana `unidadId` al entregar.

## 7. Estrategia de tests

### 7.1 Unit
INV-RES-006, 007; INV-LOA-001, 002, 301, 401.

### 7.2 Integración
TEST-MATRIX-UC-004, UC-005, UC-009 (almacén en memoria como `in-memory repository`, reloj movido); SEC-T-005 para estas operaciones; D-T-010 (API-003-07).

### 7.3 E2E
E2E-WF-001-04, 05, EX05..EX08, EX10.

### 7.4 Test Coverage Map (Source → Test)

| Source File | Type | Test File | Priority |
|-------------|------|-----------|----------|
| `src/domain/prestamos.js` | service | `tests/unit/domain/prestamos.test.js` (A) | HIGH |
| `src/domain/reservas.js` (cancelar, derivar) | state-machine | `tests/unit/domain/reservas-ciclo.test.js` (A) | HIGH |
| `src/domain/tareas.js` | service | `tests/unit/domain/tareas.test.js` (A) | HIGH |
| `src/ui/pantallas/mis-reservas.js` | page | `tests/unit/ui/mis-reservas.test.js` (A) | MEDIUM |
| `src/ui/pantallas/entregas.js` | page | `tests/unit/ui/entregas.test.js` (A) | MEDIUM |

**Exclusions (no unit test needed):**

| File | Reason |
|------|--------|
| `src/server/tareas-diarias.js` | envoltorio de temporizador; cubierto por D-T-010 vía `tareas` |

## 8. Dependencias

| Componente | De FASE | Para |
|------------|---------|------|
| `store`, `reloj`, `permisos`, `sesiones`, `reservas` | 0 | todo |

## 9. Criterios de aceptación

- [ ] Escenarios de §7.3 y matrices pasan; lint limpio
- [ ] La junta no ve acciones (AC-009-05)
