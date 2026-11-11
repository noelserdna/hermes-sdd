# El encargado del proyecto (diseño, v2)

> Estado: propuesta revisada (11/11/2026) tras una revisión con cuatro enfoques: viabilidad en Hermes, integración
> con el arnés, producto y método, y crítica y seguridad. Nada de esto está implementado todavía.

## Por qué

Hoy el arnés **orquesta**: encadena etapas (requisitos → ruta → plan → tareas → implementar → aceptar → entregar), con
Claude Code dentro de cada una, y para en las puertas para que decida una persona o Jev. Pero **nadie vela por el
proceso**, y todo el proyecto nace de **un solo prompt**. Ese papel lo ha hecho a mano una sesión de Claude Code
(vasos parado 57 min por un umbral mal medido, dos etapas cortadas por una instalación, la entrega de vasos sin
poder aceptarse, coches con 5 veces más tests que código).

El encargado es **lo que hoy es Claude Code para quien dirige el proyecto**, dentro de Hermes y con un proyecto a su
cargo: prepara la entrada con preguntas, supervisa, revisa la documentación, discute arquitectura, diseño y UX, y
recuerda.

## Principios (lo que cambió tras la revisión)

1. **En la sesión se habla y se prepara; en la puerta se decide; Jev solo aprueba lo que el encargado no ha marcado;
   el notario firma.** El encargado nunca pregunta por Telegram lo que ya pregunta una puerta.
2. **La memoria del proyecto vive en el repo**, versionada y auditable. La memoria de Hermes es solo un índice.
3. **Las garantías no dependen del agente.** Lo que el encargado no puede hacer lo impiden el notario, los permisos
   y un hook que bloquea; no unas instrucciones ni unos patrones de texto.
4. **Datos antes que agente.** Primero se mide (resultado de cada etapa, histórico de puertas); el encargado se
   construye sobre esos datos y se evalúa con ellos.
5. **Despertar por eventos, no por rondas con LLM.** Un filtro sin modelo decide si hay algo que mirar.

## Antes de empezar: cerrar un agujero que existe hoy

La revisión encontró que **hoy** una etapa (o cualquier agente con el usuario del sistema) puede fabricar una
decisión «humana»: el guardia de escrituras permite todo `.sdd/*` y todo lo que está fuera del repo, y el canal
`local` identifica a la persona solo por `$USER`. Escribir `.sdd/hermes/decisiones/<gid>.json` y la puerta en
`~/.hermes/hermes-sdd/puertas/` como «decidida» basta para que el gateway llame al notario y este firme.
`approvals.deny` y el hook solo miran órdenes de terminal, no escrituras de ficheros ni `execute_code`.

Cierre propuesto, por capas:
- **Guardias**: denegar escrituras de las etapas en `.sdd/hermes/{decisiones,puertas}` y en `~/.hermes/**`.
- **Notario**: el gateway no firma decisiones del canal `local` (esas solo las firma `decidir.sh` en el momento, en
  primer plano); y cada decisión registrada por un canal lleva una prueba que solo el canal puede producir (el
  gateway ya tiene el `callback_id` de Telegram; para el panel, la sesión).
- **A medio plazo**: separar usuarios del sistema (o contenedor) para estación, ejecutor y encargado, con el estado
  de Hermes sin permiso de escritura para ellos.

## Reparto de papeles

| Quién | Dónde | Qué hace |
|---|---|---|
| **Persona** | Chat del panel de Hermes con el perfil del proyecto (`/chat?profile=sdd-p-X&resume=…`), `hermes -p sdd-p-X chat`, o un tema de Telegram por proyecto (`gateway.profile_routes` por `thread_id`) | Conversa con el encargado |
| **Persona** | Puertas en Telegram y en el panel, como ahora | Decide |
| **Encargado** | Perfil `sdd-p-<proyecto>` | Prepara, supervisa, revisa, conversa, recuerda |
| **Etapas** | Kanban + `etapa.sh` + Claude Code | Hacen el trabajo del método |
| **Jev** | Gateway | Decide las puertas que le deja el modo, salvo las marcadas por el encargado |
| **Notario** | `firmar.sh` | Firma |

## Qué hace el encargado

### 1. Prepara la entrada (en el repo)
- Recibe lo que haya: petición, documentos, requisitos casi listos, capturas, enlaces, un repo. Se guarda en
  `intent/INT-001/` (adjuntos) y `intent/INT-001/intake.md`.
- **Preguntas con `clarify`** (Hermes: de 1 a 5 por llamada, hasta 4 opciones, la recomendada primero; en el perfil
  `agent.clarify_timeout: 0`). Regla de parada: como mucho 5 por ronda, una cada vez, solo las que tocan el contrato
  (quién lo usa, qué datos, qué queda fuera, cómo se comprueba el éxito); se para cuando cada necesidad tiene un
  ejemplo concreto o la persona dice «basta». Lo reversible se apunta como supuesto, sin preguntar.
- `intake.md` registra cada pregunta, las opciones, la recomendada, lo elegido y quién lo eligió, en el formato de
  `.sdd/questions-*` para que lo lean las etapas.
