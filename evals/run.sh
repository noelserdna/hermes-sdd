#!/usr/bin/env bash
# Evals de las skills del método: un test unitario por skill, con un modelo de verdad y céntimos de coste, en vez de
# descubrir sus fallos en una prueba de proyecto entera (≈28 $ y 6 h). Lauren Tan (AI Engineer Code Summit, 11/2026):
# «un eval es un test unitario para un agente».
#
#   bash evals/run.sh <caso>...           ejecuta esos casos (evals/casos/<caso>/caso.json)
#   bash evals/run.sh --todos             todos
#   bash evals/run.sh --cambiadas [REF]   los de las skills que cambiaron desde REF (por defecto origin/main)
#   bash evals/run.sh --lista             los casos y su skill
#
# Cada caso: copia su fixture a un repo temporal, corre su setup, ejecuta la skill con executors/claude.sh (modelo,
# tope de gasto y de minutos del caso), y puntúa con comprobaciones deterministas (lints del método y del arnés) y con
# «no tocó nada fuera de lo permitido». El resultado va a evals/results.jsonl (caso, skill, sha de la skill, modelo,
# coste, turnos, comprobaciones). Sale 1 si algún caso falla. CLAUDE_BIN=evals/fake-claude.sh prueba el runner gratis.
#
# caso.json: { skill, fixture (carpeta del arnés), copiar? [subcarpetas del fixture], setup? [órdenes], prompt, modelo?,
#              tope_usd?, tope_min?, permitidos [rutas que puede cambiar], checks [{nombre, cmd}] }
# Las órdenes de setup y checks corren en el repo del caso con $SDD (la CLI del método) y $ARNES (este repo).
set -uo pipefail
ARNES="$(cd "$(dirname "$0")/.." && pwd)"
SDD="$ARNES/metodo/scripts/sdd.mjs"
CASOS="${EVALS_CASOS:-$ARNES/evals/casos}"
RES="${EVALS_RESULTADOS:-$ARNES/evals/results.jsonl}"
export ARNES SDD

casos_de_skills() {   # casos cuya skill está entre las de stdin
  local s; while read -r s; do
    for c in "$CASOS"/*/caso.json; do [ "$(jq -r .skill "$c")" = "$s" ] && basename "$(dirname "$c")"; done
  done | sort -u
}
case "${1:-}" in
  --lista) for c in "$CASOS"/*/caso.json; do printf '%-24s %s\n' "$(basename "$(dirname "$c")")" "$(jq -r .skill "$c")"; done; exit 0 ;;
  --todos) set -- $(ls "$CASOS") ;;
  --cambiadas)
    REF=${2:-origin/main}
    set -- $(git -C "$ARNES" diff --name-only "$REF" -- metodo/skills | sed -nE 's#^metodo/skills/([^/]+)/.*#\1#p' | sort -u | casos_de_skills)
    [ $# -gt 0 ] || { echo "ninguna skill con eval cambió desde $REF"; exit 0; } ;;
  "") echo "uso: evals/run.sh <caso>... | --todos | --cambiadas [REF] | --lista" >&2; exit 2 ;;
esac

