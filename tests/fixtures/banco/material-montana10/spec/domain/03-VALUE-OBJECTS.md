# 03 — Objetos de valor

```typescript
type Rol = 'socio' | 'encargado' | 'junta';                      // VO-001
type Correo = string;       // VO-002: minúsculas, sin espacios, formato correo (INV-ACC-001)
type Fecha = string;        // VO-003: AAAA-MM-DD, día natural de Europe/Madrid (RN-001)
type TipoMaterial = 'Piolet' | 'Crampones' | 'Casco' | 'Cuerda' | 'Tienda';   // VO-004 (TIPOS_MATERIAL)
type EstadoReserva = 'Reservada' | 'Prestada' | 'Devuelta' | 'Cancelada' | 'No recogida';  // VO-005
type Importe = number;      // VO-006: euros enteros, FINE_PER_DAY_EUR × días
```

## Catálogo de errores (VO-010)

Mensaje literal tal y como lo ve la persona; `{x}` se sustituye. Sin columna HTTP (contratos `Style: operations`).

| Código | Clase | Mensaje (literal) | Lanzado por | Refs |
|---|---|---|---|---|
| `E_CREDENCIALES_INVALIDAS` | AuthError | Correo o contraseña incorrectos | API-001-01 | REQ-F-001, INV-ACC-006 |
| `E_CUENTA_BLOQUEADA` | AuthError | Cuenta bloqueada. Inténtalo de nuevo en 15 minutos | API-001-01 | REQ-F-001, INV-ACC-004 |
| `E_SESION_CADUCADA` | AuthError | Tu sesión ha caducado | todas (sesión) | REQ-F-001, INV-ACC-005 |
| `E_NO_AUTENTICADO` | AuthError | Entrar (se muestra el formulario Entrar) | todas salvo API-001-01 | REQ-F-001, INV-ACC-008 |
| `E_SIN_PERMISO` | PermissionError | No tienes permiso para ver esta pantalla | operaciones de rol | REQ-F-002, REQ-F-007, REQ-F-008, REQ-F-010, INV-ACC-008 |
| `E_SIN_PERMISO_CANCELAR` | PermissionError | No tienes permiso para cancelar esta reserva | API-002-03 | REQ-F-004, INV-ACC-009 |
| `E_CORREO_DUPLICADO` | ConflictError | Ya existe un socio con ese correo | API-001-03 | REQ-F-002, INV-ACC-001 |
| `E_CONTRASENA_CORTA` | ValidationError | La contraseña debe tener al menos 8 caracteres | API-001-03, API-001-05 | REQ-F-002, INV-ACC-002 |
| `E_BAJA_SOCIO_BLOQUEADA` | ConflictError | No se puede dar de baja: tiene material prestado o multas pendientes | API-001-04 | REQ-F-002, INV-ACC-007 |
| `E_SIN_UNIDADES_LIBRES` | ConflictError | No quedan unidades libres de {material} esas fechas | API-002-01 | REQ-F-003, INV-RES-004 |
| `E_FECHA_PASADA` | ValidationError | Las fechas no pueden estar en el pasado | API-002-01 | REQ-F-003, INV-RES-002 |
| `E_FECHAS_INVERTIDAS` | ValidationError | La fecha final no puede ser anterior a la inicial | API-002-01 | REQ-F-003, INV-RES-003 |
| `E_RESERVA_MUY_LARGA` | ValidationError | Máximo 14 días por reserva | API-002-01 | REQ-F-003, INV-RES-001 |
| `E_MULTA_PENDIENTE` | ConflictError | Tienes una multa pendiente de {importe} €. Págala al encargado para poder reservar | API-002-01 | REQ-F-003, INV-RES-005 |
| `E_CANCELACION_TARDIA` | ConflictError | Solo se puede cancelar hasta el día antes | API-002-03 | REQ-F-004, INV-RES-006 |
| `E_ENTREGA_ANTICIPADA` | ConflictError | Aún no es la fecha de entrega | API-003-01 | REQ-F-005, INV-LOA-001 |
| `E_RESERVA_NO_PRESTADA` | ConflictError | Esa reserva no está prestada | API-003-02 | REQ-F-006, INV-LOA-003 |
| `E_BAJA_UNIDAD_PRESTADA` | ConflictError | No se puede dar de baja: está prestada | API-004-02 | REQ-F-008, INV-STK-002 |
| `E_ALMACEN_NO_DISPONIBLE` | SystemError | No se pudo completar la operación. Inténtalo de nuevo | todas (global) | REQ-C-003; descrita una vez en los contratos |
| `E_DATOS_SOCIO_INVALIDOS` | ValidationError | Indica un nombre y un correo válido | API-001-03 | REQ-F-002, RN-021 |
| `E_SOCIO_NO_ENCONTRADO` | NotFoundError | El socio elegido no existe | API-003-06 | REQ-F-010 |
| `E_TIPO_INVALIDO` | ValidationError | Tipo de material no válido | API-002-01, API-004-01 | REQ-F-003, REQ-F-008, INV-STK-004 |
| `E_CANTIDAD_INVALIDA` | ValidationError | La cantidad debe ser un número entero de 1 o más | API-004-01 | REQ-F-008, INV-STK-003 |
| `E_RESERVA_NO_ENCONTRADA` | NotFoundError | No existe esa reserva | API-002-03, API-003-01, API-003-02 | REQ-F-004, REQ-F-005, REQ-F-006 |
| `E_RESERVA_NO_ENTREGABLE` | ConflictError | Esa reserva no se puede entregar | API-003-01 | REQ-F-005, INV-LOA-301 |
| `E_UNIDAD_NO_DISPONIBLE` | ConflictError | Esa unidad no sirve para esta reserva | API-003-01 | REQ-F-005, INV-LOA-002, RN-011 |
| `E_UNIDAD_NO_ENCONTRADA` | NotFoundError | No existe esa unidad | API-004-02 | REQ-F-008 |
| `E_MULTA_NO_ENCONTRADA` | NotFoundError | No se encontró esa multa | API-003-03 | REQ-F-007 |
