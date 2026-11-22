# UC-012 — Ver mis multas

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-22 |
| Refs | REQ-F-006 (primary), REQ-F-005; WF-001 step 5; API-004-01, API-001-08; INV-SEC-001, INV-MUL-001, INV-MUL-002; RN-016, RN-020; SM-002; VO-008; E_ALMACEN_NO_DISPONIBLE; BDD-UC-012 |
| Actors | Primary: socio. Secondary: almacén de datos |
| Trigger | El socio abre "Mis multas" |
| Priority / Status | Must / Approved |

El socio ve sus propias multas con su estado, o que no tiene ninguna.

## Input / Output

```typescript
interface MyFinesInput  { /* cuenta de la sesión */ }
interface MyFinesOutput { fines: { amountEur: number; status: FineStatus /* VO-008 */ }[] }
```

## Preconditions
1. Sesión abierta de un socio (API-001-08).

## Postconditions
- Success: la lista contiene solo multas de la cuenta de la sesión (INV-SEC-001); nada cambia.
- Failure: sin datos de ninguna multa.

## Main flow
1. Socio: abre "Mis multas".
2. System: comprueba la sesión y el rol (API-001-08, RN-020).
3. System: lee las multas de su cuenta, solo las suyas (INV-SEC-001).
4. System: muestra una fila por multa con importe y estado, o "No tienes multas".

## Extensions
- 3a. La cuenta no tiene multas, aunque otro socio sí → mensaje de lista vacía. (AC-012-02, AC-012-03)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 2 | sesión de un rol distinto de socio | `E_PAGINA_PROHIBIDA` | no se muestra ninguna multa (RN-020) | AC-012-04 |

## Supuestos
- RN-030: solo el socio abre «Mis multas»; encargado y junta reciben `E_PAGINA_PROHIBIDA`.
