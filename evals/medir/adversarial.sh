#!/usr/bin/env bash
# RECALL DEL VERIFICADOR ADVERSARIAL (M2c): la ronda adversarial de la etapa aceptar, sola, sobre una copia del banco
# con un defecto sembrado (tests/fixtures/banco/parches/sembrados) o sobre la copia limpia.
#
#   evals/medir/adversarial.sh (--defecto <id> | --limpia <proyecto>) --fase <N> --salida <dir>
#                              [--rep <r>] [--arnes <dir>] [--modelo <m>] [--tope-usd <x>] [--ejecutor <script>] [--seco]
#
# 1. Copia temporal del proyecto del banco con un git como el de un proyecto real (.sdd/, evidencias/ y
#    pipeline-state.json ignorados, como los deja etapa.sh), el banco como commit aceptado y el parche como commit
#    siguiente; la evidencia se toca después (la frescura es por mtime, como en executors/replay.sh).
# 2. El prompt de la ronda COMPLETA tal cual lo compone fidelidad() en etapa.sh del arnés medido (--arnes): la línea
#    del prompt, decisiones(), no_repitas(), el texto de la wiki y el bloque de aclaraciones salen de ese etapa.sh, sin
#    copiarlos aquí. Sin la parte incremental (es la primera ronda de la FASE, la que vería el defecto), sin «PEDIDO»
#    (no hay feedback pendiente) y sin lecciones (dependen de la máquina).
# 3. La ejecuta el ejecutor del arnés medido (executors/caja.sh por defecto) con SDD_PASO=acceptance y SDD_TOPE_USD.
#    La caja trabaja sobre su propia copia y «aplica» solo sobre la copia temporal: el banco no se toca y no se abre
#    ninguna puerta (no corre etapa.sh).
# 4. Deja en --salida: prompt.txt, resultado.json (la última línea del ejecutor), impugnaciones.jsonl (las que añadió
#    la ronda), transcripcion.jsonl.gz si la hay y meta.json {defecto, proyecto, fase, rep, commit_arnes, modelo,
#    nuevas, coste_usd, minutos, corrio_tests}.
# --seco: prepara la copia y el prompt y no lanza nada (sin modelo). Solo lee el banco.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEF=""; LIMPIA=""; FASE=""; SAL=""; REP=1; H="$ROOT"; MODELO=sonnet; TOPE=""; EJ=""; SECO=false
while [ $# -gt 0 ]; do
  case "$1" in
    --defecto) DEF=${2:-}; shift 2 ;;
    --limpia) LIMPIA=${2:-}; shift 2 ;;
    --fase) FASE=${2:-}; shift 2 ;;
    --salida) SAL=${2:-}; shift 2 ;;
    --rep) REP=${2:-}; shift 2 ;;
    --arnes) H=$(cd "${2:-}" && pwd) || exit 2; shift 2 ;;
    --modelo) MODELO=${2:-}; shift 2 ;;
    --tope-usd) TOPE=${2:-}; shift 2 ;;
    --ejecutor) EJ=${2:-}; shift 2 ;;
    --seco) SECO=true; shift ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "adversarial.sh: argumento desconocido $1" >&2; exit 2 ;;
  esac
done
die() { echo "adversarial.sh: $*" >&2; exit 2; }
{ [ -n "$DEF" ] && [ -z "$LIMPIA" ]; } || { [ -z "$DEF" ] && [ -n "$LIMPIA" ]; } || die "da --defecto <id> o --limpia <proyecto> (uno)"
case "$FASE" in ''|*[!0-9]*) die "falta --fase <N>" ;; esac
[ -n "$SAL" ] || die "falta --salida <dir>"
command -v jq >/dev/null || die "necesita jq"
BANCO="$ROOT/tests/fixtures/banco"; S="$BANCO/parches/sembrados"
if [ -n "$DEF" ]; then
  PROY=$(jq -r --arg d "$DEF" '.defectos[] | select(.id == $d) | .proyecto' "$S/indice.json")
  PARCHE=$(jq -r --arg d "$DEF" '.defectos[] | select(.id == $d) | .parche' "$S/indice.json")
  [ -n "$PROY" ] || die "no hay defecto $DEF en $S/indice.json"
else PROY=$LIMPIA; PARCHE=""; fi
[ -d "$BANCO/$PROY" ] || die "no hay proyecto $PROY en el banco"
ls "$BANCO/$PROY/plan/fases/FASE-$FASE-"*.md >/dev/null 2>&1 || die "$PROY no tiene FASE-$FASE"
[ -f "$H/etapa.sh" ] || die "--arnes $H no es un arnés (falta etapa.sh)"
EJ=${EJ:-$H/executors/caja.sh}
mkdir -p "$SAL"; SAL=$(cd "$SAL" && pwd)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
C="$T/proyecto"; G=(-c user.name=medir -c user.email=medir@localhost -c commit.gpgsign=false -c tag.gpgsign=false)

