# 03 — Value Objects

```typescript
type AccountId = number; type ItemId = number; type ReservationId = number; type FineId = number; // VO-001: enteros ≥ 1
type Email = string;      // VO-002: formato correo, comparado sin distinguir mayúsculas (INV-SOC-001)
type Password = string;   // VO-003: ≥ PASSWORD_MIN_LENGTH caracteres (INV-SOC-002)
type Role = 'socio' | 'encargado' | 'junta';  // VO-004 (ROLES)
type Day = string;        // VO-005: AAAA-MM-DD, día natural del servidor (RN-022)
type Quantity = number;   // VO-006: entero 1..MAX_UNITS_PER_RESERVATION en reservas (INV-RES-003); ≥ 1 en inventario
type ReservationStatus = 'Reservada' | 'Prestada' | 'Devuelta' | 'Cancelada'; // VO-007 (SM-001); «No recogida» es derivado (ADR-002)
type FineStatus = 'Pendiente' | 'Pagada';     // VO-008 (SM-002)
```

## Error catalog (VO-010)
Mensaje literal mostrado al usuario; `{…}` se rellena. Sin columna HTTP: los contratos son `Style: operations`.

| Code | Class | Message (literal) | Raised by | Refs |
|---|---|---|---|---|
| `E_CREDENCIALES` | AuthError | Correo o contraseña incorrectos | API-001-01 | REQ-F-001, RN-007 |
| `E_CUENTA_BLOQUEADA` | AuthError | Cuenta bloqueada. Vuelve a intentarlo en 15 minutos | API-001-01 | REQ-F-001, RN-001 |
| `E_ACCESO_DENEGADO` | PermissionError | Acceso denegado | todas | REQ-NF-001, RN-020 |
| `E_PAGINA_PROHIBIDA` | PermissionError | No tienes permiso para ver esta página | API-001-08 | REQ-F-008, RN-020 |
| `E_CONTRASENA_CORTA` | ValidationError | La contraseña debe tener al menos 8 caracteres | API-001-03, 04, 05 | REQ-F-002 |
| `E_SOCIO_DUPLICADO` | ConflictError | Ya existe un socio con ese correo | API-001-04 | REQ-F-002 |
| `E_BAJA_PRESTAMOS` | RuleError | No se puede dar de baja: tiene material sin devolver | API-001-06 | REQ-F-002, RN-006 |
| `E_BAJA_MULTAS` | RuleError | No se puede dar de baja: tiene multas sin pagar | API-001-06 | REQ-F-002, RN-006 |
| `E_MULTA_PENDIENTE` | RuleError | No puedes reservar hasta pagar tu multa de {importe} € | API-002-01 | REQ-F-003, RN-016 |
| `E_FECHA_PASADA` | ValidationError | La fecha de inicio no puede ser pasada | API-002-01 | REQ-F-003 |
| `E_FECHA_FIN_ANTERIOR` | ValidationError | La fecha de fin no puede ser anterior a la de inicio | API-002-01 | REQ-F-003 |
| `E_MAX_DIAS` | ValidationError | Máximo 14 días por reserva | API-002-01 | REQ-F-003 |
| `E_MAX_UNIDADES` | ValidationError | Máximo 5 unidades por reserva | API-002-01 | REQ-F-003 |
| `E_SIN_UNIDADES` | ConflictError | No hay unidades libres: solo queda {libres} de {material} el {día} | API-002-01 | REQ-F-003, RN-009 |
| `E_YA_CANCELADA` | ReplayNotice | La reserva ya estaba cancelada | API-002-03 | REQ-F-004, RN-012 |
| `E_EMPIEZA_HOY` | RuleError | No se puede cancelar: empieza hoy | API-002-03 | REQ-F-004, RN-011 |
| `E_YA_EMPEZADA` | RuleError | No se puede cancelar: ya ha empezado | API-002-03 | REQ-F-004, RN-011 |
| `E_YA_ENTREGADA` | ReplayNotice | Ya estaba entregada | API-002-04 | REQ-F-005, RN-012 |
| `E_ANTES_DE_INICIO` | RuleError | No se puede entregar antes de la fecha de inicio | API-002-04 | REQ-F-005, RN-013 |
| `E_YA_DEVUELTA` | ReplayNotice | Ya estaba devuelta | API-002-05 | REQ-F-005, RN-012 |
| `E_MULTA_YA_PAGADA` | ReplayNotice | La multa ya estaba pagada | API-004-02 | REQ-F-006, RN-012 |
| `E_BAJA_UNIDADES_NECESARIAS` | RuleError | No se puede dar de baja: hay {n} unidades de {material} necesarias el {día} | API-003-02 | REQ-F-007, RN-017 |
| `E_BAJA_UNIDADES_INSUFICIENTES` | ValidationError | No hay tantas unidades para dar de baja | API-003-02 | REQ-F-007, RN-017 |
| `E_BUSQUEDA_VACIA` | NotFoundNotice | Ningún socio coincide | API-001-07 | REQ-F-009 |
| `E_ALMACEN_NO_DISPONIBLE` | StorageError | No se pudo guardar. Inténtalo de nuevo | todas las escrituras | REQ-NF-002 |
| `E_CANTIDAD_INVALIDA` | ValidationError | La cantidad debe ser un número entero de 1 o más | API-002-01, API-003-01, 02 | RN-034, RN-017 |
| `E_NOMBRE_VACIO` | ValidationError | El nombre del material no puede estar vacío | API-003-01 | RN-017 |
| `E_FECHA_INVALIDA` | ValidationError | Elige una fecha válida | API-002-01, API-002-06 | RN-032, RN-034 |
| `E_SOCIO_DATOS_INVALIDOS` | ValidationError | Escribe un nombre y un correo válidos | API-001-04 | RN-024 |
| `E_SOCIO_NO_ENCONTRADO` | NotFoundNotice | El socio no existe o ya está de baja | API-001-05, 06 | RN-027 |
| `E_RESERVA_NO_ENCONTRADA` | NotFoundNotice | La reserva no existe | API-002-04, 05 | REQ-F-005 |
| `E_NO_RECOGIDA` | RuleError | No recogida | API-002-04 | REQ-F-005, ADR-002 |
| `E_RESERVA_NO_ENTREGABLE` | RuleError | Solo se puede entregar una reserva pendiente | API-002-04 | REQ-F-005 |
| `E_NO_PRESTADA` | RuleError | No se puede devolver: la reserva no está entregada | API-002-05 | REQ-F-005 |
| `E_MULTA_NO_ENCONTRADA` | NotFoundNotice | La multa no existe | API-004-02 | REQ-F-006 |
