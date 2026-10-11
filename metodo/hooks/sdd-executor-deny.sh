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

motivo=""
CMD_SIN_ARNES=${CMD//.hermes\/hermes-sdd\//}   # las rutas del propio arnés (plugin, CLI) sí están permitidas
check() { [ -z "$motivo" ] && printf '%s' "$CMD_SIN_ARNES" | grep -qE "$1" && motivo=$2; }
check 'accept[[:space:]]+record'                                  "registrar una decisión humana (accept record) es del notario"
check 'git[[:space:]].*(tag|update-ref).*(fase-[0-9]+-accepted|requirements-v|refs/tags)' "crear o mover tags de aceptación es del notario"
check 'route[[:space:]].*--write'                                 "confirmar la ruta es una decisión humana"
check 'journal[[:space:]]+add.*--kind[[:space:]]+(decision|gate)' "anotar decisiones o puertas en el diario es del notario"
check '(^|[^a-z])hermes[[:space:]]+kanban'                        "el ejecutor no mueve tarjetas del kanban"
check 'sqlite3'                                                   "el ejecutor no edita bases de datos de Hermes"
check '\.hermes/'                                                 "el ejecutor no toca el directorio de Hermes"
check '(firmar|decidir|puerta)\.sh'                               "las puertas y la firma son del arnés, no del ejecutor"
check '(decisions|challenges)\.jsonl|gate-evidence'               "los registros humanos no se editan desde el ejecutor"
check 'git[[:space:]]+push'                                       "publicar (push) lo decide una persona"
[ -n "$motivo" ] || exit 0

RAZON="hermes-sdd: $motivo. Termina tu etapa; la decisión llega por una puerta y la firma el notario."
if [ "$EVENTO" = pre_tool_call ]; then
  jq -nc --arg r "$RAZON" '{decision:"block", reason:$r}'; exit 2
fi
jq -nc --arg r "$RAZON" '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"deny", permissionDecisionReason:$r}}'
exit 0
