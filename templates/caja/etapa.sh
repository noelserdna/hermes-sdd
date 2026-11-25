#!/usr/bin/env bash
# Dentro de la caja local: lo mismo que los pasos «Contexto», «Etapa» y «Recoger el trabajo» de la caja de GitHub
# (templates/github/sdd-etapa.yml). /proyecto es una COPIA del proyecto (HEAD + lo ignorado que la etapa necesita),
# /arnes el arnés en solo lectura y /salida lo único que el orquestador recoge. Variables: MODELO, TOPE_USD, TOPE_MIN.
set -uo pipefail
P=${CAJA_PROYECTO:-/proyecto}; A=${CAJA_ARNES:-/arnes}   # otras rutas solo en las pruebas (tests/caja-local.sh)
cd "$P"
# la copia es de otro usuario del ordenador: sin esto git no la reconoce («dubious ownership»)
git config --global --add safe.directory "$P"
S=${CAJA_SALIDA:-/salida}; BASE=$(git rev-parse HEAD); echo "$BASE" > "$S/base"
git config user.name "$(jq -r .nombre .sdd/hermes/caja/identidad.json)"
git config user.email "$(jq -r .email .sdd/hermes/caja/identidad.json)"
# con qué corre la caja (va a etapas.jsonl): el Claude Code y el Node de DENTRO, que no son los del orquestador
jq -nc --arg c "$(claude --version 2>/dev/null | head -1)" --arg n "$(node -v 2>/dev/null)" '{claude_code:$c, node:$n}' > "$S/versiones.json" 2>/dev/null || true
bash "$A"/metodo/scripts/install-git-hooks.sh -C . --quiet || true
if [ -f package.json ] && grep -q '"@playwright/test"' package.json; then
  (npm ci --no-audit --no-fund || npm install --no-audit --no-fund) >/dev/null 2>&1 || true
  npx playwright install chromium >/dev/null 2>&1 || true
fi
AJUSTES='{"enabledPlugins":{"sdd-pipeline@noelserdna":false},"permissions":{"deny":["Edit(.sdd/hermes/decisiones/**)","Edit(.sdd/hermes/puertas/**)","Edit(wiki/**)"]}}'
# stream-json: cada mensaje y cada herramienta queda en la transcripción (qué ficheros abre, cuántos turnos busca);
# su última línea, {"type":"result"…}, es el mismo resultado que daba --output-format json
ARGS=(-p "$(cat .sdd/hermes/caja/prompt.txt)" --output-format stream-json --verbose --plugin-dir "$A"/metodo --settings "$AJUSTES" --dangerously-skip-permissions)
[ -n "${MODELO:-}" ] && ARGS+=(--model "$MODELO")
[ -n "${TOPE_USD:-}" ] && ARGS+=(--max-budget-usd "$TOPE_USD")
rc=0
timeout $(( ${TOPE_MIN:-60} * 60 )) claude "${ARGS[@]}" > "$S/transcripcion.jsonl" 2> "$S/claude.err" || rc=$?
echo "$rc" > "$S/rc"
grep '"type":"result"' "$S/transcripcion.jsonl" | tail -1 > "$S/claude.json" || true
# Recoger: commits nuevos en un bundle, lo que quedó sin commit en un parche y lo ignorado permitido en un tar
[ "$(git rev-parse HEAD)" = "$BASE" ] || git bundle create "$S/commits.bundle" "$BASE..HEAD" 2>/dev/null
# lo nuevo sin commit también (git add -N: sin esto un fichero nuevo no sale en el diff; material-montana12 G-3: la
# copia del CLI volvió sin lib/match.mjs y el hook de commit falló)
git add -A -N 2>/dev/null || true
git diff HEAD --binary > "$S/pendiente.patch"
L=(); for f in pipeline-state.json .sdd evidencias; do [ -e "$f" ] && L+=("$f"); done
[ ${#L[@]} -eq 0 ] || tar czf "$S/ignorados.tgz" --exclude=.sdd/hermes/caja --exclude=.sdd/entregas \
  --exclude=.sdd/hermes/lock --exclude=.sdd/hermes/decisiones --exclude=.sdd/hermes/puertas --exclude=.sdd/wiki "${L[@]}"
exit 0
