# E2E Acceptance Scenarios

> **Project:** material-montana12 · **Type:** WEB-APP · **UX enrichment:** No (sin `ux/`: localizadores por rol/nombre accesible de los textos de REQUIREMENTS y UC)
> **Generated from:** spec/workflows/, spec/use-cases/, spec/contracts/ (`Style: operations`), spec/tests/BDD-UC-*.md, TEST-PLAN §5/§6
> V-FIELD-03/04/05 no aplican (sin wireframes). V-FIELD-01/02 aplicadas (Findings F-01..F-03).

## E2E Strategy

| Dimension | Value |
|---|---|
| Framework | Playwright (chromium), `npx playwright test`; `captura(page, testInfo, id, { ve })` (D-T-010) |
| Selector strategy | getByRole > getByLabel > getByText. Links de menú «Reservar», «Mis reservas», «Mis multas», «Socios», «Material», «Multas»; botones «Entregar», «Devolver», «Cancelar», «Marcar pagada», «Salir»; campos /correo/, /contraseña/, /nombre/, /cantidad/, /tipo/, /inicio/, /fin/, /fecha/, /buscar/ (F-06) |
| Auth strategy | siempre por la pantalla Entrar con cuenta semilla (ruta del usuario); `storageState` solo en pasos sin captura |
| Data strategy | unique-per-test (D-T-003), semilla por API (R-5); reloj `hoy(YYYY-MM-DD)` (D-T-001); fallo de almacén simulable (D-T-002) |
| Accessibility | axe-core WCAG 2.2 AA en cada navegación principal (pasos `axe`) |
| Parallelism | 2 workers; contexto aislado por rol |
| Visual evidence | `required`: `evidencias/FASE-{N}/{AC-NNN-NN}.png`; 2ª pantalla del mismo criterio `{AC}-2.png` (F-08); vídeo por WF (`WF-001-ciclo-prestamo.webm`, `WF-002-alta-primer-acceso.webm`). Filas Full: Evidence = `{AC}.png` |
| Target environment | none (sin `staging_url`) |

> Fixtures: `lucia`=socio Lucía Gil lucia@club.test/Cumbre2026! · `pablo`=encargado pablo@club.test/Piolet2026! · `pabloSocio`=socio Pablo Sanz (F-04) · `marta`=Marta Ruiz marta@club.test/Provisional1 · `junta` (F-05) · Casco 6, Tienda 2, Cuerda 4, Linterna 3 · hoy=2026-12-01 salvo `hoy(..)`. «@X» = en pantalla X.

| Tier | Scenarios | Run time | Trigger |
|---|---|---|---|
| Smoke | P0: WF-001-01, WF-002-01 | < 2 min | Every PR |
| Critical | P0+P1: WF-001-02/03, ACC-01..07, SEC-01, variantes V/IV/CD/FI/EX/A11Y | < 10 min | Merge to main |
| Full | todo + lista P2 (F01..F13) | < 30 min | Nightly |
| smoke-deploy | none, sin escenarios | — | — |

Viewport Matrix (sin `ux/DESIGN-TOKENS.json`: anchos por defecto): Mobile 375px = P0+P1 · Desktop 1280px = All.

---

## Field Inventory y Behavioral Matrix (WF-001, WF-002, ACC)

> UC `Input/Output` → `API-NNN-NN` input. Sin wireframe. Todos requeridos salvo `date`.

