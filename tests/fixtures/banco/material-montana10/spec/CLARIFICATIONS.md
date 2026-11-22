# Aclaraciones (reglas de negocio)

> Decididas por defecto en modo arnés (sin persona; clase S: supuestos razonables, revisables en la puerta de requisitos) · 2026-11-21. Cada RN vincula a todo `spec/`.

## Decisiones de formato

| # | Pregunta | Decisión | Descartado |
|---|---|---|---|
| D-001 | Formato de la especificación | árbol modular `spec/` con casos de uso, BDD y contratos | SRS monolítico; historias |
| D-002 | Estilo de contrato | `operations` (sin rutas ni estados de transporte) | `http` |

## Reglas de negocio

| RN | Origen | Pregunta | Regla adoptada | Descartado | Tier |
|---|---|---|---|---|---|
| RN-001 | REQ-F-003 | ¿Qué es «hoy»? | fecha natural de `ZONA_HORARIA`; se inyecta como reloj (ADR-001) | hora UTC | 2 |
| RN-002 | REQ-F-003 | ¿Cuándo hay unidad libre? | unidades Activas del tipo menos reservas Reservada o Prestada del tipo que cubren ese día; Devuelta, Cancelada y No recogida no ocupan | contar solo Prestadas | 2 |
| RN-003 | REQ-F-003 | ¿Cuántas unidades por reserva? | una unidad de un tipo; la unidad concreta se asigna al entregar | elegir unidad al reservar | 2 |
| RN-004 | REQ-F-003 | ¿Reserva idéntica repetida? | si el mismo socio ya tiene una reserva Reservada del mismo tipo y fechas, se devuelve esa, sin crear otra | segunda reserva | 2 |
| RN-005 | REQ-F-001 | ¿Cómo cuentan los fallos? | cada fallo de contraseña de una cuenta existente suma 1; el quinto bloquea `LOGIN_LOCK_MINUTES` desde ese instante; un acierto fuera de bloqueo reinicia; intentos durante el bloqueo no lo alargan; correo desconocido da el mismo error sin contador | alargar el bloqueo | 2 |
| RN-006 | REQ-F-001 | ¿Caducidad de sesión? | `SESSION_IDLE_HOURS` desde la última actividad; «Salir» la cierra al momento | caducidad absoluta | 2 |
| RN-007 | REQ-F-003 | ¿Reservas ya hechas con multa? | se mantienen; solo se impide crear nuevas | cancelarlas | 2 |
| RN-008 | REQ-F-005 | ¿Cuándo es «No recogida»? | derivada: Reservada con hoy posterior a `hasta`; se evalúa al consultar y al operar, sin multa | proceso nocturno que escribe | 2 |
| RN-009 | REQ-F-006 | ¿Cómo se cuenta el retraso? | días naturales de `hasta` a la fecha de devolución; devolver el día `hasta` o antes no multa | contar horas | 2 |
| RN-010 | REQ-F-002 | ¿Qué bloquea la baja de un socio? | un préstamo Prestado o una multa Pendiente; sus reservas Reservada siguen y acabarán No recogida | cancelarlas al dar de baja | 2 |
| RN-011 | REQ-F-008 | ¿Baja de unidad con reservas futuras? | se permite si no está Prestada; si luego no hay unidad que asignar, falla la entrega | impedir la baja | 1 |
| RN-012 | REQ-F-010 | ¿Qué es el historial? | todas las reservas del socio con su estado y todas sus multas; el encargado y la junta lo ven | solo préstamos cerrados | 2 |
| RN-013 | REQ-NF-001 | ¿Cierre y borrado? | cierre de un préstamo = fecha de devolución (o `hasta` si Cancelada o No recogida); de una multa = fecha de pago; se borra a los `RETENTION_YEARS` años en una limpieza diaria | borrar a mano | 2 |
| RN-014 | REQ-F-002 | ¿Normalización del correo? | sin espacios y en minúsculas; único entre todas las cuentas, también de baja | distinguir mayúsculas | 2 |
| RN-015 | REQ-F-001 | ¿Pantalla inicial por rol? | socio: Mis reservas; encargado: Entregas y devoluciones; junta: Historial | la misma para todos | 2 |
| RN-016 | REQ-F-001 | ¿Pantallas por rol? | socio: Mis reservas, Reservar; encargado: Entregas y devoluciones, Multas, Socios, Inventario, Historial; junta: Entregas y devoluciones (solo lectura), Historial | ver `contracts/PERMISSIONS-MATRIX.md` | 2 |
| RN-017 | REQ-F-003 | ¿Orden de comprobación al reservar? | sesión y rol, fechas (pasado, orden, duración), multa pendiente, unidades libres | otro orden | 2 |
| RN-018 | REQ-F-003 | ¿Dos reservas a la vez por la última unidad? | la comprobación de unidades libres y la creación son una sola operación indivisible por tipo; la segunda ve `E_SIN_UNIDADES_LIBRES` | bloqueo optimista con reintento | 2 |
| RN-019 | REQ-F-004 | ¿Quién cancela? | solo el socio dueño, una reserva Reservada y hasta el día antes de `desde` | el encargado cancela | 2 |
| RN-020 | REQ-F-005 | ¿Quién elige la unidad al entregar? | el encargado indica la unidad: Activa, del tipo reservado y no Prestada | asignación automática | 2 |
| RN-021 | REQ-F-002 | ¿Nombre vacío o correo sin formato al dar de alta? | se rechaza con `E_DATOS_SOCIO_INVALIDOS`; sin cuenta | aceptarlo | 2 |
| RN-022 | REQ-F-009 | ¿Qué incluye «Entregar hoy»? | reservas Reservada con `desde` igual o anterior a hoy y `hasta` igual o posterior a hoy | solo `desde` igual a hoy | 2 |
| RN-023 | REQ-F-010 | ¿Cómo elige la junta al socio? | lista de socios (nombre, correo) en Historial vía API-001-06 en lectura; la pantalla Socios sigue siendo solo del encargado | buscador libre | 2 |
| RN-024 | REQ-F-010 | ¿Qué es `{unidad}` sin unidad asignada? | el tipo de material (p. ej. «Piolet») | dejarlo vacío | 2 |
