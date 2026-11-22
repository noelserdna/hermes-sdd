# Questions — acceptance

<!-- Vista generada desde questions-acceptance.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role acceptance`. -->

## Q-acceptance-001 [ANSWERED] skill=sdd-acceptance context=REQ-F-004 AC3 (AC-009-02, tests/e2e/fase-1.spec.js:265-289) · evidencias/FASE-1/AC-009-02.png · impugnación CH-005 (stale) tema=pantalla-del-aviso-ya-cancelada-y-sin-unidades
Question: REQ-F-004 AC3 pide ver en «Mis reservas» tanto «La reserva ya estaba cancelada» como «No hay unidades libres: solo queda 1 de Casco el 2026-12-05». La captura AC-009-02 muestra el primero en Reservar (tras pulsar Cancelar en Mis reservas y reservar de nuevo) y el segundo aviso solo sale en Reservar, nunca en Mis reservas. El criterio pasa en la suite, pero la captura no muestra la pantalla que su línea «Se ve» nombra, y su narración dice «Mis reservas» sobre una captura de Reservar. Hace falta decidir en qué pantalla debe verse cada texto.
Para el cliente: Cuando Lucía vuelve a pulsar «Cancelar» en una reserva ya cancelada, ¿el aviso «No hay unidades libres» debe verse también en «Mis reservas», o basta con verlo en «Reservar»?
Options:
  A) Mantener el comportamiento actual: «La reserva ya estaba cancelada» en Mis reservas y «No hay unidades libres» en Reservar. Corregir la línea «Se ve» de REQ-F-004 AC3 (vía /sdd-req-change) y la narración de AC-009-02 para que lo digan así; la captura queda como está (recommended)
     efecto: ninguno
     cliente: Sí, cada aviso se ve en la pantalla donde se produce
  B) Mostrar «No hay unidades libres» también en Mis reservas al repetir Cancelar; cambia el código de la pantalla de Mis reservas y la prueba AC-009-02 para capturar ambos avisos allí
     efecto: editar-test tests/e2e/fase-1.spec.js src/ui/paginas/mis-reservas.js
     cliente: Sí, quiero ver ambos avisos en Mis reservas
Blocks: verdict de REQ-F-004 AC3 (la captura no muestra la pantalla de su «Se ve»); fase-1 acceptance
Answer: A — elegida por Andres Leon (Cliente) (2026-11-22)

## Q-acceptance-002 [ANSWERED] skill=sdd-acceptance context=REQ-F-002 AC5 (tests/e2e/fase-3-alta-primer-acceptance.spec.js) · CH-010 (inconclusive, Must, ronda adversarial de la FASE-3 en fcc5135) · src/server/servicios/cuentas.js:43 y :130 tema=restablecer-contrasena-desbloquea-cuenta
Question: REQ-F-002 AC5 dice que tras el restablecimiento del encargado el socio entra con la nueva contraseña y ya no con la antigua. Pero si el socio falló la contraseña varias veces, su cuenta sigue bloqueada (INV-SOC-004): restablecer la contraseña no quita el bloqueo, así que no podría entrar con la nueva hasta que caduque. ¿El restablecimiento debe quitar el bloqueo?
Para el cliente: Si el encargado restablece la contraseña de un socio que tenía la cuenta bloqueada por fallos, ¿el socio puede entrar en ese momento con la nueva contraseña, o tiene que esperar a que se levante el bloqueo?
Options:
  A) Restablecer la contraseña quita el bloqueo y el contador de fallos de esa cuenta. Es lo que dice el criterio (entra con la nueva) y lo habitual cuando lo hace el encargado (recommended)
     efecto: accion src/server/servicios/cuentas.js
     cliente: Sí, al restablecer la contraseña el socio puede entrar en el acto con la nueva
  B) El bloqueo sigue hasta que caduque. El criterio se reescribe para decir que con la nueva contraseña entra cuando termine el bloqueo
     efecto: req-change requirements/REQUIREMENTS.md
     cliente: No, el socio espera a que caduque el bloqueo
Blocks: CH-010 (REQ-F-002 Must) · gate de la FASE-3 en salida 4
Answer: A — elegida por Andres Leon (Cliente) (2026-11-22)

## Q-acceptance-003 [ANSWERED] skill=sdd-acceptance context=REQ-NF-001 AC3 (Must) · desafío CH-011 (SPEC-QUESTION, confirmado, abierto) · src/server/mensajes.js:5-6 (E_ACCESO_DENEGADO, E_PAGINA_PROHIBIDA) · src/server/http/autorizar.js:36 · tests/integration/aislamiento.test.js:98 · spec/CLARIFICATIONS.md RN-020 tema=texto-al-abrir-lista-de-socios-sin-permiso
Question: REQ-NF-001 AC3 dice que, si un socio abre la lista de socios, la web responde «Acceso denegado». La web responde «No tienes permiso para ver esta página», porque RN-020 (spec/CLARIFICATIONS.md) manda ese texto al abrir una página no permitida (E_PAGINA_PROHIBIDA) y «Acceso denegado» para una operación o un dato ajeno (E_ACCESO_DENEGADO). La prueba tests/integration/aislamiento.test.js:98 comprueba el texto que da la web. Hay que decidir cuál de los dos textos vale para la lista de socios; la etapa de aceptación no lo decide.
Para el cliente: Cuando una socia abre la lista de socios, ¿la web debe decir «Acceso denegado», como pone la redacción acordada, o «No tienes permiso para ver esta página», como ya dice para las páginas que no se pueden abrir y como hace ahora?
Options:
  A) Mantener el comportamiento actual: al abrir la lista de socios sale «No tienes permiso para ver esta página», igual que en el resto de páginas prohibidas (RN-020). La diferencia con la redacción acordada se anota como supuesto para revisar en la próxima entrega. (recommended)
     efecto: ninguno
     cliente: Se mantiene el mensaje de página prohibida
  B) Cambiar la lista de socios para que diga «Acceso denegado», solo en esa página. La implementación haría el cambio de código; la prueba de tests/integration/aislamiento.test.js:98 necesitaría su propia aprobación de edición.
     efecto: accion
     cliente: La lista de socios dice «Acceso denegado»
Blocks: Puerta de FASE-5 (sdd gate exit 4): el desafío CH-011 sigue abierto sobre REQ-NF-001 AC3, un Must. REQ-NF-001 queda VERIFIED en el informe, pero la FASE no se puede aceptar hasta que se resuelva o se descarte el desafío.
Answer: A — elegida por Andres Leon (Cliente) (2026-11-22)