| Field | UC → Operation | Rules | EMPTY | INVALID | COND |
|---|---|---|---|---|---|
| email, password (Entrar) | UC-001 → API-001-01 | VO-002 | V01/V02 `E_CREDENCIALES` (F-01) | IV01 | bloqueo 5 fallos |
| name, email, password (alta) | UC-003 → API-001-04 | email único; ≥ 8 | V03/V04 `E_SOCIO_DATOS_INVALIDOS`; V05 `E_CONTRASENA_CORTA` | IV02, IV03, AC-003-02 | No |
| password (cambiar) | UC-004 → API-001-03 | ≥ 8 | V06 | IV04 | solo `mustChangePassword` |
| accountId, password (restablecer) | UC-005 → API-001-05 | ≥ 8 | V07 | IV05 | No |
| accountId (baja) | UC-006 → API-001-06 | — | N/A (botón) | AC-006-04/05 | No |
| itemId, quantity, startDate, endDate (Reservar) | UC-007 → API-002-01 | cant. 1..5; inicio ≥ hoy; fin ≥ inicio; ≤ 14 días | V08 `E_CANTIDAD_INVALIDA`; V09/V10 `E_FECHA_INVALIDA` | IV04..IV07 | CD03 |
| date (Panel) | UC-017 → API-002-06 | VO-005, opcional | hoy | IV08 | FI01 |
| name, quantity (añadir) | UC-015 → API-003-01 | entero ≥ 1 | V11 `E_NOMBRE_VACIO`; V12 | IV09 | tipo nuevo |
| itemId, quantity (retirar) | UC-016 → API-003-02 | entero ≥ 1 | V13 | AC-016-02/03 | No |
| query (Historial) | UC-018 → API-001-07 | parcial | V14 (F-02) | AC-018-03 | varios → lista |
| reservationId, fineId | UC-009/010/011/013 → API-002-03/04/05, API-004-02 | botón de fila | N/A | replays F | CD04 |

---

## Scenarios

### E2E-WF-001-01: Ciclo de préstamo — Happy Path (P0, smoke)

- **WF-001** · UC-007, 010, 011, 012, 013, 014, 017 · REQ-F-003, 005, 006, 008 · Auth: lucia y pablo por Entrar · Fields: ALL
- **Acceptance:** AC-007-01 AC-017-05 AC-010-01 AC-017-01 AC-017-08 AC-011-02 AC-012-01 AC-013-01 (title: `E2E-WF-001-01 WF-001 AC-007-01 AC-017-05 AC-010-01 AC-017-01 AC-017-08 AC-011-02 AC-012-01 AC-013-01 ciclo de préstamo`)
- **Video:** `evidencias/FASE-{N}/WF-001-ciclo-prestamo.webm`

| # | Action | Assertion (expected text) | Evidence |
|---|---|---|---|
| 1 | Abrir web; axe; lucia: /correo/, /contraseña/, «Entrar» | "Hola, Lucía" @Mis reservas | — |
| 2 | «Reservar»; axe; Casco, 2, 2026-12-05, 2026-12-07; enviar | "Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07" @Mis reservas | AC-007-01.png |
| 3 | «Salir»; pablo entra; `hoy(2026-12-05)`; axe | "Hola, Pablo" @Panel del encargado | — |
| 4 | Ver «Por entregar» | "Por entregar: 2 × Casco — Lucía Gil — desde el 2026-12-05" y botón «Entregar» | AC-017-05.png |
| 5 | «Entregar» | "Entregado: 2 × Casco a Lucía Gil" y "2 × Casco del 2026-12-05 al 2026-12-07 — Prestada" | AC-010-01.png |
| 6 | Releer panel | "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07" | AC-017-01.png |
| 7 | `hoy(2026-12-10)`; recargar panel | "Retraso: 3 días" junto al préstamo | AC-017-08.png |
| 8 | lucia (otro contexto): «Mis multas» | "No tienes multas" @Mis multas (sin multa hasta devolver) | AC-017-08-2.png |
| 9 | pablo «Devolver» | "Devuelto con 3 días de retraso: multa de 6 €" @Panel | AC-011-02.png |
| 10 | pablo «Multas» | "Lucía Gil — Multa de 6 € — Pendiente" | — |
| 11 | lucia «Mis multas» | "Multa de 6 € — Pendiente" | AC-012-01.png |
| 12 | lucia «Reservar» 1 × Tienda 2026-12-10..11 | "No puedes reservar hasta pagar tu multa de 6 €"; sin reserva | — |
| 13 | pablo «Marcar pagada» | "Multa pagada" @Multas | AC-013-01.png |
| 14 | lucia repite 12 | "Reserva creada: 1 × Tienda del 2026-12-10 al 2026-12-11" @Mis reservas, sin "No puedes reservar" | AC-013-01-2.png |

