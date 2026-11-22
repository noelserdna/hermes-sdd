# FASE 0: Skeleton — entrar, crear socios y que todo persista

> **Estado:** Implementable
> **Incremento:** El encargado da de alta a un socio; socio, encargado y junta entran con su correo, ven su inicio, salen y la sesión caduca sola. Al recargar todo sigue ahí.
> **Requisitos:** REQ-F-001
> **Escenarios:** AC-001-01, AC-001-02, AC-001-03, AC-001-04, AC-001-05, AC-001-06, AC-001-07, AC-001-08, AC-001-09, AC-001-10, AC-002-01, AC-002-02, AC-002-03, AC-002-04, AC-002-05, AC-002-06, AC-002-07, AC-003-01, AC-003-02, AC-003-03, AC-003-04, AC-003-05, AC-003-06, AC-003-07
> **Workflows:** WF-002
> **Necesidades:** N-001, N-002, N-011
> **Dependencias:** Ninguna (fase inicial)

---

## Objetivo

Permitir que el **encargado** cree socios y que **socio, encargado y junta** entren, salgan y vean su pantalla de inicio, con sesión, bloqueo y caducidad. Prueba todas las capas: SPA → plugin → dominio → almacén JSON → recarga.

---

## Criterios de Éxito

### UC-001 — Entrar con correo y contraseña
- [ ] Socio y encargado ven "Material disponible" / "Panel del encargado" al entrar (AC-001-01, AC-001-02, REQ-F-001)
- [ ] La junta entra a su inicio de solo lectura (AC-001-03)
- [ ] Contraseña errónea: "Correo o contraseña incorrectos"; cuenta en Baja, el mismo mensaje (AC-001-06, AC-001-08, REQ-F-001)
- [ ] El 5.º fallo muestra "Cuenta bloqueada durante 15 minutos", incluso con la clave buena (AC-001-07, REQ-F-001)
- [ ] Pasados 15 minutos la clave correcta entra (AC-001-04, REQ-F-001)
- [ ] Datos vacíos, almacén caído y envío repetido tienen su respuesta (AC-001-05, AC-001-09, AC-001-10)

### UC-002 — Mantener y cerrar la sesión
- [ ] "Salir" lleva a Entrar y volver atrás pide entrar otra vez (AC-002-01, AC-002-02, REQ-F-001)
- [ ] A los 30 min sin actividad: "Sesión caducada, vuelve a entrar"; la actividad renueva (AC-002-05, AC-002-04, REQ-F-001)
- [ ] Anónimo que abre la dirección de «Mis reservas» (`#/reservas`, versión mínima) ve Entrar (AC-002-03, REQ-F-001 AC8)
- [ ] Salir repetido o con almacén caído no rompe nada (AC-002-06, AC-002-07)

### UC-003 — Crear socio y listar socios
- [ ] "Pablo Ruiz" aparece en Socios tras crearlo (AC-003-01, REQ-F-002 AC1)
- [ ] Contraseña corta y correo repetido se rechazan con su mensaje (AC-003-04, AC-003-05, REQ-F-002 AC2, REQ-F-002 AC3)
- [ ] Un socio ve "Acceso no permitido" en Socios (AC-003-06, REQ-F-002 AC7)
- [ ] La lista muestra también a los socios en Baja (AC-003-02); datos vacíos y almacén caído (AC-003-03, AC-003-07)

### Transversal
- [ ] Reiniciar el servidor conserva cuentas; una contraseña solo se guarda con hash (REQ-C-003, REQ-NF-001 AC3)
- [ ] Todos los textos en español desde `src/ui/textos.js` y `errores.js` (REQ-C-002)
- [ ] Stack JS ESM + Vite + Vitest sin otro framework de UI (REQ-C-001)

---

## Specs a Leer

