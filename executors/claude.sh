#!/usr/bin/env bash
# Ejecutor CLAUDE CODE, con supervisor. Lanza UNA etapa con `claude -p` y la vigila:
#   · candado por repo: nunca dos ejecuciones a la vez en el mismo proyecto (otra viva → outcome "busy")
#   · Claude en su propio grupo de procesos; si este supervisor muere o su padre desaparece, el grupo se mata
#   · caffeinate mientras dura (el Mac no se duerme a mitad de etapa)
#   · entorno limpio: Claude no hereda tokens del bot ni claves de proveedor de Hermes
#   · cuota de la suscripción agotada → outcome "scheduled" con la hora de reinicio, no un fallo
#   · cada ejecución en su propio fichero .sdd/hermes/runs/<run>.json (nunca se sobrescribe)
#
#   executors/claude.sh <repo> <nombre> <prompt> [modelo]
#
# Última línea de stdout: JSON {outcome: done|failed|scheduled|busy, reason, run, session_id, cost_usd, minutes, reset_at}
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO=$(cd "$1" && pwd); NOMBRE=$2; PROMPT=$3; MODELO=${4:-}
RUN="$(date +%Y%m%d-%H%M%S)-$NOMBRE"
DIR="$REPO/.sdd/hermes"; LOCK="$DIR/lock"; mkdir -p "$DIR/runs"
OUT="$DIR/runs/$RUN.json"; ERR="$DIR/runs/$RUN.err"

salir() {  # salir <outcome> <reason> [extra-json]
  local x=${3:-}; [ -n "$x" ] || x='{}'
  jq -nc --arg o "$1" --arg r "$2" --arg run "$RUN" --argjson x "$x" '{outcome:$o, reason:$r, run:$run} + $x'
  exit 0
}

# ── Candado ──────────────────────────────────────────────────────────────────────────────────────────────────────
if ! mkdir "$LOCK" 2>/dev/null; then
  otro=$(cat "$LOCK/pid" 2>/dev/null || echo "")
  if [ -n "$otro" ] && kill -0 "$otro" 2>/dev/null; then
    salir busy "ya hay una ejecución viva en este repo ($(cat "$LOCK/run" 2>/dev/null), pid $otro)"
  fi
  rm -rf "$LOCK"; mkdir "$LOCK"   # candado huérfano: su dueño ya no existe
fi
echo $$ > "$LOCK/pid"; echo "$RUN" > "$LOCK/run"
CPID=""
limpiar() {
  [ -n "$CPID" ] && kill -TERM -- "-$CPID" 2>/dev/null
  [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$$" ] && rm -rf "$LOCK"
}
trap limpiar EXIT
trap 'limpiar; exit 143' TERM INT HUP

# ── Lanzar Claude en su propio grupo, con entorno limpio ───────────────────────────────────────────────────────────
BIN=$(command -v "${CLAUDE_BIN:-claude}") || salir failed "no encuentro el ejecutable de Claude Code"
ARGS=(-p "$PROMPT" --output-format json --plugin-dir "$ROOT/metodo"
      --settings '{"enabledPlugins":{"sdd-pipeline@noelserdna":false}}')
[ -n "$MODELO" ] && ARGS+=(--model "$MODELO")
cd "$REPO"
env -i HOME="$HOME" USER="$USER" LOGNAME="${LOGNAME:-$USER}" TMPDIR="${TMPDIR:-/tmp}" LANG="${LANG:-es_ES.UTF-8}" \
  PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" TERM=dumb \
  SDD_EXECUTOR=hermes SDD_RUN="$RUN" DISABLE_AUTOUPDATER=1 \
  perl -e 'setpgrp(0,0); exec @ARGV' "$BIN" "${ARGS[@]}" > "$OUT" 2> "$ERR" &
CPID=$!
echo "$CPID" > "$LOCK/claude"
command -v caffeinate >/dev/null && caffeinate -i -s -w "$CPID" &

# ── Vigilar: si nuestro padre desaparece (Hermes abandonó la herramienta), matar el grupo ──────────────────────────
INICIO=$(date +%s)
while kill -0 "$CPID" 2>/dev/null; do
  if [ "$(ps -o ppid= -p $$ | tr -d ' ')" = 1 ]; then
    echo "padre desaparecido: se detiene la etapa" >> "$ERR"; limpiar; exit 1
  fi
  sleep 5 & wait $!   # espera interrumpible: una señal llega al trap al instante
done
wait "$CPID"; RC=$?; CPID=""
MIN=$(( ($(date +%s) - INICIO) / 60 ))

# ── Clasificar el resultado ───────────────────────────────────────────────────────────────────────────────────────
if ! jq -e . "$OUT" >/dev/null 2>&1; then
  if grep -qiE "usage limit|rate limit|limit reached|resets? at" "$ERR" "$OUT" 2>/dev/null; then
    RESET=$(grep -oE '\|[0-9]{10}' "$OUT" "$ERR" 2>/dev/null | head -1 | tr -d '|' || true)
    salir scheduled "cuota de Claude agotada" "$(jq -nc --arg r "${RESET:-}" '{reset_at:$r}')"
  fi
  salir failed "Claude Code no devolvió JSON (rc=$RC): $(tail -c 300 "$ERR" | tr '\n' ' ')"
fi
TEXTO=$(jq -r '.result // ""' "$OUT")
EXTRA=$(jq -c --argjson m "$MIN" '{session_id, cost_usd: .total_cost_usd, turns: .num_turns, minutes: $m}' "$OUT")
if [ "$(jq -r .is_error "$OUT")" = true ] || [ "$RC" -ne 0 ]; then
  if echo "$TEXTO" | grep -qiE "usage limit|rate limit|limit reached"; then
    RESET=$(echo "$TEXTO" | grep -oE '\|[0-9]{10}' | head -1 | tr -d '|' || true)
    salir scheduled "cuota de Claude agotada" "$(echo "$EXTRA" | jq -c --arg r "${RESET:-}" '. + {reset_at:$r}')"
  fi
  salir failed "la etapa terminó con error: $(echo "$TEXTO" | tail -c 300 | tr '\n' ' ')" "$EXTRA"
fi
salir done "ok" "$EXTRA"
