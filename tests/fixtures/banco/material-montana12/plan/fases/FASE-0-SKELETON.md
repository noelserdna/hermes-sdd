# FASE 0: Entrar y cargar el material

> **Estado:** Implementable
> **Incremento:** El encargado y los socios entran con su correo, el encargado carga y retira material y todo sigue ahí al reiniciar el servidor
> **Requisitos:** REQ-F-001, REQ-F-007
> **Escenarios:** AC-001-01, AC-001-02, AC-001-03, AC-001-04, AC-001-05, AC-001-06, AC-001-07, AC-001-08, AC-001-09, AC-002-01, AC-002-02, AC-002-03, AC-015-01, AC-015-02, AC-015-03, AC-015-04, AC-015-05, AC-015-06, AC-016-01, AC-016-02, AC-016-03, AC-016-04, AC-016-05
> **Necesidades:** N-001, N-007
> **Dependencias:** Ninguna (fase inicial)

---

## Objetivo

Permitir que un **socio, el encargado o la junta** entren y salgan con correo y contraseña, y que el **encargado** añada y retire unidades de material con persistencia en el servidor. Un solo bloque (serie).

## Criterios de Éxito

### UC-001 — Entrar
- [ ] Socio y encargado entran y ven «Hola, {nombre}» en la página de su rol (AC-001-01, AC-001-02, REQ-F-001)
- [ ] Contraseña errónea: «Correo o contraseña incorrectos», igual con correo desconocido o de baja (AC-001-03)
- [ ] Tras `LOGIN_MAX_FAILURES` fallos, cuenta bloqueada `LOGIN_LOCK_MINUTES`; un acierto la reinicia (AC-001-04, AC-001-05)
- [ ] Sesión cerrada al pasar de 30 min sin actividad; con exactamente 30 min sigue abierta (AC-001-06, D-PA-001)
- [ ] Sin sesión, `/mis-reservas` muestra «Entrar»; un socio en `/material` recibe `E_PAGINA_PROHIBIDA` (AC-001-07, AC-001-08)
- [ ] Entrar con sesión ya abierta no cambia nada (AC-001-09)

### UC-002 — Salir
- [ ] Salir invalida la sesión en el servidor; volver atrás no muestra datos (AC-002-01, AC-002-02, REQ-F-001)
- [ ] Salir dos veces avisa sin error (AC-002-03)

### UC-015 — Añadir unidades
- [ ] Añadir a un tipo existente o crear un tipo nuevo; nombre único sin distinguir mayúsculas (AC-015-01, AC-015-02, REQ-F-007)
- [ ] Cantidad o nombre inválidos: error y nada cambia; el envío repetido avisa (AC-015-03, AC-015-04, AC-015-06)
- [ ] Solo el encargado gestiona material (AC-015-05, AC-016-05)

### UC-016 — Retirar unidades
- [ ] Retirar solo si cada día ≥ hoy conserva `total − n ≥ ocupadas`; si no, error con las unidades necesarias (AC-016-01, AC-016-02)
- [ ] Retirar de nuevo avisa; cantidad inválida da error (AC-016-03, AC-016-04)

### Reservar (versión mínima, solo lectura)
- [ ] Socio abre «Reservar» y ve «Casco» entre los tipos; un tipo con 0 unidades («Cuerda») no se ofrece (REQ-F-007 AC6)

### Transversal
- [ ] Datos en `data/datos.json` compartido en servidor, escritura atómica; sobreviven al reinicio (ADR-DRAFT-002, AC-015-01, REQ-F-007)
- [ ] Todos los textos en español (REQ-C-001); solo Vite y Vitest, `type: module` (REQ-C-002)
- [ ] Contraseñas solo con hash y sal (INV-SOC-003, REQ-F-001)

## Specs a Leer

