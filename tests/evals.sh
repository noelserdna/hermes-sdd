#!/usr/bin/env bash
# El runner de evals (evals/run.sh) sin modelo: con el claude falso puntúa, registra y detecta lo tocado fuera de
# lo permitido; los casos reales tienen su skill, su fixture y sus comprobaciones.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
echo ok > "${TMPDIR:-/tmp}/fake-claude-mode"
export CLAUDE_BIN="$ROOT/evals/fake-claude.sh" EVALS_CASOS="$T/casos" EVALS_RESULTADOS="$T/res.jsonl"
mkdir -p "$T/casos/bien" "$T/casos/mal"
jq -n '{skill:"sdd-task-generator", fixture:"metodo/tests/fixtures/plan-mini", copiar:["plan"], prompt:"x", permitidos:["task/",".sdd/"],
        checks:[{nombre:"el plan sigue ahí", cmd:"test -f plan/fases/FASE-1-mini.md"}]}' > "$T/casos/bien/caso.json"
jq -n '{skill:"sdd-plan-architect", fixture:"metodo/tests/fixtures/plan-mini", copiar:["plan"], prompt:"x", permitidos:["task/"],
        setup:["echo x > fuera.txt"], checks:[{nombre:"hay tareas", cmd:"test -d task"}]}' > "$T/casos/mal/caso.json"
o=$(bash "$ROOT/evals/run.sh" bien 2>&1); rc=$?
[ $rc = 0 ] && echo "$o" | grep -q '^ok   bien (sdd-task-generator): 0.01 \$' && jq -e 'select(.caso == "bien") | .ok and .coste_usd == 0.01 and .resultado == "done" and (.checks | length) == 2' "$T/res.jsonl" >/dev/null \
  && ok "caso que pasa: ok, con su coste, y queda en results.jsonl" || bad "bien: $rc $o"
o=$(bash "$ROOT/evals/run.sh" mal 2>&1); rc=$?
[ $rc = 1 ] && echo "$o" | grep -q 'FAIL mal' && echo "$o" | grep -q 'hay tareas' && ! echo "$o" | grep -q 'fuera.txt' \
  && ok "caso que falla: dice qué comprobación (lo del setup no cuenta como tocado por la skill)" || bad "mal: $rc $o"
jq -n '{skill:"sdd-plan-architect", fixture:"metodo/tests/fixtures/plan-mini", copiar:["plan"], prompt:"x", permitidos:["task/"],
        checks:[{nombre:"escribe al comprobar", cmd:"echo y > otro.txt"}]}' > "$T/casos/mal/caso.json"
o=$(bash "$ROOT/evals/run.sh" mal 2>&1); rc=$?
[ $rc = 0 ] && ! echo "$o" | grep -q 'fuera de lo permitido' && ok "lo del ejecutor (.sdd/hermes) y lo que escriben las comprobaciones no cuenta como tocado por la skill" || bad "fuera: $rc $o"
o=$(cd "$ROOT" && EVALS_CASOS="$ROOT/evals/casos" bash evals/run.sh --lista)
echo "$o" | grep -q '^tareas-mini  *sdd-task-generator$' && echo "$o" | grep -q '^plan-todo  *sdd-plan-architect$' && ok "casos reales: tareas-mini y plan-todo" || bad "lista: $o"
for c in "$ROOT"/evals/casos/*/caso.json; do
  jq -e '.skill and .fixture and .prompt and (.permitidos | length > 0) and (.checks | length > 0)' "$c" >/dev/null && [ -d "$ROOT/$(jq -r .fixture "$c")" ] && [ -d "$ROOT/metodo/skills/$(jq -r .skill "$c")" ] \
    || bad "caso mal formado: $c"
done
ok "cada caso real tiene skill que existe, fixture que existe, prompt, permitidos y comprobaciones"
exit $fail
