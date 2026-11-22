# Quality Attributes — material-montana10

> Generado por `/sdd-tech-designer` el 2026-11-21
> Method: ATAM-lite (simplified Architecture Tradeoff Analysis)

---

## Attribute Scores

| ID | Attribute | Score (1-5) | Evidence | Spec Source |
|----|-----------|-------------|----------|-------------|
| QA-01 | Performance | 2 | ningún NFR de rendimiento; decenas de peticiones por hora | `spec/nfr/` (sin PERF) |
| QA-02 | Security | 5 | hash con sal, bloqueo, caducidad, permisos por rol, datos mínimos | SEC-001..007, INV-ACC-001..009 |
| QA-03 | Scalability | 1 | un club; un solo proceso | REQ-C-003 |
| QA-04 | Reliability | 5 | sin doble reserva ni doble asignación de unidad; idempotencia | ADR-002, INV-RES-004, INV-RES-008, INV-LOA-002 |
| QA-05 | Maintainability | 4 | stack fijo, textos en español centralizados | MNT-001..003 |
| QA-06 | Usability | 4 | pantallas por rol, móvil para el socio | RN-015, RN-016 |
| QA-07 | Testability | 5 | reloj inyectado, almacén en memoria, Vitest | ADR-001, LIM-004 |
| QA-08 | Deployability | 3 | un proceso con disco persistente | REQ-C-003 |
| QA-09 | Cost Efficiency | 5 | sin servicios gestionados | alcance de club |
| QA-10 | Portability | 3 | Node 22 en cualquier host con disco | MNT-002 |

## Trade-off Matrix

| When | Conflicts With | Decision | Rationale |
|------|---------------|----------|-----------|
| Reliability (5) | Scalability (1) | Reliability | mutex en proceso garantiza ADR-002; no hay multiproceso |
| Cost Efficiency (5) | Deployability (3) | Cost | fichero JSON y un proceso en vez de base gestionada; hace falta disco persistente |
| Testability (5) | Performance (2) | Testability | capas y puerto `store` añaden indirección irrelevante a este volumen |

## Scenarios

### QA-04-S1: Dos reservas de la última unidad

**Stimulus:** dos socios reservan a la vez el último casco para las mismas fechas
**Source:** dos navegadores
**Environment:** funcionamiento normal
**Response:** una reserva se crea; la otra recibe `E_SIN_UNIDADES_LIBRES`
**Measure:** 0 sobre-reservas en un test con 2 peticiones concurrentes

### QA-02-S1: Fuerza bruta

**Stimulus:** 6 intentos con contraseña errónea
**Source:** atacante
**Environment:** cuenta activa
**Response:** bloqueo `LOGIN_LOCK_MINUTES` y mismo mensaje de error que correo desconocido
**Measure:** 0 aciertos durante el bloqueo

### QA-04-S2: Caída durante escritura

**Stimulus:** el proceso muere al guardar
**Source:** fallo del host
**Environment:** operación de escritura en curso
**Response:** al arrancar el fichero es el estado previo o el nuevo, nunca parcial
**Measure:** fichero siempre JSON válido (escritura temporal + rename)

### Analysis

| Architecture Decision | Impact | Notes |
|----------------------|--------|-------|
| Transacciones serializadas | Positive (QA-04) / Negative (QA-03) | cuello de botella aceptado |
| Fichero JSON tras puerto `store` | Positive (QA-09, QA-07) / Negative (QA-03) | sustituible por una base embebida |
| Sesión en servidor | Positive (QA-02) | revocación inmediata (INV-ACC-102) |
| API como middleware de Vite | Positive (QA-05, QA-08) / Neutral | `vite preview` no es un servidor de producción endurecido (ver recomendaciones) |

## Sensitivity Points

| Decision | Affects | Sensitivity |
|----------|---------|-------------|
| Mutex global en proceso | QA-03, QA-04 | High |
| Reloj inyectado | QA-04, QA-07 | High |
| Almacén en fichero | QA-03, QA-08 | Medium |

## Trade-off Points

| Decision | Improves | Degrades | Resolution |
|----------|----------|----------|-----------|
| Un solo proceso | QA-04, QA-09 | QA-03 | puerto `store` para migrar si crece |
| Sin framework de UI | QA-05 (menos dependencias) | QA-06 (más trabajo manual) | pocas pantallas; revisar en plan |

## Recommendations

1. Fijar en el plan que `vite preview` se usa tras un proxy HTTPS y que la API valida `Origin`; si `preview` limita cabeceras, servir `dist/` con un `node:http` propio.
2. Test de concurrencia (2 reservas simultáneas) obligatorio para ADR-002.
3. Test que lea `package.json` (MNT-002) y busque `localStorage`/`sessionStorage` (MNT-003).
