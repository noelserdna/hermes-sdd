# 05 — Invariantes

> Áreas: ACC (cuentas y sesión), RES (reservas), LOA (entregas y devoluciones), FIN (multas), STK (inventario), SEC (datos personales). Puntos de control: OP (operación), ALM (almacén).

| ID | Regla | Dónde | UCs | Error | Validación |
|---|---|---|---|---|---|
| INV-ACC-001 | El correo es único entre cuentas, sin distinguir mayúsculas | OP, ALM | UC-003 | `E_CORREO_DUPLICADO` | `lower(correo)` único |
| INV-ACC-002 | Contraseña de al menos `PASSWORD_MIN_LENGTH` caracteres | OP | UC-003, UC-004 | `E_CONTRASENA_CORTA` | `len ≥ 8` |
| INV-ACC-003 | La contraseña se guarda solo como hash; el texto en claro no se guarda ni se registra | OP, ALM | UC-003, UC-004 | — | el almacén no contiene la contraseña |
| INV-ACC-004 | Tras `LOGIN_MAX_FAILURES` fallos seguidos la cuenta se bloquea `LOCK_MINUTES`; durante el bloqueo se rechaza incluso la contraseña correcta; un acierto fuera del bloqueo pone los fallos a 0 | OP | UC-001 | `E_CUENTA_BLOQUEADA` | `ahora < bloqueadaHasta` |
| INV-ACC-005 | La sesión caduca tras `SESSION_IDLE_MINUTES` sin actividad; cada operación con sesión válida renueva la actividad | OP | UC-002 | `E_SESION_CADUCADA` | `ahora − ultimaActividad > SESSION_IDLE_MINUTES` |
| INV-ACC-006 | Una cuenta en Baja no puede entrar; el error es el mismo que con credenciales erróneas | OP | UC-001, UC-004 | `E_CREDENCIALES_INVALIDAS` | `estado = Baja` |
| INV-ACC-007 | Cada operación exige su rol (PERMISSIONS-MATRIX); sin sesión → `E_NO_AUTENTICADO`, con otro rol → `E_ACCESO_NO_PERMITIDO` | OP | todos | `E_ACCESO_NO_PERMITIDO` | rol ∈ roles de la operación |
| INV-ACC-008 | Al dar de baja una cuenta o restablecer su contraseña, sus sesiones abiertas dejan de valer (RN-013) | OP | UC-002, UC-004 | `E_NO_AUTENTICADO` | la siguiente operación con esa sesión → `E_NO_AUTENTICADO` |
| INV-ACC-009 | No se restablece la contraseña de una cuenta en Baja (RN-014) | OP | UC-004 | `E_SOCIO_NO_ENCONTRADO` | `estado = Baja` → error |
| INV-RES-001 | Una unidad no tiene dos reservas Reservada o Entregado con días en común | OP, ALM | UC-005 | `E_SIN_UNIDADES` | sin solape de `[inicio, fin]` |
| INV-RES-002 | `inicio` ≥ hoy | OP | UC-005 | `E_FECHA_PASADA` | `inicio ≥ hoy` |
| INV-RES-003 | `fin` ≥ `inicio` | OP | UC-005 | `E_FECHAS_INVERTIDAS` | `fin ≥ inicio` |
| INV-RES-004 | Una reserva dura como máximo `RESERVATION_MAX_DAYS` días (ambos extremos incluidos) | OP | UC-005 | `E_RESERVA_MUY_LARGA` | `fin − inicio + 1 ≤ 14` |
| INV-RES-005 | Un socio con alguna multa Pendiente no puede crear reservas; las ya existentes se conservan | OP | UC-005 | `E_MULTA_PENDIENTE` | `∃ multa Pendiente` |
| INV-RES-006 | El socio solo cancela una reserva Reservada con `inicio` > hoy | OP | UC-007 | `E_CANCELACION_TARDIA` | `inicio > hoy` |
| INV-RES-007 | Repetir una cancelación sobre una reserva Cancelada no cambia nada | OP | UC-007 | — | idempotente |
| INV-RES-008 | Repetir el envío de una reserva idéntica (mismo socio, tipo, `inicio` y `fin`) devuelve la existente y no crea otra; prevalece sobre INV-RES-001 (RN-011) | OP | UC-005 | — | idempotente |
| INV-RES-009 | Se asigna la unidad libre de menor número en todo el rango (RN-001) | OP | UC-005 | — | unidad = menor número sin solape |
| INV-LOA-001 | Solo se entrega una reserva Reservada y solo el día de `inicio` (RN-003); antes de `inicio` es `E_ENTREGA_ANTICIPADA` | OP | UC-008 | `E_ENTREGA_ANTICIPADA` | `hoy = inicio` |
| INV-LOA-002 | Una reserva Reservada con `inicio` < hoy pasa a No recogida y libera la unidad | OP | UC-008 | — | `hoy > inicio` |
| INV-LOA-003 | Solo se devuelve una reserva Entregado; repetir la devolución conserva la primera fecha y no crea otra multa | OP | UC-009 | — | idempotente |
| INV-LOA-004 | Un socio con reservas Entregado no puede darse de baja | OP | UC-004 | `E_SOCIO_CON_MATERIAL` | `∃ Entregado` |
| INV-FIN-001 | Multa = `FINE_PER_DAY_EUR` × (`devueltaEl` − `fin`) días naturales solo si `devueltaEl` > `fin` | OP | UC-009, UC-010 | — | `días > 0` |
| INV-FIN-002 | Una reserva genera como máximo una multa | OP, ALM | UC-010 | — | `reservaId` único en multas |
| INV-FIN-003 | Una multa Pagada conserva la primera fecha de pago; repetir el pago no cambia nada | OP | UC-012 | — | idempotente |
| INV-FIN-004 | Las multas no caducan; el bloqueo dura mientras quede alguna Pendiente | OP | UC-010, UC-012 | — | sin plazo |
| INV-STK-001 | El tipo es uno de `MATERIAL_TYPES`; cada unidad lleva un número propio dentro de su tipo | OP | UC-013 | `E_MATERIAL_INVALIDO` | `tipo ∈ catálogo` |
| INV-STK-002 | Se añaden al menos 1 unidad por operación | OP | UC-013 | `E_CANTIDAD_INVALIDA` | `n ≥ 1` |
| INV-STK-003 | No se da de baja una unidad con reserva Entregado | OP | UC-014 | `E_UNIDAD_PRESTADA` | sin Entregado |
| INV-STK-004 | Dar de baja una unidad ya De baja no cambia el recuento | OP | UC-014 | — | idempotente |
| INV-STK-005 | Al dar de baja una unidad se cancelan sus reservas Reservada y se informa del número | OP | UC-014 | — | reservas Reservada → Cancelada |
| INV-SEC-001 | Los datos de un socio (nombre, correo, reservas, préstamos, multas) solo se devuelven a ese socio, al encargado y a la junta | OP | todos | `E_ACCESO_NO_PERMITIDO` | filtro por dueño |
| INV-SEC-002 | La junta solo lee: ninguna operación de escritura admite el rol junta | OP | UC-016 | `E_ACCESO_NO_PERMITIDO` | rol ≠ junta en escrituras |
| INV-SEC-003 | Cada escritura es atómica: o se aplica entera o no se aplica | ALM | todos | `E_ALMACEN_NO_DISPONIBLE` | transacción |
