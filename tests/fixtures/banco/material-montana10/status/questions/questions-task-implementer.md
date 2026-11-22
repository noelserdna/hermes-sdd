# Questions — task-implementer

<!-- Vista generada desde questions-task-implementer.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role task-implementer`. -->

## Q-task-implementer-001 [ANSWERED] skill=sdd-task-implementer context=plan/fases/FASE-0-SKELETON.md Demo paso 5 · TASK-F0-009 · UC-003 · API-002-01 tema=reserva-varias-unidades
Question: La Demo (paso 5) y TASK-F0-009 dicen que Pablo «pide 2 piolets del 4 al 4» y que se rechaza porque el día 4 solo queda 1. UC-003 y API-002-01 reservan UNA unidad por reserva (entrada: tipo, desde, hasta; sin cantidad). Implementado como está el contrato, Pablo reservando 1 piolet el día 4 lo consigue (queda 1). El recorrido e2e hace ese caso; el rechazo por falta de unidades queda probado con AC-003-03 y AC-003-10.
Para el cliente: En la demo, Pablo pedía 2 piolets de golpe, pero la web hoy reserva siempre una unidad por reserva. ¿Se puede pedir más de una unidad en la misma reserva?
Options:
  A) Una unidad por reserva, como dicen UC-003 y el contrato; se corrige el paso 5 de la Demo (Pablo pide 1 piolet el día 4 y lo consigue) (recommended)
     efecto: ninguno
     cliente: No: cada reserva es de una unidad; si hacen falta dos, se hacen dos reservas
  B) Añadir un campo cantidad a la reserva (cambia REQ-F-003, UC-003, API-002-01 e INV-RES-004)
     efecto: req-change
     cliente: Sí: al reservar se indica cuántas unidades, y solo se reserva si hay todas libres
Blocks: Demo FASE-0 paso 5
Answer: A — opción recomendada, aceptada por Andres Leon (Cliente) (2026-11-21)

## Q-task-implementer-002 [ANSWERED] skill=sdd-task-implementer context=FASE-2 observación de Andres Leon (2026-11-21) · src/ui/textos.js entregas.multa · tests/e2e/fase-2-devolucion.spec.js AC-006-03 tema=multa-un-dia-singular
Question: Con 1 día de retraso el aviso de la multa dice «Multa de 2 € a Lucía (1 días de retraso)». Corregirlo a «(1 día de retraso)» obliga a editar tests/e2e/fase-2-devolucion.spec.js (AC-006-03: título, expect, narración y captura), ya aceptado en FASE-2; los tests unitarios solo fijan el plural de 3 días. Sin un test-edit firmado no se toca y el cambio de textos.js rompería ese e2e.
Para el cliente: Con un día de retraso la multa dice «1 días de retraso»; para dejarlo en «1 día» hay que cambiar una prueba que ya aceptaste en la entrega 2, ¿autorizas ese cambio?
Options:
  A) Autorizar editar la prueba e2e de FASE-2 y corregir el texto a «1 día» (recommended)
     efecto: editar-test tests/e2e/fase-2-devolucion.spec.js
     cliente: Sí, se cambia la prueba y el aviso dice «1 día»
  B) Dejarlo como está («1 días»)
     efecto: ninguno
     cliente: No, se queda como está
Blocks: TASK-F3-007
Answer: A — opción recomendada, aceptada por Andres Leon (Cliente) (2026-11-21)

## Q-task-implementer-003 [ANSWERED] skill=sdd-task-implementer context=FASE-2 observación de Andres Leon (2026-11-21) · src/domain/prestamos.js consultarHistorial · src/ui/pantallas/historial.js tema=historial-material-sin-unidad
Question: En Historial una reserva aún sin entregar sale como «Sin unidad»; para mostrar el material («Piolet») la API debe devolver `material` en cada préstamo, y tests/unit/domain/prestamos-historial.test.js fija con toEqual las 4 claves exactas de cada fila, así que añadir una quinta lo rompe sin un test-edit firmado.
Para el cliente: En Historial una reserva sin entregar sale como «Sin unidad»; para que diga el material (p. ej. «Piolet») hay que cambiar una prueba ya aceptada en la entrega 2, ¿autorizas ese cambio?
Options:
  A) Autorizar editar tests/unit/domain/prestamos-historial.test.js, devolver `material` en el historial y mostrarlo cuando no hay unidad (recommended)
     efecto: editar-test tests/unit/domain/prestamos-historial.test.js
     cliente: Sí, se cambia la prueba y Historial muestra el material
  B) Dejar «Sin unidad»
     efecto: ninguno
     cliente: No, se queda «Sin unidad»
Blocks: TASK-F3-008
Answer: A — opción recomendada, aceptada por Andres Leon (Cliente) (2026-11-21)

## Q-task-implementer-004 [ANSWERED] skill=sdd-task-implementer context=design/OPERATION-MAPPING.md API-001-05 · tests/unit/server/cuentas.test.js «D-PA-003 ninguna ruta de la API crea ni cambia cuentas de encargado o junta» tema=ruta-restablecer-contrasena
Question: OPERATION-MAPPING fija `/api/socios/contrasena` para restablecerContrasena, pero tests/unit/server/cuentas.test.js (ya aceptado) prohíbe cualquier ruta cuyo texto contenga «contrasena»; se ha usado `/api/socios/restablecer` para no romperlo, y habría que editar ese test para volver a la ruta del mapa.
Para el cliente: Es un detalle interno de cómo se llama una dirección de la web y no cambia nada de lo que ve el encargado, ¿te parece bien dejarlo como está?
Options:
  A) Dejar la ruta `/api/socios/restablecer` y anotarlo (el mapa de operaciones queda con una diferencia de nombre) (recommended)
     efecto: ninguno
     cliente: Sí, déjalo como está
  B) Editar tests/unit/server/cuentas.test.js para permitir la ruta del mapa `/api/socios/contrasena`
     efecto: editar-test tests/unit/server/cuentas.test.js
     cliente: No, que se cambie la prueba y se use el nombre del mapa
Blocks: ninguna tarea
Answer: A — opción recomendada, aceptada por Andres Leon (Cliente) (2026-11-21)