fallos=0
for caso in "$@"; do
  C="$CASOS/$caso/caso.json"
  [ -f "$C" ] || { echo "FAIL $caso: no existe $C"; fallos=1; continue; }
  skill=$(jq -r .skill "$C")
  T=$(mktemp -d); R="$T/repo"; mkdir -p "$R"
  FIX="$ARNES/$(jq -r .fixture "$C")"
  if jq -e '.copiar | length > 0' "$C" >/dev/null 2>&1; then
    for d in $(jq -r '.copiar[]' "$C"); do cp -R "$FIX/$d" "$R/"; done
  else cp -R "$FIX/." "$R/"; fi
  ( cd "$R" && git init -q -b main && git -c user.email=eval@local -c user.name=eval add -A && git -c user.email=eval@local -c user.name=eval commit -qm "eval: fixture" )
  ok_setup=true
  while IFS= read -r orden; do
    [ -n "$orden" ] || continue
    ( cd "$R" && bash -c "$orden" ) >/dev/null 2>&1 || { ok_setup=false; echo "FAIL $caso: setup «${orden}»"; }
  done < <(jq -r '.setup[]? ' "$C")
  ( cd "$R" && git -c user.email=eval@local -c user.name=eval add -A && git -c user.email=eval@local -c user.name=eval commit -qm "eval: setup" --allow-empty )
  base=$(git -C "$R" rev-parse HEAD)
  t0=$(date +%s)
  out=$(SDD_TOPE_USD="$(jq -r '.tope_usd // 1' "$C")" SDD_TOPE_MIN="$(jq -r '.tope_min // 20' "$C")" \
        bash "$ARNES/executors/claude.sh" "$R" "eval-$caso" "$(jq -r .prompt "$C")" "$(jq -r '.modelo // "sonnet"' "$C")" 2>/dev/null | tail -1)
  ejec=$(jq -c . <<< "$out" 2>/dev/null || echo '{"outcome":"failed","reason":"el ejecutor no devolvió JSON"}')
  # lo que cambió (commits y sin commit) fuera de lo permitido
  cambiados=$( { git -C "$R" diff --name-only "$base" HEAD; git -C "$R" status --porcelain -uall | cut -c4-; } 2>/dev/null | sort -u)
  fuera=$(printf '%s\n' "$cambiados" | while read -r f; do
    [ -n "$f" ] || continue
    [[ "$f" == .sdd/hermes/* ]] && continue   # lo escribe el ejecutor (lock, runs), no la skill
    jq -e --arg f "$f" 'any(.permitidos[]; . as $p | $f == $p or ($p | endswith("/")) and ($f | startswith($p)))' "$C" >/dev/null || echo "$f"
  done | head -5 | tr '\n' ' ')
  checks='[]'
  [ "$ok_setup" = true ] || checks=$(jq -c '. + [{nombre:"setup", ok:false}]' <<< "$checks")
  checks=$(jq -c --arg f "$fuera" '. + [{nombre:"nada fuera de lo permitido", ok:($f == ""), detalle:$f}]' <<< "$checks")
  n=$(jq '.checks | length' "$C")
  for i in $(seq 0 $((n - 1))); do
    nombre=$(jq -r ".checks[$i].nombre" "$C"); cmd=$(jq -r ".checks[$i].cmd" "$C")
    if salida=$(cd "$R" && bash -c "$cmd" 2>&1); then ok=true; else ok=false; fi
    checks=$(jq -c --arg n "$nombre" --argjson ok "$ok" --arg d "$(printf '%s' "$salida" | tail -3 | cut -c1-300)" '. + [{nombre:$n, ok:$ok} + (if $ok then {} else {detalle:$d} end)]' <<< "$checks")
  done
  todo_ok=$(jq -r --argjson e "$ejec" 'all(.[]; .ok) and ($e.outcome == "done")' <<< "$checks")
  sha=$(git -C "$ARNES" log -1 --format=%h -- "metodo/skills/$skill" 2>/dev/null)
  linea=$(jq -nc --arg c "$caso" --arg s "$skill" --arg sha "$sha" --arg m "$(jq -r '.modelo // "sonnet"' "$C")" --argjson e "$ejec" \
    --argjson ch "$checks" --argjson ok "$todo_ok" --arg f "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --argjson min "$(( ($(date +%s) - t0) / 60 ))" \
    '{fecha:$f, caso:$c, skill:$s, skill_sha:$sha, modelo:$m, ok:$ok, resultado:$e.outcome, coste_usd:($e.cost_usd // 0), turnos:($e.turns // null), minutos:$min, checks:$ch}')
  echo "$linea" >> "$RES"
  if [ "$todo_ok" = true ]; then
    echo "ok   $caso ($skill): $(jq -r '"\(.coste_usd) $, \(.minutos) min"' <<< "$linea")"
  else
    fallos=1
    echo "FAIL $caso ($skill): $(jq -r '[.checks[] | select(.ok | not) | .nombre + (if .detalle then ": " + .detalle else "" end)] | join(" · ")' <<< "$linea")$( [ "$(jq -r .outcome <<< "$ejec")" = done ] || echo " · ejecución: $(jq -r '.reason // .outcome' <<< "$ejec")")"
  fi
  [ -n "${EVALS_CONSERVAR:-}" ] && echo "     repo: $R" || rm -rf "$T"
done
exit $fallos
