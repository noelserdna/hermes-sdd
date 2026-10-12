# Questions — plan-architect

## Q-plan-architect-001 [OPEN] skill=sdd-plan-architect context=plan/PLAN.md §8 G-1 · plan/CLARIFY-LOG.md D-PA-010
Question: Los requisitos no dicen qué hace `todo` ante un comando desconocido, un argumento ausente (`todo add`, `todo done`) o un id que no es entero positivo (`todo done abc`). ¿Qué comportamiento se implementa?
Options:
  A) Exit 2 con un mensaje de uso en stderr (`usage: todo <add|list|done|rm> …`), igual que los demás errores de validación (recommended)
  B) Exit 1 con un mensaje de uso, separando "uso incorrecto" de "dato inválido"
  C) Añadirlo como requisito formal con criterios (vía sdd-req-change) antes de implementar
Blocks: nada por ahora; el plan usa A como provisional (D-PA-010) y las tareas que lo implementen deberían citarlo
Answer: