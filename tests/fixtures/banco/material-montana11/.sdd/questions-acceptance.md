# Questions — acceptance

<!-- Vista generada desde questions-acceptance.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role acceptance`. -->

## Q-acceptance-001 [ANSWERED] skill=sdd-acceptance context=CH-008 (SPEC-QUESTION, adversarial round at 7d4c792) · src/ui/pantallas/prestado.js:51 tema=casco-2-dia-7-prestado-ahora
Question: REQ-F-009 AC2 dice que, con el día 2026-12-07 elegido, el usuario no ve el Casco 2; hoy aparece bajo «Prestado ahora» y no bajo «Vuelven hoy». Decidir si «no ver» significa toda la pantalla o solo la lista «Vuelven hoy».
Para el cliente: Cuando el encargado elige el día 7 de diciembre, ¿el Casco 2 debe desaparecer de toda la pantalla, o basta con que no aparezca en «Vuelven hoy» mientras sigue en «Prestado ahora»?
Options:
  A) Hide Casco 2 from the whole screen on 2026-12-07 (the criterion as written) (recommended)
     efecto: accion src/ui/pantallas/prestado.js
     cliente: Sí: ese día el Casco 2 no sale en la pantalla, ni en «Prestado ahora» ni en «Vuelven hoy»
  B) Amend the criterion so it only says the item is not under 'Vuelven hoy' (the screen stays as it is)
     efecto: req-change
     cliente: No: el Casco 2 sigue saliendo en «Prestado ahora»; el requisito se cambia para decir solo eso
Blocks: CH-008; gate de la fase 5 (adversarial_gate: enforce)
Answer: B — elegida por Andres Leon (Cliente) (2026-11-22)