### Casos de Uso

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-001-entrar-con-correo.md` | flujo, extensiones, E1.., AC-001-01..10 | login y bloqueo |
| `use-cases/UC-002-mantener-y-cerrar-sesion.md` | flujo, AC-002-01..07 | sesión |
| `use-cases/UC-003-crear-y-listar-socios.md` | flujo, AC-003-01..07 | alta y lista |

### Workflows

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `workflows/WF-002-sesion-de-acceso.md` | pasos 1-4, navegación | vídeo del gate |

### ADRs y transversales

| Documento | Sección | Para |
|-----------|---------|------|
| `adr/ADR-001`..`ADR-005`, `nfr/SECURITY.md`, `VALUE-REGISTRY.md` | §Decision, SPEC-SEC-001..006 | almacén, reloj, hash, errores, constantes |

### Dominio

| Documento | Sección | Para |
|-----------|---------|------|
| `domain/02-ENTITIES.md` | ENT-001, ENT-005 | cuenta y sesión |
| `domain/03-VALUE-OBJECTS.md` | VO-001, VO-002, VO-003, VO-005, VO-010 | fecha, correo, contraseña, rol, errores |
| `domain/04-STATES.md` | SM-004 | cuenta |
| `domain/05-INVARIANTS.md` | INV-ACC-*, INV-SEC-* | ver Invariantes |

### Contratos

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `contracts/API-acceso.md` | API-001-01..05 | firmas |
| `contracts/PERMISSIONS-MATRIX.md` | filas anónimo, socio, encargado, junta | `permisos.js` |

### Tests

| Documento | ids | Para |
|-----------|-----|------|
| `tests/BDD-UC-001.md`..`BDD-UC-003.md` | AC-001-01..AC-003-07 | unit, integración, E2E |
| `tests/PROPERTY-TESTS.md` | PROP-007, PROP-010 | unit |

### Plan de tests (test/)

| Documento | ids | Para |
|-----------|-----|------|
| `test/TEST-PLAN.md` | D-T-001..D-T-006, INT-T-001, SEC-T-002..004, R-1..R-6 | inyección y E2E |

---

## Invariantes Aplicables

| ID | Dónde se aplica |
|----|-----------------|
| INV-ACC-001..004 | A · `crearSocio`, `iniciarSesion` |
| INV-ACC-005, INV-ACC-006, INV-ACC-007 | A · `sesiones.js`, `permisos.js` |
| INV-SEC-001..003 | A · filtro por dueño, `permisos.js`, `store.transaccion` |

---

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | todo el viaje (serie) | `package.json`, `vitest.config.js`, `index.html`, `.gitignore`, `scripts/seed.js`, `src/domain/{errores,reloj,validacion,permisos,cuentas}.js`, `src/server/{plugin,store,sesiones,hash}.js`, `src/ui/**`, `tests/unit/**`, `tests/api/**`, `tests/e2e/fase-0-*.spec.js` | specs, `plan/` | — |

---

## Contratos Resultantes

| Contrato | Firma / Ruta | Descripción |
|----------|--------------|-------------|
| API-001-01 | `POST /api/iniciarSesion` · `iniciarSesion(ctx, {correo, contrasena})` | abre sesión; bloqueo tras 5 fallos |
| API-001-02 | `POST /api/cerrarSesion` | invalida la sesión (todos los roles) |
| API-001-03 | `GET /api/comprobarSesion` | renueva actividad; cuenta y rol |
| API-001-04 | `POST /api/crearSocio` | alta de socio (encargado) |
| API-001-05 | `GET /api/listarSocios` | lista nombre, correo, estado (encargado) |

Sin eventos de dominio (EVENTS-sistema).

---

## Entregables de UI

| Ruta | Componente | UC | Wireframe | Descripción |
|------|------------|----|-----------|-------------|
| `#/entrar` | `pantallas/entrar.js` | UC-001, UC-002 | SCR-001 | formulario, errores, caducada |
| `#/inicio` | `pantallas/inicio.js` | UC-001 | SCR-002, SCR-005, SCR-011 | inicio por rol (cabecera y navegación; contenido llega en FASE-1, 5) |
| `#/socios` | `pantallas/socios.js` | UC-003 | SCR-006 | alta y lista |
| `#/reservas` (mínima) | `pantallas/mis-reservas.js` | UC-002 | SCR-003 | ruta protegida: anónimo → Entrar; el socio ve el título «Mis reservas» y la cabecera; la lista llega en FASE-1 |
| `#/acceso-no-permitido` | `pantallas/prohibido.js` | UC-003 | SCR-012 | rol sin permiso |

| Componente | Usado en | Descripción |
|------------|----------|-------------|
| `cabecera` (usuario + Salir) | todas | UC-002 |
| `aviso` (`role=alert` / `status`) | todas | errores y éxito |

---

## Verificación

```bash
npx vitest run tests/unit/cuentas.test.js --maxWorkers=2   # AC-001-*, AC-002-*, AC-003-*, PROP-007, PROP-010 verdes
npx vitest run tests/api --maxWorkers=2                    # SEC-T-002: sin sesión → E_NO_AUTENTICADO en todas las operaciones
npm test                                                   # todo verde
npm run lint                                               # sin errores
SDD_FASE=0 npx playwright test                             # recorridos de WF-002 con capturas
```

---

## Demo

> Desde un checkout limpio: `npm ci` · `SEED_ENCARGADO_CORREO=marta@club.test SEED_ENCARGADO_NOMBRE=Marta SEED_ENCARGADO_CONTRASENA=Cumbre2026 npm run seed` · `CLOCK_FIXED=2026-12-05 npx vite --host 127.0.0.1 --port 5173`.

| # | Acción | Resultado esperado | Escenario |
|---|--------|--------------------|-----------|
| 1 | Abrir `#/reservas` («Mis reservas») sin entrar | se ve el formulario "Entrar" | AC-002-03 (REQ-F-001 AC8) · N-002 |
| 2 | Entrar como `marta@club.test` con clave `x` | "Correo o contraseña incorrectos" | AC-001-06 · N-002 |
| 3 | Entrar con `Cumbre2026` | "Panel del encargado" | AC-001-02 · N-002 |
| 4 | En Socios crear "Pablo Ruiz", `pablo@club.test`, `Nieve2026` | "Pablo Ruiz" en la lista | AC-003-01 · N-002 |
| 5 | Repetir con clave `corta1`, luego con el mismo correo | "La contraseña debe tener al menos 8 caracteres"; "Ya existe un socio con ese correo" | AC-003-04, AC-003-05 · N-002 |
| 6 | Recargar la página y reiniciar el servidor | "Pablo Ruiz" sigue en la lista | AC-003-01 · N-001, N-011 |
| 7 | Pulsar "Salir" | se ve "Entrar" | AC-002-01 · N-002 |
| 8 | Entrar como Pablo | "Material disponible"; `#/socios` da "Acceso no permitido" | AC-001-01, AC-003-06 · N-002, N-011 |
| 9 | Fallar 5 veces la clave de Pablo | "Cuenta bloqueada durante 15 minutos" | AC-001-07 · N-002 |

---

## Alcance

| Incluye | Excluye |
|---------|---------|
| UC-001, UC-002, UC-003; comando `seed` (encargado y junta); almacén, reloj, errores, permisos, plugin | Contenido del inicio del socio y lista de «Mis reservas» → FASE-1; Panel y Prestado → FASE-5; restablecer y baja → FASE-4 |

## Notas

- La cuenta de junta no se crea por la web (no hay operación): `seed` acepta `SEED_ROL=junta` (Supuesto 6 de PLAN.md).
- `permisos.js` nace con las 5 operaciones de esta FASE y cada FASE añade las suyas.
