# Plan de FASE 2 — Devolver, multar e historial

> Fuente: `plan/fases/FASE-2-DEVOLUCION.md` · Depende de FASE-1

## 1. Visión

Cierra el ciclo WF-001: devolución con multa, pago y consulta del historial. Un bloque serial.

## 2. Specs a implementar

| Id | Nota |
|----|------|
| UC-006 / API-003-02 | multa = `FINE_PER_DAY_EUR` × días naturales de retraso; una por préstamo |
| UC-007 / API-003-03/04 | pagar guarda fecha; repetir no cambia (INV-LOA-005) |
| UC-010 / API-003-06 | lectura pura; Junta y Encargado |

## 3. Decisiones de la FASE

Ninguna nueva; se aplican ADR-001 (días naturales) y ADR-002 (transacción).

## 4. Componentes

### 4.1 `src/domain/prestamos.js` (A)
`devolverPrestamo(actor, {reservaId})` · `pagarMulta(actor, {multaId})` · `listarMultas(actor)` · `consultarHistorial(actor, {socioId})`. Notas: devolución y multa en una sola transacción; repetir devolución no duplica; el desbloqueo es derivado (sin multas Pendientes).

### 4.2 `src/ui/pantallas/{entregas,multas,historial}.js` (A)
Acción Devolver en SCR-004; SCR-005; SCR-008 con selector de socio.

### 4.3 Puertos con doble

Ninguno.

## 5. Notas de API

`consultarHistorial` recibe `socioId` por query (`GET /api/historial?socioId=`).

## 6. Cambios de datos

Ninguno de esquema; `multas` empieza a poblarse.

## 7. Estrategia de tests

### 7.1 Unit
INV-LOA-003, 004, 005, 402.

### 7.2 Integración
TEST-MATRIX-UC-006, UC-007, UC-010 (almacén en memoria como `in-memory repository`); SEC-T-005.

### 7.3 E2E
E2E-WF-001-01, 02, 03, 05, EX09, EX11.

### 7.4 Test Coverage Map (Source → Test)

| Source File | Type | Test File | Priority |
|-------------|------|-----------|----------|
| `src/domain/prestamos.js` (devolver, pagar, historial) | service | `tests/unit/domain/prestamos-cierre.test.js` (A) | HIGH |
| `src/ui/pantallas/multas.js` | page | `tests/unit/ui/multas.test.js` (A) | MEDIUM |
| `src/ui/pantallas/historial.js` | page | `tests/unit/ui/historial.test.js` (A) | MEDIUM |

**Exclusions (no unit test needed):** ninguna.

## 8. Dependencias

| Componente | De FASE | Para |
|------------|---------|------|
| `entregarReserva`, `entregas.js`, `reservas` | 1 | devolver |

## 9. Criterios de aceptación

- [ ] Escenarios de §7.3 y matrices pasan; vídeo WF-001
- [ ] Multa de 6 € por 3 días y 2 € por 1 día (AC-006-02, AC-006-03)
