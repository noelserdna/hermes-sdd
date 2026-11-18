#!/usr/bin/env bash
# Ejecutor GUIONIZADO para el simulador de proyecto (tests/simulador.sh): por defecto reproduce la grabación
# (executors/replay.sh); si el guion tiene una entrada para esta ejecución, hace lo que dice. Mismo contrato que
# executors/claude.sh: la última línea es {outcome, reason, …}.
#
#   .sdd/hermes/guion.json = {"implementar-0": ["replay", "commit+falla", "nada"], …}
#   Cada ejecución de <nombre> consume la siguiente acción de su lista; sin lista o agotada, «replay».
#     replay        lo que hizo la grabación (cherry-pick de sus commits)
#     nada          no toca el repo y termina bien (un intento sin trabajo nuevo)
#     commit        un commit de código con el trailer Task: de la primera tarea de la FASE y termina bien
#     commit+falla  ese commit y luego termina mal (un intento que hizo el trabajo y cayó por otra cosa)
#     falla         termina mal sin tocar nada
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO=$(cd "$1" && pwd); NOMBRE=$2
cd "$REPO"
G=.sdd/hermes/guion.json; C=.sdd/hermes/guion-cuenta.json
[ -f "$C" ] || echo '{}' > "$C"
n=$(jq -r --arg k "$NOMBRE" '.[$k] // 0' "$C")
accion=$(jq -r --arg k "$NOMBRE" --argjson n "$n" '.[$k][$n] // "replay"' "$G" 2>/dev/null || echo replay)
t=$(mktemp); jq --arg k "$NOMBRE" '.[$k] = ((.[$k] // 0) + 1)' "$C" > "$t" && mv "$t" "$C"
echo "$NOMBRE #$((n + 1)): $accion" >> .sdd/hermes/guion.log
salir() { jq -nc --arg o "$1" --arg r "$2" --arg n "$NOMBRE" '{outcome:$o, reason:$r, run:("guion-"+$n), session_id:"guion", cost_usd:0, minutes:0}'; exit 0; }
commit() {
  local fase task
  fase=$(echo "$NOMBRE" | sed -nE 's/.*-([0-9]+)$/\1/p')
  task=$(grep -oE 'TASK-[A-Za-z0-9-]+' "task/TASK-FASE-${fase:-0}.md" 2>/dev/null | head -1)
  mkdir -p src; echo "// intento $((n + 1)) de $NOMBRE" >> src/guion.js
  git add src/guion.js && git commit -qm "fix(guion): trabajo del intento $((n + 1)) de $NOMBRE" \
    --trailer "Task: ${task:-TASK-0}" --trailer "Refs: FASE-${fase:-0}"
}
case "$accion" in
  replay)       exec bash "$ROOT/executors/replay.sh" "$@" ;;
  nada)         salir done "ok" ;;
  commit)       commit; salir done "ok" ;;
  commit+falla) commit; salir failed "el guion: el intento hizo su trabajo y cayó por otra cosa" ;;
  falla)        salir failed "el guion: falla sin tocar nada" ;;
  *)            salir failed "acción de guion desconocida: $accion" ;;
esac
