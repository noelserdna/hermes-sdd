# Tasks: FASE-5 - Lo prestado, el historial y datos cerrados

> **Input:** plan/fases/FASE-5-CONSULTAS.md + plan/fase-plans/PLAN-FASE-5.md
> **Generated:** 2026-11-21
> **Total tasks:** 7
> **Parallel capacity:** 1
> **Critical path:** 7 tasks

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 7 |
| Parallelizable | 0 (0%) |
| Work Streams | 1 (A: 6 tasks) |
| Setup phase | 0 tasks |
| Foundation phase | 0 tasks |
| Slices phase | 6 tasks |
| Integration phase | 0 tasks |
| Verification phase | 1 tasks |

## Traceability

| Spec Reference | Task Coverage |
|---------------|---------------|
| UC-015 | TASK-F5-001, TASK-F5-002 |
| UC-016 | TASK-F5-003, TASK-F5-004 |
| API-003-09 | TASK-F5-001 |
| API-003-10 | TASK-F5-003 |
| INV-SEC-001 | TASK-F5-001, TASK-F5-003, TASK-F5-006 |
| INV-SEC-002 | TASK-F5-003, TASK-F5-004, TASK-F5-006 |
| INV-SEC-003 | TASK-F5-005 |
| SPEC-LIM-003 | TASK-F5-005 |
| REQ-F-009 | TASK-F5-001, TASK-F5-002, TASK-F5-007 |
| REQ-F-010 | TASK-F5-003, TASK-F5-004, TASK-F5-007 |
| REQ-NF-001 | TASK-F5-005, TASK-F5-006, TASK-F5-007 |

---

## Phase 1: Setup

**Purpose:** Sin tareas: las FASEs anteriores dejaron andamiaje, plugin, sesión y `seed`.
**Checkpoint:** No aplica.

---

## Phase 2: Foundation

**Purpose:** Sin tareas: lo compartido (`listarSocios`, préstamos, multas, `permisos.js`) ya existe; el resto se construye en el primer slice que lo usa.
**Checkpoint:** No aplica.

---

## Phase 3: Slices

**Purpose:** Un slice vertical por caso de uso o por grupo de operaciones afines, con el test escrito primero.
**Checkpoint:** Los tests de cada slice en verde.

### UC-015 — Ver lo prestado

- [ ] TASK-F5-001 Consultar lo prestado del día con retrasos (API-003-09), test-first | `tests/unit/prestamos.test.js`, `tests/api/prestado.test.js`, `src/domain/prestamos.js`, `src/domain/permisos.js`, `src/server/plugin.js`
  - **Commit:** `feat(consultas): consultarPrestado con vuelven hoy y retraso (API-003-09)`
  - **Acceptance:**
    - Test first: `AC-015-01 lista de lo prestado [REQ-F-009 AC1]` — con Piolet 1 prestado a "Lucía Gil" hasta 2026-12-07, `consultarPrestado` incluye "Piolet 1", "Lucía Gil" y fin 2026-12-07
    - Test first: `AC-015-02 vuelven hoy [REQ-F-009 AC2]` — con `dia` 2026-12-07 el Piolet 1 figura entre los que vuelven ese día
    - Test first: `AC-015-03 retraso [REQ-F-009 AC3]` — con `hoy` 2026-12-09 y Casco 2 con fin 2026-12-08 sin devolver, el retraso es 1 día ("Retrasado 1 día" en la UI)
    - Test first: `AC-015-04 sin préstamos [REQ-F-009 AC4]` — sin préstamos abiertos devuelve lista vacía
    - Test first: `AC-015-05 socio o junta` — con rol socio o junta responde `E_ACCESO_NO_PERMITIDO`; `AC-015-06 día mal formado` — `dia` "31-31-2026" da `E_DATOS_INVALIDOS`; `AC-015-07 fallo del almacén` — `E_ALMACEN_NO_DISPONIBLE` y sin lista
    - `dia` es opcional; `GET /api/consultarPrestado?dia=` solo para el encargado
  - **Refs:** FASE-5, REQ-F-009, UC-015, API-003-09, AC-015-01, AC-015-02, AC-015-03, AC-015-04, AC-015-05, AC-015-06, AC-015-07
  - **Revert:** SAFE — añade una operación de solo lectura sin cambios de esquema
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] La ruta GET y los errores coinciden con `contracts/API-prestamos.md`
    - [ ] El retraso se calcula contra `hoy` del reloj inyectable, no contra la fecha real

