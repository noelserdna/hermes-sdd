# UC-003 — Crear socio y listar socios

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-002 (primary); WF-002 step 5; API-001-04, API-001-05; INV-ACC-001, INV-ACC-002, INV-ACC-003, INV-ACC-007, INV-SEC-001, INV-SEC-003; RN-005, RN-006; ADR-003, ADR-005; BDD-UC-003 |
| Actors | Primary: encargado. Secondary: almacén |
| Trigger | El encargado envía el alta de un socio o abre Socios |
| Priority / Status | Must / Approved |

El encargado da de alta socios y ve la lista de Socios actualizada. Las cuentas de encargado y junta no se crean aquí (RN-006).

## Input / Output

```typescript
interface CrearSocioInput { nombre: string; correo: Correo /* VO-002, INV-ACC-001 */; contrasena: Contrasena /* VO-003, INV-ACC-002 */ }
interface SocioVista { nombre: string; correo: Correo; estado: 'Activa' | 'Baja' /* SM-004 */ }
interface ListarSociosOutput { socios: SocioVista[] }
```

## Preconditions
1. Sesión de rol encargado (INV-ACC-007).

## Postconditions
- Success: cuenta de rol socio Activa con la contraseña solo como hash (INV-ACC-003); la lista la incluye.
- Failure: no se crea ninguna cuenta (INV-SEC-003); error según la tabla.

## Main flow
1. Encargado: abre Socios.
2. System: lista nombre, correo y estado de cada socio (API-001-05, INV-SEC-001).
3. Encargado: envía nombre, correo y contraseña.
4. System: valida que los tres datos vienen informados.
5. System: valida la contraseña mínima (INV-ACC-002) y la unicidad del correo (INV-ACC-001).
6. System: guarda la cuenta de forma atómica (INV-SEC-003) y muestra la lista actualizada.

## Extensions
- 2a. Un socio dado de baja → aparece marcado "Baja". (AC-003-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 4 | Nombre, correo o contraseña vacíos o mal formados | `E_DATOS_INVALIDOS` | Lista sin cambios (RN-005) | AC-003-03 |
| E2 | 5 | Contraseña por debajo de `PASSWORD_MIN_LENGTH` | `E_CONTRASENA_CORTA` | No se crea la cuenta | AC-003-04 |
| E3 | 5 | Correo ya existente, también si es un envío repetido o simultáneo (INV-ACC-001) | `E_CORREO_DUPLICADO` | La lista conserva una sola cuenta con ese correo | AC-003-05 |
| E4 | 1, 3 | Rol distinto de encargado | `E_ACCESO_NO_PERMITIDO` | No se muestra ni cambia nada | AC-003-06 |
| E5 | 6 | Almacén no disponible (compartido, ver VO-010) | `E_ALMACEN_NO_DISPONIBLE` | No se crea la cuenta (INV-SEC-003); reintentar | AC-003-07 |

Sin sesión o con sesión caducada aplican `E_NO_AUTENTICADO` y `E_SESION_CADUCADA` de UC-002.
