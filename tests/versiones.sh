#!/usr/bin/env bash
# Cada línea de .sdd/hermes/etapas.jsonl dice CON QUÉ se hizo la etapa: commit del arnés, versión de Claude Code,
# modelo, versión de Node, imagen de la caja (si la hubo) e id de la tarjeta. Sin eso no se puede comparar dos
# ejecuciones ni unir el registro con el kanban: en las 337 líneas de los 13 proyectos «tarjeta» era null y no había
# ninguna versión (análisis 11). Sobre una copia de material-montana12 del banco; solo lo lee.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
export HERMES_SDD_HOME="$T/h" HERMES_SDD_SIN_WIKI=1 SDD_JEV=off; mkdir -p "$HERMES_SDD_HOME" "$T/bin"
B="$ROOT/tests/fixtures/banco/material-montana12"
[ "$(jq -s '[.[] | select(.tarjeta != null or has("arnes"))] | length' "$B/.sdd/hermes/etapas.jsonl")" = 0 ] \
  && ok "el banco es de antes: sus $(wc -l < "$B/.sdd/hermes/etapas.jsonl" | tr -d ' ') líneas no llevan tarjeta ni versiones" || bad "el banco ya lleva versiones: revisa este test"
R="$T/material-montana12"; cp -R "$B" "$R"; cd "$R"
git init -q -b main; git config user.email t@t; git config user.name t; git config commit.gpgsign false
printf '.sdd/\npipeline-state.json\nnode_modules\n' > .gitignore
jq '.ejecutor = "../tests/ejecutor-falso" | .ejecutores = {} | .canales = []' .sdd/hermes/hermes-sdd.json > "$T/c" && mv "$T/c" .sdd/hermes/hermes-sdd.json
git add -A; git commit -qm banco
ultima() { tail -1 "$R/.sdd/hermes/etapas.jsonl"; }
ARNES=$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || basename "$(cd -P "$ROOT" && pwd -P)")

# 1. etapa.sh: el arnés, Node, el id de la tarjeta (el que pone Hermes al worker) y lo que diga el ejecutor
V='{"claude_code":"9.9.9 (Claude Code)","node":"v22.1.0","modelo":"claude-x-1","modelos":["claude-x-1"],"imagen":"hermes-sdd-caja:abc123"}'
HERMES_SDD_SIN_KANBAN=1 HERMES_KANBAN_TASK=t_abc123 FALSO_VERSIONES="$V" bash "$ROOT/etapa.sh" "$R" ux >/dev/null 2>&1
l=$(ultima)
jq -e --arg a "$ARNES" '.etapa == "ux" and .arnes == $a' <<< "$l" >/dev/null && ok "la línea lleva el commit del arnés" || bad "arnés: $(jq -c '{etapa, arnes}' <<< "$l") (esperaba $ARNES)"
jq -e '.tarjeta == "t_abc123"' <<< "$l" >/dev/null && ok "la línea lleva el id de la tarjeta (HERMES_KANBAN_TASK)" || bad "tarjeta: $(jq -c .tarjeta <<< "$l")"
jq -e '.claude_code == "9.9.9 (Claude Code)" and .modelo == "claude-x-1" and .node == "v22.1.0" and .imagen == "hermes-sdd-caja:abc123"' <<< "$l" >/dev/null \
  && ok "la línea lleva Claude Code, modelo, Node e imagen de la ejecución" || bad "versiones: $(jq -c '{claude_code, modelo, node, imagen}' <<< "$l")"
# sin versiones del ejecutor: Node es el del orquestador, y lo demás consta como null (no se inventa)
HERMES_SDD_SIN_KANBAN=1 bash "$ROOT/etapa.sh" "$R" ux >/dev/null 2>&1
l=$(ultima)
jq -e --arg n "$(node -v)" '.node == $n and has("claude_code") and .claude_code == null and has("imagen") and .imagen == null and .tarjeta == null' <<< "$l" >/dev/null \
  && ok "sin datos del ejecutor: Node del orquestador y el resto null" || bad "sin ejecutor: $(jq -c '{claude_code, modelo, node, imagen, tarjeta}' <<< "$l")"

