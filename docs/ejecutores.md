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
| **Notario** | Solo firma si la decisión del repo es idéntica (hora, verbo, texto, persona, canal) a la que un canal registró en el índice de puertas de Hermes (`~/.hermes/hermes-sdd/puertas/`). El gateway no firma decisiones del canal `local`: las firma `decidir.sh` en el momento, salvo con `decidir.sh --en` (ventana para deshacer: la marca `firma_gateway` la escribe el núcleo al registrarla, no la etapa) | Quien pueda escribir en `~/.hermes` puede escribir los dos |
| **Sandbox de Claude Code** en las etapas sin navegador (requisitos, ruta, especificaciones, auditoría, pruebas, seguridad, diseño, plan, tareas, huecos, cambio) | Su Bash, y todo lo que lance (Python, Node), solo escribe en el repo (menos `.sdd/hermes/decisiones` y `puertas`), `$TMPDIR` y las cachés de npm y Playwright. Sin escape (`allowUnsandboxedCommands: false`); en macOS, si el sandbox no arranca, la etapa no corre | Las etapas con navegador (implementar, aceptar, cierre, huecos entre especificación y código, adoptar) van sin sandbox: en macOS no deja arrancar Chromium |
| **Permisos de Claude Code** en todas las etapas | `Edit(~/.hermes/**)`, `Edit(.sdd/hermes/decisiones/**)`, `Edit(.sdd/hermes/puertas/**)` denegados (también las redirecciones de Bash a esas rutas) | No ven lo que abre un script por su cuenta |
| **Guardias** (`sdd-executor-deny.sh`, `sdd-upstream-guard.sh`) | Órdenes que mencionan `.hermes/`, decisiones o puertas, `firmar.sh`/`decidir.sh`; en Hermes también `write_file`/`patch` a esas rutas y `execute_code` | Son regex: dificultan, no garantizan |

Lo que queda abierto con los ejecutores locales: una etapa con navegador que se lo proponga (un script propio que
escriba en `~/.hermes`). Lo cierra la caja de GitHub.

### La caja de GitHub (`"ejecutor": "github"`)

Cada etapa corre en una máquina de GitHub Actions que se crea para ella y se borra al acabar. El agente no ve este
ordenador (ni `~/.hermes`, ni el notario, ni su clave) y no puede escribir en el repo: el workflow tiene
`contents: read`. Dentro trabaja sin preguntar (`--dangerously-skip-permissions`): la máquina es desechable, y ahí
Chromium funciona sin pelearse con ningún sandbox.

1. `executors/github.sh` sube a una rama temporal `sdd-caja/<run>` el HEAD del proyecto más un commit de contexto
   (lo ignorado que la etapa necesita: `.sdd/`, `pipeline-state.json`, `evidencias/` si ocupan menos de 50 MB; el
   prompt; la identidad de git). Lanza el workflow y espera; si la etapa muere, lo cancela.
2. La caja (`templates/github/sdd-etapa.yml`) descarga el arnés en el commit instalado, hace la etapa con los mismos
   hooks y topes, y deja su trabajo en un artefacto: los commits en un bundle, lo que quedó sin commit en un parche y
   lo ignorado en un tar.
3. El ordenador lo valida antes de tocar nada. Los commits tienen que descender del commit enviado. Lo ignorado solo
   puede ir bajo `.sdd/`, `evidencias/` o `pipeline-state.json`, sin enlaces ni `..`, y nunca decisiones ni puertas.
   Si algo no cumple, no se aplica nada. Después avanza la rama (fast-forward), aplica el parche y copia lo ignorado.
   Las comprobaciones de `etapa.sh` (registros humanos, tests congelados…) se aplican igual que en local.
4. Borra la rama temporal y el artefacto.

Con `"ejecutor": "github"` en `~/.hermes/hermes-sdd/sdd.json`, los proyectos nuevos (y los adoptados) se preparan
solos: repo **público** en GitHub (en tu cuenta, o en `github.dueno`), el workflow commiteado y subido a la rama por
defecto. El token también, si lo guardas una vez en el llavero de macOS (GitHub no deja leer un secreto ya guardado para
copiarlo a otro repo):

    security add-generic-password -U -s hermes-sdd-caja -a claude -w "$(pbpaste | tr -d '[:space:]')"

Desde entonces, cada repo nuevo lo recibe del llavero sin que se muestre. Sin él, `lanzar.sh` avisa con la orden para
ponerlo desde el portapapeles.

A mano, el proyecto necesita:
- su repo en GitHub (`origin`, o `"github": {"repo": "dueño/nombre"}` en `.sdd/hermes/hermes-sdd.json`);
- `templates/github/sdd-etapa.yml` en `.github/workflows/` de la rama por defecto;
- el secreto `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`; `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R dueño/nombre`);
- `"ejecutor": "github"` en `.sdd/hermes/hermes-sdd.json`, o en `ejecutores` solo para algunas etapas.

El agente puede leer ese token dentro de la caja, igual que en cualquier sitio donde trabaje: usa uno solo para esto.
Los topes de gasto acotan lo que puede gastar.

**Firma del notario.** Con el agente fuera del ordenador, la clave del notario (`~/.ssh/hermes-notario`, o
`clave_notario` en `sdd.json`) queda fuera de su alcance. Los tags de aceptación y las actas salen firmados, y
`verificar.sh <repo>` comprueba cada uno: `OK`, `SIN FIRMA` o `FIRMA MALA`.
