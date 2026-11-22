# API-multas

| Field | Value |
|---|---|
| Module | API-004 |
| Style | operations |
| Auth | sesión del usuario; rol por operación (PERMISSIONS-MATRIX) |
| Refs | REQ-F-006, REQ-F-005; UC-011..014; INV-MUL-001..004, INV-SEC-001; ADR-004 |
| Errors | catálogo en `domain/03-VALUE-OBJECTS.md` § Error catalog |
| Transport | ver `design/OPERATION-MAPPING.md` |

## Operations

| ID | Operation | Actor | Input (VO) | Effect / post (INV) | Domain errors | UC |
|---|---|---|---|---|---|---|
| API-004-01 | listMyFines | socio | — | solo multas de la sesión; sin cambios (INV-SEC-001) | `E_PAGINA_PROHIBIDA` | UC-012 |
| API-004-02 | payFine | encargado | fineId (VO-001) | Pagada con `paidOn`; el bloqueo se levanta solo sin otras Pendientes (INV-MUL-003) | `E_ACCESO_DENEGADO`, `E_MULTA_NO_ENCONTRADA`, `E_MULTA_YA_PAGADA` | UC-013 |
| API-004-03 | listFines | encargado | — | todas las multas con socio, importe y estado; sin cambios | `E_PAGINA_PROHIBIDA` | UC-014 |

La multa la crea API-002-05 (INV-MUL-001); este módulo solo la lista y la cobra.

## Errors

| Code | Operations | Condition | Message (VO) |
|---|---|---|---|
| `E_MULTA_NO_ENCONTRADA` | 02 | la multa no existe | VO-010 |
| `E_MULTA_YA_PAGADA` | 02 | multa ya pagada | VO-010 |
| `E_ACCESO_DENEGADO` | 02 | operación fuera del rol | VO-010 |
| `E_PAGINA_PROHIBIDA` | 01, 03 | página fuera del rol | VO-010 |
