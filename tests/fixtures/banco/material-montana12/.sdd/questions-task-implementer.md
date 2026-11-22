# Questions — task-implementer

<!-- Vista generada desde questions-task-implementer.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role task-implementer`. -->

## Q-task-implementer-001 [ANSWERED] skill=sdd-task-implementer context=tests/e2e/fase-0.spec.js:288 (AC-007-10, FASE-0 aceptada) · TASK-F1-005, TASK-F1-007 tema=test-fase-0-sin-boton-reservar
Question: El test e2e aceptado de FASE-0 AC-007-10 comprueba que `getByRole('button', { name: 'Reservar' })` tiene 0 elementos («Sin formulario ni botón «Reservar» todavía: llega en FASE-1»). FASE-1 (REQ-F-003, SCR-004, OPERATION-MAPPING API-002-01, botón «Reservar») añade justo ese botón a /reservar, así que esa comprobación falla y la suite e2e completa no puede quedar en verde. Los tests unitarios tests/unit/ui/reservar.test.js y entrar.test.js siguen pasando porque las funciones de página de FASE-0 no se han tocado (el formulario nuevo vive en paginaReservarConFormulario y paginaMisReservasConLista).
Para el cliente: ¿Se quita de una prueba de la entrega 0 la comprobación de que en Reservar todavía no hay botón «Reservar», que ya no vale porque esta entrega lo añade?
Options:
  A) Quitar solo la comprobación obsoleta «aún no hay botón Reservar» (línea 288) del test AC-007-10 de FASE-0; el resto del test (Casco se ofrece, Cuerda no) queda igual (recommended)
     efecto: editar-test tests/e2e/fase-0.spec.js
     cliente: Sí, se quita solo esa comprobación obsoleta
  B) No tocar el test de FASE-0 y dejar la suite e2e en rojo en esa comprobación hasta que una persona decida
     efecto: ninguno
     cliente: No, se deja la prueba como está
Blocks: fase-1-verified (suite e2e completa en verde); el commit de TASK-F1-007 no depende de ella
Answer: A — elegida por Andres Leon (Cliente) (2026-11-22)

## Q-task-implementer-002 [ANSWERED] skill=sdd-task-implementer context=tests/e2e/fase-0.spec.js:288 (AC-007-10, FASE-0 aceptada) · fase-1-accepted · revisión independiente de FASE-2 tema=test-fase-0-sin-boton-reservar-tras-aceptar-fase-1
Question: El test aceptado AC-007-10 de FASE-0 sigue comprobando que en Reservar hay 0 botones «Reservar» («todavía no: llega en FASE-1»). Desde FASE-1 ese botón existe y la prueba falla (verificado con SDD_FASE=0 npx playwright test --grep AC-007-10). La autorización de edición de Q-task-implementer-001 caducó al aceptar fase-1-accepted y el test se restauró (8c828aa). Sin un registro test-edit firmado nuevo no se puede quitar esa única comprobación obsoleta (línea 288).
Para el cliente: La prueba de la entrega 0 todavía exige que en Reservar no haya botón «Reservar», pero desde la entrega 1 sí lo hay, así que falla. ¿Autoriza quitar de nuevo solo esa comprobación?
Options:
  A) Quitar solo la comprobación obsoleta de la línea 288 del test AC-007-10; el resto (Casco se ofrece, Cuerda no) queda igual (recommended)
     efecto: editar-test tests/e2e/fase-0.spec.js
     cliente: Sí, se quita solo esa comprobación obsoleta
  B) Dejar el test como está y aceptar que falla
     efecto: ninguno
     cliente: No, se deja la prueba como está
Blocks: suite e2e completa en verde (solo el test de FASE-0 AC-007-10); no bloquea FASE-2
Answer: A — elegida por Andres Leon (Cliente) (2026-11-22)

## Q-task-implementer-003 [ANSWERED] skill=sdd-task-implementer context=Observaciones del cliente al aceptar FASE-2 (TASK-F3-008 y TASK-F3-010). 1) El Panel del encargado dice «No tienes multas»; debe decir «No hay multas». Esa frase está fijada en tests aceptados: tests/unit/ui/panel.test.js:79 y tests/e2e/fase-2.spec.js:124,139,141,190,191 (AC-011-01, AC-017-08). 3) En «No recogida» (AC-010-04) la voz dice que las unidades quedan libres pero el vídeo no lo enseña: hace falta que otro socio reserve esas unidades esas fechas dentro del propio test de tests/e2e/fase-2.spec.js. No hay registro test-edit firmado para esos ficheros (solo tests/e2e/fase-0.spec.js). tema=observaciones-fase-2-editar-tests-panel
Question: ¿Se autoriza editar tests/unit/ui/panel.test.js y tests/e2e/fase-2.spec.js solo para (a) cambiar «No tienes multas» por «No hay multas» en las comprobaciones del Panel del encargado y (b) ampliar el test AC-010-04 para que se vea reservar de nuevo las unidades de la «No recogida»? Sin quitar ninguna comprobación existente.
Para el cliente: Para que el Panel del encargado diga «No hay multas» y para que el vídeo de «No recogida» enseñe que las unidades quedan libres, hay que retocar dos pruebas de la entrega 2 ya aceptada. ¿Autoriza retocarlas solo para eso, sin quitar nada de lo que comprueban?
Options:
  A) Editar solo esas dos pruebas: nuevo texto «No hay multas» en las comprobaciones del Panel y, en AC-010-04, un paso final en el que otra socia reserva las mismas unidades y las consigue; no se quita ninguna comprobación (recommended)
     efecto: editar-test tests/unit/ui/panel.test.js tests/e2e/fase-2.spec.js
     cliente: Sí, se retocan solo esas dos pruebas para lo que pidió
  B) No tocar las pruebas de la entrega 2: el Panel sigue diciendo «No tienes multas» y el vídeo de «No recogida» queda como está
     efecto: ninguno
     cliente: No, se dejan como están
Blocks: TASK-F3-008, TASK-F3-010
Answer: A — elegida por Andres Leon (Cliente) (2026-11-22)

## Q-task-implementer-004 [ANSWERED] skill=sdd-task-implementer context=TASK-F3-010 · AC-010-04 (REQ-F-005 AC7, observación 3 de FASE-2) · tests/e2e/fase-2.spec.js:115 · .sdd/demo/GUION-FASE-2.md:41. Cuando una reserva no se recoge, sus fechas ya han pasado y la web no deja reservar fechas pasadas («La fecha de inicio no puede ser pasada»). tema=no-recogida-unidades-libres-en-el-video
Question: La observación pide que, tras una «No recogida», otro socio reserve las mismas 2 × Casco en las mismas fechas (2026-12-05..07) y vea «Reserva creada». Pero el Panel se abre el 2026-12-08, esas fechas ya son pasadas y la reserva se rechaza (RN-029, API-002-01). Retrasar el reloj de la demo no prueba nada: antes del 8 la reserva sigue activa y esas unidades NO están libres. ¿Cómo se enseña que las unidades quedan libres?
Para el cliente: Como la web no deja reservar fechas que ya han pasado, el vídeo de «No recogida» no puede enseñar que las unidades quedan libres reservándolas de nuevo: ¿qué prefieres?
Options:
  A) No cambiar el test de «No recogida»: el vídeo sigue enseñando «No recogida», sin Entregar y sin multa; que las unidades quedan libres lo prueba el test de disponibilidad (tests/unit/disponibilidad.test.js) y se anota como límite conocido de la observación 3 (recommended)
     efecto: ninguno
     cliente: Se deja el vídeo como está y se explica que no se puede enseñar reservando
  B) Quitar de la locución de AC-010-04 la frase «sus unidades quedan libres», para que la voz no diga lo que el vídeo no enseña; no se quita ninguna comprobación
     efecto: editar-test tests/e2e/fase-2.spec.js
     cliente: Se cambia solo la frase que dice la voz del vídeo
  C) Cambiar el criterio para poder reservar fechas pasadas o mostrar disponibilidad histórica en el Panel (cambio de requisito, con su propia puerta)
     efecto: req-change
     cliente: Se pide un cambio de requisitos, que se decide aparte
Blocks: TASK-F3-010
Answer: A — opción recomendada, aceptada por Jev (regla) (Agente automático (modo auto)) (2026-11-22)

## Q-task-implementer-005 [ANSWERED] skill=sdd-task-implementer context=REQ-F-005 AC3 y AC9 (AC-011-01, AC-017-08, tests/e2e/fase-2.spec.js); informe .sdd/hermes/fidelidad-3.json: 8 vínculos graves. «Mis multas» no existe hasta la FASE-4 (REQ-F-006) y, tras Q-task-implementer-003, la captura enseña «No hay multas» en el Panel del encargado. tema=no-tienes-multas-en-mis-multas-sin-pantalla
Question: REQ-F-005 AC3 y AC9 piden ver «No tienes multas» en «Mis multas» cuando Lucía la abre. ¿Cómo se deja esa línea «Se ve» hasta que exista esa pantalla?
Para el cliente: El requisito pide que Lucía vea «No tienes multas» en su pantalla de multas, que no existe hasta la entrega 4: ¿se enseña entonces o se cambia el requisito?
Options:
  A) Dejar las capturas como están y enseñar «No tienes multas» en Mis multas cuando exista, en la FASE-4 (una prueba nueva allí que cite REQ-F-005 AC3 y AC9). No se toca ninguna prueba aceptada. (recommended)
     efecto: ninguno
     cliente: Se enseña cuando exista la pantalla, en la entrega 4
  B) Cambiar la línea «Se ve» de REQ-F-005 AC3 y AC9 a «No hay multas» en Panel del encargado (cambio de requisito con su propia puerta).
     efecto: req-change
     cliente: Cambiar el requisito para que diga lo que enseña hoy la web
Blocks: veredicto de REQ-F-005 AC3 y AC9 en la entrega 3
Answer: A — elegida por Andres Leon (Cliente) (2026-11-22)

## Q-task-implementer-006 [ANSWERED] skill=sdd-task-implementer context=FASE-3 · REQ-F-002 AC5 (AC-005-01) y AC6 (AC-006-01) · tests/e2e/fase-3-alta-primer-acceso.spec.js · sdd lint --captures C-06 tema=captura-de-dos-personas-en-un-criterio
Question: El «Se ve» de REQ-F-002 AC5 («Contraseña provisional guardada para Marta Ruiz», «Elige una contraseña nueva», «Correo o contraseña incorrectos») y de AC6 («Socio dado de baja: Marta Ruiz», «Correo o contraseña incorrectos») mezcla textos de la pantalla del encargado y de la de Marta. Con los avisos ya aislados por sesión (petición de la persona) esos textos no pueden estar en una sola pantalla, y «sdd lint --captures» (C-06) exige todos en cada llamada a captura. La captura enseña ahora la pantalla del encargado (el aviso) y el resto se comprueba en el test y se ve en el vídeo, así que C-06 sigue dando error en esos dos criterios.
Para el cliente: En dos criterios (restablecer contraseña y dar de baja) lo que tiene que verse está en la pantalla del encargado y en la de Marta, y como ahora ningún aviso pasa de una persona a otra, no caben en una sola foto. ¿Cómo lo dejamos?
Options:
  A) Mantener la captura de la pantalla del encargado; la reacción de Marta se comprueba en el test y se enseña en el vídeo. El aviso de lint C-06 queda como excepción de la persona. (recommended)
     efecto: ninguno
     cliente: La foto enseña lo que ve el encargado; lo que ve Marta se ve en el vídeo y lo comprueba la prueba
  B) Reescribir el «Se ve» de AC5 y AC6 para que cada criterio nombre solo los textos de una pantalla
     efecto: req-change
     cliente: Se cambian esos dos criterios para que cada uno hable de una sola pantalla
Blocks: sdd lint --captures --fase 3 (C-06 en AC-005-01 y AC-006-01)
Answer: A — elegida por Andres Leon (Cliente) (2026-11-22)

## Q-task-implementer-007 [ANSWERED] skill=sdd-task-implementer context=FASE-4 Phase 9: ejecución completa de los e2e tema=e2e-fase-0-intermitente
Question: Dos pruebas e2e de la FASE-0 fallan a veces en la suite completa, también en el commit 3712fd9 (antes de cualquier código de la FASE-4): tests/e2e/fase-0.spec.js:84 AC-001-04 (el bucle de 5 intentos pulsa «Entrar» mientras el login anterior sigue en vuelo; entrar.js ignora un envío si hay otro pendiente, así que solo se cuentan 4 fallos y el sexto login responde «Correo o contraseña incorrectos» en vez de «Cuenta bloqueada…») y :320 «sigue en el servidor tras pararlo y arrancarlo» (page.goto net::ERR_ABORTED justo tras reiniciar en el puerto 5175). Las dos pasan si se ejecutan solas. Son pruebas aceptadas de la FASE-0: esta etapa no puede editarlas sin un registro test-edit firmado.
Para el cliente: Dos pruebas antiguas de la entrega 0 fallan a veces (no siempre) aunque la web funciona bien: van con demasiada prisa. ¿Se permite retocarlas solo para que esperen a que termine cada paso, sin quitarles ninguna comprobación?
Options:
  A) Hacer que las dos pruebas esperen a la respuesta de cada login y al servidor reiniciado antes del paso siguiente, sin quitar ninguna comprobación (recommended)
     efecto: endurecer-test tests/e2e/fase-0.spec.js
     cliente: Sí, se retocan solo para que esperen; siguen comprobando lo mismo
  B) Dejarlas como están y repetir la suite hasta que pase
     efecto: ninguno
     cliente: No se tocan; se repite la suite hasta que pasen
Blocks: suite e2e de la FASE-0 en verde en cada ejecución (ninguna tarea de la FASE-4)
Answer: A — elegida por Andres Leon (Cliente) (2026-11-22)

## Q-task-implementer-008 [ANSWERED] skill=sdd-task-implementer context=Observación del cliente al aceptar FASE-4 (Q1): REQ-F-005 AC3 (AC-011-01) y AC9 (AC-017-08) siguen sin enseñar «No tienes multas». Sus pruebas y capturas están en tests/e2e/fase-2.spec.js:130 y :184 y hoy enseñan «No hay multas» en el Panel del encargado. Mis multas ya existe desde FASE-4. Ningún registro test-edit firmado posterior a la aceptación de FASE-4 lista ese fichero (el de Q-task-implementer-003 es anterior). TASK-F5-007 está bloqueada. tema=no-tienes-multas-en-mis-multas-de-lucia-en-fase-2
Question: ¿Se autoriza editar tests/e2e/fase-2.spec.js solo para que AC-011-01 (REQ-F-005 AC3) y AC-017-08 (REQ-F-005 AC9) abran «Mis multas» de Lucía tras lo que ya hacen y comprueben, narren y capturen «No tienes multas», manteniendo todas sus comprobaciones actuales?
Para el cliente: Para que en los vídeos de «devolver a tiempo» y «retraso aún sin devolver» se vea la pantalla Mis multas de Lucía con «No tienes multas», hay que retocar esas dos pruebas antiguas de la entrega 2. ¿Das permiso?
Options:
  A) Sí: se retocan solo esas dos pruebas para añadir el paso de Mis multas de Lucía; no se quita ninguna comprobación. (recommended)
     efecto: editar-test tests/e2e/fase-2.spec.js
     cliente: Sí, se retocan solo esas dos pruebas para enseñar «No tienes multas».
  B) No: se quedan como están y «No tienes multas» no se enseña en esos dos criterios.
     efecto: ninguno
     cliente: No, se dejan como están.
Blocks: TASK-F5-007
Answer: A — elegida por Andres Leon (Cliente) (2026-11-22)
