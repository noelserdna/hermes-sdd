# Questions — task-generator

## Q-task-generator-001 [OPEN] skill=sdd-task-generator context=AGENTS.md ## SDD Stack Profile (visual_evidence)
Question: todo-app es una CLI sin interfaz gráfica y el Stack Profile no declara `visual_evidence`, así que rige el valor por defecto `required`: las tareas journey de FASE-0/1/2 exigen guardar una captura `.png` por criterio en `evidencias/FASE-N/` y un vídeo por FASE. ¿Cómo se evidencian los criterios REQ-F de esta CLI?
Options:
  A) Añadir `visual_evidence: off` al Stack Profile (CLI pura): los journeys conservan la ruta del usuario (`run(argv, io)`) y las aserciones del texto exacto de salida, sin capturas (recommended)
  B) Mantener `required`: el journey renderiza la salida del terminal a imagen (.png) por criterio y graba un vídeo por FASE
  C) `visual_evidence: warn`: se intentan capturas, pero su ausencia solo se avisa
Blocks: bullet de evidencias de TASK-F0/F1/F2 journey (las tareas se generaron con el bullet condicionado a esta respuesta); sdd gate de FASE-0..2
Answer: