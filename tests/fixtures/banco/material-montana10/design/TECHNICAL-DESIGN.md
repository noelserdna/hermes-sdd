# Technical Design — material-montana10

> Generado por `/sdd-tech-designer` el 2026-11-21 (modo arnés, sin persona en la sesión)
> Basado en `spec/` y `requirements/`. Stack Profile de AGENTS.md respetado: JavaScript (ES modules) + Vite + Vitest.

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-11-21 | Diseño técnico inicial |

---

## 1. System Vision

**Type:** Web application SPA (Vite) con una API HTTP propia en Node, en un único proceso.
**Primary Users:** socio (reserva y cancela), encargado (entrega, devuelve, multas, inventario, socios), junta (solo lectura); y el sistema (tareas diarias API-003-07 y API-003-08).
**Scale:** un club: decenas de socios, cientos de unidades como mucho, unas pocas decenas de peticiones por hora. Sin NFR de rendimiento en `spec/nfr/`.
**Key Constraint:** REQ-C-002 (JS + Vite + Vitest) y REQ-C-003 (datos en un único lugar en servidor, nada de negocio en `localStorage`/`sessionStorage`), más indivisibilidad por tipo de material (ADR-002).

> Una SPA servida por Vite habla con una API JSON montada como middleware del propio servidor de Vite (`vite dev` y `vite preview`), así que el stack no cambia y hay un solo proceso Node. La lógica de negocio vive en módulos puros con el reloj y el almacén inyectados (ADR-001), probables con Vitest sin red. Los datos viven en un fichero en el servidor, escrito de forma atómica y serializado por tipo de material.

---

## 2. Quality Attribute Summary

> Análisis completo en `design/QUALITY-ATTRIBUTES.md`

| Attribute | Score (1-5) | Key Driver |
|-----------|-------------|------------|
| Security | 5 | SEC-001..007, REQ-NF-001 |
| Reliability (integridad) | 5 | ADR-002, INV-RES-004, INV-LOA-002 |
| Testability | 5 | ADR-001 (reloj inyectado), MNT-002 |
| Maintainability | 4 | MNT-001..003 |
| Usability | 4 | REQ-C-001, RN-016 |
| Cost Efficiency | 5 | club pequeño, un solo proceso |
| Performance / Scalability | 2 | sin NFR; volumen mínimo |

**Top trade-off:** integridad y simplicidad sobre escalabilidad: un solo proceso con serialización por tipo (ADR-002) en vez de una base de datos multiusuario.

---

## 3. Delivery Channels (Dimension 1)

**Decision:** Web responsive (móvil primero para el socio; escritorio para el encargado). Sin app nativa ni PWA offline.
**Rationale:** REQ-C-003 pide que lo que hace el encargado lo vea el socio desde su móvil; el navegador basta.
**Alternatives considered:** PWA offline (los datos deben ser compartidos y vigentes; offline sería incoherente), app nativa (coste sin valor).
**Trade-offs:** sin uso sin conexión.

---

## 4. Architecture Style (Dimension 2)

**Decision:** Monolito modular en capas, un solo proceso: `ui` (SPA) → `api` (adaptador HTTP) → `domain` (casos de uso puros) → `store` (puerto de persistencia). Contratos con `Style: operations`: cada `API-NNN-NN` es una función de caso de uso; HTTP es solo transporte.
**Rationale:** ADR-002 pide operaciones indivisibles; un monolito de un proceso lo garantiza con un mutex. Los tests de dominio no dependen de Vite ni de HTTP.
**Alternatives considered:** SPA + backend separado (otro stack, otro despliegue), SPA con backend-as-a-service (dependencia externa, datos de socios fuera).
**Trade-offs:** no hay escalado horizontal (la serialización es en memoria de proceso).

### Architecture Diagram (C4 Level 1)

```
 socio / encargado / junta (navegador, móvil o PC)
            |  HTTPS, cookie de sesión HttpOnly
            v
 +--------------------------- proceso Node (Vite dev / preview) ----------+
 |  SPA estática (src/ui)                                                 |
 |  middleware /api/*  (src/server/http.js)   <- reloj (Europe/Madrid)   |
 |        |                                                               |
 |  casos de uso puros (src/domain)  -- mutex por tipo --> store (puerto) |
 |        |                                                               |
 |  tarea diaria (resolverNoRecogidas, purgarRegistrosAntiguos)           |
 +------------------------------------------|-----------------------------+
                                            v
                              data/store.json (escritura atómica)
```

---

## 5. Tech Stack (Dimension 3)

