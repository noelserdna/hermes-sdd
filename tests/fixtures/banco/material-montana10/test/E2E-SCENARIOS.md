# E2E Acceptance Scenarios

> **Project:** material-montana10 · **Project type:** WEB-APP · **UX enrichment:** No (abstract scenarios, locators por rol y nombre desde los textos de REQ)
> **Generated from:** spec/workflows/WF-001, WF-002, spec/use-cases/UC-001..010, spec/contracts/API-*.md, requirements/REQUIREMENTS.md

## E2E Strategy

| Dimension | Value |
|-----------|-------|
| Framework | Playwright (`npx playwright test`), servidor `npx vite --host 127.0.0.1 --port 5173` |
| Selector strategy | getByRole > getByLabel > getByText > getByTestId |
| Auth strategy | storageState por rol (1 test de login real: E2E-WF-002-01; el resto reutiliza estado) |
| Data strategy | unique-per-test: almacén y cuentas sembrados por la capa de datos antes de cada test; reloj fijo (D-T-001, D-T-E2E2) |
| Accessibility | axe-core en cada pantalla principal (WCAG 2.2 AA) |
| Parallelism | 1 worker por contexto aislado; Vitest y Playwright nunca a la vez (máquina compartida) |
| Visual evidence | captura por criterio `evidencias/FASE-{N}/{AC id}.png`, vídeo por WF con `WF-NNN` en el nombre y el título |
| Target environment | build local para PR · `none` para smoke-deploy (sin `staging_url`) |

### Tiered Execution

| Tier | Scenarios | Run time | Trigger |
|------|-----------|----------|---------|
| Smoke | P0: E2E-WF-002-01, E2E-WF-001-01 | < 2 min | cada PR |
| Critical | P0 + P1 (tablas V, IV, EX, ADM) | < 10 min | cada merge a main |
| Full | todos, incl. P2 | < 30 min | nightly / release |
| smoke-deploy | ninguno (`Target environment: none`) | — | post-deploy |

Viewport Matrix: Mobile 375 px (P0 + P1) y Desktop 1280 px (todos); el socio usa móvil (REQ-C-003).

---

## Field Inventory

> V-FIELD-01/02 comprobados: cada input de UC coincide con el input de su operación. V-FIELD-03..05 no aplican (sin wireframe). Sin errores.

| Field | UC input | Operation input | Required | Type | Validation | Conditional? |
|-------|----------|-----------------|----------|------|-----------|--------------|
| correo | UC-001 | API-001-01.correo | Yes | Correo (VO-002) | formato; igual error para desconocido/Baja | No |
| contrasena | UC-001 | API-001-01.contrasena | Yes | string | `E_CREDENCIALES_INVALIDAS` si no coincide | No |
| tipo | UC-003 | API-002-01.tipo | Yes | TipoMaterial (VO-004) | `TIPOS_MATERIAL` → `E_TIPO_INVALIDO` | No |
| desde | UC-003 | API-002-01.desde | Yes | Fecha (VO-003) | ≥ hoy → `E_FECHA_PASADA` | No |
| hasta | UC-003 | API-002-01.hasta | Yes | Fecha (VO-003) | ≥ desde; ≤ 14 días | No |
| reservaId | UC-004/005/006 | API-002-03/003-01/003-02.reservaId | Yes | id (fila elegida) | existe; dueño; estado | No |
| unidadId | UC-005 | API-003-01.unidadId | Yes | id (selector) | activa, del tipo, libre | No |
| multaId | UC-007 | API-003-03.multaId | Yes | id (fila elegida) | existe | No |
| nombre, correo, contrasena (alta) | UC-002 | API-001-03 | Yes | string, Correo, string | contraseña ≥ 8; correo único | No |
| tipo, cantidad | UC-008 | API-004-01 | Yes | TipoMaterial, entero ≥ 1 | `E_CANTIDAD_INVALIDA` | No |
| socioId (Historial) | UC-010 | API-003-06.socioId | Yes | id (selector) | existe | No |