### E2E-WF-002-01: Alta y primer acceso — Happy Path (P0, smoke)

- **WF-002** · UC-003, 001, 004, 007, 008 · REQ-F-001, 002, 003, 004 · Auth: pablo → marta · Fields: ALL
- **Acceptance:** AC-003-01 AC-004-01 AC-004-02 AC-004-03 AC-008-03 (title: `E2E-WF-002-01 WF-002 AC-003-01 AC-004-01 AC-004-02 AC-004-03 AC-008-03 alta y primer acceso`)
- **Video:** `evidencias/FASE-{N}/WF-002-alta-primer-acceso.webm`

| # | Action | Assertion (expected text) | Evidence |
|---|---|---|---|
| 1 | pablo entra; «Socios»; axe | heading «Socios» | — |
| 2 | /nombre/ «Marta Ruiz», /correo/ marta@club.test, /contraseña/ «Provisional1»; enviar | "Socio creado: Marta Ruiz" y "Marta Ruiz — Activo" @Socios | AC-003-01.png |
| 3 | «Salir»; axe | form «Entrar» | — |
| 4 | marta entra con la provisional | "Elige una contraseña nueva" @Cambiar contraseña | AC-004-01.png |
| 5 | marta abre "/mis-reservas" (URL de REQ) | "Elige una contraseña nueva" @Cambiar contraseña | AC-004-02.png |
| 6 | Enviar «corta» | "La contraseña debe tener al menos 8 caracteres" @Cambiar contraseña | AC-004-03.png |
| 7 | Enviar «NuevaClave1» | heading «Mis reservas»; "Aún no tienes reservas" | AC-008-03.png |
| 8 | «Reservar» 1 × Casco 2026-12-01..02 | "Reserva creada: 1 × Casco del 2026-12-01 al 2026-12-02" | — |
| 9 | «Salir»; entrar con «NuevaClave1» | heading «Mis reservas» | — |

### E2E-WF-001-02: Cancelar una reserva (P1, critical)

UC-008, 009 · REQ-F-004 · lucia, pabloSocio · AC-008-01 AC-009-01 AC-009-02 AC-008-02 AC-008-04

| # | Action | Assertion (expected text) | Evidence |
|---|---|---|---|
| 1 | lucia (2 × Casco 12-05..07), pabloSocio (1 × Tienda 12-06..08); lucia «Mis reservas»; axe | "2 × Casco del 2026-12-05 al 2026-12-07 — Reservada", una sola fila, sin "1 × Tienda del 2026-12-06 al 2026-12-08 — Reservada" | AC-008-01.png |
| 2 | `hoy(2026-12-04)`; «Cancelar» | "Reserva cancelada" y "2 × Casco del 2026-12-05 al 2026-12-07 — Cancelada" | AC-009-01.png |
| 3 | pabloSocio reserva 5 × Casco 12-05..07 | "Reserva creada: 5 × Casco del 2026-12-05 al 2026-12-07" | AC-009-01-2.png |
| 4 | Repetir «Cancelar» | `E_YA_CANCELADA` "La reserva ya estaba cancelada" @Mis reservas | AC-009-02.png |
| 5 | pabloSocio pide 2 × Casco 12-05..07 | "No hay unidades libres: solo queda 1 de Casco el 2026-12-05" @Reservar | AC-009-02-2.png |
| 6 | `hoy(2026-12-05)`, reserva que empieza hoy | "No se puede cancelar: empieza hoy" en su fila, sin «Cancelar» | AC-008-02.png |
| 7 | pabloSocio (sin reservas) «Mis reservas» | "Aún no tienes reservas" | AC-008-04.png |

### E2E-WF-001-03: Panel del encargado (P1, critical)

UC-017, 010, 011 · REQ-F-008, 005 · pablo · AC-017-02 AC-017-03 AC-017-04 AC-017-09 · préstamo 2 × Casco Lucía Gil fin 2026-12-07

