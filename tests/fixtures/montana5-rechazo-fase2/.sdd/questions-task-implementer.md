# Questions — task-implementer

<!-- Vista generada desde questions-task-implementer.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role task-implementer`. -->

## Q-task-implementer-001 [ANSWERED] skill=sdd-task-implementer context=REQ-F-002 AC5 / AC-002-06 en FASE-0 tema=reenvio-mis-reservas-fase-0
Question: REQ-F-002 AC5 (AC-002-06) promete ver «Piolet» y «2026-12-10» una sola vez en «Mis reservas», una pantalla que llega en la FASE-1. En la FASE-0 la idempotencia de reserve se prueba con datos, pero no puede haber captura narrada de esa pantalla (sdd lint --captures: C-07).
Para el cliente: Al repetir el envío de una reserva, el socio debe seguir viendo una sola reserva en «Mis reservas». Esa pantalla se construye en la entrega siguiente: ¿damos por bueno enseñarlo entonces?
Options:
  A) Comprobar ahora la regla con datos y enseñar la pantalla «Mis reservas» en la FASE-1, donde ya existe (se mueve el criterio de entrega) (recommended)
     efecto: req-change
     cliente: Sí: lo comprobamos ahora internamente y lo enseñamos cuando exista la pantalla
  B) Dejarlo como está: el criterio sigue en la FASE-0 sin captura de pantalla
     efecto: ninguno
     cliente: Dejarlo así, sin enseñarlo en pantalla en esta entrega
Blocks: ninguna tarea; solo la captura narrada de REQ-F-002 AC5 en el cierre de la FASE-0
Answer: A — opción recomendada, aceptada por Ana (Cliente) (2026-11-18)

## Q-task-implementer-002 [OPEN] skill=sdd-task-implementer context=FASE-2, REQ-F-012 AC4 (AC-010-06) tema=reforzar-pruebas-reserva-encargado-junta
Question: REQ-F-012 AC4 sale MISSING (3/4): tests/unit/views-fase0.test.js:195 y tests/unit/views-fase1.test.js:46, aceptados en FASEs anteriores, citan el criterio pero no tienen el literal «No tienes permiso para hacer esto», ni la cláusula «nothing changes» aparte, ni la alternativa «junta@club.es» (sdd lint --quotes Q-03/Q-04/Q-05). Los tests nuevos de la FASE-2 (tests/unit/permisos.test.js y el recorrido e2e) ya lo comprueban entero. ¿Se endurecen esos dos tests (solo añaden comprobaciones y citas, no quitan ninguna)?
Para el cliente: Dos pruebas antiguas comprueban de forma incompleta que el encargado y la junta no pueden reservar ni cancelar, y por eso esa regla no se puede dar por comprobada. ¿Se refuerzan para que comprueben el aviso exacto y a los dos roles?
Options:
  A) Endurecer los dos tests: añadir el literal del aviso, la cláusula «nothing changes» y el caso de la junta, sin quitar nada (recommended)
     efecto: endurecer-test tests/unit/views-fase0.test.js tests/unit/views-fase1.test.js
     cliente: Sí, se refuerzan esas dos pruebas para que comprueben todo lo que pide la regla
  B) Dejarlos como están: REQ-F-012 AC4 queda sin comprobar hasta que alguien decida
     efecto: ninguno
     cliente: No: se dejan como están y la regla queda sin dar por comprobada
Blocks: Veredicto de REQ-F-012 (AC4) en la aceptación de la FASE-2
Answer:

## Q-task-implementer-003 [OPEN] skill=sdd-task-implementer context=FASE-2, REQ-F-012 AC1/AC2/AC4 (AC-010-01, AC-010-02, AC-010-06) tema=aviso-de-permiso-sin-boton
Question: La junta no tiene botón «Entregar», el socio no tiene «Marcar como pagada» y el encargado o la junta no ven el formulario de Reservar, así que no hay un control con el que «intentar» esas acciones. Por defecto, api-client.js pinta un aviso role=alert «No tienes permiso para hacer esto» al inicio de la página cuando el servidor rechaza una acción (E_FORBIDDEN_ACTION); el recorrido e2e lanza el intento con el cliente de la propia web. ¿Se queda así o se añaden controles visibles para todos los roles (el servidor sigue decidiendo)?
Para el cliente: Quien no tiene permiso para entregar, cobrar o reservar no ve el botón correspondiente; si la acción se envía de todos modos, la web avisa «No tienes permiso para hacer esto». ¿Se queda así, sin botones que no sirven?
Options:
  A) Mantener el aviso global de permiso y sin controles para los roles sin permiso (recommended)
     efecto: ninguno
     cliente: Sí, se queda así: sin botones para quien no puede usarlos
  B) Mostrar los botones a todos los roles y dejar que el servidor rechace
     efecto: accion
     cliente: No: se muestran los botones a todos y la web avisa al pulsarlos sin permiso
Blocks: ninguna tarea; solo el modo de enseñar AC-010-01, AC-010-02 y AC-010-06 en la demo
Answer:
