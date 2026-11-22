# UC-002 — Salir

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-001 (primary); API-001-02, API-001-08; INV-SOC-005, INV-SEC-001; RN-003, RN-020; E_ALMACEN_NO_DISPONIBLE (fallo de almacén compartido, mensaje en VO-010); BDD-UC-002 |
| Actors | Primary: socio, encargado o junta. Secondary: almacén de datos |
| Trigger | El usuario pulsa "Salir" |
| Priority / Status | Must / Approved |

El usuario cierra su sesión y deja de ver datos privados, también al volver atrás.

## Input / Output

```typescript
interface LogoutInput  { /* sesión actual */ }
interface LogoutOutput { shown: 'Entrar' }
```

## Preconditions
1. Ninguna: salir sin sesión no falla (E1).

## Postconditions
- Success: sesión invalidada en el servidor (RN-003); se muestra el formulario Entrar; las páginas privadas no se reutilizan al volver atrás. (AC-002-01)
- Failure: la sesión sigue abierta hasta caducar (INV-SOC-005).

## Main flow
1. Usuario: pulsa "Salir".
2. Sistema: invalida la sesión (API-001-02, RN-003).
3. Sistema: muestra el formulario Entrar.
4. Usuario: vuelve atrás con el navegador; Sistema: exige sesión para toda página privada (API-001-08, RN-020).

## Extensions
- 4a. el usuario vuelve atrás → se muestra Entrar sin datos de socios. (AC-002-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | replay: Salir sin sesión o repetido | `—` | se muestra Entrar; sin cambios | AC-002-03 |
| E2 | 4 | sesión ya invalidada al volver atrás | `—` | se muestra Entrar (RN-020, INV-SEC-001) | AC-002-02 |
