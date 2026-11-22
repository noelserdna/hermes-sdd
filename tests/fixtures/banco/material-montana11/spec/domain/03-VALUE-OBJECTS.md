# 03 — Objetos de valor

```typescript
type Fecha = string;           // VO-001: día "AAAA-MM-DD" válido; la comparación es por día completo
type Correo = string;          // VO-002: texto con "@", sin distinguir mayúsculas; único (INV-ACC-001)
type Contrasena = string;      // VO-003: ≥ PASSWORD_MIN_LENGTH caracteres (INV-ACC-002)
type TipoMaterial = 'Piolet' | 'Crampones' | 'Casco' | 'Cuerda' | 'Tienda'; // VO-004 (MATERIAL_TYPES)
type Rol = 'socio' | 'encargado' | 'junta';                                  // VO-005
type EstadoReserva = 'Reservada' | 'Entregado' | 'Devuelto' | 'Cancelada' | 'No recogida'; // VO-006
type EstadoMulta = 'Pendiente' | 'Pagada';                                   // VO-007
type Importe = number;         // VO-008: euros con 2 decimales, se muestra "6,00 €"
type Cantidad = number;        // VO-009: entero ≥ 1 (INV-STK-002)
```

## Catálogo de errores (VO-010)

Todos los errores son de dominio; el mensaje literal es el único texto que ve la persona (REQ-C-002).

| Código | Clase | Mensaje (literal) | Lanzado por | Refs |
|---|---|---|---|---|
| `E_CREDENCIALES_INVALIDAS` | AuthError | Correo o contraseña incorrectos | API-001-01 | REQ-F-001 |
| `E_CUENTA_BLOQUEADA` | AuthError | Cuenta bloqueada durante 15 minutos | API-001-01 | REQ-F-001, INV-ACC-004 |
| `E_SESION_CADUCADA` | AuthError | Sesión caducada, vuelve a entrar | API-001-03 | REQ-F-001, INV-ACC-005 |
| `E_NO_AUTENTICADO` | AuthError | Entrar | todas las operaciones con sesión | REQ-F-001, REQ-NF-001 |
| `E_ACCESO_NO_PERMITIDO` | PermissionError | Acceso no permitido | operaciones por rol | REQ-NF-001, INV-ACC-007 |
| `E_DATOS_INVALIDOS` | ValidationError | Revisa los datos del formulario | cualquier entrada vacía o mal formada | RN-005 |
| `E_CONTRASENA_CORTA` | ValidationError | La contraseña debe tener al menos 8 caracteres | API-001-04, API-001-06 | REQ-F-002, INV-ACC-002 |
| `E_CORREO_DUPLICADO` | ConflictError | Ya existe un socio con ese correo | API-001-04 | REQ-F-002, INV-ACC-001 |
| `E_SOCIO_NO_ENCONTRADO` | NotFoundError | El socio no existe | API-001-06, API-001-07, API-003-10 | RN-005 |
| `E_SOCIO_CON_MATERIAL` | ConflictError | No se puede dar de baja: tiene material sin devolver | API-001-07 | REQ-F-002, INV-LOA-004 |
| `E_FECHA_PASADA` | ValidationError | No se puede reservar en fechas pasadas | API-002-02 | REQ-F-003, INV-RES-002 |
| `E_FECHAS_INVERTIDAS` | ValidationError | La fecha de fin no puede ser anterior a la de inicio | API-002-02 | REQ-F-003, INV-RES-003 |
| `E_RESERVA_MUY_LARGA` | ValidationError | La reserva no puede superar 14 días | API-002-02 | REQ-F-003, INV-RES-004 |
| `E_MULTA_PENDIENTE` | ConflictError | Tienes una multa pendiente: no puedes reservar hasta pagarla | API-002-02 | REQ-F-003, INV-RES-005 |
| `E_SIN_UNIDADES` | ConflictError | No hay unidades libres esas fechas | API-002-02 | REQ-F-003, INV-RES-001 |
| `E_MATERIAL_INVALIDO` | ValidationError | Elige un tipo de material del catálogo | API-002-02, API-004-02 | INV-STK-001 |
| `E_RESERVA_NO_ENCONTRADA` | NotFoundError | La reserva no existe | API-002-04, API-003-01, API-003-02 | RN-005, INV-SEC-001 |
| `E_CANCELACION_TARDIA` | ConflictError | Solo se puede cancelar hasta el día antes | API-002-04 | REQ-F-004, INV-RES-006 |
| `E_ENTREGA_ANTICIPADA` | ConflictError | No se puede entregar antes de la fecha de inicio | API-003-01 | REQ-F-005, INV-LOA-001 |
| `E_ESTADO_INVALIDO` | ConflictError | La reserva no está en un estado que permita esa acción | API-002-04, API-003-01, API-003-02 | SM-001 |
| `E_MULTA_NO_ENCONTRADA` | NotFoundError | La multa no existe | API-003-08 | RN-005 |
| `E_CANTIDAD_INVALIDA` | ValidationError | La cantidad debe ser al menos 1 | API-004-02 | REQ-F-008, INV-STK-002 |
| `E_UNIDAD_NO_ENCONTRADA` | NotFoundError | La unidad no existe | API-004-03 | RN-005 |
| `E_UNIDAD_PRESTADA` | ConflictError | No se puede dar de baja: está prestada | API-004-03 | REQ-F-008, INV-STK-003 |
| `E_ALMACEN_NO_DISPONIBLE` | StorageError | No se pudo guardar. Inténtalo de nuevo | todas (WF-001) | REQ-C-003, ADR-001 |

## Mensajes de éxito (literales)

| Código | Mensaje | Operación |
|---|---|---|
| `M_RESERVA_CREADA` | Reserva creada: {material}, {inicio} a {fin} | API-002-02 |
| `M_RESERVA_CANCELADA` | Reserva cancelada | API-002-04 |
| `M_CONTRASENA_RESTABLECIDA` | Contraseña restablecida | API-001-06 |
| `M_RESERVAS_CANCELADAS_BAJA` | {n} reserva cancelada por la baja | API-004-03 |
