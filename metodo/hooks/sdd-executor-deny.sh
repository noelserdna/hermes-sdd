#!/usr/bin/env bash
# Guardia del EJECUTOR (artículo 13: el ejecutor nunca firma). Deniega, sin preguntar, lo que solo puede hacer el
# notario o una persona: registrar decisiones, crear o mover tags de aceptación, confirmar la ruta, tocar el kanban
# o el estado de Hermes, publicar. Es una regex sobre el comando: dificulta, no garantiza (ver docs/ejecutores.md, «Garantías del ejecutor»).
#
# Habla los dos dialectos: Claude Code (PreToolUse Bash → hookSpecificOutput.permissionDecision) y Hermes
# (pre_tool_call terminal → {"decision":"block"} + exit 2). Fuera de un ejecutor del arnés no hace nada.
IN=$(cat)
EVENTO=$(printf '%s' "$IN" | jq -r '.hook_event_name // ""')
CMD=$(printf '%s' "$IN" | jq -r '.tool_input.command // ""')
[ "${SDD_EXECUTOR:-}" = hermes ] || [ "$EVENTO" = pre_tool_call ] || exit 0
bloquear() {  # bloquear <razón>: en el dialecto de quien pregunta
  if [ "$EVENTO" = pre_tool_call ]; then jq -nc --arg r "hermes-sdd: $1" '{decision:"block", reason:$r}'; exit 2; fi
  jq -nc --arg r "hermes-sdd: $1" '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"deny", permissionDecisionReason:$r}}'
  exit 0
}
# Herramientas de ficheros de Hermes (write_file, patch) y código suelto (execute_code): las decisiones, las puertas y
# el estado de Hermes no se escriben desde una etapa (una decisión «humana» fabricada la firmaría el notario).
HERRAMIENTA=$(printf '%s' "$IN" | jq -r '.tool_name // ""')
case "$HERRAMIENTA" in
  execute_code) bloquear "el ejecutor no ejecuta código suelto; usa la terminal" ;;
  write_file|patch)
    RUTA=$(printf '%s' "$IN" | jq -r '.tool_input.path // .tool_input.file_path // ""')
    if printf '%s' "$RUTA" | grep -qE '(^~|/)\.hermes(/|$)|(^|/)\.sdd/hermes/(decisiones|puertas)(/|$)|(aprobadores|jev|sdd)\.json$'; then
      bloquear "las decisiones, las puertas y el estado de Hermes no se escriben desde una etapa ($RUTA)"
    fi
    exit 0 ;;
esac
[ -n "$CMD" ] || exit 0

. "$(dirname "${BASH_SOURCE[0]}")/lib/sdd-common.sh"

motivo=""
CMD_SIN_ARNES=${CMD//.hermes\/hermes-sdd\//}   # las rutas del propio arnés (plugin, CLI) sí están permitidas
check() { [ -z "$motivo" ] && printf '%s' "$2" | grep -qE "$1" && motivo=$3; }
# Segmentos del comando (separados por ; && || | $( `): las reglas de tags miran solo los que EMPIEZAN por git.
SEGMENTOS=$(printf '%s\n' "$CMD_SIN_ARNES" | perl -pe 's/(;|&&|\|\||\||\$\(|`)/\n/g')
# Citar no es hacer. Para las invocaciones (accept record, route --write, journal add --kind decision) se mira el
# texto FUERA de comillas, como la guardia de herramientas: un resumen que menciona `accept record` no es firmar. Si el
# comando delega en otro intérprete (bash -c, eval…) o queda una comilla abierta, se mira entero.
INVOCA=$(printf '%s' "$CMD_SIN_ARNES" | sed -E -e 's/"(\$\{?SDD\}?)"/\1/g' -e 's/"[^"]*sdd\.mjs"/sdd.mjs/g')
if printf '%s' "$INVOCA" | grep -qE '(^|[^[:alnum:]_])(eval|(ba|z)?sh[[:space:]]+-[a-z]*c)([[:space:]]|$)' ||
   ! INVOCA=$(unquoted_text "$INVOCA"); then INVOCA=$CMD_SIN_ARNES; fi
# Los registros (decisions.jsonl, challenges.jsonl) solo los escribe la CLI (`accept measure`, `accept challenge add`);
# lo que se deniega es escribirlos a mano. Leerlos, compararlos o commitearlos no los cambia, y el texto de un
# `cat <<EOF` es un dato: esas partes se quitan antes de buscar. El código de un intérprete (`python3 - <<EOF`,
# `node -e`) sí cuenta. El arnés comprueba además, al cerrar la etapa, qué se añadió a cada registro.
ESCRIBE=$(printf '%s\n' "$CMD_SIN_ARNES" |
  perl -0pe 's/(^|[\n;&|]\s*)(cat\b[^\n]*?<<-?[ \t]*([\x27"]?)(\w+)\3[^\n]*)\n.*?\n[ \t]*\4[ \t]*(?=\n|$)/$1$2/gs' |
  perl -pe 's/(;|&&|\|\||\|)/\n/g' |
  grep -vE '^[[:space:]]*(cd[[:space:]][^>]*|git[[:space:]]+(add|diff|show|log|status|commit|blame)[^>]*|(cat|head|tail|grep|wc|cut|jq)[[:space:]][^>]*|sed[[:space:]]+-n[[:space:]][^>]*)$')
ESCRIBE_I=$(printf '%s\n' "$SEGMENTOS" | grep -E '^[[:space:]]*sed[[:space:]]+(.*[[:space:]])?-[a-zA-Z]*i' || true)

check 'accept[[:space:]]+record'                                  "$INVOCA" "registrar una decisión humana (accept record) es del notario"
check '^[[:space:]]*git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+)*[[:space:]]+(tag|update-ref)[[:space:]].*(fase-([0-9]+|\$\{?[A-Za-z_]+\}?)-accepted|requirements-v|refs/tags)' \
  "$SEGMENTOS" "crear o mover tags de aceptación es del notario"
check 'route[[:space:]].*--write'                                 "$INVOCA" "confirmar la ruta es una decisión humana"
check 'journal[[:space:]]+add.*--kind[[:space:]]+(decision|gate)' "$INVOCA" "anotar decisiones o puertas en el diario es del notario"
check '(^|[^a-z])hermes[[:space:]]+kanban'                        "$CMD_SIN_ARNES" "el ejecutor no mueve tarjetas del kanban"
check '\.sdd/hermes/(decisiones|puertas)'                         "$CMD" "las decisiones y las puertas solo las escriben los canales y el notario"
check 'sqlite3'                                                   "$CMD_SIN_ARNES" "el ejecutor no edita bases de datos de Hermes"
check '\.hermes/'                                                 "$CMD_SIN_ARNES" "el ejecutor no toca el directorio de Hermes"
check '(firmar|decidir|puerta|jev|nuevo)\.sh|hsdd_(nucleo|proyectos)' "$CMD_SIN_ARNES" "las puertas, la firma, el modo de Jev y crear proyectos son del arnés, no del ejecutor"
check '(aprobadores|jev|sdd)\.json'                                   "$CMD" "quién decide (aprobadores.json), el modo de Jev (jev.json) y la configuración (sdd.json) los fija una persona"
check '(decisions|challenges)\.jsonl|gate-evidence'               "$ESCRIBE$ESCRIBE_I" "los registros humanos no se editan desde el ejecutor"
check 'git[[:space:]]+push'                                       "$CMD_SIN_ARNES" "publicar (push) lo decide una persona"
# Chrome abierto a mano (capturas, PDF, headless) sin llavero simulado: en macOS pide a la persona la contraseña del
# llavero («Chromium Safe Storage») en CADA arranque (incidente raciones, 10/11/2026). No se para la etapa: se repite
# el comando bien. Playwright ya pasa --use-mock-keychain por su cuenta.
navegador=""
if [ -z "$motivo" ] && printf '%s' "$CMD" | grep -qiE 'chrome for testing|chromium|chrome-headless-shell|google-chrome|google chrome' &&
   printf '%s' "$CMD" | grep -qE -- '--(headless|screenshot|print-to-pdf|dump-dom|remote-debugging-port)' &&
   ! printf '%s' "$CMD" | grep -q -- '--use-mock-keychain'; then
  navegador=1
fi
[ -n "$motivo" ] || [ -n "$navegador" ] || exit 0

if [ -n "$motivo" ]; then
  RAZON="hermes-sdd: $motivo. Termina tu etapa; la decisión llega por una puerta y la firma el notario."
else
  RAZON="hermes-sdd: abrir Chrome a mano sin --use-mock-keychain hace que macOS pida a la persona la contraseña del llavero en cada arranque. Repite el comando añadiendo --use-mock-keychain --password-store=basic (o usa Playwright, que ya lo hace)."
fi
if [ "$EVENTO" = pre_tool_call ]; then
  jq -nc --arg r "$RAZON" '{decision:"block", reason:$r}'; exit 2
fi
jq -nc --arg r "$RAZON" '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"deny", permissionDecisionReason:$r}}'
exit 0