**Decision:**

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Language | JavaScript (ES modules), sin TypeScript | ES2023 | Stack Profile / REQ-C-002 |
| Backend | `node:http` + middleware de Vite, sin framework | Node 22 LTS | sin dependencias; Vite ya sirve el proceso |
| Frontend | SPA en JS vanilla con módulos pequeños y plantillas DOM; sin framework | — | superficie reducida (6-8 pantallas); revisable en plan |
| Bundler / server | Vite (`vite`, `vite build`, `vite preview`) | ^6 | package.json |
| Tests | Vitest (`maxWorkers: 2`) + jsdom para UI; Playwright para aceptación | ^2.1 / ^1.49 | AGENTS.md |
| Hash de contraseñas | `node:crypto` scrypt con sal por cuenta | built-in | INV-ACC-003 sin dependencia nativa |
| Lint | ESLint | ^9 | `npm run lint` |
| Package manager | npm | — | `npm test` |

---

## 6. Data Strategy (Dimension 4)

**Primary Database:** fichero JSON único en servidor (`DATA_FILE`, por defecto `data/store.json`), detrás de un puerto `store` (`load`, `transaction(fn)`), con escritura atómica (fichero temporal + `rename`). En tests, almacén en memoria.
**Schema Approach:** entidades ENT-001..005 de `spec/domain/02-ENTITIES.md` como colecciones; campo `schemaVersion` y migraciones por función al cargar.
**Caching:** no necesaria.

- Indivisibilidad: toda operación de escritura entra en `transaction(fn)`, que serializa en una cola de promesas (mutex global del proceso; más grueso que «por tipo» pero cumple ADR-002 y es más simple con este volumen).
- Fechas: texto `YYYY-MM-DD` de `Europe/Madrid`; el reloj se inyecta (ADR-001).
- Retención: `purgarRegistrosAntiguos` diaria (`RETENTION_YEARS`), nunca multas Pendientes.
- Copia de seguridad: copia diaria del fichero (`data/backups/`, 7 últimas). Datos personales mínimos (SEC-006).
- Los números se leen de `VALUE-REGISTRY.md` en un único módulo de constantes (`src/domain/config.js`).

---

## 7. Auth & Security (Dimension 5)

**Authentication:** correo + contraseña; sesión en servidor (id aleatorio de 32 bytes) en cookie `HttpOnly; SameSite=Strict; Secure` (Secure salvo en local). Caducidad por inactividad `SESSION_IDLE_HOURS`; cerrar sesión la invalida (INV-ACC-102). Bloqueo `LOGIN_MAX_FAILURES` / `LOGIN_LOCK_MINUTES`.
**Authorization:** una sola tabla de permisos en código derivada de `PERMISSIONS-MATRIX.md`, comprobada en la capa de casos de uso (no solo en la UI); filtro por propietario para el socio (INV-ACC-009).
**Encryption:** scrypt + sal; HTTPS lo aporta el proxy o la plataforma (TLS en tránsito); fichero de datos con permisos 0600. Sin cifrado en reposo adicional (aceptado: datos mínimos).
**Compliance:** RGPD básico: minimización y retención (REQ-NF-001).
**CSRF:** `SameSite=Strict` + comprobación de cabecera `Origin` en métodos que escriben + cuerpo solo JSON.
**Mensajes:** mismo error para correo desconocido y contraseña mala (SEC-007).

> `audits/` solo contiene la auditoría de specs; no hay SECURITY-AUDIT-BASELINE.

---

## 8. API Design (Dimension 6)

**Style:** JSON sobre HTTP, `POST /api/<operación>` por operación (los contratos son `operations`), `GET` para las de solo lectura. Errores `{ error: "E_…", mensaje }` con códigos de los contratos; estado HTTP 4xx según familia.
**Versioning:** ninguno (cliente y servidor se despliegan juntos).
**Documentation:** `spec/contracts/API-*.md` y `design/OPERATION-MAPPING.md`.
**Rate Limiting:** solo el bloqueo de inicio de sesión (INV-ACC-004).
**Idempotencia:** repetir cancelar, devolver, pagar, dar de baja no cambia nada (INV-RES-008).

---

## 9. Infrastructure (Dimension 7)

**Compute Model:** un único proceso Node (`npm run build` + `npm start` = `vite preview`) en una máquina o PaaS con disco persistente.
**Cloud Provider:** sin decidir (pendiente del club); el diseño solo exige disco persistente y HTTPS.
**IaC:** ninguna.
**Environments:** local (`npm run dev`, puerto 5173) y producción. Sin staging.

**Config per environment:**

| Variable / endpoint | Kind | Local | Producción | Notes |
|---------------------|------|-------|------------|-------|
| `DATA_FILE` | ruta | `data/store.json` | ruta en disco persistente | fichero fuera de `dist/` |
| `COOKIE_SECURE` | bool | `false` | `true` | tras HTTPS |
| `TZ_CLUB` | zona | `Europe/Madrid` | `Europe/Madrid` | `ZONA_HORARIA` |
| `/api/tareas-diarias` | endpoint de máquina | llamada directa | cabecera `x-cron-secret` | además de un `setInterval` interno en el proceso |
| `CRON_SECRET` | secreto | valor de prueba | secreto montado | solo para tareas diarias |
| `ENCARGADO_INICIAL_*` | secreto | semilla de desarrollo | variables al primer arranque | cuenta inicial del encargado (ver Supuestos) |