- [ ] TASK-F5-002 Pantalla Prestado con día y "Vuelven hoy" (UC-015), test-first | `tests/unit/ui-prestado.test.js`, `src/ui/pantallas/prestado.js`, `src/ui/pantallas/inicio.js`, `src/ui/textos.js`
  - blocked-by: TASK-F5-001
  - **Commit:** `feat(consultas): pantalla Prestado (UC-015)`
  - **Acceptance:**
    - Test first: `AC-015-01 fila de préstamo [REQ-F-009 AC1]` — en `#/prestado` se pinta "Piolet 1 — Lucía Gil — hasta 2026-12-07"
    - Test first: `AC-015-02 Vuelven hoy [REQ-F-009 AC2]` — al elegir el día 2026-12-07 el Piolet 1 aparece bajo "Vuelven hoy"
    - Test first: `AC-015-03 Retrasado [REQ-F-009 AC3]` — el préstamo con 1 día de retraso muestra "Retrasado 1 día"
    - Test first: `AC-015-04 vacío [REQ-F-009 AC4]` — sin préstamos muestra "No hay material prestado"
    - Con `E_DATOS_INVALIDOS` conserva la lista anterior; con `E_ALMACEN_NO_DISPONIBLE` o `E_ACCESO_NO_PERMITIDO` no pinta la lista y muestra el mensaje; el Panel enlaza a "Prestado" y el selector de día lleva `label`
  - **Refs:** FASE-5, REQ-F-009, UC-015, SCR-005, SCR-010, AC-015-01, AC-015-02, AC-015-03, AC-015-04
  - **Revert:** SAFE — pantalla y textos nuevos
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Los textos están en `src/ui/textos.js`, en español
    - [ ] No se fija el conjunto cerrado de entradas del Panel

### UC-016 — Consultar historial de un socio

- [ ] TASK-F5-003 Consultar historial de un socio solo para la junta (API-003-10), test-first | `tests/unit/prestamos.test.js`, `tests/unit/permisos.test.js`, `tests/api/historial.test.js`, `src/domain/prestamos.js`, `src/domain/permisos.js`, `src/server/plugin.js`
  - blocked-by: TASK-F5-002
  - **Commit:** `feat(consultas): consultarHistorialSocio de solo lectura para la junta (API-003-10)`
  - **Acceptance:**
    - Test first: `AC-016-01 multa pendiente [REQ-F-010 AC1]` — historial de "Pablo Ruiz" incluye una multa de 6,00 € (600 céntimos) Pendiente y ningún préstamo ni multa de "Lucía Gil" (INV-SEC-001)
    - Test first: `AC-016-02 préstamo devuelto [REQ-F-010 AC2]` — incluye "Piolet 1" con estado Devuelto
    - Test first: `AC-016-03 sin historial [REQ-F-010 AC3]` — socio sin movimientos devuelve listas vacías
    - Test first: `AC-016-05 rol socio` — con rol socio `E_ACCESO_NO_PERMITIDO` y sin historial; `AC-016-06 socio inexistente` — `E_SOCIO_NO_ENCONTRADO`; `AC-016-07 fallo del almacén` — `E_ALMACEN_NO_DISPONIBLE`
    - Test first: `SEC-T-005 / INV-SEC-002` — la junta solo puede API-001-02, API-001-03 y API-003-10 (y `listarSocios` de lectura, Supuesto 1); cualquier otra operación da `E_ACCESO_NO_PERMITIDO`, `cerrarSesion` y `comprobarSesion` quedan exentas; un socio en Baja conserva su historial dentro de la retención
  - **Refs:** FASE-5, REQ-F-010, UC-016, API-003-10, INV-SEC-001, INV-SEC-002, AC-016-01, AC-016-02, AC-016-03, AC-016-05, AC-016-06, AC-016-07
  - **Revert:** SAFE — operación de solo lectura y fila de permisos, sin cambios de esquema
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] El historial solo contiene datos del socio pedido
    - [ ] `permisos.js` no concede escritura a la junta

- [ ] TASK-F5-004 Pantalla Historial con selector de socio y junta sin escritura (UC-016), test-first | `tests/unit/ui-historial.test.js`, `src/ui/pantallas/historial.js`, `src/ui/pantallas/inicio.js`, `src/ui/textos.js`
  - blocked-by: TASK-F5-003
  - **Commit:** `feat(consultas): pantalla Historial para la junta (UC-016)`
  - **Acceptance:**
    - Test first: `AC-016-01 multa en el historial [REQ-F-010 AC1]` — al elegir a "Pablo Ruiz" se pinta "Multa 6,00 € Pendiente" y nada de Lucía
    - Test first: `AC-016-02 devuelto [REQ-F-010 AC2]` — se pinta "Piolet 1" con "Devuelto"
    - Test first: `AC-016-03 sin historial [REQ-F-010 AC3]` — se pinta "Sin préstamos ni multas"
    - Test first: `AC-016-04 junta sin escritura [REQ-F-010 AC4]` — con rol junta, Entregar, Inventario y Reservar muestran "Acceso no permitido" y la pantalla Historial no ofrece botones que cambien datos
    - El selector de socio usa `label` y `listarSocios` de solo lectura; con `E_SOCIO_NO_ENCONTRADO`, `E_ACCESO_NO_PERMITIDO` o `E_ALMACEN_NO_DISPONIBLE` no se pinta historial y se muestra el mensaje
  - **Refs:** FASE-5, REQ-F-010, UC-016, SCR-011, AC-016-01, AC-016-02, AC-016-03, AC-016-04
  - **Revert:** SAFE — pantalla y textos nuevos
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Ningún botón de escritura en la vista de la junta
    - [ ] Los textos están en `src/ui/textos.js`

### Transversal — Purga y seguridad por rol (REQ-NF-001)

- [ ] TASK-F5-005 Purga de cuentas e historial a los 2 años al arrancar (SPEC-LIM-003), test-first | `tests/unit/purga.test.js`, `src/server/purga.js`, `src/server/plugin.js`
  - blocked-by: TASK-F5-004
  - **Commit:** `feat(consultas): purga por retención al arrancar (SPEC-LIM-003)`
  - **Acceptance:**
    - Test first: `SPEC-LIM-003 purga a los 2 años` — con reloj falso, cuentas y préstamos/multas cuya última actividad supera `RETENTION_YEARS` (2 años) se borran y los de actividad reciente se conservan
    - Test first: `RN-010 socio en Baja dentro de la retención` — un socio en Baja con actividad de hace menos de 2 años conserva su historial
    - `purgar(store, hoy)` corre al arrancar el plugin, dentro de `store.transaccion` (INV-SEC-003); sin cambios de esquema
  - **Refs:** FASE-5, REQ-NF-001, SPEC-LIM-003, RN-010, INV-SEC-003, D-PA-010
  - **Revert:** SAFE — módulo nuevo y una llamada al arrancar, sin cambio de formato del almacén
  - **Review:**
    - [ ] El test falló antes de la implementación
    - [ ] Un fallo a mitad de la purga no deja el almacén a medias
    - [ ] El reloj es inyectable en la prueba

- [ ] TASK-F5-006 Prueba cruzada de seguridad por rol sobre la API (SEC-T-001..006) | `tests/api/seguridad.test.js`, `tests/unit/permisos.test.js`, `src/domain/permisos.js`
  - blocked-by: TASK-F5-005
  - **Commit:** `test(consultas): prueba cruzada de seguridad por rol (REQ-NF-001)`
  - **Acceptance:**
    - Test first: `REQ-NF-001 AC1 SEC-T-001` — la sesión de "lucia" que pide las multas o el historial de "pablo" recibe rechazo y ningún dato de Pablo
    - Test first: `REQ-NF-001 AC2 SEC-T-002` — sin sesión cada operación de la API se rechaza
    - Test first: `REQ-NF-001 AC3 SEC-T-003` — el almacén no contiene "Nieve2026" y sí un hash de la contraseña
    - Test first: `REQ-NF-001 AC4` — un socio recibe `E_ACCESO_NO_PERMITIDO` ("Acceso no permitido") en `listarSocios`
    - Test first: `SEC-T-005` — recorre cada operación de `permisos.js` por rol (socio, encargado, junta, sistema); `SEC-T-006` — ningún secreto ni contraseña aparece en los logs
    - El recorrido por rol no fija la lista cerrada de operaciones: comprueba las que cada criterio nombra
  - **Refs:** FASE-5, REQ-NF-001, INV-SEC-001, INV-SEC-002, SEC-T-001, SEC-T-002, SEC-T-003, SEC-T-005, SEC-T-006
  - **Revert:** SAFE — solo añade tests (y corrige permisos si el recorrido destapa un hueco)
  - **Review:**
    - [ ] Cada criterio se prueba en un solo nivel
    - [ ] No se repiten aquí las restricciones REQ-C ya probadas

