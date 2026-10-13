# Modo arnés (hermes-sdd)

Esta skill corre **sin una persona en la sesión**: la lanza Hermes desde una tarjeta del kanban con `claude -p` y
nadie puede contestar un `AskUserQuestion`, aprobar un permiso ni leer un mensaje a mitad de la etapa. Las
decisiones humanas llegan por **puertas** (tarjetas bloqueadas que una persona resuelve desde su canal) y las firma
el **notario** del arnés, no tú. Artículo 13: *el ejecutor nunca firma; el notario nunca decide; el orquestador nunca
interpreta.*

## Reglas

1. **No preguntes nunca durante la etapa.** Ni `AskUserQuestion` ni "¿continúo?". Clasifica cada decisión:

   | Clase | Ejemplos | Qué haces |
   |---|---|---|
   | **R** reversible o local | nombres internos, orden de tareas, librería menor de test, formato de un informe | Toma la opción recomendada y anótala: `node "$SDD" journal add --stage <etapa> --kind change --text "default-policy: <decisión> (<motivo>)"` |
   | **C** toca el contrato | criterio ambiguo, PAUSE del implementer, Tier-1 STOP, SPEC-DEVIATION, exclusión de cobertura | Escribe la pregunta en `.sdd/questions-<etapa>.md` con el formato de `references/async-questions.md` (opciones A/B/C, la recomendada marcada), sigue con todo lo que no dependa de ella y, al terminar, dilo en el resumen (`questions=<n>`) |
   | **H** humana por constitución | aprobar requisitos, confirmar la ruta, aceptar o rechazar una FASE, exenciones (waiver), descartar un challenge, editar un test que ya existía (art. 12), excepciones de listón o literal, evidencia de demo o inspección | **No la tomes ni la registres.** Prepara lo que la persona necesita para decidir y termina. La pedirá la puerta |

2. **Nunca firmes ni registres decisiones humanas.** Prohibido (la guardia del ejecutor lo deniega): `sdd accept record`,
   crear o mover tags `requirements-v*` / `fase-*-accepted`, `sdd route --write`, `journal add --kind decision|gate`,
   `git push`, tocar el kanban (`hermes kanban …`) o `~/.hermes/`. Si el procedimiento de la skill dice "pregunta y
   registra", haz solo la parte de preparar y para.
3. **Termina siempre la etapa con el estado coherente**: deja tu etapa en `pipeline-state.json` como `done` (o
   `error` con motivo) y commitea lo que escribiste con las convenciones de `references/git-conventions.md`, también
   lo que la CLI añadió a `acceptance/decisions.jsonl` (`accept measure`) o a `acceptance/challenges.jsonl`
   (`accept challenge add`): commitearlos está permitido; escribirlos a mano, no. Al cerrar la etapa el arnés comprueba
   que esos registros solo crecieron y que lo nuevo es de la CLI; si no, la etapa falla. Una etapa que queda en
   `running` se considera rota.
4. **Resumen final** (lo lee Hermes y lo verá la persona en la puerta): primera línea
   `stage=<etapa> status=done|blocked questions=<n> artifacts=<n>`, después como mucho 5 líneas en español con lo
   que importa para decidir: qué se hizo, qué decidiste por defecto (clase R) y qué queda abierto (clase C).
5. **Nada de multisesión**: no hay lead ni estaciones con `SendMessage`; ignora esas secciones. Tampoco publiques la
   página de estado (`--publish`): basta con el diario `status/journal.jsonl`.
