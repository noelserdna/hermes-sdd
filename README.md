# hermes-sdd

El método **SDD** (Specification-Driven Development) como **arnés para [Hermes Agent](https://github.com/NousResearch/hermes-agent)**.
Hermes orquesta con su kanban (un tablero por proyecto), un agente ejecutor hace cada etapa (Claude Code de momento)
y **las decisiones las toman personas** en *puertas* que llegan por un canal (Telegram primero) y que firma un
notario sin LLM.

> **Artículo 13.** El ejecutor nunca firma; el notario nunca decide; el orquestador nunca interpreta.

Probado de punta a punta con Hermes v0.21.6 y Claude Code 2.1: un proyecto pequeño (CLI de tareas, 10 requisitos,
4 FASEs) fue de los requisitos a la entrega con 10 decisiones tomadas con botones de Telegram. Coste real: unos
25 $ del ejecutor (46 min de Claude) y céntimos de Hermes.

## Cómo funciona

```
 requisitos ─▶ 🚪 ─▶ ruta ─▶ 🚪 ─▶ plan ─▶ tareas ─▶ 🚪 ─▶ implementar N ─▶ aceptar N ─▶ 🚪 ─▶ … ─▶ cierre ─▶ 🚪 entrega
                                                                   ▲                       │
                                                                   └──── rechazo ──────────┘
```

| Papel | Quién | Fichero |
|---|---|---|
| **Propone** | el ejecutor (Claude Code con las skills del método, sin preguntar a mitad de la etapa) | `etapa.sh`, `executors/` |
| **Pregunta** | la puerta: una tarjeta bloqueada sin assignee + un mensaje con botones | `puerta.sh`, `plugin/` |
| **Decide** | una persona autorizada, con un toque (ventana de 3 min para deshacer) | el canal |
| **Firma** | el notario: valida identidad y commit, registra, etiqueta y encadena | `firmar.sh` |
| **Orquesta** | el kanban de Hermes y `lanzar.sh` (tramos de tarjetas, sin LLM) | `lanzar.sh` |

Las decisiones del ejecutor se clasifican: **R** reversible (decide con la opción recomendada y lo anota), **C** toca
el contrato (pregunta por escrito con opciones y sigue con lo demás; la persona la contesta en la puerta) y **H**
humana por constitución (aceptar, exenciones, editar un test que ya existía…: nunca la toma).

## Empezar

```bash
git clone https://github.com/noelserdna/hermes-sdd && cd hermes-sdd
bash instalar.sh            # perfil sdd-estacion limpio, plugin de Telegram, ~/.hermes/hermes-sdd/aprobadores.json
hermes gateway restart      # carga el plugin
bash tests/todo.sh          # todas las pruebas, sin LLM (~2 min)
```

Requisitos: Hermes ≥ 0.21.6 con el gateway y Telegram configurados, Node ≥ 18, `jq`, `git`; para el ejecutor real,
Claude Code. `kanban.auto_decompose` debe estar desactivado (el instalador lo comprueba).

### Practicar gratis (sin LLM)

```bash
bash practicar.sh grabaciones/todo-app ~/practica-todo
```

Monta el proyecto desde una ejecución grabada y anonimizada: las tarjetas, las puertas, Telegram y el notario son
reales; lo que hace "el agente" es lo que hizo en la grabación (cherry-pick de sus commits) y los tests se ejecutan
de verdad. Coste 0 $; recorrerlo entero lleva lo que tardes en decidir. `grabar.sh` crea grabaciones nuevas.

### Un proyecto de verdad

1. Prepara el repo con un `AGENTS.md` con su `## SDD Stack Profile` (plantilla en `templates/AGENTS.md`) y, si ya
   hay requisitos, `requirements/CUSTOMER-NEEDS.md` y `requirements/REQUIREMENTS.md`.
2. `bash ~/.hermes/hermes-sdd/actual/lanzar.sh iniciar /ruta/al/repo`
3. Decide en Telegram cuando llegue cada puerta.

## Puertas en Telegram

- **Requisitos, ruta, plan:** resumen y botones (`✅`, `✏️ cambios` con motivo, `❌`).
- **FASE:** en dos tiempos. Primero alertas, veredictos por requisito y `▶ Ver demo` (capturas y vídeo); después
  `✅ Aceptar`, `📝 Con observaciones`, `❌ Rechazar`. Se registra cuánto tiempo pasó entre ver la demo y decidir.
- **Preguntas abiertas:** formulario `Q1·A Q1·B …` con la recomendada marcada.
- **Entrega:** puerta de calidad global (todos los requisitos de todas las FASEs) y tag `entrega-N`.

Comandos: `/puertas` · `/estado [proyecto]` · `/pausar [proyecto|todo] [ahora]` · `/reanudar [proyecto|todo]` ·
`/anular <proyecto> <fase> <motivo>`. Un mensaje vivo por proyecto se actualiza en silencio; resúmenes a las 08:30 y
19:00; silencio de 22 a 8 (configurable en `~/.hermes/hermes-sdd/atencion.json`).

Plan B sin Telegram: `bash decidir.sh <puerta> acepto` (queda registrado que la decisión fue local).

## Qué garantiza y qué no

Garantiza que nadie firma sin una decisión tomada por una persona autorizada en su canal y que lo firmado es el
commit que se le mostró: tres registros (el canal, el acta del notario y `acceptance/decisions.jsonl` + el tag)
cuentan la misma historia. **No** garantiza quién sostenía el móvil ni resiste a alguien con tu sesión del sistema
operativo (el kanban, los registros y los tags son ficheros tuyos). Las guardias (hooks, `approvals.deny`)
*dificultan*; solo un ejecutor en contenedor o una firma con llave física *impiden*.

## Estructura

| Ruta | Qué es |
|---|---|
| `metodo/` | Núcleo del método con estructura de plugin de Claude Code: CLI (`scripts/sdd.mjs`), skills en modo arnés, hooks (guardia que deniega firmar), plantillas, ejemplo y sus tests |
| `etapa.sh` · `puerta.sh` · `firmar.sh` · `lanzar.sh` | Los papeles del arnés |
| `executors/claude.sh` · `executors/replay.sh` | Supervisor de `claude -p` (candado, grupo de procesos, cuota, entorno limpio) y reproducción |
| `decidir.sh` · `anular.sh` | Canal local y anulación auditable de una aceptación |
| `grabar.sh` · `practicar.sh` · `grabaciones/` | Grabar una ejecución real y practicarla sin coste |
| `plugin/hermes-sdd/` | Canal Telegram: puertas, formulario, deshacer, comandos, mensaje vivo, resúmenes |
| `profiles/` · `instalar.sh` | Perfil `sdd-estacion` (solo terminal; no programa ni decide) |
| `tests/` · `evals/` | Pruebas sin LLM (`tests/todo.sh`) y el simulador de Claude |

## Origen

El núcleo parte de [sdd-pipeline](https://github.com/noelserdna/sdd-pipeline) 5.3.0 (mismo autor, MIT), del que se
tomó lo esencial. Desde aquí evoluciona por su cuenta.
