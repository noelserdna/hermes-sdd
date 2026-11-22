# FASE 0: Esqueleto — entrar, inventario y reservar

> **Estado:** Implementable
> **Incremento:** El encargado deja material en el inventario; un socio entra con su correo y reserva unas fechas; la reserva sigue ahí al recargar y desde otro navegador.
> **Requisitos:** REQ-F-001, REQ-F-003, REQ-F-008
> **Escenarios:** AC-001-01, AC-001-02, AC-001-03, AC-001-04, AC-001-05, AC-001-06, AC-001-07, AC-001-08, AC-001-09, AC-001-10, AC-001-11, AC-001-12, AC-001-13, AC-008-01, AC-008-02, AC-008-03, AC-008-04, AC-008-05, AC-008-06, AC-008-07, AC-008-08, AC-008-09, AC-003-01, AC-003-02, AC-003-03, AC-003-04, AC-003-05, AC-003-06, AC-003-07, AC-003-08, AC-003-09, AC-003-10, AC-003-11, AC-003-12
> **Workflows:** WF-002
> **Necesidades:** N-001, N-002, N-003, N-006, N-008, N-011
> **Dependencias:** Ninguna (fase inicial)

---

## Objetivo

Permitir que el **encargado** gestione el inventario y que un **socio** entre con su correo y reserve material para unas fechas, con los datos en un almacén compartido. La pantalla «Mis reservas» llega ya en versión mínima de solo lectura (saludo, aviso de reserva creada y lista de las reservas propias), porque es donde aterrizan el acceso y la reserva; Cancelar y multas la completan en FASE-1. Un solo bloque serial: dominio, servidor, SPA y tests del recorrido.

## Criterios de Éxito

### UC-001 — Entrar y salir
- [ ] Socia y socio entran y ven su pantalla inicial por rol (AC-001-01, AC-001-02, AC-001-12, REQ-F-001)
- [ ] Contraseña mala: mismo error que correo desconocido o en Baja (AC-001-03, AC-001-10, REQ-F-001)
- [ ] 5 fallos bloquean 15 min; un acierto reinicia; pasado el bloqueo entra (AC-001-04, AC-001-05, AC-001-11)
- [ ] Sesión caduca a las 8 h sin uso; Salir la invalida; sin sesión no se opera (AC-001-06, AC-001-07, AC-001-08, AC-001-13)
- [ ] «Mis reservas» mínima: «Hola, {nombre}» al entrar; sin sesión lleva a Entrar; tras Salir, volver atrás pide entrar (AC-001-01, AC-001-02, AC-001-07, AC-001-08, AC-001-11, REQ-F-001)
- [ ] Doble envío del acceso no duplica sesión (AC-001-09, REQ-F-001)

### UC-008 — Gestionar inventario
- [ ] Añadir n unidades suma n cada vez; dar de baja una unidad libre (AC-008-01, AC-008-02, AC-008-03, REQ-F-008)
- [ ] No se da de baja una Prestada; baja repetida sin cambios (AC-008-04, AC-008-05)
- [ ] Socio sin permiso; tipo, cantidad o unidad inválidos con su error (AC-008-06, AC-008-07, AC-008-08, AC-008-09)

### UC-003 — Reservar material
- [ ] Reserva creada con unidades libres todos los días del rango; repetir idéntica no duplica (AC-003-01, AC-003-02, REQ-F-003)
- [ ] Tras reservar, «Mis reservas» muestra «Reserva creada: …» y una sola fila de esa reserva (AC-003-01, AC-003-02, AC-003-04, REQ-F-003)
- [ ] Sin unidades un día: se rechaza; la última unidad la gana uno solo (AC-003-03, AC-003-04, AC-003-10)
- [ ] Fechas pasadas, invertidas o de más de 14 días se rechazan (AC-003-05, AC-003-06, AC-003-07)
- [ ] Multa Pendiente impide reservar; pagada, vuelve a poder (AC-003-08, AC-003-09, REQ-F-003)
- [ ] Rol sin permiso y tipo inválido rechazados (AC-003-11, AC-003-12)

### Transversal
- [ ] Textos en español; ningún dato de negocio en `localStorage` (REQ-C-001, REQ-C-003, MNT-001, MNT-003)
- [ ] Contraseñas solo como hash con sal, nunca en una salida (SEC-001, SEC-002, INV-ACC-003, REQ-F-001)
- [ ] JS ESM + Vite + Vitest (REQ-C-002)

## Specs a Leer

### Casos de Uso

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `use-cases/UC-001-entrar-y-salir.md` | flujo, excepciones | login y sesión |
| `use-cases/UC-008-gestionar-inventario.md` | flujo, excepciones | inventario |
| `use-cases/UC-003-reservar-material.md` | flujo, excepciones | reserva |

### Workflows y ADR

| Documento | Sección | Para |
|-----------|---------|------|
| `workflows/WF-002-sesion-de-una-cuenta.md` | pasos | vídeo de la sesión |
| `adr/ADR-001-reloj-en-fecha-natural.md`, `adr/ADR-002-almacen-compartido-y-reserva-indivisible.md` | §Decision | reloj, transacción |

### Dominio, contratos y transversales