---

## 10. CI/CD Pipeline (Dimension 8)

**CI Platform:** cualquiera con Node 22: `npm ci`, `npm run lint`, `npm test`, `npm run build`, `npx playwright test`.
**Deployment Strategy:** directa (un proceso; reinicio breve aceptable).
**Branch Strategy:** trunk-based con commits atómicos por tarea (trailers `Refs:`/`Task:`).
**Post-deploy verification:** smoke `GET /api/salud` tras despliegue; sin staging, riesgo aceptado.

---

## 11. Observability (Dimension 9)

**Logging:** una línea JSON por petición y por error en stdout (operación, rol, código, ms); nunca contraseñas, hashes ni cuerpos.
**Monitoring:** `GET /api/salud` (sin datos de negocio).
**Alerting:** ninguna automática; la plataforma reinicia el proceso.
**Tracing:** no aplica.

---

## 12. Cost & Scaling (Dimension 10)

**Scaling Strategy:** vertical; una instancia.
**Estimated Monthly Cost:** 0-5 EUR (hosting mínimo con disco).
**Cost Optimization:** sin base de datos gestionada ni servicios externos.
**Límite conocido:** pasar a más de un proceso exige sustituir el almacén (el puerto `store` lo permite, p. ej. SQLite).

---

## 13. Developer Experience (Dimension 11)

**Repo Structure:** un solo paquete; `src/domain`, `src/server`, `src/ui`, `tests/unit`, `tests/e2e`.
**Tooling:** ESLint (`npm run lint`), Vitest con `maxWorkers: 2`, Playwright.
**Local Dev:** nativo, `npm run dev` (5173).

---

## 14. i18n & Accessibility (Dimension 12)

**i18n Strategy:** un solo idioma, español (REQ-C-001); textos de la interfaz en un único módulo `src/ui/textos.js` (facilita MNT-001).
**Accessibility Target:** WCAG 2.2 AA razonable (etiquetas, foco, contraste); detalle en `ux/` si se ejecuta.
**Languages Supported:** es-ES.

---

## 15. ADR Drafts

| ADR Draft | Decision | Status |
|-----------|----------|--------|
| `design/ADR-DRAFT-001-almacen-fichero-json.md` | almacén en fichero JSON tras un puerto | Draft — pending review |
| `design/ADR-DRAFT-002-api-en-middleware-de-vite.md` | API como middleware de Vite, un solo proceso | Draft — pending review |
| `design/ADR-DRAFT-003-sesion-servidor-y-cookie.md` | sesión en servidor con cookie HttpOnly | Draft — pending review |

---

## 16. Traceability

| Design Decision | Spec Source | ADR |
|----------------|------------|-----|
| SPA + API en un proceso | REQ-C-002, REQ-C-003 | draft 002 |
| Almacén en servidor, transacciones serializadas | REQ-C-003, INV-RES-004, INV-LOA-002 | ADR-002, draft 001 |
| Reloj inyectado | REQ-F-003..006 | ADR-001 |
| scrypt con sal | REQ-NF-001, INV-ACC-003 | draft 003 |
| Sesión servidor + cookie | REQ-F-001, INV-ACC-004..006, INV-ACC-102 | draft 003 |
| Permisos en capa de casos de uso | INV-ACC-008, INV-ACC-009, PERMISSIONS-MATRIX | — |
| Purga y no recogidas diarias | INV-LOA-006, INV-RES-007, API-003-07/08 | — |
| Textos en un módulo | REQ-C-001, MNT-001 | — |

---

## Supuestos

Valores razonables decididos sin preguntar (clase S/R); el cliente puede corregirlos.

1. La cuenta inicial del encargado se crea al primer arranque con variables de entorno; los specs no dicen cómo nace la primera cuenta. La junta la crea el encargado mediante un alta de socio con rol distinto: **no está cubierto por API-001-03** (crea solo rol socio); es un hueco de spec ya registrado como pregunta abierta (tema `alta-cuentas-encargado-junta`, Q-security-auditor-002). Mientras tanto se asume la semilla por configuración.
2. Las tareas diarias corren dentro del proceso (a las 00:05 de Europe/Madrid y al arrancar) y también por endpoint protegido; además, `resolverNoRecogidas` se aplica al leer (INV-RES-007 lo deriva), así que no depende de que la tarea haya corrido.
3. Un fichero JSON basta por el volumen del club; si se necesitan varios procesos se cambia el almacén.
4. Sin staging ni IaC: un club pequeño; riesgo aceptado.
5. Copia de seguridad diaria local, 7 copias.
