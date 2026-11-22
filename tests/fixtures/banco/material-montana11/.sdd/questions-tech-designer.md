# Questions — tech-designer

<!-- Vista generada desde questions-tech-designer.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role tech-designer`. -->

## Q-tech-designer-001 [ANSWERED] skill=sdd-tech-designer context=design/TECHNICAL-DESIGN.md §9 tema=primer-encargado
Question: No hay operación para crear la primera cuenta de encargado (crearSocio exige encargado). El diseño propone un comando de semilla `npm run seed` con variables de entorno.
Para el cliente: ¿Cómo se crea la primera cuenta del encargado al poner la web en marcha?
Options:
  A) Comando de arranque que crea el encargado con correo y contraseña que da quien instala (recommended)
     efecto: ninguno
     cliente: Lo prepara quien instala la web, una sola vez
  B) Pantalla de primer uso cuando no hay cuentas (nueva operación)
     efecto: req-change
     cliente: Una pantalla nueva; el primero que llegue podría crearla
Blocks: ninguno
Answer: A — opción recomendada, aceptada por Jev (regla) (Agente automático (modo auto)) (2026-11-21)