---

## Phase 4: Integration

**Purpose:** Sin tareas: las rutas `#/prestado` y `#/historial` y la API se enganchan dentro de los slices; no hay cableado compartido por varios Streams.
**Checkpoint:** No aplica.

---

## Phase 5: Verification

**Purpose:** Journey de FASE-5 por la ruta del usuario.
**Checkpoint:** El journey de FASE-5 pasa con capturas, vídeo y axe-core (A11Y-T-001).

- [ ] TASK-F5-007 Journey FASE-5: el encargado ve lo prestado, la junta consulta el historial sin escribir y Lucía no ve datos de Pablo | `tests/e2e/fase-5-consultas.spec.js`
  - blocked-by: TASK-F5-006
  - **Commit:** `test(consultas): journey de FASE-5 con capturas`
  - **Acceptance:**
    - Test first: `AC-015-01`, `AC-015-02`, `AC-015-03`, `AC-016-01`, `AC-016-04`, `REQ-NF-001 AC1`, `REQ-NF-001 AC3` — un test por escenario de la Demo, con datos de partida de FASE-2/3 y `SEED_ROL=junta npm run seed` para la junta
    - El título lleva FASE-5 (la FASE no declara workflow), que da nombre al vídeo
    - Entra por el paso 1 de la Demo (el encargado abre "Prestado"), nunca por una entrada interna
    - Afirma con `toHaveText`/`toContainText`: "Piolet 1 — Lucía Gil — hasta 2026-12-07"; "Vuelven hoy"; "Retrasado 1 día" (con `CLOCK_FIXED=2026-12-09`); "Multa 6,00 € Pendiente"; "Acceso no permitido"; el rechazo a Lucía; en `data/almacen.json` no aparece `Nieve2026` y hay un hash
    - Guarda `evidencias/FASE-5/{AC-NNN-NN}.png` por criterio y un vídeo con FASE-5 en el nombre, con `narrar` y `captura` de `tests/e2e/fixtures/evidence.js`; pasa axe-core sobre Prestado e Historial (A11Y-T-001)
    - Los demás escenarios (AC-015-04..07, AC-016-02, AC-016-03, AC-016-05..07, REQ-NF-001 AC2, AC4) los cubren los tests de TASK-F5-001 a TASK-F5-006 y no se repiten aquí
  - **Refs:** FASE-5, REQ-F-009, REQ-F-010, REQ-NF-001, AC-015-01, AC-015-02, AC-015-03, AC-016-01, AC-016-04, REQ-NF-001 AC1, REQ-NF-001 AC3
  - **Revert:** SAFE — solo añade un test
  - **Review:**
    - [ ] El journey entra por la ruta del usuario
    - [ ] Las capturas se guardan en `evidencias/FASE-5/`

- [ ] TASK-F5-008 Corregir CH-004: la comprobación de REQ-F-009 AC2 afirma entera la sección «Vuelven hoy» y que «Casco 2» no está en ella | `tests/unit/ui-prestado.test.js`, `tests/e2e/fase-5-consultas.spec.js`
  - blocked-by: TASK-F5-007
  - **Source:** FEEDBACK-FASE-5
  - **Commit:** `test(consultas): REQ-F-009 AC2 afirma entera la sección Vuelven hoy`
  - **Acceptance:**
    - Reproduce first: WEAKENED-ASSERT (el código es correcto, se endurece el test): el GIVEN lleva sus dos préstamos con sus datos, el WHEN elige 2026-12-07 y el THEN afirma el texto exacto de «Vuelven hoy» (título y única línea «Piolet 1 — Lucía Gil — hasta 2026-12-07») y que «Casco 2» no está en ella
    - La captura AC-015-02 muestra la pantalla con «Vuelven hoy» y «Piolet 1»
  - **Refs:** FASE-5, REQ-F-009, AC-015-02
  - **Revert:** SAFE — solo endurece tests
  - **Review:**
    - [ ] El test cita la letra del criterio y afirma todo su THEN

