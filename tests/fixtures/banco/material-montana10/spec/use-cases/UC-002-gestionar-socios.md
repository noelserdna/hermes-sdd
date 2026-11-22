# UC-002 — Gestionar socios

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-002 (primary), REQ-F-001; API-001-03, API-001-04, API-001-05, API-001-06; INV-ACC-001, INV-ACC-002, INV-ACC-003, INV-ACC-006, INV-ACC-007, INV-ACC-008, INV-ACC-103; RN-010, RN-014, RN-016, RN-021; BDD-UC-002 |
| Actors | Primary: Encargado. Secondary: Socio afectado |
| Trigger | El encargado abre Socios y envía un alta, una baja o un restablecimiento |
| Priority / Status | Should / Approved |

El encargado mantiene las cuentas de los socios: las da de alta, de baja y restablece su contraseña.

## Input / Output

```typescript
interface CrearSocioInput { nombre: string; correo: Correo /* VO-002, INV-ACC-001 */; contrasena: string /* INV-ACC-002 */ }
interface RestablecerInput { cuentaId: number; contrasena: string /* INV-ACC-002 */ }
interface SocioFila { id: number; nombre: string; correo: Correo; estado: 'Activa' | 'Baja' } // sin hash (INV-ACC-003)
// darDeBajaSocio(cuentaId): SocioFila · listarSocios(): SocioFila[]
```

## Preconditions
1. Sesión vigente con rol Encargado (INV-ACC-008, RN-016).

## Postconditions
- Success: cuenta creada Activa, en Baja, o con contraseña nueva (INV-ACC-103); la lista de Socios lo refleja.
- Failure: ninguna cuenta cambia (INV-ACC-001, INV-ACC-002, INV-ACC-007); error según la tabla.

## Main flow
1. Encargado: abre Socios.
2. System: lista nombre, correo y estado de los socios (API-001-06).
3. Encargado: envía nombre, correo y contraseña inicial.
4. System: normaliza el correo (RN-014); valida contraseña (INV-ACC-002) y correo único (INV-ACC-001).
5. System: crea la cuenta Activa con rol socio y solo su hash (INV-ACC-003); aparece en la lista. (AC-002-01)

## Extensions
- 3a. Encargado pide la baja → System comprueba INV-ACC-007 (RN-010), deja la cuenta en Baja (INV-ACC-006) y la lista muestra "Baja". (AC-002-04)
- 3b. Encargado envía nueva contraseña → System la valida y sustituye la anterior (INV-ACC-103); muestra "Contraseña restablecida". (AC-002-06)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 1 | la cuenta no es Encargado y abre Socios directamente | `E_SIN_PERMISO` | no se muestra la lista ni se cambia nada | AC-002-07 |
| E2 | 4 | correo ya existente (incluido replay del alta) | `E_CORREO_DUPLICADO` | no se crea cuenta; la lista sigue igual | AC-002-02 |
| E3 | 4 | contraseña de menos de `PASSWORD_MIN_LENGTH` en el alta | `E_CONTRASENA_CORTA` | no se crea cuenta | AC-002-03 |
| E4 | 3b | contraseña corta al restablecer | `E_CONTRASENA_CORTA` | la contraseña vigente no cambia | AC-002-08 |
| E5 | 3a | socio con préstamo Prestado o multa Pendiente | `E_BAJA_SOCIO_BLOQUEADA` | la cuenta sigue Activa | AC-002-05 |
| E6 | 4 | dos altas simultáneas con el mismo correo | `E_CORREO_DUPLICADO` | una cuenta creada; la otra rechazada | AC-002-09 |
| E7 | 3a | replay: baja de una cuenta ya en Baja | `—` | sigue en Baja, sin cambios | AC-002-10 |
| E8 | 3b | replay: misma contraseña nueva otra vez | `—` | "Contraseña restablecida"; sigue vigente | AC-002-11 |
| E9 | 4 | nombre vacío o correo sin formato válido (RN-021) | `E_DATOS_SOCIO_INVALIDOS` | no se crea cuenta | AC-002-12 |
