# hermes-sdd

El método SDD (Specification-Driven Development) como **arnés para Hermes Agent**: Hermes orquesta con su kanban
(un tablero por proyecto), un agente ejecutor (Claude Code de momento) hace cada etapa, y **las decisiones las toman
personas** en puertas que llegan por un canal (Telegram primero) y que firma un notario sin LLM.

> El ejecutor nunca firma; el notario nunca decide; el orquestador nunca interpreta.

**Estado: en construcción (Hito 0).**

| Carpeta | Qué es |
|---|---|
| `metodo/` | El núcleo del método: CLI (`scripts/`), skills, hooks, plantillas y ejemplo. Tiene estructura de plugin para que el ejecutor Claude lo cargue con `--plugin-dir` |
| `executors/` | Cómo se lanza cada ejecutor (supervisor de `claude -p`) |
| `plugin/hermes-sdd/` | Plugin de Hermes: puertas con botones en Telegram |
| `profiles/` | Perfil `sdd-estacion` del worker del kanban |
| `docs/metodo/` | El método escrito para el entorno Hermes |
| `tests/` | Pruebas sin LLM |

## Origen

El núcleo parte de [sdd-pipeline](https://github.com/noelserdna/sdd-pipeline) 5.3.0 (mismo autor, MIT), del que se
tomó lo esencial como punto de partida. Desde aquí evoluciona por su cuenta.