| Documento | Sección / ids | Para |
|-----------|---------------|------|
| `domain/02-ENTITIES.md` | ENT-001..005 | estructura del almacén |
| `domain/03-VALUE-OBJECTS.md` | VO-010 catálogo de errores | errores |
| `domain/04-STATES.md` | SM-001, SM-003, SM-004 | transiciones |
| `contracts/API-acceso.md`, `API-inventario.md`, `API-reservas.md` | API-001-01/02, API-004-01..03, API-002-01 | firmas |
| `contracts/PERMISSIONS-MATRIX.md` | todo | `permisos.js` |
| `nfr/SECURITY.md`, `LIMITS.md`, `MAINTAINABILITY.md`; `VALUE-REGISTRY.md` | SEC-001..007, LIM-001..003 | constantes |
| `domain/01-GLOSSARY.md`, `CLARIFICATIONS.md` | RN-001..007, 015, 016 | léxico y reglas |
| `design/OPERATION-MAPPING.md`, `ux/WIREFRAMES.md` | SCR-001, SCR-002 (mínima), SCR-003, SCR-007 | rutas y pantallas |

### Tests

| Documento | ids | Para |
|-----------|-----|------|
| `tests/BDD-UC-001.md`, `BDD-UC-003.md`, `BDD-UC-008.md` | AC-001-*, AC-003-*, AC-008-* | integración y E2E |
| `test/TEST-MATRIX-UC-001.md`, `-003.md`, `-008.md`; `E2E-SCENARIOS.md` | E2E-WF-002-*, E2E-ADM-02 | matrices |

## Invariantes Aplicables

| ID | Dónde se aplica |
|----|-----------------|
| INV-ACC-001..006, 008, 009, 102 | `acceso`, `sesiones`, `permisos` |
| INV-RES-001..005, 008 | `reservas.reservarMaterial` en transacción |
| INV-STK-001..004 | `inventario` |

## Módulos y Conjuntos de Escritura

| Bloque | Módulo / directorio | Escribe (write-set) | No escribe | Depende de |
|--------|---------------------|---------------------|------------|------------|
| A | dominio + servidor + SPA | `package.json`, `vite.config.js`, `vitest.config.js`, `index.html`, `src/domain/**`, `src/server/**`, `src/ui/**`, `tests/unit/**` | `tests/e2e/**` | — |
| Integración | e2e | `tests/e2e/**`, `playwright.config.js` | código de producción | A |

## Contratos Resultantes

- API-001-01 iniciarSesion · API-001-02 cerrarSesion · `GET /api/salud`
- API-004-01 anadirUnidades · API-004-02 darDeBajaUnidad · API-004-03 listarInventario
- API-002-01 reservarMaterial · API-002-02 listarMisReservas (mínima: solo reservas del socio, INV-ACC-009; multas y derivación No recogida en FASE-1)
- Puerto `store` (`load`, `transaction(fn)`), `reloj.hoy()`, `npm run cuentas` (cuentas de encargado y junta, D-PA-003)

## Entregables de UI

| Página / ruta | UC | Wireframe |
|---------------|----|-----------|
| `#/entrar` Entrar | UC-001 | SCR-001 |
| `#/mis-reservas` Mis reservas, mínima de solo lectura (saludo, confirmación, lista propia; Cancelar y multas en FASE-1) | UC-001, UC-003 | SCR-002 |
| `#/reservar` Reservar (socio) | UC-003 | SCR-003 |
| `#/inventario` Inventario (encargado) | UC-008 | SCR-007 |

## Verificación

```
npm test            # unit + integración UC-001, UC-003, UC-008 en verde
npm run lint        # sin errores
npx playwright test --grep "WF-002|ADM-02"   # capturas en evidencias/FASE-0/
```

## Demo

Semilla: `CLOCK_FIXED=2026-12-01`, `npm run cuentas` (encargado, junta) y socios lucia@club.es / pablo@club.es por la semilla de pruebas.

| # | Acción | Resultado esperado | Escenario · Necesidad |
|---|--------|--------------------|-----------------------|
| 1 | Abrir `/` sin sesión | lleva a Entrar | AC-001-08 · N-002 |
| 2 | Encargado entra con contraseña mala 5 veces | mismo error; la 5.ª bloquea la cuenta | AC-001-03, AC-001-04 · N-011 |
| 3 | Encargado entra bien y añade 2 piolets | Inventario muestra 2 | AC-001-12, AC-008-01 · N-008 |
| 4 | Lucía entra (ve «Hola, Lucía» en Mis reservas) y reserva 1 piolet del 3 al 5 de diciembre | Mis reservas muestra «Reserva creada: Piolet del 2026-12-03 al 2026-12-05» | AC-001-01, AC-003-01 · N-003 |
| 5 | Pablo reserva 2 piolets del 4 al 4 | rechazado: el día 4 solo queda 1 | AC-003-04 · N-003 |
| 6 | Recargar y abrir desde otro navegador como encargado | la reserva y las unidades siguen | AC-003-10 · N-001 |
| 7 | Lucía pulsa Salir y vuelve atrás | pide entrar de nuevo | AC-001-07 · N-002 |

## Alcance

**Incluye:** acceso, permisos por rol, inventario, reservar, Mis reservas mínima (solo lectura), infraestructura mínima (almacén, reloj, servidor, SPA, cuentas iniciales).
**Excluye:** cancelar reservas y ver multas en Mis reservas (FASE-1), entregas, devoluciones, multas (FASE-1, 2), altas y bajas de socios (FASE-3).