| # | Action | Assertion (expected text) | Evidence |
|---|---|---|---|
| 1 | pablo sin préstamos; axe | "No hay material prestado" @Panel del encargado | AC-017-04.png |
| 2 | `hoy(2026-12-07)` | "Vuelven hoy" y "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07" | AC-017-02.png |
| 3 | `hoy(2026-12-05)`; /fecha/ 2026-12-07 | "Vuelven el 2026-12-07" y "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07" | AC-017-03.png |
| 4 | `hoy(2026-12-08)` | "Retraso: 1 día" junto al préstamo | AC-017-09.png |
| 5 | Abrir el panel con retraso | sin multa creada hasta «Devolver» (ADR-004) | — |

### E2E-ACC-01: Entrar, errores, bloqueo, caducidad (P1) — UC-001 · REQ-F-001 · AC-001-01..07

| # | Action | Assertion (expected text) | Evidence |
|---|---|---|---|
| 1 | axe; lucia / «Cumbre2026!» | "Hola, Lucía" @Mis reservas | AC-001-01.png |
| 2 | pablo / «Piolet2026!» | "Hola, Pablo" @Panel del encargado | AC-001-02.png |
| 3 | lucia, contraseña errónea | `E_CREDENCIALES` "Correo o contraseña incorrectos" @Entrar | AC-001-03.png |
| 4 | 5 fallos; +1 min, contraseña correcta | `E_CUENTA_BLOQUEADA` "Cuenta bloqueada. Vuelve a intentarlo en 15 minutos" @Entrar | AC-001-04.png |
| 5 | bloqueada hace 15 min, correcta | "Hola, Lucía" @Mis reservas | AC-001-05.png |
| 6 | sesión +31 min inactiva, abrir cualquier página (borde 30: GAP-001) | form "Entrar" | AC-001-06.png |
| 7 | visitante abre "/mis-reservas" | form "Entrar" | AC-001-07.png |

### E2E-ACC-02: Salir (P1) — UC-002 · REQ-F-001 · AC-002-01 AC-002-02

| # | Action | Assertion (expected text) | Evidence |
|---|---|---|---|
| 1 | lucia «Salir» | form "Entrar" | AC-002-01.png |
| 2 | Atrás del navegador | "Entrar" @Entrar; sin reserva, multa ni nombre de socio | AC-002-02.png |
| 3 | «Salir» sin sesión (replay, AC-002-03) | form Entrar, sin cambios | — |

### E2E-ACC-03: Restablecer contraseña (P1) — UC-005 · REQ-F-002 · AC-005-01..03 · pablo → marta

| # | Action | Assertion (expected text) | Evidence |
|---|---|---|---|
| 1 | Fila Marta, «Otra12345», enviar | "Contraseña provisional guardada para Marta Ruiz" @Socios | AC-005-01.png |
| 2 | marta entra con «Otra12345» | "Elige una contraseña nueva" @Cambiar contraseña | AC-005-02.png |
| 3 | marta entra con la antigua | "Correo o contraseña incorrectos" @Entrar | AC-005-03.png |

### E2E-ACC-04: Baja de socio (P1) — UC-006 · REQ-F-002 · AC-006-01..05 · pablo

| # | Action | Assertion (expected text) | Evidence |
|---|---|---|---|
| 1 | Baja de marta (sin préstamos ni multas) | "Socio dado de baja: Marta Ruiz" @Socios | AC-006-01.png |
| 2 | marta intenta entrar | "Correo o contraseña incorrectos" @Entrar | AC-006-02.png |
| 3 | Baja de marta con 2 × Casco 12-05..07 futuro; lucia reserva lo mismo | "Socio dado de baja: Marta Ruiz"; luego "Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07" @Mis reservas | AC-006-03.png, AC-006-03-2.png |
| 4 | Baja de lucia con 1 préstamo sin devolver | `E_BAJA_PRESTAMOS` "No se puede dar de baja: tiene material sin devolver" y "Lucía Gil — Activo" @Socios | AC-006-04.png |
| 5 | lucia entra | "Hola, Lucía" @Mis reservas | AC-006-04-2.png |
| 6 | Baja de pabloSocio con multa de 4 € | `E_BAJA_MULTAS` "No se puede dar de baja: tiene multas sin pagar" @Socios | AC-006-05.png |
| 7 | Baja repetida de marta (AC-006-07) | sin cambios (GAP-002) | — |

