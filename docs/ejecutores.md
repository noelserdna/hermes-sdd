# Ejecutores

Un ejecutor hace UNA etapa del método y devuelve una línea JSON con el mismo contrato:

```json
{"outcome": "done|failed|scheduled|busy", "reason": "…", "run": "…", "session_id": "…", "cost_usd": 0.0, "minutes": 0}
```

La estación de Hermes (`sdd-estacion`) solo traduce `outcome` a una acción del kanban; nunca interpreta. Qué ejecutor
hace cada etapa lo decide `.sdd/hermes/hermes-sdd.json` del proyecto:

```json
{ "ejecutor": "claude", "ejecutores": { "ruta": "hermes" }, "modelos": { "ruta": "anthropic/claude-sonnet-5.5" } }
```

| Ejecutor | Qué es | Para qué etapas | Medido |
|---|---|---|---|
| `claude` | `claude -p` con el núcleo del método como plugin (`metodo/`), bajo supervisor: candado por repo, grupo de procesos, *dead-man switch*, `caffeinate`, entorno limpio, cuota | Las pesadas: requisitos, plan, tareas, implementar, aceptar, cambio, adoptar, cierre | todo-app completo: 46 min, 25,43 $ de suscripción |
| `hermes` | Un agente de Hermes (perfil `sdd-ejecutor`: solo ficheros y terminal, skills del método, guardia en el dialecto de Hermes) | Las ligeras y acotadas: factores de la ruta, diagnósticos, revisiones | Factores de la ruta con Sonnet: 0,075 $ (Claude Code: 0,24 $), misma ruta |
| `replay` | Reproduce una ejecución grabada (cherry-pick de sus commits) y ejecuta los tests de verdad | Prácticas y pruebas | todo-app completo: ~50 s, 0 $ |

## Elegir modelo por etapa

En **SDD → Configuración → Modelos por etapa** (o con `nuevo.sh` / `hsdd_proyectos.py modelos --perfil P`) eliges un
perfil para todos los proyectos y, encima, puedes cambiar etapas sueltas con los modelos disponibles:

| Perfil | Requisitos · plan · cambio · adoptar | Tareas · huecos · implementar · aceptar · cierre | Ruta |
|---|---|---|---|
| Calidad | Opus | Opus | Sonnet |
| **Equilibrado** (por defecto) | Opus | Sonnet | Sonnet |
| Rápido | Sonnet | Sonnet | Sonnet |

- Los alias (`fable`, `opus`, `sonnet`, `haiku`) son siempre el último modelo de esa familia; también puedes fijar una
  versión (`anthropic/claude-opus-5.5`). Para la ruta, que la hace Hermes, el alias se traduce al id de OpenRouter más
  reciente que conoce Hermes; para Claude Code, el id completo se traduce a su nombre (`claude-opus-5-5`).
- Un proyecto puede fijar el suyo en `.sdd/hermes/hermes-sdd.json` → `modelos.<etapa>`, y ese manda.
- Los subagentes de las skills (investigación del plan, una FASE por agente, Streams en paralelo) ya van con Sonnet;
  en un proyecto de una sola FASE no se lanzan, así que el perfil es lo que decide.

Medido en hola-astro (10/11/2026), todo con Opus: 22 min y 6 $ hasta acabar la FASE-0, el 70 % del tiempo en el
modelo (implementar, 7,9 min; plan, 3,3 min); los tests y el build, 2 s.


- **No uses un modelo pequeño para juicios que acaban en una probabilidad.** Con Haiku, los factores de la ruta
  salieron todos en la banda de duda (0,4) y la regla "duda = sí" pidió el pipeline completo para una CLI de una
  persona. Sonnet y el modelo por defecto de Claude Code dieron la ruta ligera. Valores distintos (vida del proyecto
  0,35 frente a 0,75) pueden dar la misma ruta: las reglas del código absorben la diferencia.
- La estación (`sdd-estacion`) puede usar el modelo más barato: solo mueve tarjetas.

## Garantías del ejecutor

Ningún ejecutor puede firmar: la guardia `metodo/hooks/sdd-executor-deny.sh` deniega `accept record`, los tags de
aceptación, `route --write`, el kanban, `~/.hermes`, `git push`… en los dos dialectos (Claude Code y Hermes), y los
perfiles añaden `approvals.deny`. Probado: un agente de Hermes al que se le pide `git tag fase-0-accepted` no puede
crearlo y explica por qué.

### Decisiones fabricadas (cerrado en 0.3.2)

Hasta 0.3.1 una etapa podía fabricar una decisión «humana»: escribir `.sdd/hermes/decisiones/<puerta>.json` y la
puerta como decidida en `~/.hermes/hermes-sdd/puertas/` bastaba para que el gateway llamara al notario y este firmara.
Ahora hay cuatro capas, de más a menos fuerte:

| Capa | Qué impide | Límite |
|---|---|---|
| **Notario** | Solo firma si la decisión del repo es idéntica (hora, verbo, texto, persona, canal) a la que un canal registró en el índice de puertas de Hermes (`~/.hermes/hermes-sdd/puertas/`). El gateway no firma decisiones del canal `local`: las firma `decidir.sh` en el momento | Quien pueda escribir en `~/.hermes` puede escribir los dos |
| **Sandbox de Claude Code** en las etapas sin navegador (requisitos, ruta, especificaciones, auditoría, pruebas, seguridad, diseño, plan, tareas, huecos, cambio) | Su Bash, y todo lo que lance (Python, Node), solo escribe en el repo (menos `.sdd/hermes/decisiones` y `puertas`), `$TMPDIR` y las cachés de npm y Playwright. Sin escape (`allowUnsandboxedCommands: false`); en macOS, si el sandbox no arranca, la etapa no corre | Las etapas con navegador (implementar, aceptar, cierre, huecos entre especificación y código, adoptar) van sin sandbox: en macOS no deja arrancar Chromium |
| **Permisos de Claude Code** en todas las etapas | `Edit(~/.hermes/**)`, `Edit(.sdd/hermes/decisiones/**)`, `Edit(.sdd/hermes/puertas/**)` denegados (también las redirecciones de Bash a esas rutas) | No ven lo que abre un script por su cuenta |
| **Guardias** (`sdd-executor-deny.sh`, `sdd-upstream-guard.sh`) | Órdenes que mencionan `.hermes/`, decisiones o puertas, `firmar.sh`/`decidir.sh`; en Hermes también `write_file`/`patch` a esas rutas y `execute_code` | Son regex: dificultan, no garantizan |

Lo que queda abierto: una etapa con navegador que se lo proponga (un script propio que escriba en `~/.hermes`). El
cierre completo es separar usuarios del sistema (o un contenedor) para las etapas, con el estado de Hermes sin permiso
de escritura para ellas (ver `docs/encargado.md`).
