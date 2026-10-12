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
