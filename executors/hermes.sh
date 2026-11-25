#!/usr/bin/env bash
# Ejecutor HERMES nativo: la etapa la hace un agente de Hermes (perfil sdd-ejecutor) en lugar de Claude Code.
# Pensado para etapas ligeras (factores de la ruta, diagnósticos, revisiones); mismo contrato que claude.sh.
#
#   executors/hermes.sh <repo> <nombre> <prompt> [modelo]
#
# El perfil sdd-ejecutor (instalar.sh) tiene solo ficheros y terminal, las skills del método (skills.external_dirs),
# la guardia que deniega firmar en el dialecto de Hermes y las mismas prohibiciones (approvals.deny) que la estación.
# Si el prompt empieza por /sdd-<skill>, esa skill se precarga entera. El modelo, por etapa en hermes-sdd.json.
#
# Última línea de stdout: JSON {outcome: done|failed|busy, reason, run, session_id, cost_usd, minutes}
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO=$(cd "$1" && pwd); NOMBRE=$2; PROMPT=$3; MODELO=${4:-}
RUN="$(date +%Y%m%d-%H%M%S)-$NOMBRE"
DIR="$REPO/.sdd/hermes"; LOCK="$DIR/lock"; mkdir -p "$DIR/runs"
OUT="$DIR/runs/$RUN.txt"; ERR="$DIR/runs/$RUN.err"; USO="$DIR/runs/$RUN.json"
salir() { local x=${3:-}; [ -n "$x" ] || x='{}'
  local v=${VERSIONES:-}; jq -e 'type == "object"' <<< "$v" >/dev/null 2>&1 || v='{}'   # con qué se hizo (va a etapas.jsonl)
  jq -nc --arg o "$1" --arg r "$2" --arg run "$RUN" --argjson x "$x" --argjson v "$v" '{outcome:$o, reason:$r, run:$run} + $x + (if $v == {} then {} else {versiones:$v} end)'; exit 0; }

# Candado (lib/candado.sh): el de la etapa que nos lanzó o, a mano, uno propio
. "$ROOT/lib/candado.sh"
candado_tomar "$REPO" ejecutor "$RUN" || salir busy "ya hay una ejecución viva en este repo ($CANDADO_OTRO)"
trap '[ -s "$ERR" ] || rm -f "$ERR"; candado_soltar' EXIT   # sin .err vacíos en runs/

SKILL=$(printf '%s' "$PROMPT" | sed -nE '1s#^/(sdd-[a-z-]+).*#\1#p')
TEXTO=$(printf '%s' "$PROMPT" | sed -E '1s#^/sdd-[a-z-]+[^—]*— *##')
ARGS=(-p sdd-ejecutor --accept-hooks -t file,terminal --usage-file "$USO" -z "$TEXTO")
[ -n "$SKILL" ] && ARGS+=(-s "$SKILL")
[ -n "$MODELO" ] && ARGS+=(-m "$MODELO")
VERSIONES=$(jq -nc --arg h "$(hermes --version 2>/dev/null | head -1)" --arg n "$(node -v 2>/dev/null || true)" --arg m "$MODELO" \
  '{hermes: (if $h == "" then null else $h end), node: (if $n == "" then null else $n end), modelo: (if $m == "" then null else $m end)}' 2>/dev/null || echo '{}')
INICIO=$(date +%s)
cd "$REPO"
SDD_PLUGIN_ROOT="$ROOT/metodo" CLAUDE_PLUGIN_ROOT="$ROOT/metodo" SDD_EXECUTOR=hermes \
  hermes "${ARGS[@]}" > "$OUT" 2> "$ERR"; RC=$?
MIN=$(( ($(date +%s) - INICIO) / 60 ))
COSTE=$(jq -r '.estimated_cost_usd // .cost_usd // .total_cost_usd // 0' "$USO" 2>/dev/null || echo 0)
EXTRA=$(jq -nc --arg c "$COSTE" --argjson m "$MIN" '{session_id:"hermes", cost_usd:($c|tonumber? // 0), minutes:$m}')
[ "$RC" = 0 ] || salir failed "hermes salió con $RC: $(tail -c 300 "$ERR" | tr '\n' ' ')" "$EXTRA"
salir done "ok" "$EXTRA"