### Field Behavioral Matrix

| Field | VALID | EMPTY | INVALID | BOUNDARY | CONDITIONAL |
|-------|-------|-------|---------|----------|-------------|
| correo / contrasena | entra → "Hola, {nombre}" | undefined in spec (GAP-006) | contraseña mala → "Correo o contraseña incorrectos" | 5.º fallo, 15 min: TEST-MATRIX-UC-001 | N/A |
| tipo | Piolet → reserva creada | undefined in spec (GAP-006) | "Mochila" → `E_TIPO_INVALIDO` | — | N/A |
| desde / hasta | 2026-12-05..07 → creada | undefined in spec (GAP-006) | pasado, invertidas | 14 vs 15 días: TEST-MATRIX-UC-003 | N/A |
| unidadId | "Piolet 2" → Prestada | undefined in spec (GAP-006) | unidad ocupada → `E_UNIDAD_NO_DISPONIBLE` | — | solo unidades activas del tipo |
| cantidad | 2 → "Añadidas 2 unidades de Piolet" | undefined in spec (GAP-006) | 0 → `E_CANTIDAD_INVALIDA` | 1: TEST-MATRIX-UC-008 | N/A |
| contrasena (alta) | "Glaciar2026" → alta | undefined in spec (GAP-006) | "corta" → `E_CONTRASENA_CORTA` | 7/8: TEST-MATRIX-UC-002 | N/A |

Sin campos condicionales ni cadenas de interacción en la especificación: no hay escenarios CD/FI.

---

## Scenarios

> Fixtures: `club` = socia lucia@club.es/Cumbre2026, socio pablo@club.es/Arista2026, junta ana@club.es, encargado, marta@club.es/Glaciar2026 · `inv` = 3 Piolet, 3 Casco, 2 Cuerda, 2 Tienda, 2 Crampones, unidades numeradas · `hoy` = reloj fijo, se indica por escenario.

### E2E-WF-002-01: Sesión de una cuenta — Happy Path (P0)

- **Workflow:** WF-002 · **Use Cases:** UC-001 · **Tier:** smoke · **Auth:** unauthenticated
- **Acceptance:** AC-001-01 AC-001-07 AC-001-08 (título: `E2E-WF-002-01 AC-001-01 AC-001-07 AC-001-08 entrar y salir`)
- **Requirements:** REQ-F-001 · **Fields covered:** ALL (correo, contrasena)
- **Video:** `evidencias/FASE-{N}/WF-002-sesion.webm`

| # | Action | Target | Assertion (expected text) | Evidence | Spec Ref |
|---|--------|--------|---------------------------|----------|----------|
| 1 | Abrir la dirección de la web | — | formulario Entrar visible | — | WF-002 §1 |
| 2 | axe-core | página | sin violaciones | — | WCAG 2.2 AA |
| 3 | Rellenar correo | campo Correo | "lucia@club.es" aceptado | — | UC-001 main |
| 4 | Rellenar contraseña | campo Contraseña | "Cumbre2026" aceptada | — | UC-001 main |
| 5 | Pulsar Entrar | botón | texto "Hola, Lucía" en Mis reservas | AC-001-01.png | AC-001-01 |
| 6 | Pulsar Salir | botón | formulario con "Entrar" | AC-001-07.png | AC-001-07 |
| 7 | Abrir la dirección de Mis reservas sin sesión | URL | "Entrar" | AC-001-08.png | AC-001-08 |

### E2E-WF-002-02: Entrar como socio (P0)

- **Tier:** smoke · **Acceptance:** AC-001-02 · **Requirements:** REQ-F-001 · Pasos: Entrar con pablo@club.es / Arista2026 → "Hola, Pablo" en Mis reservas (`AC-001-02.png`). axe-core en Mis reservas.

### E2E-WF-002 — Required-Field Validation (P0)