### E2E-ACC-05: Añadir unidades (P1) — UC-015 · REQ-F-007 · AC-015-01 AC-015-02 · pablo

| # | Action | Assertion (expected text) | Evidence |
|---|---|---|---|
| 1 | «Material»; axe; «Cuerda» (4), 2 | "Cuerda: 6 unidades" @Material | AC-015-01.png |
| 2 | «Mosquetón», 10 | "Mosquetón: 10 unidades" | AC-015-02.png |

### E2E-ACC-06: Retirar unidades (P1) — UC-016, UC-007 · REQ-F-007 · AC-016-01 AC-016-02 AC-016-03 AC-007-10

| # | Action | Assertion (expected text) | Evidence |
|---|---|---|---|
| 1 | Cuerda 6 libre; retirar 1 | "Cuerda: 5 unidades" @Material | AC-016-01.png |
| 2 | Tienda 2 reservadas 2026-12-06; retirar 1 | `E_BAJA_UNIDADES_NECESARIAS` "No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06" y "Tienda: 2 unidades" | AC-016-02.png |
| 3 | Cuerda 0 tras retirar la última; retirar otra | `E_BAJA_UNIDADES_INSUFICIENTES` "No hay tantas unidades para dar de baja" y "Cuerda: 0 unidades" | AC-016-03.png |
| 4 | lucia «Reservar» (Casco 6, Cuerda 0) | "Casco" entre los tipos, sin "Cuerda" @Reservar | AC-007-10.png |

### E2E-ACC-07: Historial de la junta (P1) — UC-018 · REQ-F-009 · AC-018-01..04 · junta

| # | Action | Assertion (expected text) | Evidence |
|---|---|---|---|
| 1 | Buscar «lucia» (préstamo 12-05..07 devuelto 12-09; multa 4 € pagada) | "2 × Casco del 2026-12-05 al 2026-12-07 — devuelto el 2026-12-09" y "Multa de 4 € — Pagada" @Historial del socio | AC-018-01.png |
| 2 | Socio sin préstamos | "Sin préstamos ni multas" | AC-018-02.png |
| 3 | Buscar «zzz» | `E_BUSQUEDA_VACIA` "Ningún socio coincide" | AC-018-03.png |
| 4 | Ver un historial | "Historial del socio" sin «Entregar», «Devolver», «Marcar pagada» ni «Cancelar» | AC-018-04.png |

### E2E-SEC-01: Cada rol solo ve lo suyo (P1) — UC-001 E4, UC-017 E1/E2 · REQ-F-008, REQ-NF-001 · AC-017-06 AC-017-07

| # | Role → page | Assertion (expected text) | Evidence |
|---|---|---|---|
| 1 | socio abre "/panel" | `E_PAGINA_PROHIBIDA` "No tienes permiso para ver esta página" @Panel del encargado | AC-017-06.png |
| 2 | junta abre "/panel" | idem | AC-017-07.png |
| 3 | socio → Socios, Material, Multas, Historial; encargado → Reservar, Mis reservas, Mis multas; junta → Reservar, Socios, Multas (rutas de OPERATION-MAPPING; menú sin esas entradas) | idem, sin datos ajenos ni botones de gestión (AC-001-08, 003-04, 007-11, 008-05, 012-04, 014-02, 015-05, 018-06) | — |

### Variantes de validación (resto de campos válidos; estado sin cambios; sin criterio REQ → sin captura salvo Evidence)

