# Architecture — material-montana11

> Spec v1.0 · 2026-11-21 · Style: monolito modular en un proceso (ADR-DRAFT-001, ADR-001)
> Inputs: spec/ · design/ sí · ux/ sí · audits/ sí

## 1. Decisions

| Aspect | Decision | Ref |
|--------|----------|-----|
| Stack profile | JavaScript ESM + Vite + Vitest, sin kit | AGENTS.md |
| Runtime / language | Node 22, JS ES2022, sin dependencias nuevas de ejecución | REQ-C-001, design §5 |
| Topology | un proceso: SPA + API en el mismo puerto vía plugin de Vite | ADR-DRAFT-001 |
| Storage | fichero JSON único, escritura atómica y en cola | ADR-001, ADR-005, ADR-DRAFT-002 |
| Auth | correo + contraseña (scrypt), sesión opaca en cookie HttpOnly | ADR-003, INV-ACC-* |
| Error model | `E_*` con literal de VO-010 | ADR-004 |
| Time | reloj inyectable, días `AAAA-MM-DD`, zona Europe/Madrid | ADR-002 |
| Primer encargado | `npm run seed` | D-PA-001 |
| Rutas de sistema | `marcarNoRecogidas` y `aplicarMultaPorRetraso` son funciones internas, sin ruta HTTP | D-PA-003 |

## 2. C4 Views

### 2.1 System Context (L1)

```
 socio ─┐
 encargado ─┼─ navegador ──HTTPS (proxy del club)──> material-montana11 ──> data/almacen.json
 junta ─┘
```

| Element | Type | Interaction | Ref |
|---------|------|-------------|-----|
| socio | Person | reserva, ve y cancela lo suyo, ve sus multas | UC-005..007, UC-011 |
| encargado | Person | cuentas, inventario, préstamos, multas | UC-003, 004, 008..010, 012..015 |
| junta | Person | consulta historial, solo lectura | UC-016 |
| sistemas externos | — | ninguno | EVENTS-sistema |

### 2.2 Containers (L2)

```
 Navegador: SPA src/ui  --POST|GET /api/<op>, cookie sid-->  Proceso Node (vite dev | preview)
                                                              plugin -> dominio puro -> store -> almacen.json
```

| Container | Technology | Purpose | Ref |
|-----------|-----------|---------|-----|
| SPA | JS vanilla, hash router | pantallas por rol | ux/WIREFRAMES.md |
| Servidor | plugin Vite + `node:http` | parsea, sesión, formato de respuesta | OPERATION-MAPPING |
| Almacén | JSON + cola de promesas | persistencia atómica | ADR-005 |

### 2.3 Components (L3)

```
src/domain/ errores · reloj · validacion · permisos · cuentas · reservas · prestamos · multas · inventario
src/server/ plugin · store · sesiones · hash · purga          scripts/seed.js
src/ui/     main · router · api · textos · componentes · pantallas/{entrar,inicio,socios,inventario,...}
```

| Component | Responsibility | Interfaces | FASE |
|-----------|----------------|------------|------|
| `domain/errores.js` | catálogo VO-010 | `E_*` | 0 |
| `domain/reloj.js` | `hoy()`, `ahora()`, `CLOCK_FIXED` solo fuera de producción | ADR-002 | 0 |
| `domain/permisos.js` | rol → operaciones (PERMISSIONS-MATRIX) | INV-ACC-007 | 0 (crece cada FASE) |
| `domain/cuentas.js` | sesión y cuentas | API-001-01..07 | 0, 5 |
| `domain/inventario.js` | unidades | API-004-01..03 | 1, 5 |
| `domain/reservas.js` | disponibilidad y reservas | API-002-01..04 | 1, 2 |
| `domain/prestamos.js` | entrega, devolución, consultas, no recogidas | API-003-01..04, 09, 10 | 2, 3, 6 |
| `domain/multas.js` | multa y pago | API-003-05..08 | 3, 4 |
| `server/store.js` | `transaccion(fn)`, fallo inyectable | INV-SEC-003 | 0 |
| `server/plugin.js` | una ruta por operación | OPERATION-MAPPING | 0 (crece) |
| `server/purga.js` | retención 2 años al arrancar | RN-010 | 6 |

## 3. Deployment

```
 desarrollo: npm run dev (127.0.0.1:5173)     producción: npm run build && npm start (0.0.0.0:4173) tras proxy HTTPS
 DATA_FILE en volumen persistente (0600); data/ en .gitignore
```

| Environment | Purpose | Infrastructure | Entry |
|-------------|---------|----------------|-------|
| Development | local, e2e | Node + Vite | `npm run dev` |
| Production | club | un proceso con disco persistente (ADR-DRAFT-003) | `npm start` |

Pipeline: `lint → test → build → playwright` (sin CI de plataforma decidida).

## 4. Data Model

Documento `{ version, contadores, cuentas, unidades, reservas, multas, sesiones }` (ENT-001..005); sin SQL. Búsquedas lineales en memoria; sin índices (cientos de filas).

| Data | Store | Format | Retention |
|------|-------|--------|-----------|
| cuentas (hash scrypt + sal) | almacen.json | objeto con `estado` Activa/Baja | `RETENTION_YEARS` desde la última actividad |
| unidades, reservas, multas | almacen.json | listas con `id` por contador | idem |
| sesiones | almacen.json | `sid` opaco, `ultimaActividad` | hasta caducar |

Migración: `migrar(version)` al cargar; el `.tmp` residual se ignora. Escritura: copia → validar → `.tmp` + fsync + rename; cola de promesas serializa (ADR-005).

## 5. Integration Map

No hay sistemas externos: `contracts/` no lista ninguno.

## 6. Security & Error Handling

```
petición -> límite 16 KB + Content-Type -> sesión (cookie) -> permisos (rol) -> validación VO -> dominio en transacción -> {ok|codigo}
```

| Data class | At rest | In transit | Access control | Ref |
|-----------|---------|-----------|----------------|-----|
| contraseña | hash scrypt + sal | HTTPS por proxy | nunca devuelta ni registrada | ADR-003, SPEC-SEC-003/006 |
| datos de socio | JSON 0600 | HTTPS | dueño, encargado, junta | INV-SEC-001, REQ-NF-001 |
| sesión | `sid` de 32 bytes en el almacén | cookie HttpOnly SameSite=Strict | caduca a 30 min | INV-ACC-005 |

Cabeceras: `nosniff`, `Cache-Control: no-store` en `/api`, CSP `default-src 'self'`; la UI usa `textContent`. Mapeo error → HTTP en OPERATION-MAPPING; el orden es sesión, rol, validación (D-T-006).

## 7. Quality Attributes

| Attribute | Target | Strategy | Ref |
|-----------|--------|----------|-----|
| Security | 0 datos ajenos, 0 contraseñas legibles | filtro por dueño + hash | REQ-NF-001 |
| Reliability | nunca dos reservas de una unidad | transacción en cola | INV-RES-001 |
| Testability | sin fecha real | reloj y almacén inyectables | ADR-002, R-1, R-2 |
| Scalability | club pequeño | vertical; salida a SQLite tras la interfaz `store` | ADR-DRAFT-002 |

---

> Generated by sdd-plan-architect | Spec v1.0 | 2026-11-21