| Variant ID | Empty field | Action | Expected | Evidence | Spec Ref |
|------------|-------------|--------|----------|----------|----------|
| E2E-WF-002-V01 | correo | Enviar solo contraseña | undefined in spec (GAP-006); no se implementa hasta que la spec defina el error | — | UC-001 |
| E2E-WF-002-V02 | contrasena | Enviar solo correo | undefined in spec (GAP-006) | — | UC-001 |

### E2E-WF-002 — Invalid-Value and Exception Flows (P1)

| Variant ID | Given | Action | Expected | Evidence | Spec Ref |
|------------|-------|--------|----------|----------|----------|
| E2E-WF-002-IV01 | lucia | contraseña "mala" | `E_CREDENCIALES_INVALIDAS` "Correo o contraseña incorrectos" en Entrar | AC-001-03.png | AC-001-03 |
| E2E-WF-002-EX01 | lucia con 5 fallos seguidos | contraseña correcta antes de 15 min | `E_CUENTA_BLOQUEADA` "Cuenta bloqueada. Inténtalo de nuevo en 15 minutos"; sin sesión | AC-001-04.png | AC-001-04, SEC-T-003 |
| E2E-WF-002-EX02 | lucia bloqueada hace 15 min | contraseña correcta | "Hola, Lucía" en Mis reservas | AC-001-05.png | AC-001-05 |
| E2E-WF-002-EX03 | sesión con 8 h sin actividad | abrir cualquier pantalla | formulario Entrar con "Tu sesión ha caducado" | AC-001-06.png | AC-001-06, SEC-T-004 |
| E2E-WF-002-EX04 | lucia | doble clic en Entrar | una sola sesión; "Hola, Lucía" | AC-001-09.png | AC-001-09 |

### E2E-WF-002 — Accessibility (P1)

| Variant ID | Scenario | Steps | Assertion | Spec Ref |
|------------|----------|-------|-----------|----------|
| E2E-WF-002-A11Y-01 | Solo teclado | Tab a correo, contraseña, Entrar; Enter | entra; textos de la interfaz en español (MNT-T-001) | REQ-C-001 |

---

### E2E-WF-001-01: Ciclo de un préstamo — Happy Path (P0)

- **Workflow:** WF-001 · **Use Cases:** UC-003, UC-004, UC-005, UC-006, UC-009 · **Tier:** smoke
- **Acceptance:** AC-003-01 AC-004-01 AC-009-03 AC-005-01 AC-009-01 AC-006-01 (título: `E2E-WF-001-01 AC-003-01 AC-004-01 AC-009-03 AC-005-01 AC-009-01 AC-006-01 reservar, entregar y devolver`)
- **Requirements:** REQ-F-003, 004, 005, 006, 009 · **Fields covered:** tipo, desde, hasta, reservaId, unidadId
- **Video:** `evidencias/FASE-{N}/WF-001-ciclo.webm`

| # | Action | Target | Assertion (expected text) | Evidence | Spec Ref |
|---|--------|--------|---------------------------|----------|----------|
| 1 | Socia entra (hoy 2026-12-01) y abre Reservar por el menú | menú Reservar | pantalla Reservar | — | WF-001 nav 1 |
| 2 | Elegir tipo "Piolet", desde 2026-12-05, hasta 2026-12-07; Reservar | formulario | "Reserva creada: Piolet del 2026-12-05 al 2026-12-07" en Mis reservas | AC-003-01.png | AC-003-01 |
| 3 | Abrir Mis reservas | menú | "Piolet · 2026-12-05 a 2026-12-07 · Reservada" | AC-004-01.png | AC-004-01 |
| 4 | Encargado entra (hoy 2026-12-05), abre Entregas y devoluciones | menú | "Entregar hoy: Piolet · Lucía" | AC-009-03.png | AC-009-03 |
| 5 | Elegir unidad "Piolet 2"; Entregar | selector, botón | "Piolet 2 · Lucía · Prestada" | AC-005-01.png | AC-005-01 |
| 6 | Hoy 2026-12-07, con "Casco 1" prestado a Pablo hasta 2026-12-09, abrir Entregas y devoluciones | menú | "Vuelve hoy: Piolet 2 · Lucía" y "Prestado: Casco 1 · Pablo · hasta 2026-12-09" | AC-009-01.png | AC-009-01 |
| 7 | Marcar devuelta "Piolet 2" | botón | "Piolet 2 · Lucía · Devuelta"; sin multa | AC-006-01.png | AC-006-01 |