| Variant ID | Field / value | Expected | Evidence |
|---|---|---|---|
| E2E-ACC-01-V01/V02 | email / password vacío (Entrar) | `E_CREDENCIALES` "Correo o contraseña incorrectos" (F-01) | — |
| E2E-ACC-01-IV01 | email «lucia» sin «@» | `E_CREDENCIALES` | — |
| E2E-WF-002-V03/V04 | nombre / correo vacío (alta) | `E_SOCIO_DATOS_INVALIDOS` "Escribe un nombre y un correo válidos" | — |
| E2E-WF-002-IV02 | correo «marta.club» | `E_SOCIO_DATOS_INVALIDOS` | — |
| E2E-WF-002-V05 / IV03 | contraseña vacía / «corta» (alta) | `E_CONTRASENA_CORTA` "La contraseña debe tener al menos 8 caracteres" @Socios | — / AC-003-03.png |
| E2E-WF-002-V06 / IV04 | contraseña vacía / «corta» (cambiar) | `E_CONTRASENA_CORTA`; sigue en Cambiar contraseña | — (IV04 = AC-004-03) |
| E2E-ACC-03-V07 / IV05 | contraseña vacía / «corta» (restablecer) | `E_CONTRASENA_CORTA`; sin cambio (AC-005-04) | — |
| E2E-WF-001-V08 / IV07 | cantidad vacía o 0 / 6 | `E_CANTIDAD_INVALIDA` "La cantidad debe ser un número entero de 1 o más" (F-03) / `E_MAX_UNIDADES` "Máximo 5 unidades por reserva" @Reservar | — / AC-007-07.png |
| E2E-WF-001-V09/V10 | inicio / fin vacío | `E_FECHA_INVALIDA` "Elige una fecha válida" (F-03) | — |
| E2E-WF-001-IV04 | inicio 2026-11-21 (hoy 2026-11-22) | `E_FECHA_PASADA` "La fecha de inicio no puede ser pasada" | AC-007-04.png |
| E2E-WF-001-IV05 | fin 2026-12-01, inicio 2026-12-05 | `E_FECHA_FIN_ANTERIOR` "La fecha de fin no puede ser anterior a la de inicio" | AC-007-05.png |
| E2E-WF-001-IV06 | 2026-12-01..2026-12-15 | `E_MAX_DIAS` "Máximo 14 días por reserva" | AC-007-06.png |
| E2E-WF-001-IV08 | /fecha/ ilegible (Panel) | `E_FECHA_INVALIDA` (F-03) | — |
| E2E-ACC-05-V11/V12/IV09 | nombre vacío / cantidad vacía / 1,5 y 0 | `E_NOMBRE_VACIO` "El nombre del material no puede estar vacío" / `E_CANTIDAD_INVALIDA` (AC-015-04, AC-015-03) | — |
| E2E-ACC-06-V13 | cantidad vacía o 0 (retirar) | `E_CANTIDAD_INVALIDA` (AC-016-04) | — |
| E2E-ACC-07-V14 | query vacía | lista vacía o `E_BUSQUEDA_VACIA` (F-02) | — |

### Variantes condicionales, interacciones, excepciones y accesibilidad (P1)

| Variant ID | Trigger / given | Expected | Evidence |
|---|---|---|---|
| E2E-WF-002-CD01 | entrar con provisional | solo Cambiar contraseña; otras páginas vuelven a ella; tras cambiar, su página | (AC-004-01/02) |
| E2E-WF-001-CD02 | rol al entrar | socio→Mis reservas; encargado→Panel; junta→Historial del socio | (AC-001-01/02) |
| E2E-WF-001-CD03/CD04 | tipo con total 0; reserva que empieza hoy o No recogida | sin oferta en Reservar; sin «Cancelar» / sin «Entregar» | (AC-007-10, 008-02, 010-04) |
| E2E-WF-001-FI01 | /fecha/ del Panel | agrupa como "Vuelven el {fecha}" | (AC-017-03) |
| E2E-WF-001-EX01 | Tienda 2, lucia 1 en 12-05..07; pabloSocio pide 2 en 12-06..08 | `E_SIN_UNIDADES` "No hay unidades libres: solo queda 1 de Tienda el 2026-12-06" @Reservar; "Aún no tienes reservas" (-2) | AC-007-02.png |
| E2E-WF-001-EX02 | Linterna 3, lucia reservó 2; mismo formulario | "No hay unidades libres: solo queda 1 de Linterna el 2026-12-05"; una sola fila "2 × Linterna del 2026-12-05 al 2026-12-07 — Reservada" (-2) | AC-007-03.png |
| E2E-WF-001-EX03 | pabloSocio con multa 6 € | `E_MULTA_PENDIENTE` "No puedes reservar hasta pagar tu multa de 6 €"; "Aún no tienes reservas" (-2) | AC-007-08.png |
| E2E-WF-001-EX04 | lucia con multa 2 € | "No puedes reservar hasta pagar tu multa de 2 €" | AC-007-09.png |
| E2E-WF-001-EX05 | reserva 2026-12-10, `hoy(2026-12-05)` | «Entregar» → `E_ANTES_DE_INICIO` "No se puede entregar antes de la fecha de inicio" @Panel | AC-010-03.png |
| E2E-WF-001-EX06 | almacén caído en cualquier escritura | `E_ALMACEN_NO_DISPONIBLE` "No se pudo guardar. Inténtalo de nuevo"; sin cambios | — |
| E2E-ACC-01-A11Y-01 | solo teclado en Entrar | Tab correo→contraseña→Entrar, Enter envía; foco visible | — |
| E2E-WF-001-A11Y-02 | solo teclado en Reservar | Tab por los 4 campos y envío; errores con role alert | — |