# 2. la tarjeta, sin la variable (la estación de Hermes no la pasa a la orden): la que está en marcha con esta etapa
cat > "$T/bin/hermes" <<FALSO
#!/usr/bin/env bash
echo "\$*" >> "$T/hermes.log"
case "\$*" in *" list --json"*) jq -nc --arg r "$R" --arg a "$ROOT" '[
  {id:"t_vieja", status:"blocked", assignee:"sdd-estacion", created_at:1, body:("Ejecuta: bash " + \$a + "/etapa.sh " + \$r + " ux")},
  {id:"t_otra",  status:"running", assignee:"sdd-estacion", created_at:2, body:("Ejecuta: bash " + \$a + "/etapa.sh " + \$r + " ux 1")},
  {id:"t_viva",  status:"running", assignee:"sdd-estacion", created_at:3, body:("Origen: puerta g1 · UX\nEjecuta: bash " + \$a + "/etapa.sh " + \$r + " ux")}]' ;; esac
exit 0
FALSO
chmod +x "$T/bin/hermes"
PATH="$T/bin:$PATH" env -u HERMES_KANBAN_TASK bash "$ROOT/etapa.sh" "$R" ux >/dev/null 2>&1
jq -e '.tarjeta == "t_viva"' <<< "$(ultima)" >/dev/null && ok "sin la variable, la tarjeta es la que está en marcha con esta etapa" || bad "tarjeta del kanban: $(jq -c .tarjeta <<< "$(ultima)")"

# 3. executors/claude.sh dice qué Claude Code, qué Node y qué modelo usó de verdad (modelUsage)
cat > "$T/bin/claude" <<'FALSO'
#!/usr/bin/env bash
[ "${1:-}" = --version ] && { echo "9.9.9 (Claude Code)"; exit 0; }
echo '{"result":"hecho","total_cost_usd":0.01,"num_turns":2,"is_error":false,"session_id":"s","modelUsage":{"claude-x-1-20260101":{"costUSD":0.01}}}'
FALSO
chmod +x "$T/bin/claude"
o=$(CLAUDE_BIN="$T/bin/claude" bash "$ROOT/executors/claude.sh" "$R" prueba "hola" x-1 2>/dev/null | tail -1)
jq -e '.outcome == "done" and .versiones.claude_code == "9.9.9 (Claude Code)" and (.versiones.node | test("^v[0-9]+\\.")) and .versiones.modelo == "x-1"
       and .versiones.modelos == ["claude-x-1-20260101"]' <<< "$o" >/dev/null \
  && ok "executors/claude.sh: versión de Claude Code, Node, modelo pedido y modelo usado" || bad "claude.sh: $(jq -c '{outcome, versiones}' <<< "$o" 2>/dev/null || echo "$o")"

# 4. la caja dice desde dentro qué Claude Code y qué Node tiene, y el ejecutor añade la imagen
S="$T/salida"; mkdir -p "$S" "$R/.sdd/hermes/caja"; echo hola > "$R/.sdd/hermes/caja/prompt.txt"; echo '{"nombre":"t","email":"t@t"}' > "$R/.sdd/hermes/caja/identidad.json"
mv "$R/package.json" "$T/package.json"   # sin npm ci: aquí solo se mira lo que la caja declara
( cd "$R" && HOME="$T/hc" PATH="$T/bin:$PATH" CAJA_PROYECTO="$R" CAJA_ARNES="$ROOT" CAJA_SALIDA="$S" MODELO=x-1 bash "$ROOT/templates/caja/etapa.sh" >/dev/null 2>&1 )
mv "$T/package.json" "$R/package.json"
jq -e --arg n "$(node -v)" '.claude_code == "9.9.9 (Claude Code)" and .node == $n' "$S/versiones.json" >/dev/null 2>&1 \
  && ok "la caja deja /salida/versiones.json (Claude Code y Node de dentro)" || bad "caja: $(cat "$S/versiones.json" 2>/dev/null || echo 'sin versiones.json')"
grep -q 'versiones.json' "$ROOT/lib/caja-aplicar.sh" && grep -q 'imagen' "$ROOT/executors/caja.sh" && grep -q 'versiones.json' "$ROOT/templates/github/sdd-etapa.yml" \
  && ok "caja local y caja de GitHub recogen esas versiones y la imagen" || bad "caja-aplicar.sh / caja.sh / sdd-etapa.yml no recogen versiones"
exit $fail