# ── 1. La copia ──────────────────────────────────────────────────────────────────────────────────────────────────
cp -R "$BANCO/$PROY" "$C"
printf 'pipeline-state.json\n.sdd/\nevidencias/\nnode_modules/\n' >> "$C/.gitignore"
N=$(( $(ls "$C/plan/fases/"FASE-*.md | wc -l) - 1 ))
( cd "$C" && git init -q -b main && git add -A && git "${G[@]}" commit -qm banco && git tag "fase-$N-accepted" ) || die "no se pudo crear el git de la copia"
if [ -n "$PARCHE" ]; then
  git -C "$C" apply "$S/$PARCHE" 2>"$T/err" || die "$PARCHE no aplica: $(cat "$T/err")"
  git -C "$C" add -A && git -C "$C" "${G[@]}" commit -qm "sembrado $PARCHE" || die "no se pudo commitear el parche"
fi
for sub in .sdd/junit evidencias; do [ -d "$C/$sub" ] && find "$C/$sub" -type f -exec touch {} +; done
ANTES=$(wc -l < "$C/acceptance/challenges.jsonl" 2>/dev/null | tr -d ' '); ANTES=${ANTES:-0}

# ── 2. El prompt, del etapa.sh medido ────────────────────────────────────────────────────────────────────────────
E="$H/etapa.sh"
{ sed -n '/^decisiones() {/,/^}/p' "$E"; sed -n '/^no_repitas() {/,/^}/p' "$E"
  grep -m1 '^WIKI=" Project wiki' "$E"; grep -m1 '^ARNES="Modo arnés' "$E"
  sed -n '/^fidelidad() {/,/^}/p' "$E" | grep -m1 'claude_etapa acceptance "/sdd-acceptance --adversarial' | sed 's/^ *claude_etapa acceptance /printf "%s" /'
} > "$T/prompt.sh"
[ "$(grep -c . "$T/prompt.sh")" -gt 5 ] && grep -q '^printf "%s" "/sdd-acceptance --adversarial' "$T/prompt.sh" ||
  die "no encuentro en $E las piezas del prompt adversarial (decisiones, no_repitas, WIKI, ARNES, fidelidad)"
PROMPT=$(cd "$C" && ROOT="$H" SDD="$H/metodo/scripts/sdd.mjs" FASE="$FASE" bash -c '
  PEDIDO=""; LECC=""; inc=""; '"$(sed -n '/^decisiones() {/,/^}/p;/^no_repitas() {/,/^}/p' "$T/prompt.sh")"'
  DECIS=$(decisiones)
  '"$(grep -E '^(WIKI|ARNES)=' "$T/prompt.sh")"'
  '"$(grep '^printf' "$T/prompt.sh")") || die "no se pudo componer el prompt"
printf '%s' "$PROMPT" > "$SAL/prompt.txt"
COMMIT=$(git -C "$H" rev-parse HEAD 2>/dev/null || echo null)
meta() {  # meta <resultado-json>
  local r=$1; jq -e . >/dev/null 2>&1 <<< "$r" || r='{}'
  local tr=false; [ -s "$SAL/transcripcion.jsonl.gz" ] && gzip -dc "$SAL/transcripcion.jsonl.gz" |
    jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use" and .name == "Bash") | .input.command // empty' 2>/dev/null |
    grep -qE '(vitest|npm (run )?test|playwright test|npx test)' && tr=true
  jq -n --arg d "${DEF:-limpia}" --arg p "$PROY" --argjson f "$FASE" --argjson r "$REP" --arg c "$COMMIT" --arg m "$MODELO" \
    --argjson n "$(cat "$SAL/impugnaciones.jsonl" 2>/dev/null | grep -c . || true)" --argjson res "$r" --argjson tr "$tr" --arg seco "$SECO" \
    '{defecto:$d, proyecto:$p, fase:$f, rep:$r, commit_arnes:$c, modelo:$m, seco:($seco == "true"), nuevas:$n,
      outcome:($res.outcome // null), reason:($res.reason // null), coste_usd:($res.cost_usd // null),
      minutos:($res.minutes // null), turnos:($res.turns // null), corrio_tests:$tr}' > "$SAL/meta.json"
}
: > "$SAL/impugnaciones.jsonl"
if $SECO; then meta '{}'; cp -R "$C" "$SAL/copia"; echo "$SAL"; exit 0; fi

# ── 3. La ronda ──────────────────────────────────────────────────────────────────────────────────────────────────
python3 "$H/plugin/hermes-sdd/hsdd_wiki.py" construir "$C" >/dev/null 2>&1 || true   # como claude_etapa
SDD_TOPE_USD=$TOPE SDD_TOPE_MIN=${SDD_TOPE_MIN:-60} SDD_PASO=acceptance SDD_SANDBOX=0 \
  bash "$EJ" "$C" "aceptar-$FASE" "$PROMPT" "$MODELO" > "$T/sal" 2> "$T/ejerr"
RES=$(tail -1 "$T/sal"); printf '%s\n' "$RES" > "$SAL/resultado.json"

# ── 4. Lo que encontró ───────────────────────────────────────────────────────────────────────────────────────────
[ -f "$C/acceptance/challenges.jsonl" ] && tail -n +"$((ANTES + 1))" "$C/acceptance/challenges.jsonl" > "$SAL/impugnaciones.jsonl"
TRS=$(ls -t "$C"/.sdd/hermes/runs/*.transcripcion.jsonl.gz 2>/dev/null | head -1)
[ -n "$TRS" ] && cp "$TRS" "$SAL/transcripcion.jsonl.gz"
tail -c 2000 "$T/ejerr" > "$SAL/ejecutor.err" 2>/dev/null
meta "$RES"
cat "$SAL/meta.json"
