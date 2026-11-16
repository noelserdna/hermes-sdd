#!/usr/bin/env bash
# Topes de gasto y de tiempo: etapa.sh pasa al ejecutor lo que le queda a la etapa y al proyecto (--max-budget-usd) y
# su tope de minutos; sin presupuesto, la etapa no arranca y dice cómo subirlo.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
export HERMES_SDD_HOME="$T/h"; mkdir -p "$HERMES_SDD_HOME"
R="$T/r"; mkdir -p "$R/.sdd/hermes" "$R/ux"; cd "$R"; git init -q -b main
git config user.email t@t; git config user.name t   # las etapas commitean con la identidad del repo (Linux sin global)
cp "$ROOT/metodo/templates/pipeline-state.template.json" pipeline-state.json; echo x > ux/UI-DESIGN-SYSTEM.md
conf() { echo "{\"ejecutor\":\"claude\",\"ejecutores\":{\"ux\":\"../tests/ejecutor-falso\"}$1}" > .sdd/hermes/hermes-sdd.json; }
conf ""; git add -A; git -c user.email=t@t -c user.name=t commit -qm i
etapa() { : > "$T/log"; out=$(FALSO_LOG="$T/log" bash "$ROOT/etapa.sh" "$R" ux 2>/dev/null | tail -1); }

printf 'node_modules\n' > .gitignore; git add .gitignore; git -c user.email=t@t -c user.name=t commit -qm "gitignore sin el arnés"
etapa
grep -qx '.sdd/' .gitignore && grep -qx 'pipeline-state.json' .gitignore && git log -1 --format=%s | grep -q "restore the harness entries" \
  && ok "la etapa vuelve a poner en .gitignore las líneas del arnés que un agente quitó (taller3)" || bad "gitignore: $(cat .gitignore) / $(git log -1 --format=%s)"
[ "$(jq -r .tope_usd "$T/log")" = 20 ] && [ "$(jq -r .tope_min "$T/log")" = 60 ] && ok "por defecto: 20 \$ por etapa y 60 min por ejecución" || bad "defecto: $(cat "$T/log" | jq -c '{tope_usd,tope_min}')"
# lo gastado por el proyecto descuenta: con 295 $ gastados de 300, la ejecución solo puede gastar 5
echo '{"etapa":"x","coste_usd":295}' >> .sdd/hermes/etapas.jsonl
etapa
[ "$(jq -r .tope_usd "$T/log")" = 5 ] && ok "lo que queda del proyecto limita la ejecución (5 de 300 \$)" || bad "resto proyecto: $(jq -c . "$T/log")"
# sin presupuesto: la etapa no llama al ejecutor y falla diciendo cómo seguir
echo '{"etapa":"x","coste_usd":10}' >> .sdd/hermes/etapas.jsonl
etapa
[ ! -s "$T/log" ] && jq -e '.outcome == "failed" and .tope == "proyecto" and (.reason | test("tope de gasto.*topes.proyecto_usd"))' <<< "$out" >/dev/null \
  && ok "proyecto sin presupuesto: no arranca y dice cómo subirlo" || bad "sin presupuesto: $out $(cat "$T/log")"
# los topes del proyecto mandan sobre los globales; 0 = sin tope
conf ',"topes":{"proyecto_usd":0,"etapa_usd":3,"ejecucion_min":15}'
echo '{"topes":{"etapa_usd":50}}' > "$HERMES_SDD_HOME/sdd.json"
etapa
[ "$(jq -r .tope_usd "$T/log")" = 3 ] && [ "$(jq -r .tope_min "$T/log")" = 15 ] && ok "los topes del proyecto mandan; proyecto_usd 0 = sin tope de proyecto" || bad "proyecto manda: $(jq -c '{tope_usd,tope_min}' "$T/log")"
conf ',"topes":{"proyecto_usd":0,"etapa_usd":0}'
etapa
[ "$(jq -r .tope_usd "$T/log")" = "" ] && ok "sin topes de gasto, el ejecutor no recibe --max-budget-usd" || bad "sin tope: $(jq -c . "$T/log")"
# el ejecutor de Claude: el tope llega como --max-budget-usd y uno alcanzado es un fallo que dice qué subir
grep -q -- '--max-budget-usd "$SDD_TOPE_USD"' "$ROOT/executors/claude.sh" && grep -q 'superó su tope de tiempo' "$ROOT/executors/claude.sh" \
  && ok "executors/claude.sh: --max-budget-usd y tope de minutos propio" || bad "claude.sh sin topes"
exit $fail
