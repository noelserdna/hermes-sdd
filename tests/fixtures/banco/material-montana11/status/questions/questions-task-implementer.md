# Questions — task-implementer

<!-- Vista generada desde questions-task-implementer.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role task-implementer`. -->

## Q-task-implementer-001 [ANSWERED] skill=sdd-task-implementer context=tests/unit/permisos.test.js:19 compara Object.keys(OPERACIONES) con la lista exacta de las 5 operaciones de FASE-0; cada FASE añade operaciones y el test aceptado lo rompe tema=permisos-test-conjunto-cerrado
Question: El test aceptado tests/unit/permisos.test.js fija el conjunto cerrado de operaciones de permisos.js. Para no editarlo, las operaciones de FASE-1 se registran en una tabla aparte (OPERACIONES_FASE_1) que autorizar() fusiona. ¿Se autoriza editarlo para que compruebe que las operaciones de FASE-0 están (sin fijar la lista completa) y que solo iniciarSesion es pública?
Para el cliente: Una comprobación interna de la web impide añadir funciones nuevas de forma limpia. Es un detalle técnico que no cambia nada de lo que ves; solo hace falta permiso para retocar esa comprobación.
Options:
  A) Dejar el test como está y seguir registrando las operaciones de cada FASE en su propia tabla (recomendada: no cambia nada) (recommended)
     efecto: ninguno
     cliente: Se deja como está; las funciones nuevas se registran aparte
  B) Editar tests/unit/permisos.test.js para comprobar que las operaciones de FASE-0 están y que solo iniciarSesion es pública, sin fijar la lista cerrada
     efecto: editar-test tests/unit/permisos.test.js
     cliente: Se retoca la comprobación para que admita funciones nuevas
Blocks: ninguna
Answer: A — opción recomendada, aceptada por Jev (regla) (Agente automático (modo auto)) (2026-11-21)

## Q-task-implementer-002 [ANSWERED] skill=sdd-task-implementer context=FASE-3 · sdd lint --quotes: tests/unit/multas.test.js:41 (REQ-F-006 AC2, aceptado en FASE-2) tema=literal-sin-multas-test-fase-2
Question: lint --quotes da Q-03 en tests/unit/multas.test.js:41: el test de REQ-F-006 AC2 (FASE-2, dominio) no contiene el literal "Sin multas", que es texto de pantalla y no de dominio. Ese texto ya lo comprueban tests/unit/ui-mis-multas.test.js y la captura AC-010-02 de FASE-3 (fase-3-ciclo-multas.spec.js). Editar un test aceptado exige un registro test-edit del notario.
Para el cliente: Una comprobación interna de una entrega anterior no menciona el texto «Sin multas», que ya se comprueba y se enseña en la pantalla de Multas. ¿Se deja como está?
Options:
  A) Dejarlo: el literal lo cubren el test de la pantalla Mis multas y la captura de Multas de FASE-3; no se edita el test aceptado (recommended)
     efecto: ninguno
     cliente: Se deja como está; el texto ya se comprueba en pantalla
  B) Autorizar la edición de tests/unit/multas.test.js para que su test de REQ-F-006 AC2 lleve el literal
     efecto: editar-test tests/unit/multas.test.js
     cliente: Se retoca esa comprobación interna para que mencione el texto
Blocks: ninguna tarea; solo el aviso Q-03 de lint --quotes
Answer: B — elegida por Andres Leon (Cliente) (2026-11-22)

## Q-task-implementer-003 [ANSWERED] skill=sdd-task-implementer context=tests/unit/ui-socios.test.js (aceptado en FASE-1) exige que cada fila de la tabla Socios tenga exactamente 3 celdas (nombre, correo, estado). El wireframe SCR-006 pone una 4.ª columna «Acciones» con «Restablecer contraseña» y «Dar de baja» en la fila. tema=ui-socios-test-tres-columnas
Question: Para no editar el test aceptado, las acciones de FASE-4 se pintan en una lista «Acciones» bajo la tabla (un grupo de botones por socio Activa), no en una 4.ª celda de la fila. ¿Se autoriza editar tests/unit/ui-socios.test.js para que admita la columna de acciones, como dibuja el wireframe?
Para el cliente: Los botones «Restablecer contraseña» y «Dar de baja» funcionan igual, pero hoy salen en una lista justo debajo de la tabla de socios y no al final de cada fila, porque una comprobación interna de una entrega anterior exige que la fila tenga solo tres datos. ¿Se deja así o se retoca esa comprobación para ponerlos en la fila?
Options:
  A) Dejar el test como está: las acciones van en una lista bajo la tabla (la recomendada: no cambia nada de lo aceptado) (recommended)
     efecto: ninguno
     cliente: Se deja así; los botones salen bajo la tabla de socios
  B) Editar tests/unit/ui-socios.test.js para admitir la 4.ª columna Acciones y mover los botones a la fila
     efecto: editar-test tests/unit/ui-socios.test.js
     cliente: Se retoca esa comprobación interna y los botones pasan a la fila de cada socio
Blocks: ninguna tarea
Answer: A — elegida por Andres Leon (Cliente) (2026-11-22)

## Q-task-implementer-004 [ANSWERED] skill=sdd-task-implementer context=FASE-4 · sdd lint --quotes --fase 4: Q-03 en tests/e2e/fase-1-reservas.spec.js:61, tests/unit/inventario.test.js:18 y tests/unit/ui-inventario.test.js:17 (REQ-F-008 AC1, aceptados en FASE-1): el criterio se escribe con la plantilla «{tipo}: {n} unidades» y el lint pide la forma «unidad(es)» en el código del test. La FASE-4 cierra REQ-F-008 y su test nuevo (tests/e2e/fase-4-cuentas-inventario.spec.js AC-013-01) sí la lleva. tema=literal-unidades-tests-fase-1
Question: ¿Se autoriza editar esos tres tests aceptados para que comprueben también la forma «unidad(es)» (solo añade comprobación, no quita ninguna)?
Para el cliente: Tres comprobaciones internas de entregas anteriores no mencionan la forma «1 unidad» / «3 unidades» del recuento de Inventario, que ya se comprueba en la pantalla. ¿Se dejan como están?
Options:
  A) Dejarlos: el recuento «Crampones: 2 unidades» ya lo comprueban esos tests y el de FASE-4 lleva la forma completa (recomendada: no cambia nada aceptado) (recommended)
     efecto: ninguno
     cliente: Se dejan como están; el texto ya se comprueba en pantalla
  B) Endurecer los tres tests para que lleven la forma «unidad(es)»
     efecto: endurecer-test tests/e2e/fase-1-reservas.spec.js tests/unit/inventario.test.js tests/unit/ui-inventario.test.js
     cliente: Se retocan esas comprobaciones internas para que mencionen la forma del recuento
Blocks: ninguna tarea; solo el aviso Q-03 de lint --quotes
Answer: A — elegida por Andres Leon (Cliente) (2026-11-22)

## Q-task-implementer-005 [ANSWERED] skill=sdd-task-implementer context=FASE-5 · TASK-F5-003 · tests/unit/permisos.test.js:34 (aceptado en FASE-0) exige que la junta reciba E_ACCESO_NO_PERMITIDO en listarSocios; el Supuesto 1 de PLAN-FASE-5 abre listarSocios a la junta en solo lectura para el selector del Historial. Sin editarlo, la junta obtiene la lista de socios por una operación de lectura propia (listarSociosHistorial). tema=permisos-test-junta-listar-socios
Question: El test aceptado tests/unit/permisos.test.js («INV-ACC-007 … la junta también») fija que la junta no puede llamar a listarSocios, y el Supuesto 1 de FASE-5 dice lo contrario. ¿Se autoriza editar tests/unit/permisos.test.js para que la junta pueda listarSocios en solo lectura y retirar la operación propia?
Para el cliente: Para elegir un socio la junta necesita ver la lista de socios, pero una comprobación interna antigua se lo prohíbe, así que hoy la ve por una vía de solo lectura aparte: ¿se deja así o se retoca esa comprobación?
Options:
  A) Dejar el test como está: la junta lista socios con listarSociosHistorial (solo lectura, solo junta); la desviación queda anotada como SPEC-DEVIATION (recommended)
     efecto: ninguno
     cliente: Se deja así; la junta ve la lista de socios por una vía de solo lectura propia
  B) Editar tests/unit/permisos.test.js para que la junta pueda listarSocios (solo lectura, Supuesto 1) y abrir esa operación a la junta
     efecto: editar-test tests/unit/permisos.test.js
     cliente: Se retoca la comprobación interna y la junta usa la misma lista de socios que el encargado
Blocks: ninguna tarea
Answer: A — elegida por Andres Leon (Cliente) (2026-11-22)
