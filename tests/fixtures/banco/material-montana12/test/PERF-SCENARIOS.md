# Performance Test Scenarios — material-montana12

> Derived from: spec/nfr/PERFORMANCE.md (REQ-NF-002), spec/VALUE-REGISTRY.md — quantified targets only

## Targets

| ID | Metric | Target | Measurement (from spec) | Source |
|----|--------|--------|--------------------------|--------|
| PERF-001 | Tiempo hasta ver en otro navegador un cambio hecho en el primero, tras recargar | ≤ `SYNC_VISIBILITY_SECONDS` (5 s) | reserva creada en navegador A; panel abierto en B; tiempo hasta verla al recargar | SPEC-PERF-001, REQ-NF-002 |
| PERF-002 | Datos de negocio solo en el servidor | 0 datos solo en el dispositivo | dos sesiones independientes ven las mismas reservas, multas y material | SPEC-PERF-002, REQ-NF-002 |
| PERF-003 | Registros perdidos tras reiniciar el servidor | 0 | crear reserva, reiniciar, entrar y listar | SPEC-PERF-003, REQ-NF-002 |

## Scenarios

| ID | Type | Target / dataset | Method (≤ 140 chars) | Pass criterion | Blocking | Refs |
|----|------|------------------|-----------------------|----------------|----------|------|
| PERF-001 | latency | UC-007 en A, UC-017 en B · 1 reserva | 2 contextos Playwright; 10 muestras, descartar la 1.ª; medir hasta ver la fila tras recargar | máximo ≤ `SYNC_VISIBILITY_SECONDS`; 0 fallos | yes | REQ-NF-002, UC-007, UC-017 |
| PERF-002 | consistency | reservas, multas y material · 2 sesiones | escribir en A (reservar, devolver con retraso, añadir unidades); leer en B sin compartir storage del navegador | B ve el 100% de los datos; ninguno en localStorage/IndexedDB | yes | REQ-NF-002, INV-RES-005 |
| PERF-003 | durability | 1 reserva, 1 préstamo, 1 multa | crear, reiniciar el servidor (D-T-011), entrar (UC-001) y listar (UC-008, UC-012) | 0 registros perdidos; el acceso funciona | yes | REQ-NF-002, WF-001 |

## Harness

Playwright con dos contextos aislados (storageState distinto); servidor local con almacén en fichero temporal por ejecución; reloj fijo (D-T-001); serie, sin paralelismo; resultado en JUnit con el id PERF-NNN en el nombre del test (`REQ-NF-002 AC1 …`).

## Not planned

| Item | Reason (≤ 80 chars) | Ref |
|------|----------------------|-----|
| Carga, estrés, soak, spike | ningún NFR los cuantifica | REQ-NF-002 |
| Límites de uso (`LOGIN_MAX_FAILURES`…) | funcionales: cubiertos en matrices UC-001, 007, 011 | SPEC-LIM-001..008 |
