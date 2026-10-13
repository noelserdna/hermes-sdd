#!/usr/bin/env bash
# Guardia del EJECUTOR (artículo 13: el ejecutor nunca firma). Deniega, sin preguntar, lo que solo puede hacer el
# notario o una persona: registrar decisiones, crear o mover tags de aceptación, confirmar la ruta, tocar el kanban
# o el estado de Hermes, publicar. Es una regex sobre el comando: dificulta, no garantiza (ver docs/garantias.md).
#
# Habla los dos dialectos: Claude Code (PreToolUse Bash → hookSpecificOutput.permissionDecision) y Hermes
# (pre_tool_call terminal → {"decision":"block"} + exit 2). Fuera de un ejecutor del arnés no hace nada.
IN=$(cat)
EVENTO=$(printf '%s' "$IN" | jq -r '.hook_event_name // ""')
CMD=$(printf '%s' "$IN" | jq -r '.tool_input.command // ""')
[ "${SDD_EXECUTOR:-}" = hermes ] || [ "$EVENTO" = pre_tool_call ] || exit 0
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
check 'sqlite3'                                                   "$CMD_SIN_ARNES" "el ejecutor no edita bases de datos de Hermes"
check '\.hermes/'                                                 "$CMD_SIN_ARNES" "el ejecutor no toca el directorio de Hermes"
check '(firmar|decidir|puerta)\.sh'                               "$CMD_SIN_ARNES" "las puertas y la firma son del arnés, no del ejecutor"
check '(decisions|challenges)\.jsonl|gate-evidence'               "$ESCRIBE$ESCRIBE_I" "los registros humanos no se editan desde el ejecutor"
check 'git[[:space:]]+push'                                       "$CMD_SIN_ARNES" "publicar (push) lo decide una persona"
[ -n "$motivo" ] || exit 0

RAZON="hermes-sdd: $motivo. Termina tu etapa; la decisión llega por una puerta y la firma el notario."
if [ "$EVENTO" = pre_tool_call ]; then
  jq -nc --arg r "$RAZON" '{decision:"block", reason:$r}'; exit 2
fi
jq -nc --arg r "$RAZON" '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"deny", permissionDecisionReason:$r}}'
exit 0