### Full tier (P2) — lista (id · given · action · expected «Se ve» · refs)

> Evidence de cada fila = `{AC}.png` (2ª pantalla `-2`).

| ID | Given | Action | Expected | Refs |
|---|---|---|---|---|
| E2E-WF-002-F01 | Marta existe | alta con el mismo correo | "Ya existe un socio con ese correo" @Socios; una sola fila "Marta Ruiz — Activo" | AC-003-02 |
| E2E-WF-001-F02 | 2 × Casco entregado | «Entregar» otra vez | "Ya estaba entregada"; una sola fila "Prestado: 2 × Casco — Lucía Gil — vuelve el 2026-12-07" | AC-010-02 |
| E2E-WF-001-F03 | reserva sin entregar, `hoy(2026-12-08)` | abrir panel | "No recogida" sin «Entregar» (unidades libres: No visible) | AC-010-04 |
| E2E-WF-001-F04 | préstamo fin 12-07 | devolver el 12-07 | "Devuelto a tiempo"; lucia "No tienes multas" @Mis multas (-2) | AC-011-01 |
| E2E-WF-001-F05 | préstamo fin 12-07 | devolver el 12-08 | "Devuelto con 1 día de retraso: multa de 2 €" | AC-011-03 |
| E2E-WF-001-F06 | devuelto con multa 6 € | «Devolver» otra vez | "Ya estaba devuelta"; "Lucía Gil — Multa de 6 € — Pendiente", una sola fila @Multas (-2) | AC-011-04 |
| E2E-WF-001-F07 | multa de Pablo Sanz pagada | «Marcar pagada» otra vez | "La multa ya estaba pagada" y "Pablo Sanz — Multa de 6 € — Pagada", una sola fila | AC-013-02 |
| E2E-WF-001-F08 | pabloSocio multas 2 € y 4 € | pagar la de 4 € | "Multa pagada"; "No puedes reservar hasta pagar tu multa de 2 €" @Reservar (-2) | AC-013-03 |
| E2E-WF-001-F09 | lucia sin multas | «Mis multas» | "No tienes multas" | AC-012-02 |
| E2E-WF-001-F10 | marta sin multas, pabloSocio con una | «Mis multas» de marta | "No tienes multas" | AC-012-03 |
| E2E-WF-001-F11 | multa 6 € pendiente y multa 2 € pagada | pablo «Multas» | "Pablo Sanz — Multa de 6 € — Pendiente" y "Lucía Gil — Multa de 2 € — Pagada" | AC-014-01 |
| E2E-ACC-01-F12 | 4 fallos | contraseña correcta | entra "Hola, Lucía" (borde `LOGIN_MAX_FAILURES`) | AC-001-05 |
| E2E-ACC-01-F13 | sesión abierta | enviar Entrar otra vez | otra sesión, sin duplicados | AC-001-09 |

---

## Field coverage

