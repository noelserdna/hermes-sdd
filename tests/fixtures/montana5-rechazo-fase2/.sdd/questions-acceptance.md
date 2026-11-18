# Questions — acceptance

<!-- Vista generada desde questions-acceptance.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role acceptance`. -->

## Q-acceptance-001 [OPEN] skill=sdd-acceptance context=FASE-2, REQ-F-005 AC3 (AC-005-03) tema=captura-reserva-cancelada-pendientes
Question: REQ-F-005 AC3 pasa (e2e y unit) pero queda 'unshown': el test e2e AC-005-03 de tests/e2e/fase-2-ciclo-de-prestamo.spec.js:108 no llama a captura(), así que no hay evidencias/FASE-2/AC-005-03.png. Añadir la captura de 'Sin pendientes de entrega' es editar un test existente.
Para el cliente: ¿Se puede añadir una captura de la pantalla «Pendientes de entrega» vacía (sin la reserva cancelada de Lucía) para poder enseñar este criterio en la demo?
Options:
  A) Add captura(page, testInfo, 'AC-005-03', {ve:['Sin pendientes de entrega']}) after the assertions; no assertion changes (recommended)
     efecto: endurecer-test tests/e2e/fase-2-ciclo-de-prestamo.spec.js
     cliente: Sí, se añade la captura; la prueba no cambia lo que comprueba
  B) Leave it unshown and waive visual evidence for this criterion
     efecto: ninguno
     cliente: No; este criterio queda sin captura y hay que exentarlo
Blocks: Aceptación de FASE-2 (REQ-F-005)
Answer:
