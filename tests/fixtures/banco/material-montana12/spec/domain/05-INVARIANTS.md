# 05 — Invariants

> Áreas: SOC, RES, MUL, MAT, SEC. INV-SOC-101 e INV-SOC-102 los añadió la fase D. Enforcement: API (operación del contrato) | REPO (almacén de datos).

| ID | Rule | Enforced at | UCs | Violation error | Validation |
|---|---|---|---|---|---|
| INV-SOC-001 | `email` único entre todas las cuentas (también las de baja), sin distinguir mayúsculas | API, REPO | UC-003 | `E_SOCIO_DUPLICADO` | índice único sobre `lower(email)` |
| INV-SOC-002 | contraseña con al menos `PASSWORD_MIN_LENGTH` caracteres | API | UC-003..005 | `E_CONTRASENA_CORTA` | `length ≥ 8` |
| INV-SOC-003 | la contraseña se guarda solo cifrada (hash con sal); nunca en claro | REPO | UC-003..005 | — | ningún campo contiene la contraseña |
| INV-SOC-004 | tras `LOGIN_MAX_FAILURES` fallos seguidos la cuenta se bloquea `LOGIN_LOCK_MINUTES` minutos; un acierto reinicia la cuenta | API | UC-001 | `E_CUENTA_BLOQUEADA` | `lockedUntil > ahora` |
| INV-SOC-005 | la sesión caduca tras `SESSION_IDLE_MINUTES` minutos sin actividad | API | UC-001, UC-002 | — | `ahora − última actividad > 30 min` |
| INV-SOC-006 | con `mustChangePassword` el único acceso permitido es cambiar la contraseña | API | UC-001, UC-004 | — | toda operación salvo API-001-02 y -03 muestra Cambiar contraseña |
| INV-SOC-007 | baja solo sin préstamos sin devolver ni multas pendientes | API | UC-006 | `E_BAJA_PRESTAMOS`, `E_BAJA_MULTAS` | recuento de Prestada y Pendiente = 0 |
| INV-SOC-008 | una cuenta de baja no entra; el error es el mismo que con credenciales malas | API | UC-001 | `E_CREDENCIALES` | `active = true` |
| INV-SOC-009 | por socio solo se guardan nombre, correo, contraseña cifrada, rol, indicadores de acceso y su historial | REPO | UC-003 | — | sin otros campos personales |
| INV-RES-001 | `hoy ≤ startDate ≤ endDate` | API | UC-007 | `E_FECHA_PASADA`, `E_FECHA_FIN_ANTERIOR` | comparación de `Day` |
| INV-RES-002 | duración (ambas fechas incluidas) ≤ `MAX_RESERVATION_DAYS` | API | UC-007 | `E_MAX_DIAS` | `endDate − startDate + 1 ≤ 14` |
| INV-RES-003 | `quantity` entre 1 y `MAX_UNITS_PER_RESERVATION` | API | UC-007 | `E_MAX_UNIDADES` | `1 ≤ q ≤ 5` |
| INV-RES-004 | cada día de la reserva: `totalUnits − ocupadas ≥ quantity` | API, REPO | UC-007, UC-016 | `E_SIN_UNIDADES` | ADR-001, RN-009 |
| INV-RES-005 | ocupan unidades Reservada y Prestada (y la Prestada vencida hasta hoy); Cancelada, Devuelta y No recogida no | API | UC-007, UC-009..011 | — | RN-009 |
| INV-RES-006 | cancelar solo si `hoy < startDate` | API | UC-009 | `E_EMPIEZA_HOY`, `E_YA_EMPEZADA` | `hoy < startDate` |
| INV-RES-007 | entregar solo una Reservada con `startDate ≤ hoy ≤ endDate` | API | UC-010 | `E_ANTES_DE_INICIO` | RN-013 |
| INV-RES-008 | Reservada con `endDate < hoy` es «No recogida»: no se entrega, libera unidades, sin multa | API | UC-010, UC-017 | — | ADR-002 |
| INV-RES-009 | repetir cancelar, entregar o devolver no cambia nada y avisa «ya estaba …» | API | UC-009..011 | `E_YA_CANCELADA`, `E_YA_ENTREGADA`, `E_YA_DEVUELTA` | RN-012, ADR-005 |
| INV-RES-010 | un socio solo ve y cancela sus propias reservas | API | UC-008, UC-009 | `E_ACCESO_DENEGADO` | `reservation.accountId = sesión` |
| INV-RES-011 | préstamos y reservas cerrados (Devuelta, Cancelada, No recogida; no los vivos, RN-033) con `endDate` anterior a hoy − `RETENTION_YEARS` años se borran | REPO | UC-019 | — | RN-021 |
| INV-MUL-001 | la multa se crea al devolver, una por préstamo, de `FINE_PER_DAY_EUR` × días de retraso (> 0) | API | UC-011 | — | RN-014, ADR-004 |
| INV-MUL-002 | con alguna multa Pendiente el socio no puede reservar; sus reservas hechas siguen | API | UC-007 | `E_MULTA_PENDIENTE` | RN-016 |
| INV-MUL-003 | marcar pagada es idempotente; el bloqueo se levanta al no quedar pendientes | API | UC-013 | `E_MULTA_YA_PAGADA` | RN-016 |
| INV-MUL-004 | días de retraso = `returnedOn − endDate` (o `hoy − endDate` si no devuelta), naturales | API | UC-011, UC-017 | — | RN-014 |
| INV-MAT-001 | `totalUnits ≥ 0` | API, REPO | UC-015, UC-016 | `E_BAJA_UNIDADES_INSUFICIENTES` | `total − n ≥ 0` |
| INV-MAT-002 | retirar n unidades solo si cada día ≥ hoy: `total − n ≥ ocupadas` | API | UC-016 | `E_BAJA_UNIDADES_NECESARIAS` | RN-017 |
| INV-MAT-003 | un tipo con 0 unidades no se ofrece para reservar | API | UC-007, UC-015 | — | `totalUnits > 0` |
| INV-MAT-004 | el nombre de un tipo es único sin distinguir mayúsculas | API, REPO | UC-015 | — | RN-017 |
| INV-SEC-001 | un socio solo accede a sus datos; sin datos de otro en ninguna respuesta | API | todas | `E_ACCESO_DENEGADO` | REQ-NF-001 |
| INV-SEC-002 | la junta solo consulta: toda operación de gestión se rechaza sin cambios | API | UC-018 | `E_ACCESO_DENEGADO` | REQ-NF-001 |
| INV-SEC-003 | gestionar socios, material, entregas, devoluciones y multas es solo del encargado | API | UC-003, 005, 006, 010, 011, 013..017 | `E_ACCESO_DENEGADO`, `E_PAGINA_PROHIBIDA` | PERMISSIONS-MATRIX |
| INV-SOC-101 | la baja cancela las reservas Reservada del socio y libera sus unidades, sin guarda de fecha | API | UC-006 | — | ninguna Reservada del socio tras la baja |
| INV-SOC-102 | restablecer deja `mustChangePassword` y la contraseña anterior deja de valer | API | UC-005 | `E_CREDENCIALES` | la anterior no autentica |
