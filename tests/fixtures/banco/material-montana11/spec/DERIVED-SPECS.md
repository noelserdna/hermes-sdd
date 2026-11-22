# Especificaciones derivadas

> Artefactos que no se rastrean literalmente a un REQ. Tier 1 = comportamiento nuevo visible (necesita REQ o aceptación explícita). Tier 2 = detalle técnico derivado de un REQ. Tier 3 = cosmético (no se registra).

| Métrica | Valor | Umbral | Estado |
|---|---|---|---|
| Tier 1 pendiente de REQ | 1 | ≤ 3 | PASS |
| Tier 1 aceptado sin REQ | 1 | — | Aviso |
| Tier 2 registrado | 9 filas | — | Info |

## Derivado por el ingeniero de especificaciones

| Artefacto | Tipo | Derivado de | Tier | Justificación | Estado |
|---|---|---|---|---|---|
| RN-006 cuentas de encargado y junta cargadas al desplegar | Regla | REQ-F-001, REQ-F-002 | 1 | nadie las crea desde la web | ACEPTADA (RN-006) |
| RN-010 purga automática a `RETENTION_YEARS` | Regla | REQ-NF-001 | 1 | purga no pedida como función | **[PENDING REQ]** |
| INV-ACC-001..007, INV-SEC-001..003 | Invariantes | REQ-F-001, REQ-F-002, REQ-NF-001 | 2 | formalizan acceso y datos | Registrado |
| INV-RES-001..007, INV-LOA-001..004 | Invariantes | REQ-F-003..REQ-F-005 | 2 | formalizan reservas y entregas | Registrado |
| INV-FIN-001..004, INV-STK-001..005 | Invariantes | REQ-F-006..REQ-F-008 | 2 | formalizan multas e inventario | Registrado |
| filas `E_ALMACEN_NO_DISPONIBLE` en UC-001..UC-016 | Flujo de excepción | REQ-C-003 | 2 | fallo del almacén compartido | Registrado |
| filas `replay` en UC escritores | Flujo de excepción | REQ-F-001..REQ-F-008 | 2 | repetir una escritura (RN-011, RN-016) | Registrado |
| filas de acceso `E_ACCESO_NO_PERMITIDO` / `E_NO_AUTENTICADO` | Flujo de excepción | REQ-NF-001 | 2 | rol y sesión por operación | Registrado |
| RN-012..RN-015 (inicio de la junta, sesiones tras baja o reinicio, Mis multas) | Reglas | REQ-F-001, REQ-F-002, REQ-F-006 | 2 | detalle que el requisito deja abierto | Registrado |
| ADR-001..ADR-005 | Decisiones | REQ-C-001..REQ-C-003, REQ-NF-001 | 2 | almacén, reloj, hash, errores, atomicidad | Registrado |

## Derivado por auditoría
None.

## Registro de resolución
None.