- [ ] TASK-F5-009 Corregir CH-005: ninguna dirección de datos se sirve sin sesión (REQ-NF-001 AC2), ni `/data/almacen.json` ni por `/@fs/` | `src/server/plugin.js`, `tests/api/seguridad.test.js`
  - blocked-by: TASK-F5-007
  - **Source:** FEEDBACK-FASE-5
  - **Commit:** `fix(seguridad): el servidor rechaza las direcciones del fichero de datos`
  - **Acceptance:**
    - Reproduce first: con el servidor de Vite real y sin sesión, `GET /data/almacen.json` devuelve 200 con el almacén; debe ser rechazo 401 `E_NO_AUTENTICADO` (y 403 con sesión: el fichero nunca se sirve), también por `/data/almacen.json.tmp`, `/@fs/…/data/almacen.json` y variantes codificadas
    - Las operaciones de la API siguen como antes
  - **Refs:** FASE-5, REQ-NF-001, REQ-NF-001 AC2
  - **Revert:** SAFE — solo añade un rechazo
  - **Review:**
    - [ ] El test levanta el servidor de Vite real, no solo el manejador

- [ ] TASK-F5-010 Corregir CH-006: ninguna forma de pedir el fichero de datos sin sesión devuelve su contenido (REQ-NF-001 AC2), ni con `?import`, `/@id/` ni `//data/` | `src/server/plugin.js`, `tests/api/seguridad.test.js`
  - blocked-by: TASK-F5-009
  - **Source:** FEEDBACK-FASE-5
  - **Commit:** `fix(seguridad): el rechazo del fichero de datos cubre /@id/, // y ?import`
  - **Acceptance:**
    - Reproduce first: BYPASS-PATH — con el servidor de Vite real y sin sesión, `GET /@id/data/almacen.json?import` devuelve 200 con el contenido del almacén; debe ser rechazo 401 `E_NO_AUTENTICADO` y sin datos, igual que `//data/almacen.json`, `/@id/…ruta absoluta…?import`, `/data/almacen.json?import` y la forma absoluta de la petición
    - Las operaciones de la API siguen como antes
  - **Refs:** FASE-5, REQ-NF-001, REQ-NF-001 AC2
  - **Revert:** SAFE — solo amplía un rechazo
  - **Review:**
    - [ ] El test levanta el servidor de Vite real y comprueba que el cuerpo no contiene datos del almacén

- [ ] TASK-F5-011 Corregir CH-007: REQ-F-009 AC2 dice que el Casco 2 no está en «Vuelven hoy» y sí en «Prestado ahora» | `tests/unit/ui-prestado.test.js`, `tests/e2e/fase-5-consultas.spec.js`
  - blocked-by: TASK-F5-010
  - **Source:** FEEDBACK-FASE-5
  - **Commit:** `test(consultas): REQ-F-009 AC2 dice que el Casco 2 sigue en Prestado ahora y no en Vuelven hoy`
  - **Acceptance:**
    - Reproduce first: WEAKENED-ASSERT (el código es correcto; decisión de la persona: «does not see "Casco 2"» significa que no aparece en «Vuelven hoy» ese día, el Casco 2 sigue prestado y se ve en «Prestado ahora»): el test y la captura lo dicen así
  - **Refs:** FASE-5, REQ-F-009, AC-015-02
  - **Revert:** SAFE — solo retoca tests
  - **Review:**
    - [ ] El test cita la letra del criterio y deja claro dónde sí y dónde no se ve el Casco 2

- [ ] TASK-F5-012 Comprobar REQ-C-001: la web es JavaScript con Vite y Vitest, sin otro framework de interfaz | `tests/unit/restriccion-stack.test.js`
  - blocked-by: TASK-F5-011
  - **Source:** ACCEPTANCE-LOOP
  - **Commit:** `test(restricciones): REQ-C-001 AC1 package.json lista vite y vitest y ningún otro framework`
  - **Acceptance:**
    - Test first: `REQ-C-001 AC1` — `package.json` lista `vite` y `vitest` y ningún framework de interfaz
  - **Refs:** FASE-5, REQ-C-001
  - **Revert:** SAFE — solo añade un test
  - **Review:**
    - [ ] El test cita la letra del criterio y no fija el conjunto cerrado de dependencias