### E2E-WF-001-02: Devolución tardía, multa y pago (P1)

- **Tier:** critical · **Acceptance:** AC-006-02 AC-007-01 · **Requirements:** REQ-F-006, REQ-F-007 · **Fixture:** "Casco 1" prestado a Pablo hasta 2026-12-07

| # | Action | Assertion | Evidence | Spec Ref |
|---|--------|-----------|----------|----------|
| 1 | Encargado, hoy 2026-12-10, marca devuelto "Casco 1" | "Multa de 6 € a Pablo (3 días de retraso)" | AC-006-02.png | AC-006-02, INV-LOA-004 |
| 2 | Abrir Multas, marcar pagada la de Pablo | "Multa de 6 € · Pablo · Pagada" | AC-007-01.png | AC-007-01 |
| 3 | Pablo reserva "Casco" | "Reserva creada: Casco …" (puede reservar) | — | AC-007-01 |

### E2E-WF-001-03: Varias multas bloquean (P1)

- **Tier:** critical · **Acceptance:** AC-006-03 AC-004-06 AC-007-02 AC-003-08 · **Requirements:** REQ-F-003, 004, 006, 007 · **Fixture:** Lucía con "Cuerda 1" hasta 2026-12-07, y una multa previa de 4 €

| # | Action | Assertion | Evidence | Spec Ref |
|---|--------|-----------|----------|----------|
| 1 | Encargado marca devuelta "Cuerda 1" el 2026-12-08 | "Multa de 2 € a Lucía (1 días de retraso)" | AC-006-03.png | AC-006-03 |
| 2 | Lucía abre Mis reservas | "Multa pendiente: 4 €" | AC-004-06.png | AC-004-06 |
| 3 | Encargado paga la de 2 € | Lucía sigue viendo "Multa pendiente: 4 €" en Mis reservas | AC-007-02.png | AC-007-02 |
| 4 | Lucía intenta reservar "Casco" | `E_MULTA_PENDIENTE` "Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar" | AC-003-08.png | AC-003-08 |

### E2E-WF-001-04: Cancelar y ver reservas (P1)

- **Tier:** critical · **Acceptance:** AC-004-03 AC-004-05 AC-004-02 · **Fixture:** reserva de Lucía "Piolet" 2026-12-05..07

| # | Action | Assertion | Evidence | Spec Ref |
|---|--------|-----------|----------|----------|
| 1 | Hoy 2026-12-04, Lucía cancela | "Piolet · 2026-12-05 a 2026-12-07 · Cancelada" | AC-004-03.png | AC-004-03 |
| 2 | Otra reserva; hoy 2026-12-05, Lucía cancela | `E_CANCELACION_TARDIA` "Solo se puede cancelar hasta el día antes"; sigue Reservada | AC-004-05.png | AC-004-05 |
| 3 | Pablo (sin reservas) abre Mis reservas | "No tienes reservas"; ninguna de Lucía | AC-004-02.png | AC-004-02 |

### E2E-WF-001-05: Historial de un socio (P1)

- **Tier:** critical · **Acceptance:** AC-010-01 AC-010-02 AC-009-05 · **Requirements:** REQ-F-009, REQ-F-010 · **Fixture:** Lucía con "Piolet 2" devuelto y multa de 2 € pagada; Pablo sin préstamos; "Prestado" de Casco 1 a Pablo

| # | Action | Assertion | Evidence | Spec Ref |
|---|--------|-----------|----------|----------|
| 1 | Ana (junta) abre Historial, elige Lucía | "Piolet 2 · 2026-12-05 a 2026-12-07 · Devuelta" y "Multa de 2 € · Pagada" | AC-010-01.png | AC-010-01 |
| 2 | Elige Pablo | "Sin préstamos ni multas" | AC-010-02.png | AC-010-02 |
| 3 | Ana abre Entregas y devoluciones | "Prestado: Casco 1 · Pablo · hasta 2026-12-09"; sin botones de entrega o devolución | AC-009-05.png | AC-009-05, INV-LOA-401 |

