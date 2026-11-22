# UC-015 — Ver lo prestado y lo que vuelve cada día

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-009 (primary); WF-001 steps 4-5; API-003-09; INV-ACC-007, INV-SEC-001, INV-LOA-003; RN-002, RN-009; BDD-UC-015 |
| Actors | Primary: encargado. Secondary: almacén |
| Trigger | El encargado abre Prestado |
| Priority / Status | Must / Approved |

El encargado ve el material fuera del almacén, de quién es y hasta cuándo, y lo que vuelve el día que elige. Los retrasos salen marcados.

## Input / Output

```typescript
interface ConsultarPrestadoInput  { dia?: Fecha /* VO-001; por defecto Hoy */ }
interface ConsultarPrestadoOutput {
  prestamos: { material: string; socio: string; fin: Fecha; retrasoDias?: number /* RN-009 */ }[];
  vuelvenEseDia: string[] /* material con fin = dia */
}
```

## Preconditions
1. Sesión válida del encargado (INV-ACC-007); sin sesión rige E_NO_AUTENTICADO / E_SESION_CADUCADA del contrato.

## Postconditions
- Success: lista de préstamos (reservas Entregado) sin cambiar ningún dato; operación de solo lectura.
- Failure: no se muestra ningún dato (INV-SEC-001); error según la tabla.

## Main flow
1. Encargado: abre Prestado (API-003-09).
2. System: lista cada préstamo como "{material} — {socio} — hasta {fecha}".
3. System: marca "Retrasado {n} día" en los préstamos con `fin` anterior a Hoy (RN-002, RN-009).
4. Encargado: elige un día.
5. System: muestra bajo "Vuelven hoy" el material cuyo `fin` es el día elegido, y no el resto.

## Extensions
- 2a. Ningún préstamo → se muestra "No hay material prestado". (AC-015-04)
- 3a. Préstamo con retraso → se muestra "Retrasado {n} día" junto al material. (AC-015-03)
- 5a. Día elegido sin devoluciones → "Vuelven hoy" queda vacío. (AC-015-02)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 1 | socio o junta (INV-ACC-007) | `E_ACCESO_NO_PERMITIDO` | no se muestra ningún préstamo | AC-015-05 |
| E2 | 4 | día mal formado (VO-001) | `E_DATOS_INVALIDOS` | se conserva la lista anterior | AC-015-06 |
| E3 | 2 | fallo del almacén (compartido, WF-001) | `E_ALMACEN_NO_DISPONIBLE` | no se muestra la lista; se reintenta | AC-015-07 |