### Casos de Uso
| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-001-entrar.md`, `UC-002-salir.md` | flujo, excepciones | sesión, bloqueo, caducidad |
| `use-cases/UC-015-anadir-unidades.md`, `UC-016-retirar-unidades.md` | flujo, excepciones | material |

### ADRs y diseño
| Documento | Sección | Para |
|-----------|---------|------|
| `adr/ADR-001-disponibilidad-por-dia.md`, `ADR-005-operaciones-idempotentes.md` | §Decision | ocupadas por día; avisos de repetición |
| `design/TECHNICAL-DESIGN.md` | §4 a §8 | capas, almacén, sesión, errores |
| `design/OPERATION-MAPPING.md` | API-001-01, -02, -08, API-003-01..03 | rutas |

### Dominio
| Documento | Sección | Para |
|-----------|---------|------|
| `domain/02-ENTITIES.md` | ENT-001, ENT-002 | cuenta, material |
| `domain/03-VALUE-OBJECTS.md` | VO-004, VO-006, VO-010 | rol, cantidad, mensajes |
| `domain/04-STATES.md` | SM-003 | cuenta Activa y bloqueada |
| `domain/05-INVARIANTS.md` | INV-SOC-*, INV-MAT-*, INV-SEC-* | ver Invariantes |

### Contratos
| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `contracts/API-cuentas.md` | API-001-01, -02, -08 | firmas |
| `contracts/API-material.md` | API-003-01..03 | firmas |
| `contracts/PERMISSIONS-MATRIX.md` | filas de esos ops | `authorize` |

### Tests
| Documento | ids | Para |
|-----------|-----|------|
| `spec/tests/BDD-UC-001.md`, `-002`, `-015`, `-016` | escenarios de Escenarios | integración |
| `test/TEST-PLAN.md` | §3, §9 R-1..R-3, R-5, R-6; PROP-004, 005, 021, 022, 023 | dobles, semillas |
| `test/E2E-SCENARIOS.md` | E2E-ACC-01, -02, -05, -06 | E2E |

### Transversal (FASE-0)
`domain/01-GLOSSARY.md`, `contracts/EVENTS-*.md`, `spec/CLARIFICATIONS.md` (RN-001..003, RN-017, RN-020, RN-022), `nfr/SECURITY.md`, `nfr/LIMITS.md`, `spec/README.md` y `VALUE-REGISTRY.md`.

## Invariantes Aplicables

| ID | Dónde se aplica (bloque · función) |
|----|------------------------------------|
| INV-SOC-003, INV-SOC-004, INV-SOC-005, INV-SOC-008 | A · `cuentas.login`, `sesiones` |
| INV-SOC-001, INV-SOC-002 | A · modelo de cuenta (siembra); el alta llega en FASE-3 |
| INV-MAT-001..004 | A · `material.addUnits`, `withdrawUnits` |
| INV-RES-004, INV-RES-005 | A · `dominio/disponibilidad` (sobre reservas sembradas) |
| INV-SEC-003, INV-SEC-001 | A · `http/autorizar` |

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | todo el producto | `package.json`, `vite.config.js`, `vitest.config.js`, `src/server/**`, `src/ui/**`, `index.html`, `demo/**`, `tests/unit/**`, `tests/integration/**`, `tests/e2e/**` | `spec/**`, `plan/**` | — |

## Contratos Resultantes

| Contrato | Firma / Ruta | Descripción (≤ 80 chars) |
|----------|--------------|--------------------------|
| API-001-01 | `login(ctx, {correo, contrasena})` | abre sesión, destino por rol |
| API-001-02 | `logout(ctx)` | invalida la sesión en el servidor |
| API-001-08 | `authorize(sesion, operacion)` | rol y página, antes de cada ruta |
| API-003-01 | `addUnits(ctx, {nombre, cantidad})` | añade a un tipo o lo crea |
| API-003-02 | `withdrawUnits(ctx, {id, cantidad})` | retira si quedan cubiertas las reservas |
| API-003-03 | `listMaterial(ctx)` | catálogo con unidades |

## Entregables de UI

| Ruta | Componente | UC | Wireframe | Descripción |
|------|------------|----|-----------|-------------|
| `/entrar` | `src/ui/paginas/entrar.js` | UC-001 | SCR-001 | formulario con error y bloqueo |
| `/mis-reservas` | `src/ui/paginas/mis-reservas.js` | UC-001, UC-002 | SCR-003 | cabecera «Hola» y «Salir»; lista vacía hasta FASE-1 |
| `/panel` | `src/ui/paginas/panel.js` | UC-001 | SCR-006 | «Hola, {nombre}» del encargado; contenido en FASE-2 |
| `/material` | `src/ui/paginas/material.js` | UC-015, UC-016 | SCR-008 | añadir y retirar unidades |
| `/reservar` | `src/ui/paginas/reservar.js` | UC-015 (REQ-F-007 AC6) | SCR-004 | versión mínima: solo la lista de tipos con unidades (`listMaterial`), solo socio; sin formulario ni «Reservar» (llega en FASE-1) |
| `/sin-permiso` | `src/ui/paginas/sin-permiso.js` | UC-001 | SCR-011 | `E_PAGINA_PROHIBIDA` |

Componentes compartidos: `navegacion` (según rol), `formulario`, `mensajes` (textos VO-010), `router` (History API).

## Verificación

```bash
npx vitest run tests/integration/cuentas.test.js --maxWorkers=2   # UC-001/002 verdes
npx vitest run tests/integration/material.test.js --maxWorkers=2  # UC-015/016 verdes
npm test                      # unit + integración verdes
npm run lint                  # sin errores
npx playwright test           # E2E-ACC-01, -02, -05, -06 verdes
```

## Demo

> Desde un checkout limpio: `npm install` · `node demo/sembrar.mjs fase-0` (Lucía socia, Pablo encargado, un miembro de junta, 1 tipo «Casco» con 3 unidades y una reserva sembrada) · `npx vite --host 127.0.0.1 --port 5173`.

| # | Acción | Resultado esperado | Escenario |
|---|--------|--------------------|-----------|
| 1 | Abrir `/mis-reservas` sin entrar | se ve «Entrar» | AC-001-07 · N-001 |
| 2 | Entrar como lucia@club.test | «Hola, Lucía» en Mis reservas | AC-001-01 · N-001 |
| 3 | Probar `/material` como Lucía | página «Sin permiso» | AC-001-08 · N-001 |
| 4 | Pulsar «Salir» y volver atrás | se ve «Entrar», sin datos | AC-002-01, AC-002-02 · N-001 |
| 5 | Entrar con contraseña errónea 5 veces | «Cuenta bloqueada. Vuelve a intentarlo en 15 minutos» | AC-001-03, AC-001-04 · N-001 |
| 6 | Entrar como pablo@club.test | «Hola, Pablo» en Panel del encargado | AC-001-02 · N-001 |
| 7 | En Material, añadir 2 «Piolet» (tipo nuevo) | aparece Piolet con 2 unidades | AC-015-02 · N-007 |
| 8 | Retirar 3 «Casco» (la reserva sembrada ocupa 2): error con las unidades necesarias; luego retirar 1 | error y, después, quedan 2 | AC-016-02, AC-016-01 · N-007 |
| 9 | Entrar como Lucía y abrir `/reservar` con «Cuerda» a 0 unidades | «Casco» entre los tipos; «Cuerda» no se ofrece | REQ-F-007 AC6 · N-007 |
| 10 | Parar y arrancar el servidor, entrar y abrir Material | Piolet 2 y Casco 2 siguen | AC-015-01 · N-007 |

## Alcance

**Incluye:** sesión, bloqueo, caducidad, autorización central, material, almacén JSON atómico, reloj inyectable, router, esqueleto de la web y la lista de tipos de `/reservar` (REQ-F-007 AC6).
**Excluye:** contraseña provisional y cambio de contraseña (FASE-3), reservas (FASE-1: formulario, fechas y botón «Reservar»), alta de socios (FASE-3: hasta entonces los socios se siembran con `demo/sembrar.mjs`).
