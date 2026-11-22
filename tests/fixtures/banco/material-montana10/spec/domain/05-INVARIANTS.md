# 05 — Invariantes

> Áreas: ACC (cuentas y sesión), RES (reservas), LOA (préstamos y multas), STK (inventario). Puntos de aplicación: API | REPO. Valores por nombre en `VALUE-REGISTRY.md`.

| ID | Regla | Aplicada en | UCs | Error |
|---|---|---|---|---|
| INV-ACC-001 | `correo` único entre cuentas, comparado en minúsculas | API, REPO | UC-002 | `E_CORREO_DUPLICADO` |
| INV-ACC-002 | contraseña de al menos `PASSWORD_MIN_LENGTH` caracteres al crear o restablecer | API | UC-002 | `E_CONTRASENA_CORTA` |
| INV-ACC-003 | contraseña solo como hash con sal; nunca se muestra ni se devuelve (REQ-NF-001) | REPO | UC-001, UC-002 | — |
| INV-ACC-004 | tras `LOGIN_MAX_FAILURES` fallos seguidos la cuenta no entra durante `LOGIN_LOCK_MINUTES`; un acierto reinicia el contador (RN-005) | API | UC-001 | `E_CUENTA_BLOQUEADA` |
| INV-ACC-005 | la sesión caduca tras `SESSION_IDLE_HOURS` sin actividad (RN-006) | API | UC-001 | `E_SESION_CADUCADA` |
| INV-ACC-006 | una cuenta en Baja no inicia sesión | API | UC-001, UC-002 | `E_CREDENCIALES_INVALIDAS` |
| INV-ACC-007 | no se da de baja a un socio con préstamo Prestado o multa Pendiente (RN-010) | API | UC-002 | `E_BAJA_SOCIO_BLOQUEADA` |
| INV-ACC-008 | toda operación exige sesión vigente y un rol permitido por `PERMISSIONS-MATRIX` | API | UC-001..UC-010 | `E_NO_AUTENTICADO`, `E_SIN_PERMISO` |
| INV-ACC-009 | un socio solo ve y cambia sus propias reservas y multas | API | UC-004 | `E_SIN_PERMISO_CANCELAR` |
| INV-RES-001 | duración (`hasta` − `desde` + 1 días) como máximo `RESERVA_MAX_DAYS` | API | UC-003 | `E_RESERVA_MUY_LARGA` |
| INV-RES-002 | `desde` no anterior a hoy | API | UC-003 | `E_FECHA_PASADA` |
| INV-RES-003 | `hasta` no anterior a `desde` | API | UC-003 | `E_FECHAS_INVERTIDAS` |
| INV-RES-004 | cada día del rango hay menos reservas Reservada o Prestada del tipo que unidades activas del tipo (RN-002) | API, REPO | UC-003 | `E_SIN_UNIDADES_LIBRES` |
| INV-RES-005 | un socio con multa Pendiente no crea reservas; las que tenía se mantienen (RN-007) | API | UC-003 | `E_MULTA_PENDIENTE` |
| INV-RES-006 | solo se cancela una reserva Reservada con hoy anterior a `desde` | API | UC-004 | `E_CANCELACION_TARDIA` |
| INV-RES-007 | una reserva Reservada con hoy posterior a `hasta` es No recogida y no ocupa unidades (RN-008) | API, REPO | UC-005, UC-009 | — |
| INV-RES-008 | solo existen las transiciones de SM-001; repetir una ya hecha no cambia nada ni duplica | API | UC-003..UC-006 | — |
| INV-LOA-001 | solo se entrega con hoy igual o posterior a `desde` | API | UC-005 | `E_ENTREGA_ANTICIPADA` |
| INV-LOA-002 | una reserva Prestada tiene una unidad activa de su tipo, no asignada a otra Prestada | API, REPO | UC-005 | — |
| INV-LOA-003 | solo se devuelve una reserva Prestada | API | UC-006 | `E_RESERVA_NO_PRESTADA` |
| INV-LOA-004 | multa = `FINE_PER_DAY_EUR` × días naturales entre `hasta` y la devolución; solo si son más de 0; una por préstamo (RN-009) | API | UC-006 | — |
| INV-LOA-005 | una multa Pagada conserva su fecha de pago; pagarla de nuevo no cambia nada | API | UC-007 | — |
| INV-LOA-006 | préstamos y multas se borran `RETENTION_YEARS` años después de su cierre; nunca una multa Pendiente (RN-013) | REPO | REQ-NF-001 | — |
| INV-STK-001 | una unidad DeBaja no se reserva ni entrega y no cuenta como libre | API | UC-005, UC-008 | — |
| INV-STK-002 | no se da de baja una unidad Prestada | API | UC-008 | `E_BAJA_UNIDAD_PRESTADA` |
| INV-STK-003 | añadir n ≥ 1 unidades suma n cada vez; no es idempotente por diseño (REQ-F-008 AC2) | API | UC-008 | — |
| INV-STK-004 | el tipo de material pertenece a `TIPOS_MATERIAL` | API | UC-003, UC-008 | — |
| INV-ACC-101 | un envío correcto repetido o simultáneo deja una sola sesión | API | UC-001 | — |
| INV-ACC-102 | una sesión cerrada con Salir no vuelve a valer | API | UC-001 | `E_NO_AUTENTICADO` |
| INV-ACC-103 | restablecer sustituye el hash; la contraseña anterior deja de valer | API | UC-002 | `E_CREDENCIALES_INVALIDAS` |
| INV-LOA-301 | solo se entrega una reserva Reservada; una Prestada repetida no asigna otra unidad | API | UC-005 | `E_RESERVA_NO_ENTREGABLE` |
| INV-LOA-401 | consultar entregas y devoluciones no cambia estado; las acciones solo se ofrecen al encargado | API | UC-009 | — |
| INV-LOA-402 | el historial es de solo lectura y no ofrece acciones | API | UC-010 | — |