Todos los campos del inventario: paso feliz (WF-001-01, WF-002-01, ACC-01..07), vacío (V01-V14), inválido (IV01-IV09 o AC), condicional (CD01-CD04) e interacción (FI01) donde aplica: COMPLETE. Sin INCOMPLETE; F-01..F-03 marcan oráculos asumidos.

## Transitive coverage

| Scenario | WF → UC → REQ |
|---|---|
| E2E-WF-001-01 | WF-001 → UC-007, 010, 011, 012, 013, 014, 017 → REQ-F-003, 005, 006, 008 |
| E2E-WF-001-02 / 03 | WF-001 → UC-008, 009 / UC-017, 010, 011 → REQ-F-004 / REQ-F-008, 005 |
| E2E-WF-002-01 | WF-002 → UC-003, 001, 004, 007, 008 → REQ-F-001, 002, 003, 004 |
| E2E-ACC-01 / 02 | UC-001 / UC-002 → REQ-F-001 |
| E2E-ACC-03 / 04 | UC-005 / UC-006 → REQ-F-002 |
| E2E-ACC-05 / 06 / 07 | UC-015 / UC-016 / UC-018 → REQ-F-007 / REQ-F-007 / REQ-F-009 |
| E2E-SEC-01 | UC-001, UC-017 → REQ-F-008, REQ-NF-001 |
| REQ-NF-002 | WF-001-01 (UC-007, 017) + EXEMPT-NFR PERF-SCENARIOS |
| REQ-NF-003, REQ-C-001/002 | EXEMPT-NFR: TEST-MATRIX-UC-019, SEC-T-004, MNT-T-001/002 |

## Findings for sdd-spec-auditor

| ID | Finding |
|---|---|
| F-01 | UC-001: sin fila de excepción para correo/contraseña vacíos o correo mal formado (V01, V02, IV01 asumen `E_CREDENCIALES`) |
| F-02 | UC-018: `query` vacía sin definir (`E_BUSQUEDA_VACIA` solo cubre «ningún socio coincide») |
| F-03 | V-FIELD-02: API-002-01, API-003-01/02 listan `E_CANTIDAD_INVALIDA`/`E_FECHA_INVALIDA` (y API-002-06 `E_FECHA_INVALIDA`); UC-007, UC-017 solo los citan en Supuestos (RN-034), sin fila E# ni AC |
| F-04 | REQ: Pablo es encargado (REQ-F-001 AC2) y socio con reservas y multas (REQ-F-003/005/006), pero PERMISSIONS-MATRIX veta reservar al encargado: fixtures `pablo` y `pabloSocio` |
| F-05 | Sin credenciales de ejemplo de la junta ni nombre de su menú; fixture `junta` inventado |
| F-06 | V-FIELD-01: sin wireframes, ni REQ ni UC fijan etiquetas de campos ni textos de botones de envío (Entrar, Reservar, alta); R-6 exige nombres accesibles estables |
| F-07 | API-002/003/004 no listan `E_ALMACEN_NO_DISPONIBLE` aunque WF-001/002 y D-T-002 lo exigen en toda escritura |
| F-08 | hasta 25 líneas «Se ve» secundarias en otra pantalla: `captura` y `sdd lint --captures` no definen `{AC}-2.png` (convención usada aquí) |

V-FIELD-01/02: el resto de entradas de UC-001..018 coincide con su `API-NNN-NN`.

## Gaps

| Gap ID | Spec element | Missing |
|---|---|---|
| MISSING-E2E | REQ-F-002 AC9 (`No visible`) | estado «Cancelada» de la reserva de Marta: sin pantalla, sin captura |
| MISSING-E2E | REQ-F-005 AC7 (`No visible`) | «unidades libres» tras No recogida: sin pantalla, sin captura |
| MISSING-E2E | AC-006-07 | baja repetida sin resultado definido (GAP-002): paso sin oráculo |
| MISSING-E2E | AC-001-06 | borde exacto 30 min indefinido (GAP-001): la fila usa +31 min |

Criterios REQ-F con escenario y captura: 66 de 66 (91 líneas «Se ve» con texto afirmado; 2 `No visible` sin captura).