- **Requisitos de partida → depurar**: si hay `requirements/REQUIREMENTS.md` de partida, la etapa de requisitos usa
  el modo 2 de `sdd-requirements-engineer` (auditar y dar formato con `req-lint`, sin reescribir) y la puerta enseña
  el diff contra el documento original. Hoy, si existe ese fichero, la etapa ni llama al ejecutor (`etapa.sh:152`):
  falta esa tercera rama. Traer `sdd-import` a `metodo/` para Jira, CSV, OpenAPI o Notion.
- `nuevo.sh --sin-lanzar` ya existe: el encargado prepara y después lanza.

### 2. Supervisa
- **Despertar**: un `cron` del perfil cada pocos minutos con un **script de filtro** (`encargado.sh estado`) que
  devuelve `{"wakeAgent": false}` si no hay nada; solo si hay algo se ejecuta el modelo (uno barato para clasificar,
  el capaz cuando hace falta). El gateway, en `_vigia`/`_avisar_fallos`, deja de mandar su propio aviso cuando el
  proyecto tiene encargado (un aviso, no dos).
- **Qué cuenta como «algo»**: tarjeta bloqueada, puerta en `error`, puerta decidida por Jev que no se firma en X
  min, puerta esperando más de X, etapa más lenta que su mediana, reintento que vuelve a fallar.
- **Diagnostica** con `estado` (ver Datos) y la salida de la etapa; **actúa** según la tabla; lo cuenta en el tema o
  la sesión del proyecto.
- **Resumen «desde la última vez»** al abrir la sesión y en el resumen diario: qué etapas acabaron (con el diff
  resumido entre tags), qué puerta espera, desde cuándo y por qué, y qué recomienda.

### 3. Revisa la documentación (sin bloquear la puerta)
- **Primero, comprobaciones mecánicas (sin IA)** antes de cada puerta, sacadas de fallos reales:
  - requisito «demo»/«inspección» con criterio medible → debería ser test (vasos REQ-NF-001, REQ-C-003);
  - requisito sin necesidad detrás (el «Stack del proyecto» como Must en vasos y propinas);
  - promesa del enunciado sin criterio que la cubra;
  - tests/código > 3, FASEs o tareas desproporcionadas para el número de REQ-F (coches: 3 FASEs, 24 tareas, 199
    líneas);
  - motivo de salto de ruta que contradice el stack (vasos: «sin pantallas» en una web);
  - evidencias cuyo nombre no casa con su criterio (vasos: REQ-F-001 AC1 apunta a una captura de REQ-F-003);
  - idiomas mezclados.
- **Después, revisión con IA por un revisor independiente** (un subagente con `delegation`, sin la memoria del
  proyecto), para no ser juez y parte de la entrada que preparó.
- **Viaja dentro de la puerta**: `review/<etapa>.md` y una línea arriba en la puerta, «🧭 Encargado: 2 avisos», con
  enlace. No bloquea; un aviso grave hace que Jev no pueda aprobar esa puerta solo.

### 4. Conversa sobre arquitectura, diseño y UX
- Lee `design/`, `ux/`, el código y las capturas de la demo (`vision`); opina y discute.
- Toda conversación que llegue a algo acaba en `decisions/DEC-NNN.md` y el encargado pregunta su tipo:
  **ADR** (a `design/`, entra en la siguiente puerta de plan), **cambio de alcance** (`INT-NNN`, puerta de
  requisitos) o **indicación para relanzar** (pide permiso).
- Comentarios sobre la demo → los propone como observación en la puerta de la fase; no decide.

### 5. Recuerda
- **Del proyecto, en el repo**: `notas/encargado.md` (lo que sabe del proyecto, lo lee al empezar), `decisions/`,
  `intake.md`, el diario. `MEMORY.md` del perfil (2200 caracteres) solo para lo esencial; holographic (local, viene
  con Hermes) si hace falta buscar hechos.
- **Entre proyectos**: lecciones **solo con evidencia** (enlace a la puerta rechazada, a la etapa bloqueada…),
  confirmadas por una persona, con caducidad (se descartan si en 3 proyectos no cambian ningún resultado) y sin
  datos del cliente. Se borran con el proyecto. Es la última fase: es la de más riesgo de meter ruido.

## Autonomía y cómo se hace cumplir

| Acción | Encargado | Cómo se impone |
|---|---|---|
| Leer, diagnosticar, explicar, opinar | Solo | — |
| Escribir en `intent/`, `notas/`, `decisions/`, `review/` | Solo | Hook `pre_tool_call` fail-closed: `file` solo en esas rutas |
| Reintentar una etapa que falló (una vez por tarjeta y causa; después solo avisa) | Solo, y lo cuenta | Solo vía `encargado.sh` |
| Archivar obsoletas; apartar restos sin commit de una etapa cortada | Solo, y lo cuenta | `encargado.sh`, con `git stash`/rama de respaldo, nunca borrando |
| Relanzar una etapa ya hecha | Pregunta antes | Hook devuelve `approve` → aprobación humana de Hermes |
| Descartar trabajo | Pregunta antes | Igual |
| Decidir o firmar puertas, tags, `accept record`, `aprobadores.json`, `jev.json`, código del arnés | Nunca | Notario + guardias + hook `block` + permisos |

