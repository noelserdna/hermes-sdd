# Plan de implementación — material-montana10

> Generado por sdd-plan-architect · spec v1.0 (audit gate CONDITIONAL) · Fecha: 2026-11-21 · Modo: global
> **Plan-Style:** vertical
> Inputs: spec v1.0 · design/ sí · ux/ sí · audits/ sí

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-11-21 | Plan inicial: 4 FASEs (viajes: reservar · cuidar y entregar · devolver y multar · socios y datos) |

---

## 1. Resumen

Web de préstamo de material del club: SPA de JS vanilla servida por Vite con una API JSON como middleware del mismo proceso (ADR-DRAFT-002), dominio puro con reloj y almacén inyectados (ADR-001, ADR-002) y datos en un fichero JSON compartido (ADR-DRAFT-001). Cada FASE es un viaje que se ve funcionando en su Demo.

| FASE | Incremento | Requisitos | Depende de |
|------|-----------|------------|------------|
| FASE-0-SKELETON | El encargado deja material en el inventario; un socio entra y reserva unas fechas; sigue ahí al recargar y desde otro navegador | REQ-F-001, REQ-F-003, REQ-F-008 | — |
| FASE-1-ENTREGA | El socio cancela sus reservas y ve sus multas (Mis reservas mínima ya está en FASE-0); el encargado entrega y ve lo prestado y lo que vuelve | REQ-F-004, REQ-F-005, REQ-F-009 | FASE-0 |
| FASE-2-DEVOLUCION | El encargado marca devoluciones y multas y las cobra; la junta consulta el historial | REQ-F-006, REQ-F-007, REQ-F-010 | FASE-1 |
| FASE-3-SOCIOS | El encargado da de alta y de baja socios y restablece contraseñas; los datos personales se borran cuando ya no hacen falta | REQ-F-002, REQ-NF-001 | FASE-2 |

Los 9 requisitos Must y los 2 Should quedan asignados una sola vez (P-WHOLE). REQ-C-001/002/003 son criterios de toda FASE (R7). No hay NFR medido de rendimiento: sin FASE HARDENING.

## 2. Contexto técnico

| Aspecto | Decisión | Ref |
|---------|----------|-----|
| Lenguaje / stack | JavaScript ESM + Vite ^6 + Vitest ^2 (maxWorkers 2); Node 22 | REQ-C-002, AGENTS.md |
| Servidor | `node:http` como middleware de Vite (`vite dev` y `vite preview`), un proceso | ADR-DRAFT-002 |
| Almacén | `data/store.json` tras puerto `store`; `transaction(fn)` serializada; escritura atómica | ADR-DRAFT-001, ADR-002 |
| Reloj | fecha natural Europe/Madrid, inyectado; parámetro de arranque de pruebas | ADR-001, TEST-PLAN R-1 |
| Sesión | servidor, cookie `HttpOnly; SameSite=Strict`, scrypt con sal | ADR-DRAFT-003 |
| Frontend | SPA vanilla, rutas por hash, textos en `src/ui/textos.js` | TECHNICAL-DESIGN §5, REQ-C-001 |
| Constantes | un módulo `src/domain/config.js` desde `VALUE-REGISTRY.md` | VALUE-REGISTRY |
| Transporte | `POST/GET /api/<operación>` según `design/OPERATION-MAPPING.md` | OPERATION-MAPPING |
| Tareas diarias | `setInterval` interno + `POST /api/tareas-diarias` con `x-cron-secret` | API-003-07/08 |
| Cuentas encargado y junta | las prepara quien instala con `npm run cuentas`; ninguna API las crea ni les cambia la contraseña | D-PA-003 |

### 2.3 Integraciones externas

Ninguna. Sin puertos con doble hacia terceros (no hay `CONTRACT-*`).

## 3. Módulos

```
 ui (src/ui) --fetch--> server (src/server: http, sesiones, store) --> domain (src/domain)
                                                                           |
 domain: config · reloj · errores · permisos · acceso · socios · inventario
         · reservas · prestamos · tareas         --> store (puerto)
```

| Módulo | Responsabilidad | FASE |
|--------|-----------------|------|
| `domain/{config,reloj,errores,permisos}` | constantes, reloj, catálogo VO-010, PERMISSIONS-MATRIX | 0 |
| `domain/acceso` + `server/sesiones` | login, bloqueo, caducidad, salir, sesión por petición | 0 |
| `domain/inventario`, `domain/reservas` | UC-008, UC-003/004 | 0, 1 |
| `domain/prestamos`, `domain/tareas` | UC-005..007, 009, 010; no recogidas; purga | 1, 2, 3 |
| `domain/socios` | UC-002 | 3 |
| `ui/pantallas/*` | SCR-001..008 | 0..3 |

## 4. Preocupaciones transversales

