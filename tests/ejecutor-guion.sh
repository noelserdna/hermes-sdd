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
#     cambio        aplica el cambio en curso como la skill real: requisitos con la versión siguiente (Status: Review)
#     impugna       una ronda adversarial que deja una impugnación abierta (WEAKENED-ASSERT) sobre REQ-F-001 AC1
# Cada prompt queda en .sdd/hermes/guion-prompts/<nombre>-<n>.txt (para comprobar qué recibió la etapa).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO=$(cd "$1" && pwd); NOMBRE=$2
cd "$REPO"
G=.sdd/hermes/guion.json; C=.sdd/hermes/guion-cuenta.json
[ -f "$C" ] || echo '{}' > "$C"
n=$(jq -r --arg k "$NOMBRE" '.[$k] // 0' "$C")
# «cambio» por defecto aplica el cambio como la etapa real: el de la grabación todo-app (octubre) no sube la versión y
# el notario rechaza aprobarlo («el tag requirements-v1.0 ya existe»)
def=replay; [ "$NOMBRE" = cambio ] && def=cambio
accion=$(jq -r --arg k "$NOMBRE" --argjson n "$n" --arg d "$def" '.[$k][$n] // $d' "$G" 2>/dev/null || echo "$def")
t=$(mktemp); jq --arg k "$NOMBRE" '.[$k] = ((.[$k] // 0) + 1)' "$C" > "$t" && mv "$t" "$C"
echo "$NOMBRE #$((n + 1)): $accion" >> .sdd/hermes/guion.log
mkdir -p .sdd/hermes/guion-prompts; printf '%s' "${3:-}" > ".sdd/hermes/guion-prompts/$NOMBRE-$((n + 1)).txt"
salir() { jq -nc --arg o "$1" --arg r "$2" --arg n "$NOMBRE" '{outcome:$o, reason:$r, run:("guion-"+$n), session_id:"guion", cost_usd:0, minutes:0}'; exit 0; }
commit() {
  local fase task
  fase=$(echo "$NOMBRE" | sed -nE 's/.*-([0-9]+)$/\1/p')
  task=$(grep -oE 'TASK-[A-Za-z0-9-]+' "task/TASK-FASE-${fase:-0}.md" 2>/dev/null | head -1)
  mkdir -p src; echo "// intento $((n + 1)) de $NOMBRE" >> src/guion.js
  git add src/guion.js && git commit -qm "fix(guion): trabajo del intento $((n + 1)) de $NOMBRE" \
    --trailer "Task: ${task:-TASK-0}" --trailer "Refs: FASE-${fase:-0}"
}
cambio() {
  local int v nv
  int=$(cat .sdd/hermes/cambio-actual 2>/dev/null || echo INT-000)
  v=$(sed -n 's/^> \*\*Version:\*\* *//p' requirements/REQUIREMENTS.md | head -1); v=${v:-1.0}
  nv="${v%%.*}.$(( ${v#*.} + 1 ))"
  sed -i.bak -E "s/^> \*\*Version:\*\*.*/> **Version:** $nv/; s/^> \*\*Status:\*\*.*/> **Status:** Review/" requirements/REQUIREMENTS.md
  rm -f requirements/REQUIREMENTS.md.bak
  git add requirements/REQUIREMENTS.md && git commit -qm "docs(requirements): apply $int as version $nv" --trailer "Change: $int"
}
impugna() {
  local t; t=$(git ls-files 'tests/*' 'test/*' | grep -E '\.(js|ts|mjs)$' | head -1)
  node "$ROOT/metodo/scripts/sdd.mjs" accept challenge add --req REQ-F-001 --ac 1 --category WEAKENED-ASSERT \
    --quote "el criterio" --why "el guion: el test no comprueba todo el THEN" --evidence "$t:1" --verifier guion \
    --counter confirmed >/dev/null &&
    git add acceptance/challenges.jsonl && git commit -qm "docs(acceptance): adversarial round FASE-${NOMBRE##*-} (guion)"
}
case "$accion" in
  impugna)      impugna || salir failed "el guion no pudo registrar la impugnación"; salir done "ok" ;;
  cambio)       cambio || salir failed "el guion no pudo aplicar el cambio"; salir done "ok" ;;
  replay)       exec bash "$ROOT/executors/replay.sh" "$@" ;;
  nada)         salir done "ok" ;;
  commit)       commit; salir done "ok" ;;
  commit+falla) commit; salir failed "el guion: el intento hizo su trabajo y cayó por otra cosa" ;;
  falla)        salir failed "el guion: falla sin tocar nada" ;;
  *)            salir failed "acción de guion desconocida: $accion" ;;
esac
