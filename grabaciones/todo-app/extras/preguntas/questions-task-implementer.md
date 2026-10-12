# Questions — task-implementer

## Q-task-implementer-001 [OPEN] skill=sdd-task-implementer context=TASK-F0-008 · IF-0-005 · REQ-F-001 AC3 vs REQ-F-006 AC3
Question: Con `data/todos.json` corrupto, `todo add ""` cumple dos criterios incompatibles: REQ-F-001 AC3 ("GIVEN any state" → exit 2, `title must not be empty`) y REQ-F-006 AC3 ("WHEN any command runs" → exit 4, `data/todos.json is not valid JSON`). ¿Cuál debe prevalecer?
Options:
  A) Prevalece el fichero corrupto (exit 4), como hace hoy el código siguiendo el orden del plan; aclarar REQ-F-001 AC3 con sdd-req-change (recommended)
  B) Prevalece la validación del título (exit 2): validar el título antes de cargar el fichero; aclarar REQ-F-006 AC3
  C) Dejarlo sin especificar y no probar la combinación
Blocks: nada de FASE-0 (comportamiento actual = A); un test de la combinación cuando se decida
Answer:

## Q-task-implementer-002 [OPEN] skill=sdd-task-implementer context=FASE-1 · IF-1-005 · REQ-F-006 AC3 vs D-PA-010
Question: Con `data/todos.json` corrupto, un id inválido (`todo done abc`, `todo rm 0`) sale hoy con exit 2 y el mensaje de uso, porque el plan (D-PA-010, PLAN-FASE-1 §4.2) manda validar el id antes de leer el fichero; pero REQ-F-006 AC3 dice "WHEN any command runs THEN … exit code 4" y en Q-task-implementer-001 se eligió que el fichero corrupto prevalece (`add ""` → 4). ¿Qué regla única debe valer para todos los errores de uso frente a un fichero corrupto?
Options:
  A) El uso inválido prevalece (exit 2) para todos los comandos, también `add ""`; aclarar REQ-F-006 AC3 ("any valid command") y revisar Q-task-implementer-001 con sdd-req-change (recommended: los errores de argv no dependen del fichero y se ven sin leerlo)
  B) El fichero corrupto prevalece (exit 4) para todos: leer el fichero antes de validar argumentos; cambiar D-PA-010 y los tests de FASE-1 que esperan exit 2
  C) Dejar la mezcla actual y documentarla como excepción en REQ-F-006 AC3
Blocks: ninguna tarea de FASE-1 (comportamiento actual = plan); un fix task tras la decisión