### E2E-WF-001-06: Datos compartidos entre dispositivos (P1)

- **Tier:** critical · **Acceptance:** `REQ-C-003` · Dos contextos de navegador: el encargado añade o entrega y la socia, en otro contexto, lo ve tras recargar (INT-T-001, MNT-T-003). Sin captura (REQ-C).

### E2E-WF-001 — Reservar: valores inválidos y excepciones (P1)

> Otros campos válidos; el criterio fija el mensaje.

| Variant ID | Field / Given | Invalid value / action | Expected | Evidence | Spec Ref |
|------------|---------------|------------------------|----------|----------|----------|
| E2E-WF-001-IV01 | desde | 2026-11-30 con hoy 2026-12-01 | `E_FECHA_PASADA` "Las fechas no pueden estar en el pasado" en Reservar | AC-003-05.png | AC-003-05 |
| E2E-WF-001-IV02 | hasta | 2026-12-09 con desde 2026-12-10 | `E_FECHAS_INVERTIDAS` "La fecha final no puede ser anterior a la inicial" | AC-003-06.png | AC-003-06 |
| E2E-WF-001-IV03 | hasta | 16 días | `E_RESERVA_MUY_LARGA` "Máximo 14 días por reserva" (límite 14/15: TEST-MATRIX-UC-003) | AC-003-07.png | AC-003-07 |
| E2E-WF-001-IV04 | tipo | "Mochila" (manipulado) | `E_TIPO_INVALIDO` | — | AC-003-12 |
| E2E-WF-001-EX01 | 2 Tienda reservadas 12-05..07 | Pablo reserva 12-06 | `E_SIN_UNIDADES_LIBRES` "No quedan unidades libres de Tienda esas fechas" | AC-003-03.png | AC-003-03 |
| E2E-WF-001-EX02 | 2 Tienda, una reservada 12-05..06 | Pablo reserva 12-07..08 | "Reserva creada: Tienda del 2026-12-07 al 2026-12-08" en Mis reservas | AC-003-04.png | AC-003-04 |
| E2E-WF-001-EX03 | Pablo con multa de 2 € | reserva "Casco" | "Tienes una multa pendiente de 2 €. Págala al encargado para poder reservar" | AC-003-09.png | AC-003-09 |
| E2E-WF-001-EX04 | 1 Crampones libre, dos contextos | envían a la vez | una reserva creada; el otro ve "No quedan unidades libres de Crampones esas fechas" | AC-003-10.png | AC-003-10, D-T-006 |
| E2E-WF-001-EX05 | reserva Reservada desde 12-05, hoy 12-04 | encargado marca entregada | `E_ENTREGA_ANTICIPADA` "Aún no es la fecha de entrega"; sigue Reservada | AC-005-03.png | AC-005-03 |
| E2E-WF-001-EX06 | reserva 12-05..07 sin entregar, hoy 12-08 | encargado abre Entregas y devoluciones | "Piolet · Lucía · No recogida"; unidades libres | AC-005-04.png | AC-005-04, RN-008 |
| E2E-WF-001-EX07 | "Cuerda 1" de Marta hasta 12-05, hoy 12-07 | abrir pantalla | "Con retraso: Cuerda 1 · Marta · 2 días" | AC-009-02.png | AC-009-02 |
| E2E-WF-001-EX08 | nada prestado | abrir pantalla | "No hay material prestado" | AC-009-04.png | AC-009-04 |
| E2E-WF-001-EX09 | reserva Reservada | marcar devuelta | `E_RESERVA_NO_PRESTADA` "Esa reserva no está prestada" | AC-006-05.png | AC-006-05 |
| E2E-WF-001-EX10 | reserva de Lucía | Pablo ejecuta cancelar con su id (gancho de pruebas de la app; la UI no lo ofrece) | `E_SIN_PERMISO_CANCELAR` "No tienes permiso para cancelar esta reserva"; sigue Reservada | AC-004-07.png | AC-004-07, INV-ACC-009 |
| E2E-WF-001-EX11 | socio / socia abre por dirección | Multas, Historial | `E_SIN_PERMISO` "No tienes permiso para ver esta pantalla" | AC-007-04.png, AC-010-04.png | AC-007-04, AC-010-04, SEC-T-005 |
| E2E-WF-001-A11Y-01 | teclado | recorrer Reservar y Entregas y devoluciones | campos alcanzables; axe sin violaciones | — | ACCESSIBILITY (WCAG 2.2) |

### E2E-WF-001 — Full tier (P2) — list only

| Variant ID | Given | Action | Expected | Spec Ref |
|------------|-------|--------|----------|----------|
| E2E-WF-001-F01 | `E_ALMACEN_NO_DISPONIBLE` inyectado | reservar | "No se pudo completar la operación. Inténtalo de nuevo"; sin cambios | D-T-003, VO-010 |
| E2E-WF-001-F02 | reserva Prestada | entregar de nuevo | una sola fila prestada | AC-005-02 |
| E2E-WF-001-F03 | reserva con multa | repetir devolución y pago | una multa, misma fecha de pago | AC-006-04, AC-007-03 |
| E2E-WF-001-F04 | 20 reservas y 5 socios | vistas Mis reservas y Entregas | listas completas, sin mezclar socios | INV-ACC-009 |

---

### E2E-ADM-01: Gestión de socios (P1, UC-002)

- **Tier:** critical · **Acceptance:** AC-002-01 AC-002-02 AC-002-03 AC-002-04 AC-002-05 AC-002-06 AC-002-07 · **Requirements:** REQ-F-002, REQ-NF-001 · **Auth:** encargado

| # | Action | Assertion | Evidence | Spec Ref |
|---|--------|-----------|----------|----------|
| 1 | Socios: crear "Marta Ruiz", marta@club.es, "Glaciar2026" | "Marta Ruiz" en la lista de Socios; Marta entra ("Hola, Marta") | AC-002-01.png | AC-002-01 |
| 2 | Crear otro con marta@club.es | `E_CORREO_DUPLICADO` "Ya existe un socio con ese correo"; una sola Marta | AC-002-02.png | AC-002-02 |
| 3 | Crear socio con contraseña "corta" | `E_CONTRASENA_CORTA` "La contraseña debe tener al menos 8 caracteres" | AC-002-03.png | AC-002-03 |
| 4 | Dar de baja a Pablo (sin préstamo ni multa) | "Pablo" con "Baja"; Pablo no entra | AC-002-04.png | AC-002-04 |
| 5 | Dar de baja a Lucía con "Casco 2" prestado | `E_BAJA_SOCIO_BLOQUEADA` "No se puede dar de baja: tiene material prestado o multas pendientes"; sigue Activa | AC-002-05.png | AC-002-05 |
| 6 | Restablecer a Marta con "Nieve2026" | "Contraseña restablecida"; entra con la nueva, la antigua falla | AC-002-06.png | AC-002-06 |
| 7 | Lucía abre Socios por dirección | `E_SIN_PERMISO` "No tienes permiso para ver esta pantalla" | AC-002-07.png | AC-002-07 |

### E2E-ADM-02: Gestión del inventario (P1, UC-008)

- **Tier:** critical · **Acceptance:** AC-008-01 AC-008-02 AC-008-03 AC-008-04 AC-008-06 · **Requirements:** REQ-F-008 · **Auth:** encargado