- **Autenticación y roles (R6):** `permisos.js` (PERMISSIONS-MATRIX) se comprueba en el caso de uso, no solo en la UI; la precedencia de errores es sesión > rol > validación > estado (D-T-009). Los tres roles existen desde FASE-0 (AC-001-12); cada pantalla llega con su primera capacidad.
- **Baja con sesión abierta (cliente, Q-spec-auditor-001):** cada petición vuelve a leer la cuenta; si no está Activa la sesión no vale al instante y `darDeBajaSocio` borra sus sesiones en la misma transacción (D-PA-004).
- **Errores:** `{ error: "E_…", mensaje }` con el catálogo VO-010 y HTTP 4xx por familia (OPERATION-MAPPING).
- **Observabilidad:** una línea JSON por petición sin cuerpos ni credenciales; `GET /api/salud`.
- **Textos:** todo en `src/ui/textos.js` (REQ-C-001, MNT-001). Nada de negocio en `localStorage`/`sessionStorage` (REQ-C-003, MNT-003).

## 5. Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| FASE-0 es grande (3 UC y toda la infraestructura) | un solo bloque serial; el esqueleto mínimo es login + inventario + reservar; se corta por orden de tareas |
| Carreras en la última unidad (INV-RES-004) | `transaction(fn)` serializada; test `race` AC-003-10 |
| Fichero JSON corrupto o perdido | escritura atómica + 7 copias diarias; sin staging, riesgo aceptado |
| Cambios del encargado no vistos por otros clientes | un solo almacén en servidor; INT-T-001 con dos contextos |

## 6. Quickstart (Stack Profile)

```
npm ci
npm run cuentas -- --encargado e@club.es --junta j@club.es   # lo hace quien instala (pide contraseña por entorno)
npm run dev            # http://127.0.0.1:5173
npm test               # vitest run --maxWorkers=2
npm run lint
npx playwright test    # aceptación; reloj fijo por parámetro de arranque
npm run build && npm start
```

## 7. Validación y trazabilidad

### Supuestos de este plan

Ver `CLARIFY-LOG.md` (D-PA-001..008). Destacan D-PA-003 (cuentas de encargado/junta), D-PA-004 (baja = sesión cortada al instante) y D-PA-005 (borrado de datos personales).

### Spec Gaps Detected

| Gap | Recomendación |
|-----|---------------|
| El borrado de nombre y correo de un socio en Baja cuando ya no hay préstamos ni multas (decisión del cliente Q-security-auditor-001) no está en INV-LOA-006 ni en RN-013 | `sdd-req-change`/spec-auditor Mode Fix: añadir INV y RN; el plan lo implementa en FASE-3 (D-PA-005) |
| El corte inmediato de sesión al dar de baja (Q-spec-auditor-001) no tiene escenario BDD | spec-auditor Mode Fix: añadir `AC-002-13`; hasta entonces FASE-3 lo cubre con un test unitario sin id AC |
| `TECHNICAL-DESIGN.md` Supuesto 1 dice que el encargado crea la cuenta de junta; el cliente decidió lo contrario (D-PA-003) | corregir el diseño; el plan sigue la decisión del cliente |
| Correo único «también de baja» (RN-014) choca con el borrado: el correo queda libre tras purgar | aclarar en el mismo cambio de spec |

### UC → FASE

| UC | FASE | | UC | FASE |
|----|------|-|----|------|
| UC-001, UC-003, UC-008 | 0 (con SCR-002 mínima) | | UC-006, UC-007, UC-010 | 2 |
| UC-004, UC-005, UC-009 | 1 | | UC-002 | 3 |

### ADR / NFR / INV

| Elemento | Estrategia |
|----------|-----------|
| ADR-001 | `reloj.js` inyectado en todo caso de uso (FASE-0) |
| ADR-002 | `store.transaction` en toda escritura; INV-RES-004, INV-LOA-002 dentro de la transacción |
| SEC-001..007 | scrypt, bloqueo, caducidad, permisos y mensajes únicos: FASE-0; revocación por baja: FASE-3 |
| REQ-NF-001 / LIM-004..005 | scrypt desde FASE-0 (AC1); purga y borrado de datos personales en FASE-3 (AC2) |
| INV-ACC-* | FASE-0 (001..006, 008, 009, 102), FASE-3 (007, 103) |
| INV-RES-*, INV-STK-* | FASE-0 (RES-001..005, 008, STK), FASE-1 (RES-006, 007) |
| INV-LOA-* | FASE-1 (001, 002, 301, 401), FASE-2 (003..005, 402), FASE-3 (006) |

### Validation Report

| Check | Status | Cobertura |
|-------|--------|-----------|
| V1 UC | PASS | 10/10 UC con guía en un PLAN-FASE |
| V2 ADR | PASS | ADR-001/002 y drafts 001..003 en ARCHITECTURE §1 |
| V3 NFR | PASS | SEC, LIM, MNT en §4 y §7 |
| V4 INV | PASS | tabla INV → FASE |
| V5 FASE | PASS | 4 FASEs, 4 PLAN-FASE |
| V6 decisiones | PASS | D-PA-001..008 citadas |
| V7 mapeo | PASS | todas las operaciones con fila en `design/OPERATION-MAPPING.md` |
| V8 respaldo | ver lint | `sdd lint --plan` |
| V9 Must | ver lint | `sdd lint --plan` |

> Revisión: «Mis reservas» mínima (solo lectura, SCR-002) entregada en FASE-0 para que los criterios de REQ-F-001 y REQ-F-003 se puedan comprobar; FASE-1 la completa con Cancelar y multas (D-PA-009, clase R).

Plan validation: PASS
