# Arquitectura — material-montana10

> Inputs: spec v1.0 · design/ sí · ux/ sí · audits/ sí · Fecha 2026-11-21

## 1. Decisiones

| Aspecto | Decisión | Ref |
|---------|----------|-----|
| Reloj | «hoy» = fecha natural Europe/Madrid, inyectado | ADR-001 |
| Concurrencia | un único almacén; operaciones indivisibles por tipo | ADR-002 |
| Persistencia | fichero JSON tras puerto `store` | ADR-DRAFT-001 |
| API | middleware de Vite, un proceso | ADR-DRAFT-002 |
| Sesión | servidor + cookie HttpOnly, scrypt | ADR-DRAFT-003 |
| Cuentas privilegiadas | preparadas por quien instala | D-PA-003 |
| Baja = sesión cortada | relectura de cuenta por petición | D-PA-004 |
| Borrado de datos personales | purga de cuentas en Baja sin registros | D-PA-005 |

## 2. Vistas C4

### 2.1 Contexto (L1)

```
 socio / encargado / junta (navegador) --HTTPS, cookie--> material-montana10 (un proceso Node)
 quien instala --npm run cuentas--> data/store.json
```

### 2.2 Contenedores (L2)

```
 +--------------------- proceso Node (Vite dev | preview) ---------------------+
 | SPA src/ui  --fetch /api/*-->  src/server/http.js --> sesiones --> permisos |
 |                                      |                                      |
 |                               src/domain/* (puros; reloj + store inyectados)|
 |   tareas diarias (00:05 y al arrancar)                  |                   |
 +---------------------------------------------------------|-------------------+
                                                    data/store.json (+ backups/)
```

| Contenedor | Tecnología | Ref |
|------------|-----------|-----|
| SPA | JS ESM vanilla, hash routes | D-PA-002 |
| API | `node:http` en middleware Vite | ADR-DRAFT-002 |
| Almacén | JSON + rename atómico | ADR-DRAFT-001 |

### 2.3 Componentes (L3)

| Componente | Responsabilidad | Interfaces | FASE |
|------------|-----------------|------------|------|
| `server/http.js` | rutas, Origin, errores, log | OPERATION-MAPPING | 0 |
| `server/sesiones.js` | alta/baja/caducidad, relectura de cuenta | API-001-01/02 | 0, 3 |
| `server/store.js` | `load`, `transaction`, fallo inyectable | puerto `store` | 0 |
| `domain/acceso` | login, bloqueo, salir | API-001-01/02 | 0 |
| `domain/inventario` | unidades | API-004-01..03 | 0 |
| `domain/reservas` | reservar, listar, cancelar, derivar No recogida | API-002-01..03 | 0, 1 |
| `domain/prestamos` | entregar, devolver, multas, listados, historial | API-003-01..06 | 1, 2 |
| `domain/tareas` | no recogidas, purga | API-003-07/08 | 1, 3 |
| `domain/socios` | alta, baja, restablecer, listar | API-001-03..06 | 3 |

## 3. Despliegue

Un proceso (`npm run build` + `npm start`) con disco persistente; HTTPS en el proxy; `DATA_FILE`, `COOKIE_SECURE`, `CRON_SECRET`, `CLOCK_FIXED` (solo pruebas). Sin staging.

## 4. Modelo de datos físico

Colecciones de `store.json` = ENT-001..005 (`cuentas`, `unidades`, `reservas`, `multas`, `sesiones`) más `schemaVersion`. Fechas `YYYY-MM-DD`.

| Colección | Índices lógicos (consultas de UC) |
|-----------|-----------------------------------|
| reservas | por socio (UC-004), por tipo y rango (INV-RES-004), por estado y fecha (UC-009) |
| multas | por socio y estado (INV-RES-005, UC-007) |
| cuentas | por correo normalizado (INV-ACC-001) |

Migración: `schemaVersion` y una función por versión al cargar; ≤ 5 líneas por cambio.

## 5. Seguridad

scrypt + sal (SEC-001); sesión de 32 bytes aleatorios, caducidad por inactividad (SEC-004); permisos por rol en el caso de uso (SEC-005); `Origin` en escrituras; mismo error en el acceso (SEC-007); datos mínimos (SEC-006); fichero 0600.

## 6. Calidad

Integridad y testabilidad sobre escalabilidad (QUALITY-ATTRIBUTES): un proceso, dominio puro, reloj inyectado.
