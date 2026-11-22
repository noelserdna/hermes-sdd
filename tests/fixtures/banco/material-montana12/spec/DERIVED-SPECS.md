# Derived Specifications

> Tier 1 = comportamiento visible nuevo (necesita REQ o aceptación). Tier 2 = detalle técnico de un REQ. Tier 3 no se registra.

| Metric | Value | Threshold | Status |
|---|---|---|---|
| Tier 1 pending REQ | 9 | ≤ 3 | **FAIL — alerta: ver `sdd-req-change`** |
| Tier 1 accepted without REQ | 0 | — | Advisory |
| Tier 2 registered | 8 | — | Info |

## Spec-engineer derived

| Artifact | Type | Derived from | Tier | Justification | Status |
|---|---|---|---|---|---|
| INV-SOC-101, INV-SOC-102 | Invariant | REQ-F-002 | 2 | formalise baja y restablecimiento | Registered |
| RN-001..RN-022 (salvo los Tier 1) | Rule | REQ-F-001..009, REQ-NF-001/003 | 2 | concretan «Supuestos» de los REQ | Registered |
| `E_ACCESO_DENEGADO`/`E_PAGINA_PROHIBIDA` rows | Exception flow | REQ-NF-001, REQ-F-008 | 2 | rechazo por rol en cada UC | Registered |
| `E_YA_*` replay rows | Exception flow | REQ-F-004..006 | 2 | repetir una acción (ADR-005) | Registered |
| `E_*_NO_ENCONTRADA`, `E_NO_PRESTADA`, `E_RESERVA_NO_ENTREGABLE`, `E_NO_RECOGIDA` | Exception flow | REQ-F-005, REQ-F-006 | 2 | estados incorrectos de reserva y multa | Registered |
| `E_ALMACEN_NO_DISPONIBLE` | Exception flow | REQ-NF-002 | 2 | fallo de almacenamiento compartido | Registered |
| `E_YA_EMPEZADA` (RN-011), RN-035 | Rule | REQ-F-004, REQ-F-007 | 2 | casos de borde de cancelar y añadir | Registered |
| `E_CANTIDAD_INVALIDA`, `E_NOMBRE_VACIO`, `E_FECHA_INVALIDA` (RN-034, UC-015) | Rule + messages | REQ-F-003, REQ-F-007 | 1 | mensajes de validación nuevos | **[PENDING REQ]** |
| `E_SOCIO_DATOS_INVALIDOS` (RN-024) | Rule + message | REQ-F-002 | 1 | mensaje nuevo en el alta | **[PENDING REQ]** |
| `E_SOCIO_NO_ENCONTRADO` (RN-027) | Rule + message | REQ-F-002 | 1 | baja o restablecer inexistente | **[PENDING REQ]** |
| RN-023 inicio de la junta | Rule | REQ-F-001 | 1 | página no nombrada | **[PENDING REQ]** |
| RN-025 sin cambio voluntario de contraseña | Rule | REQ-F-002 | 1 | límite no pedido | **[PENDING REQ]** |
| RN-029, `NOT_COLLECTED_VISIBLE_DAYS` | Rule + value | REQ-F-005 | 1 | cómo ve el encargado «No recogida» | **[PENDING REQ]** |
| RN-031 «No hay multas» | Rule + message | REQ-F-006 | 1 | lista vacía de Multas | **[PENDING REQ]** |
| RN-032 `E_FECHA_INVALIDA` en el Panel | Rule + message | REQ-F-008 | 1 | fecha del selector no válida | **[PENDING REQ]** |
| `E_RESERVA_NO_ENCONTRADA`, `E_MULTA_NO_ENCONTRADA` textos | Messages | REQ-F-005, REQ-F-006 | 1 | textos nuevos | **[PENDING REQ]** |

Los Tier 1 son supuestos de clase S del arnés: la persona los revisa en la puerta; ninguno contradice un REQ.

## Audit derived
None.

## Resolution log
None.