| # | Action | Assertion | Evidence | Spec Ref |
|---|--------|-----------|----------|----------|
| 1 | Con 3 Piolet, añadir 2 de "Piolet" | "Piolet · 5 unidades" en Inventario | AC-008-01.png | AC-008-01 |
| 2 | Enviar el mismo formulario otra vez | "Añadidas 2 unidades de Piolet"; ahora 7 (INV-STK-003) | AC-008-02.png | AC-008-02 |
| 3 | Marcar rota "Casco 3" (libre) | "Casco 3 · De baja" y "Casco · 2 unidades" | AC-008-03.png | AC-008-03 |
| 4 | Marcar rota "Casco 1" (prestada a Pablo) | `E_BAJA_UNIDAD_PRESTADA` "No se puede dar de baja: está prestada" | AC-008-04.png | AC-008-04 |
| 5 | Pablo abre Inventario por dirección | `E_SIN_PERMISO` "No tienes permiso para ver esta pantalla" | AC-008-06.png | AC-008-06 |

### smoke-deploy (@smoke-deploy)

Target environment: none (sin `staging_url`); sin escenarios.

---

## Field Coverage Verification

| Field | Happy step | Empty | Invalid | Conditional | Interaction | Status |
|-------|-----------|-------|---------|-------------|-------------|--------|
| correo, contrasena | WF-002-01 #3-4 | V01, V02: undefined in spec | IV01 | N/A | N/A | INCOMPLETE (empty, GAP-006) |
| tipo | WF-001-01 #2 | undefined in spec | IV04 | N/A | N/A | INCOMPLETE (empty, GAP-006) |
| desde, hasta | WF-001-01 #2 | undefined in spec | IV01..IV03 | N/A | N/A | INCOMPLETE (empty, GAP-006) |
| reservaId, unidadId | WF-001-01 #5, #7 | undefined in spec | EX09; unidad ocupada: TEST-MATRIX-UC-005 | N/A | N/A | INCOMPLETE (empty, GAP-006) |
| multaId | WF-001-02 #2 | N/A (fila elegida) | not found: TEST-MATRIX-UC-007 | N/A | N/A | COMPLETE |
| alta, cantidad | ADM-01 #1, ADM-02 #1 | undefined in spec | ADM-01 #3 | N/A | N/A | INCOMPLETE (empty, GAP-006) |

Exención propuesta, no firmada (clase H): "empty" sin criterio queda como GAP-006 hasta que la spec fije el error; no se inventa el mensaje.

## Transitive Coverage and Visual Criteria

| REQ | Scenarios | Visible criteria with screenshot | Status |
|-----|-----------|---------------------------------|--------|
| REQ-F-001 | WF-002-01, 02, IV01, EX01..EX04 | AC-001-01..09 (9/9) | covered |
| REQ-F-002 | ADM-01 | AC-002-01..07 (7/7) | covered |
| REQ-F-003 | WF-001-01, 03, IV01..03, EX01..04 | AC-003-01, 03..10 (9/9); AC2 No visible | covered |
| REQ-F-004 | WF-001-01, 03, 04, EX10 | AC-004-01, 02, 03, 05, 06, 07 (6/6); AC4 No visible | covered |
| REQ-F-005 | WF-001-01, EX05, EX06 | AC-005-01, 03, 04 (3/3); AC2 No visible | covered |
| REQ-F-006 | WF-001-01, 02, 03, EX09 | AC-006-01, 02, 03, 05 (4/4); AC4 No visible | covered |
| REQ-F-007 | WF-001-02, 03, EX11 | AC-007-01, 02, 04 (3/3); AC3 No visible | covered |
| REQ-F-008 | ADM-02 | AC-008-01, 02, 03, 04, 06 (5/5); AC5 No visible | covered |
| REQ-F-009 | WF-001-01, 05, EX07, EX08 | AC-009-01..05 (5/5) | covered |
| REQ-F-010 | WF-001-05, EX11 | AC-010-01, 02, 04 (3/3); AC3 No visible | covered |
| REQ-NF-001, REQ-C-001..003 | EXEMPT-NFR: SEC-T-001..002, LIM-T-004, MNT-T-001..003, INT-T-001 | — | exempt |

visual_criteria = 54, visual_criteria_covered = 54. Criterios `No visible:` (7) fuera de captura: GAP-004.
