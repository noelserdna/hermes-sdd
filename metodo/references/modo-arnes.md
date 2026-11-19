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
   | **S** supuesto: el contrato deja abierto un detalle con un valor razonable | una cifra o un límite (intentos, minutos, longitud), qué pasa en un caso de borde (fecha pasada, no recogido, baja con reservas), quién ve qué por rol, la política de seguridad estándar (bloqueo tras intentos, caducidad de sesión, salir, contraseña mínima), registro y conservación de datos, una pantalla o lista que un rol necesita para hacer su trabajo | **No preguntes.** Escribe el valor en el artefacto (en el requisito y su criterio, o en tu documento) y una línea en la sección `## Supuestos` del mismo documento: qué supusiste y por qué, en castellano llano. La persona los ve juntos en la puerta de requisitos y dice si alguno no vale. Con los requisitos ya aprobados (hay un tag `requirements-v*`), lo que debería cambiarlos también va aquí, en tu documento: nunca una pregunta que recomiende reabrirlos (`questions add` lo rechaza) |
   | **C** toca el contrato y no hay un valor prudente | solo si las opciones cambian lo que el cliente ve o paga y ninguna es claramente la conservadora: criterio ambiguo, PAUSE del implementer, Tier-1 STOP, SPEC-DEVIATION, exclusión de cobertura | Escribe la pregunta con `node "$SDD" questions add --role <etapa>` (un JSON por stdin; queda en `.sdd/questions-<etapa>.json`, la fuente de verdad, y su vista `.md` se regenera: no escribas ninguno de los dos a mano) después de mirar `node "$SDD" questions list --json` (si ya hay una sobre lo mismo, abierta o contestada, no añadas otra: una sola pregunta por `tema`), con el formato de `references/async-questions.md` (un `tema`, la recomendada = lo que ya escribiste, con efecto `ninguno`; opciones A/B/C, la recomendada marcada (`"recomendada": true`), «Para el cliente:» (`para_cliente`) y el `efecto:` de cada opción con sus `ficheros`; para editar un test que ya existía, `efecto: editar-test <ficheros>` (o `efecto: endurecer-test <ficheros>` si solo lo hace comprobar más: eso lo puede autorizar Jev): solo el registro `test-edit` que firma el notario en `acceptance/decisions.jsonl` autoriza editarlos, nunca un `Answer:` ni un `[ANSWERED]`), sigue con todo lo que no dependa de ella y, al terminar, dilo en el resumen (`questions=<n>`) |
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
6. **Nada en diferido**: nadie vuelve a esta sesión. No programes avisos, despertares ni monitores (`ScheduleWakeup`,
   `Monitor`, `sleep` largos) ni dejes agentes en segundo plano: lanza los agentes y los comandos en primer plano y espera
   su resultado aquí. Al terminar no quedan servidores tuyos encendidos (vite, servidor de pruebas): ciérralos.
7. **Navegador sin molestar a la persona**: para capturas, vídeo o comprobar la web usa Playwright (ya abre Chrome con
   un llavero simulado). Si abres Chrome o Chromium a mano (`--headless`, `--screenshot`…), añade siempre
   `--use-mock-keychain --password-store=basic`: sin eso, en macOS cada arranque le pide a la persona la contraseña
   del llavero. La guardia bloquea el comando que no lo lleve; repítelo con esas opciones.
