# Borradores de issues para Hermes Agent

Propuestas que nacen de construir este arnés sobre Hermes v0.21.6 (kanban, plugins, gateway y panel). Son
**borradores sin enviar**: cada uno dice qué hacemos hoy para sortearlo y qué haría falta.

## 1. Tarjetas que solo puede cerrar una persona (`kind: gate`)

**Hoy:** las puertas son tarjetas `blocked` sin assignee. Funciona, pero nada en el tablero dice «esto lo decide una
persona». Además, cualquier proceso con acceso a la CLI puede hacer `complete` sobre ellas.
**Propuesta:** un tipo de tarjeta `gate` que el dispatcher nunca asigna, que el panel muestre aparte y que solo pueda
completarse desde una superficie con identidad (gateway, panel con login) y con el autor registrado.

## 2. Autor real en comentarios y cierres del kanban

**Hoy:** `hermes kanban comment/complete` registra el texto, pero no quién lo hizo desde qué canal. Por eso las
decisiones no se leen de comentarios: el arnés guarda su propia decisión normalizada.
**Propuesta:** guardar `actor: {platform, user_id}` cuando la acción llega desde el gateway o el panel, y exponerlo en
`show --json`.

## 3. Límite de recurrencias configurable antes de mandar a triage

**Hoy:** una tarjeta que se bloquea y desbloquea varias veces acaba en triage. El arnés lo evita no desbloqueando
nunca una puerta: la completa y crea una tarjeta nueva.
**Propuesta:** `kanban.max_recurrences` por tablero o por tarjeta.

## 4. Identidad del panel para los plugins en modo local

**Hoy:** en modo loopback, `request.state.session` no existe y el plugin deduce «usuario del sistema que arrancó el
panel» comprobando `app.state.auth_required is False` y que el cliente sea 127.0.0.1.
**Propuesta:** un helper público (`dashboard_auth.current_principal(request)`) que devuelva la identidad en cualquier
modo, con su fuerza (`oauth`, `token`, `loopback`).

## 5. Plazo de las herramientas en perfiles de ejecución larga

**Hoy:** `timeouts.tools.sequential_call` (420 s por defecto) corta etapas de 10-30 min que lanza un worker. El
instalador lo sube a 5400 en sus perfiles.
**Propuesta:** que el plazo de un worker del kanban herede `--max-runtime` de la tarjeta, o un aviso explícito cuando
el plazo de la herramienta es menor que el de la tarjeta.
