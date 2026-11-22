# UC-016 — Consultar historial de un socio

| Field | Value |
|---|---|
| Version | 1.0 / 2026-11-21 |
| Refs | REQ-F-010 (primary); WF-001 steps 4-7; API-003-10; INV-SEC-001, INV-SEC-002, INV-ACC-007; RN-005, RN-007; BDD-UC-016 |
| Actors | Primary: junta. Secondary: almacén |
| Trigger | La junta elige un socio para ver su historial |
| Priority / Status | Must / Approved |

La junta ve los préstamos y las multas de cualquier socio, solo de ese socio y sin poder cambiar nada.

## Input / Output

```typescript
interface ConsultarHistorialInput  { socioId: string }
interface ConsultarHistorialOutput {
  prestamos: { material: string; estado: EstadoReserva /* VO-006 */; inicio: Fecha; fin: Fecha }[];
  multas: { importe: Importe /* VO-008 */; estado: EstadoMulta /* VO-007 */ }[]
}
```

## Preconditions
1. Sesión válida de la junta (INV-ACC-007); sin sesión rige E_NO_AUTENTICADO / E_SESION_CADUCADA del contrato.

## Postconditions
- Success: historial del socio elegido, sin ningún dato de otros socios (INV-SEC-001); ningún dato cambia (INV-SEC-002).
- Failure: no se muestra ningún historial; error según la tabla.

## Main flow
1. Junta: elige un socio (API-003-10).
2. System: comprueba que el socio existe; un socio en Baja conserva su historial (RN-007).
3. System: devuelve solo los préstamos y multas de ese socio (INV-SEC-001).
4. System: muestra "Historial del socio" con cada préstamo y su estado ("Devuelto") y cada multa como "Multa {importe} € {estado}".
5. System: no ofrece ningún botón que cambie datos (INV-SEC-002).

## Extensions
- 4a. El socio no tiene préstamos ni multas → se muestra "Sin préstamos ni multas". (AC-016-03)

## Exceptions & errors

| # | Step | Condition | Error code | Effect | AC |
|---|---|---|---|---|---|
| E1 | 1 | la junta abre Entregar, Inventario o Reservar (INV-SEC-002) | `E_ACCESO_NO_PERMITIDO` | no se muestra la pantalla; nada cambia | AC-016-04 |
| E2 | 1 | rol socio (INV-SEC-001, INV-ACC-007) | `E_ACCESO_NO_PERMITIDO` | no se muestra ningún historial | AC-016-05 |
| E3 | 2 | el socio no existe | `E_SOCIO_NO_ENCONTRADO` | no se muestra historial | AC-016-06 |
| E4 | 3 | fallo del almacén (compartido, WF-001) | `E_ALMACEN_NO_DISPONIBLE` | no se muestra historial; se reintenta | AC-016-07 |