- Acciones solo por **`encargado.sh`** (lista de órdenes permitidas, argumentos validados, idempotente, con modo «en
  seco»), envoltorio fino de lo que ya existe (`lanzar.sh reintentar|limpiar|rehacer|cambio`, `kanban unblock`).
  Antes de actuar comprueba el candado del repo, que no haya puertas abiertas o decididas (un commit con una puerta
  abierta impide su firma) y lo apunta en el diario.
- Sin `code_execution`; `kanban` solo de lectura (las escrituras pasan por `encargado.sh`); `terminal` limitada por el
  hook. La lista de prohibiciones, en un solo fichero (`profiles/deny.json`) que usan estación, ejecutor y encargado.
- **Contra la inyección**: lo que lee (documentos del cliente, webs, salidas de etapas) es dato; las acciones las
  dispara el filtro estructurado, no el texto. `web` desactivado hasta que haga falta.

## Datos (fase 0)
- **`.sdd/hermes/etapas.jsonl`**, escrito por `fin()` de `etapa.sh`: etapa, FASE, tarjeta, resultado, motivo,
  ejecuciones, coste y turnos sumados (hoy se pierde el de la primera llamada cuando hay dos), minutos, HEAD antes y
  después, y en `implementar` la proporción tests/código.
- **`puertas.jsonl`** por proyecto, al firmar: tiempo hasta decidir, quién, si se deshizo a Jev, texto de los cambios.
- **`estado` (`hsdd_proyectos.py estado <repo> --json`)**: lo que hoy calcula `_resumen_proyecto` + candado + puertas
  + últimas etapas. Lo usan el encargado, `/estado` y el panel.
- Arreglo de paso: `_avisar_fallos` lee `latest_summary`, que el kanban no devuelve; debe leer
  `last_failure_error`/`result` (hoy el motivo del fallo seguramente llega vacío).

## Cómo se construye sobre Hermes (verificado en v0.23.1)
- **Perfil por proyecto** `sdd-p-<proyecto>` creado con `--no-skills` por `nuevo.sh` (un directorio; memoria y
  sesiones aisladas; `multiplex_profiles` ya activo). SOUL.md con la carta del proyecto; `workdir` en el repo para
  cargar su `AGENTS.md`; skills solo las necesarias por `skills.external_dirs` (no hay «modo lectura» de skills: lo
  limita el hook).
- **Estado vivo en el prompt** con `register_system_prompt_section` del plugin.
- **No usar** A2A (el propio Hermes lo trata como entrada no fiable) ni Hindsight por ahora (es de catálogo, no viene
  incluido).

## Fases
0. **Seguridad y datos** — ✅ hecha (0.3.2, 11/11/2026): el notario solo firma la decisión que registró un canal en el
   índice de Hermes; sandbox de Claude Code en las etapas sin navegador; permisos y guardias contra escribir decisiones,
   puertas o `~/.hermes` (detalle y límites en `docs/ejecutores.md`, «Decisiones fabricadas»). `etapas.jsonl`,
   `puertas.jsonl` y `hsdd_proyectos.py estado <repo> --json` (que ya usa `/estado`); el aviso de fallos lee el motivo
   real. Pendiente de esta capa: separar usuarios del sistema para las etapas con navegador.
1. **Encargado que lee y conversa**: perfil, SOUL, `estado`, resumen «desde la última vez», chat en el panel y tema de
   Telegram. Sin escribir fuera de `notas/` ni actuar.
2. **Preparar la entrada**: `intake.md`, `clarify`, requisitos de partida con modo depurar, `sdd-import`.
3. **Supervisar y arreglar**: cron con filtro, `encargado.sh`, hook con `approve`, un solo aviso.
4. **Revisar la documentación**: comprobaciones mecánicas en `sdd gate`/puerta, después el revisor independiente, la
   línea «🧭 Encargado» en la puerta y la regla para Jev.
5. **Lecciones entre proyectos**, con evidencia, confirmadas y con caducidad.

## Cómo sabremos si aporta
- Línea base (fase 0) y después con encargado: minutos que un proyecto pasa parado sin que nadie lo sepa;
  intervenciones manuales por proyecto; puertas rechazadas por defectos que una revisión habría visto; coste por
  proyecto.
- Objetivos: detección → acción < 10 min; ≥ 70 % de diagnósticos correctos sobre incidentes grabados (`evals/`,
  `grabaciones/`); 0 acciones fuera de la tabla; coste añadido por debajo de un tope.
- Antes de la fase 3, una prueba con documentos con instrucciones inyectadas e intentos de firmar o saltarse las
  prohibiciones: 0 éxitos.

## Preguntas abiertas
- Desktop: ¿tiene selector de perfil en la interfaz? (solo verificado `--profile`).
- Modelo y tope de gasto por proyecto y día.
- ¿Se crean encargados para los proyectos existentes?
