# Aclaraciones (reglas de negocio)

> Decididas en modo arnés (sin persona en la sesión): D-001 por el método; RN-001..RN-016 son supuestos de clase S sobre detalles que `requirements/` deja abiertos (se citan por id y la persona los revisa en la puerta). Cada RN obliga a todo `spec/`.

## Decisiones de formato

| # | Pregunta | Decisión | Descartado |
|---|---|---|---|
| D-001 | Formato de la especificación | árbol modular `spec/` con casos de uso, BDD y contratos `Style: operations` | SRS monolítico; historias |

## Reglas de negocio

| RN | Origen | Pregunta | Regla adoptada | Descartado | Tier |
|---|---|---|---|---|---|
| RN-001 | REQ-F-003 | ¿Qué se reserva: tipo o unidad? | Se pide un tipo; el sistema asigna la unidad libre de menor número en todo el rango. "Libres" = unidades sin solape en el rango | elegir unidad a mano; contar por día | 2 |
| RN-002 | REQ-F-003 | ¿Qué es "hoy"? | Fecha del reloj del sistema, en días completos (ADR-002) | fecha del navegador | 2 |
| RN-003 | REQ-F-005 | ¿Cuándo se puede entregar? | Solo el día de `inicio`; antes → `E_ENTREGA_ANTICIPADA`; después la reserva ya es No recogida | entregar con retraso | 2 |
| RN-004 | REQ-F-005 | ¿Cuándo se marca No recogida? | Al pasar el día de `inicio`, se aplica de forma perezosa al leer o escribir (UC-008) | tarea programada propia | 2 |
| RN-005 | REQ-F-002 | Mensajes para errores no citados en los requisitos | Mensajes de VO-010 redactados en español llano | — | 2 |
| RN-006 | REQ-F-001 | ¿Quién crea las cuentas de encargado y junta? | Se cargan al desplegar (datos iniciales); la web solo da de alta socios | alta desde la web | 1 (aceptada) |
| RN-007 | REQ-F-002 | ¿Qué hace un socio dado de baja con su historial? | Se conserva para la junta (`RETENTION_YEARS`); no puede entrar | borrarlo | 2 |
| RN-008 | REQ-F-001 | ¿Cuenta un intento con correo inexistente? | Mismo mensaje `E_CREDENCIALES_INVALIDAS`, sin contador | revelar si el correo existe | 2 |
| RN-009 | REQ-F-006 | ¿Cómo se cuentan los días de retraso? | Días naturales: `devueltaEl` − `fin`; el día de `fin` no es retraso | contar el día de fin | 2 |
| RN-010 | REQ-NF-001 | ¿Se borran los datos a los 2 años? | Se fija `RETENTION_YEARS`; la purga automática no se especifica (nuevo comportamiento) | tarea de purga ya | 1 (pendiente) |
| RN-011 | REQ-F-003 | Repetir el mismo envío de reserva | El segundo envío no duplica: si ya existe esa reserva idéntica del mismo socio se devuelve la existente; si no, es una reserva nueva | permitir dos reservas | 2 |
| RN-012 | REQ-F-001 | ¿Qué ve la junta al entrar? | Su inicio es la pantalla "Historial del socio" (elegir socio) | pantalla propia nueva | 2 |
| RN-013 | REQ-F-002 | ¿Qué pasa con las sesiones abiertas de una cuenta dada de baja o con contraseña restablecida? | Dejan de valer: la siguiente operación da `E_NO_AUTENTICADO` | dejarlas hasta caducar | 2 |
| RN-014 | REQ-F-002 | ¿Se restablece la contraseña de una cuenta en Baja? | No: `E_SOCIO_NO_ENCONTRADO` (la cuenta en Baja no se gestiona) | permitirlo | 2 |
| RN-015 | REQ-F-006 | Texto de Mis multas sin multas; quién la abre | "Sin multas" (mismo literal que Multas); solo el rol socio | texto nuevo; abrirla otros roles | 2 |
| RN-016 | REQ-F-008 | Añadir material dos veces; baja repetida; historial del encargado | Cada alta de material es una petición nueva (suma unidades); la baja repetida no muestra mensaje de reservas; el historial por socio es solo de la junta (REQ-F-010) | deduplicar altas; mostrar mensaje | 2 |
