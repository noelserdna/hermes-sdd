# Instrucciones para agentes

material-montana11: Una web para el préstamo de material del club de montaña. Cada socio entra con su correo y una contraseña y puede reservar material (piolets, crampones, cascos, cuerdas, tiendas) para unas fechas concretas, siempre que haya unidades libres esas fechas; ve sus reservas y puede cancelarlas hasta el…
Stack elegido al crear el proyecto: Web con Vite (JavaScript) (JavaScript (ES modules) + Vite + Vitest). No lo cambies sin un requisito que lo pida.

## SDD Stack Profile
- stack: JavaScript (ES modules) + Vite + Vitest
- test: npm test
- test_file: npx vitest run {file} --maxWorkers=2
- code_paths: src/
- test_paths: tests/
- task_state: trailers
- test_slots: 1
- server: npx vite --host 127.0.0.1 --port 5173
- port: 5173
- lint: npm run lint
- acceptance: npx playwright test
- narration: required

## Convenciones
- Código y textos de la interfaz en español (o el idioma del proyecto).
- Cualquier cambio de comportamiento lleva su test.
- Vitest con como mucho 2 workers: `test: { maxWorkers: 2 }` en vitest.config (la máquina la comparten otras etapas y el navegador de los e2e).
