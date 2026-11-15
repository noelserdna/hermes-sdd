#!/usr/bin/env bash
# Ejecutor GITHUB: la etapa corre en una máquina de GitHub Actions que se crea para ella y se borra al acabar
# (templates/github/sdd-etapa.yml, en .github/workflows/ del proyecto). El agente no ve este ordenador: ni ~/.hermes,
# ni el notario, ni su clave; y no puede escribir en el repo (contents: read). Mismo contrato que executors/claude.sh.
#
#   executors/github.sh <repo> <nombre> <prompt> [modelo]
#
# 1. Sube a una rama temporal sdd-caja/<run> el HEAD del proyecto más un commit de contexto (lo ignorado que la etapa
#    necesita: .sdd/, pipeline-state.json, evidencias/ si caben; el prompt; la identidad de git).
# 2. Lanza el workflow en esa rama y espera (cancelándolo si esta etapa muere).
# 3. Descarga su artefacto y lo valida antes de tocar nada: los commits tienen que descender del HEAD que se envió;
#    los ficheros ignorados que vuelven, solo bajo .sdd/, evidencias/ y pipeline-state.json, sin enlaces ni rutas
#    raras, y nunca decisiones ni puertas. Entonces avanza la rama (fast-forward), aplica lo que quedó sin commit (el
#    arnés lo commitea a la vista, como en local) y copia lo ignorado. Las comprobaciones de etapa.sh tras el ejecutor
#    (registros humanos, tests congelados…) se aplican igual.
# 4. Borra la rama temporal y el artefacto.
#
# Configuración (.sdd/hermes/hermes-sdd.json → "github"): {"repo": "dueño/nombre"} (por defecto, el de `origin`).
# Última línea de stdout: JSON {outcome: done|failed|scheduled, reason, run, session_id, cost_usd, turns, minutes, resumen}
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO=$(cd "$1" && pwd); NOMBRE=$2; PROMPT=$3; MODELO=${4:-}
RUN="$(date +%Y%m%d-%H%M%S)-$(printf '%s' "$NOMBRE" | tr -c 'A-Za-z0-9-' '-')"
RAMA="sdd-caja/$RUN"
DIR="$REPO/.sdd/hermes"; mkdir -p "$DIR/runs"
OUT="$DIR/runs/$RUN.json"; ERR="$DIR/runs/$RUN.err"
TMP=$(mktemp -d); ID=""; GH=""; SUBIDA=false
INICIO=$(date +%s)
cd "$REPO"

salir() {  # salir <outcome> <reason> [extra-json]
  local x=${3:-}; [ -n "$x" ] || x='{}'
  jq -nc --arg o "$1" --arg r "$2" --arg run "$RUN" --argjson x "$x" '{outcome:$o, reason:$r, run:$run} + $x'
  exit 0
}
limpiar() {
  [ -n "$ID" ] && [ -n "$GH" ] && [ "$(gh run view "$ID" -R "$GH" --json status -q .status 2>/dev/null)" != completed ] &&
    gh run cancel "$ID" -R "$GH" >/dev/null 2>&1
  $SUBIDA && git push -q origin --delete "$RAMA" >/dev/null 2>&1
  git update-ref -d "refs/sdd-caja/$RUN" 2>/dev/null
  rm -rf "$TMP"
}
trap limpiar EXIT
trap 'limpiar; trap - EXIT; exit 143' TERM INT HUP

command -v gh >/dev/null || salir failed "no está gh (GitHub CLI): hace falta para la caja de GitHub"
[ -z "$(git status --porcelain --untracked-files=no)" ] || salir failed "el proyecto tiene cambios sin commit: la caja empieza desde un commit"
GH=$(jq -r '.github.repo // empty' "$DIR/hermes-sdd.json" 2>/dev/null)
[ -n "$GH" ] || GH=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
[ -n "$GH" ] || salir failed "el proyecto no tiene repo en GitHub (origin) ni github.repo en .sdd/hermes/hermes-sdd.json"
gh workflow view sdd-etapa.yml -R "$GH" >/dev/null 2>&1 ||
  salir failed "falta .github/workflows/sdd-etapa.yml en la rama por defecto de $GH (cópialo de templates/github/sdd-etapa.yml del arnés)"
ARNES=$(jq -r '.commit // empty' "${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}/instalacion.json" 2>/dev/null)
if [ -z "$ARNES" ] && git -C "$ROOT" rev-parse HEAD >/dev/null 2>&1 && [ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]; then
  ARNES=$(git -C "$ROOT" rev-parse HEAD)
fi
[ -n "$ARNES" ] || salir failed "no sé qué commit del arnés usar en la caja (instala desde un commit subido a GitHub)"

# ── 1. Rama temporal: HEAD + commit de contexto (sin tocar el árbol ni el índice del proyecto) ────────────────────────
HEAD0=$(git rev-parse HEAD)
mkdir -p "$DIR/caja"
printf '%s' "$PROMPT" > "$DIR/caja/prompt.txt"
jq -n --arg n "$(git config user.name || echo hermes-sdd)" --arg e "$(git config user.email || echo hermes-sdd@localhost)" '{nombre:$n, email:$e}' > "$DIR/caja/identidad.json"
export GIT_INDEX_FILE="$TMP/index"
git read-tree HEAD
CONTEXTO=(.sdd pipeline-state.json)
[ -d evidencias ] && [ "$(du -sk evidencias | cut -f1)" -lt 51200 ] && CONTEXTO+=(evidencias)   # < 50 MB
for f in "${CONTEXTO[@]}"; do [ -e "$f" ] && git add -f -- "$f"; done
git rm -r -q --cached --ignore-unmatch -- .sdd/entregas .sdd/hermes/lock .sdd/hermes/runs >/dev/null 2>&1
# GitHub no acepta ficheros de más de 100 MB: fuera del contexto los de más de 50
git ls-files -s | while read -r _ obj _ f; do [ "$(git cat-file -s "$obj")" -gt 52428800 ] && git rm -q --cached -- "$f"; done
ARBOL=$(git write-tree)
unset GIT_INDEX_FILE
C=$(git commit-tree "$ARBOL" -p "$HEAD0" -m "sdd-caja: contexto de $RUN (no se integra)")
git push -q origin "$C:refs/heads/$RAMA" 2> "$ERR" || salir failed "no se pudo subir la rama $RAMA a $GH: $(tail -c 300 "$ERR" | tr '\n' ' ')"
SUBIDA=true

# ── 2. Lanzar y esperar ───────────────────────────────────────────────────────────────────────────────────────────
gh workflow run sdd-etapa.yml -R "$GH" --ref "$RAMA" -f run="$RUN" -f nombre="$NOMBRE" -f arnes="$ARNES" \
  -f modelo="$MODELO" -f paso="${SDD_PASO:-}" -f tope_usd="${SDD_TOPE_USD:-}" -f tope_min="${SDD_TOPE_MIN:-60}" 2>> "$ERR" ||
  salir failed "GitHub no aceptó lanzar la etapa: $(tail -c 300 "$ERR" | tr '\n' ' ')"
for _ in $(seq 1 30); do
  ID=$(gh run list -R "$GH" --workflow sdd-etapa.yml --branch "$RAMA" --json databaseId -q '.[0].databaseId' 2>/dev/null)
  [ -n "$ID" ] && break; sleep 4
done
[ -n "$ID" ] || salir failed "la etapa no aparece en GitHub Actions ($GH, rama $RAMA)"
echo "$ID" > "$DIR/caja/run-id"
while :; do
  ST=$(gh run view "$ID" -R "$GH" --json status -q .status 2>/dev/null || echo desconocido)
  [ "$ST" = completed ] && break
  if [ "$(ps -o ppid= -p $$ | tr -d ' ')" = 1 ]; then echo "padre desaparecido: se cancela la caja" >> "$ERR"; exit 1; fi
  sleep 10 & wait $!
done
MIN=$(( ($(date +%s) - INICIO) / 60 ))
CONCL=$(gh run view "$ID" -R "$GH" --json conclusion -q .conclusion 2>/dev/null)
S="$TMP/salida"
gh run download "$ID" -R "$GH" -n "sdd-$RUN" -D "$S" 2>> "$ERR" ||
  salir failed "la caja terminó ($CONCL) sin dejar su trabajo: https://github.com/$GH/actions/runs/$ID" "{\"minutes\":$MIN}"
cp "$S/claude.json" "$OUT" 2>/dev/null; cat "$S/claude.err" >> "$ERR" 2>/dev/null

# ── 3. Validar y aplicar ──────────────────────────────────────────────────────────────────────────────────────────
[ "$(cat "$S/base" 2>/dev/null)" = "$HEAD0" ] || salir failed "la caja trabajó sobre otro commit que el enviado"
[ "$(git rev-parse HEAD)" = "$HEAD0" ] && [ -z "$(git status --porcelain --untracked-files=no)" ] ||
  salir failed "el proyecto cambió mientras trabajaba la caja: no se aplica nada"
if [ -s "$S/ignorados.tgz" ]; then
  MAL=$(tar tzvf "$S/ignorados.tgz" | awk '{print substr($1,1,1)}' | grep -v '^[-d]' | head -1)
  [ -z "$MAL" ] || salir failed "la caja devolvió enlaces o ficheros especiales: no se aplica nada"
  MAL=$(tar tzf "$S/ignorados.tgz" | grep -vE '^(pipeline-state\.json|\.sdd(/.*)?|evidencias(/.*)?)$' | head -1)
  [ -z "$MAL" ] || salir failed "la caja devolvió un fichero fuera de lo permitido ($MAL): no se aplica nada"
  MAL=$(tar tzf "$S/ignorados.tgz" | grep -E '(^|/)\.\.(/|$)|^\.sdd/hermes/(decisiones|puertas|lock|caja)(/|$)|^\.sdd/entregas(/|$)' | head -1)
  [ -z "$MAL" ] || salir failed "la caja devolvió decisiones, puertas o rutas no permitidas ($MAL): no se aplica nada"
fi
if [ -s "$S/commits.bundle" ]; then
  git bundle verify -q "$S/commits.bundle" >/dev/null 2>&1 || salir failed "el paquete de commits de la caja no es válido"
  git fetch -q "$S/commits.bundle" "HEAD:refs/sdd-caja/$RUN" 2>> "$ERR" || salir failed "no se pudieron traer los commits de la caja"
  NUEVO=$(git rev-parse "refs/sdd-caja/$RUN")
  git merge-base --is-ancestor "$HEAD0" "$NUEVO" || salir failed "los commits de la caja no descienden del commit enviado"
  git merge -q --ff-only "$NUEVO" 2>> "$ERR" || salir failed "no se pudo avanzar la rama con los commits de la caja"
fi
if [ -s "$S/pendiente.patch" ]; then
  git apply "$S/pendiente.patch" 2>> "$ERR" || salir failed "no se pudieron aplicar los cambios sin commit de la caja"
fi
[ -s "$S/ignorados.tgz" ] && tar xzf "$S/ignorados.tgz" -C "$REPO"

# ── 4. Resultado (como executors/claude.sh) ───────────────────────────────────────────────────────────────────────
gh api -X DELETE "repos/$GH/actions/runs/$ID/artifacts" >/dev/null 2>&1 || true
CUOTA='usage limit|rate limit|limit reached|weekly limit|daily limit|session limit'
if ! jq -e . "$OUT" >/dev/null 2>&1; then
  grep -qiE "$CUOTA" "$ERR" 2>/dev/null && salir scheduled "cuota de Claude agotada" "{\"minutes\":$MIN}"
  salir failed "la caja no devolvió el resultado de Claude ($CONCL, rc=$(cat "$S/rc" 2>/dev/null)): $(tail -c 300 "$ERR" | tr '\n' ' ') — https://github.com/$GH/actions/runs/$ID" "{\"minutes\":$MIN}"
fi
EXTRA=$(jq -c --argjson m "$MIN" --arg u "https://github.com/$GH/actions/runs/$ID" '{session_id, cost_usd: .total_cost_usd, turns: .num_turns, minutes: $m,
  resumen: ((.result // "") | .[0:800]), caja: $u}' "$OUT")
if jq -e '(.subtype // "") | test("budget")' "$OUT" >/dev/null 2>&1; then
  salir failed "la ejecución llegó a su tope de gasto (${SDD_TOPE_USD:-?} \$): para seguir, sube topes.etapa_usd o topes.proyecto_usd" "$(jq -c '. + {tope:"gasto"}' <<< "$EXTRA")"
fi
TEXTO=$(jq -r '.result // ""' "$OUT")
if [ "$(jq -r .is_error "$OUT")" = true ] || [ "$(cat "$S/rc" 2>/dev/null || echo 0)" != 0 ]; then
  echo "$TEXTO" | grep -qiE "$CUOTA" && salir scheduled "cuota de Claude agotada" "$EXTRA"
  [ "$(cat "$S/rc" 2>/dev/null)" = 124 ] && salir failed "la ejecución superó su tope de tiempo (${SDD_TOPE_MIN:-60} min)" "$(jq -c '. + {tope:"tiempo"}' <<< "$EXTRA")"
  salir failed "la etapa terminó con error: $(echo "$TEXTO" | tail -c 300 | tr '\n' ' ')" "$EXTRA"
fi
salir done "ok" "$EXTRA"