- [ ] TASK-F5-013 Comprobar REQ-C-002: los textos de la interfaz están en español y los mensajes de los criterios salen literales | `tests/unit/restriccion-espanol.test.js`
  - blocked-by: TASK-F5-012
  - **Source:** ACCEPTANCE-LOOP
  - **Commit:** `test(restricciones): REQ-C-002 AC1 los textos de la interfaz se leen del código y los mensajes en español salen literales`
  - **Acceptance:**
    - Test first: `REQ-C-002 AC1` — los textos y errores se leen del código y aparecen literales «Acceso no permitido», «No hay unidades libres esas fechas» y «Solo se puede cancelar hasta el día antes»; `index.html` declara `lang="es"`
  - **Refs:** FASE-5, REQ-C-002
  - **Revert:** SAFE — solo añade un test
  - **Review:**
    - [ ] El test lee los ficheros fuente, no una copia

- [ ] TASK-F5-014 Comprobar REQ-C-003: una segunda sesión con otra cuenta lee lo que escribió la primera | `tests/api/datos-compartidos.test.js`
  - blocked-by: TASK-F5-013
  - **Source:** ACCEPTANCE-LOOP
  - **Commit:** `test(restricciones): REQ-C-003 AC1 una segunda sesión con otra cuenta lee los datos que escribió la primera`
  - **Acceptance:**
    - Test first: `REQ-C-003 AC1` — Lucía reserva 1 Piolet de 3 por HTTP y la sesión de Pablo ve 2 libres; un segundo almacén sobre el mismo fichero lee la reserva
  - **Refs:** FASE-5, REQ-C-003
  - **Revert:** SAFE — solo añade un test
  - **Review:**
    - [ ] El test usa dos sesiones y dos cuentas distintas

### Test Exclusions

Files excluded from unit test coverage (from PLAN-FASE §7.4 Exclusions):

| File | Reason | Verified By |
|------|--------|-------------|
| — | ninguna | N/A |

---

## Dependencies

### Task Dependency Graph

```text
TASK-F5-001 ──► TASK-F5-002 ──► TASK-F5-003 ──► TASK-F5-004 ──► TASK-F5-005 ──► TASK-F5-006 ──► TASK-F5-007
```

### Critical Path

1. TASK-F5-001 → TASK-F5-002 → TASK-F5-003 → TASK-F5-004 → TASK-F5-005 → TASK-F5-006 → TASK-F5-007
   (7 tasks on critical path)

### Parallel Execution Plan

**Stream A:** consultas y seguridad en serie (prestado, historial, purga, prueba cruzada) — see Stream Ownership

## Stream Ownership

| Stream | Tasks | Owns (write-set) | Runs in |
|--------|-------|------------------|---------|
| base | — | — | main checkout, before worktrees (checkpoint `fase-5-foundation`) |
| A | TASK-F5-001, TASK-F5-002, TASK-F5-003, TASK-F5-004, TASK-F5-005, TASK-F5-006, TASK-F5-008, TASK-F5-009, TASK-F5-010, TASK-F5-011, TASK-F5-012, TASK-F5-013, TASK-F5-014 | `src/domain/prestamos.js`, `src/domain/permisos.js`, `src/server/plugin.js`, `src/server/purga.js`, `src/ui/pantallas/prestado.js`, `src/ui/pantallas/historial.js`, `src/ui/pantallas/inicio.js`, `src/ui/textos.js`, `tests/unit/prestamos.test.js`, `tests/unit/permisos.test.js`, `tests/unit/purga.test.js`, `tests/unit/ui-prestado.test.js`, `tests/unit/ui-historial.test.js`, `tests/api/prestado.test.js`, `tests/api/historial.test.js`, `tests/api/seguridad.test.js`, `tests/unit/restriccion-stack.test.js`, `tests/unit/restriccion-espanol.test.js`, `tests/api/datos-compartidos.test.js` | worktree `feat/fase-5-a` |
| integración | — | — | main checkout, after `--integrate --fase 5` |
| verificación | TASK-F5-007 | `tests/e2e/fase-5-consultas.spec.js` | main checkout, Phase 9 |

### Rollback Checkpoints

| Checkpoint | After Task | Tag | Runs in |
|-----------|------------|-----|---------|
| Verified | TASK-F5-007 | `fase-5-verified` | main checkout |
