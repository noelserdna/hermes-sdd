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
  local v=${VERSIONES:-}; jq -e 'type == "object"' <<< "$v" >/dev/null 2>&1 || v='{}'   # con qué se hizo (va a etapas.jsonl)
  jq -nc --arg o "$1" --arg r "$2" --arg run "$RUN" --argjson x "$x" --argjson v "$v" '{outcome:$o, reason:$r, run:$run} + $x + (if $v == {} then {} else {versiones:$v} end)'
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
for f in "${CONTEXTO[@]}"; do [ -e "$f" ] && git add -f -- "$f"; done
# Las evidencias, sin lo repetido: la carpeta .playwright (copia cruda de vídeos y capturas) y el webm que ya tiene su
# mp4 narrado. Enteras pasaban de 50 MB (material-montana3: 188 MB), no subían, y cada paso de aceptar volvía a pasar
# toda la suite e2e con vídeo para rehacerlas (5 min por paso, de 3 a 8 pasos por FASE)
if [ -d evidencias ]; then
  find evidencias -type f ! -path '*/.playwright/*' | while IFS= read -r f; do
    case "$f" in *.webm) [ -f "${f%.webm}.mp4" ] && continue ;; esac
    printf '%s\n' "$f"
  done > "$TMP/evidencias"
  if [ -s "$TMP/evidencias" ] && [ "$(tr '\n' '\0' < "$TMP/evidencias" | xargs -0 du -ck 2>/dev/null | tail -1 | cut -f1)" -lt 51200 ]; then   # < 50 MB
    tr '\n' '\0' < "$TMP/evidencias" | xargs -0 git add -f --
  fi
fi
git rm -r -q --cached --ignore-unmatch -- .sdd/entregas .sdd/hermes/lock .sdd/hermes/runs >/dev/null 2>&1
# GitHub no acepta ficheros de más de 100 MB: fuera del contexto los de más de 50
git ls-files -s | while read -r _ obj _ f; do [ "$(git cat-file -s "$obj")" -gt 52428800 ] && git rm -q --cached -- "$f"; done
ARBOL=$(git write-tree)
unset GIT_INDEX_FILE
C=$(git commit-tree "$ARBOL" -p "$HEAD0" -m "sdd-caja: contexto de $RUN (no se integra)")
git push -q origin "$C:refs/heads/$RAMA" 2> "$ERR" || salir failed "no se pudo subir la rama $RAMA a $GH: $(tail -c 300 "$ERR" | tr '\n' ' ')"
SUBIDA=true

# ── 2. Lanzar y esperar ───────────────────────────────────────────────────────────────────────────────────────────
# Lanza el workflow y devuelve en ID el run nuevo (distinto de los que ya había en la rama)
lanzar() {
  local antes; antes=$(gh run list -R "$GH" --workflow sdd-etapa.yml --branch "$RAMA" --json databaseId -q '[.[].databaseId]|join(" ")' 2>/dev/null)
  gh workflow run sdd-etapa.yml -R "$GH" --ref "$RAMA" -f run="$RUN" -f nombre="$NOMBRE" -f arnes="$ARNES" \
    -f modelo="$MODELO" -f paso="${SDD_PASO:-}" -f tope_usd="${SDD_TOPE_USD:-}" -f tope_min="${SDD_TOPE_MIN:-60}" 2>> "$ERR" ||
    salir failed "GitHub no aceptó lanzar la etapa: $(tail -c 300 "$ERR" | tr '\n' ' ')"
  ID=""
  for _ in $(seq 1 30); do
    ID=$(gh run list -R "$GH" --workflow sdd-etapa.yml --branch "$RAMA" --json databaseId -q '.[0].databaseId' 2>/dev/null)
    [ -n "$ID" ] && ! grep -qw -- "$ID" <<< "$antes" && break; ID=""; sleep "${HERMES_SDD_PAUSA_ID:-4}"
  done
  [ -n "$ID" ] || salir failed "la etapa no aparece en GitHub Actions ($GH, rama $RAMA)"
  echo "$ID" > "$DIR/caja/run-id"
}
lanzar
# Tope de cola: GitHub puede dejar un run «queued» sin máquina mucho rato (material-montana2: 37 y 73 min; el tope
# de la tarjeta contaba esa espera y la etapa se cortó tras 16 min de trabajo). Pasado el tope se cancela y se
# vuelve a lanzar (hasta HERMES_SDD_RELANZAR veces); el tiempo de la etapa cuenta desde que tiene máquina.
COLA_MAX=$(( ${HERMES_SDD_COLA_MIN:-10} * 60 )); RELANZAR=${HERMES_SDD_RELANZAR:-2}; EN_COLA=$(date +%s)
while :; do
  ST=$(gh run view "$ID" -R "$GH" --json status -q .status 2>/dev/null || echo desconocido)
  [ "$ST" = completed ] && break
  if [ "$(ps -o ppid= -p $$ | tr -d ' ')" = 1 ]; then echo "padre desaparecido: se cancela la caja" >> "$ERR"; exit 1; fi
  case "$ST" in
    queued|waiting|pending|requested)
      if [ $(( $(date +%s) - EN_COLA )) -ge "$COLA_MAX" ]; then
        gh run cancel "$ID" -R "$GH" >/dev/null 2>&1 || echo "no se pudo cancelar el run $ID en cola" >> "$ERR"
        [ "$RELANZAR" -gt 0 ] || salir failed "GitHub no dio máquina a la caja en ${HERMES_SDD_COLA_MIN:-10} min (varias veces): reintenta más tarde" '{"cola":true}'
        echo "run $ID ${HERMES_SDD_COLA_MIN:-10} min en cola sin máquina: se relanza" >> "$ERR"
        RELANZAR=$((RELANZAR - 1)); lanzar; EN_COLA=$(date +%s); INICIO=$EN_COLA
      fi ;;
    *) EN_COLA=$(date +%s) ;;
  esac
  sleep "${HERMES_SDD_PAUSA:-10}" & wait $!
done
MIN=$(( ($(date +%s) - INICIO) / 60 ))
CONCL=$(gh run view "$ID" -R "$GH" --json conclusion -q .conclusion 2>/dev/null)
S="$TMP/salida"
VERSIONES=$(jq -nc --arg m "$MODELO" '{modelo: (if $m == "" then null else $m end)}' 2>/dev/null || echo '{}')   # la caja añade lo suyo (caja_resultado)
# La descarga puede fallar un rato sin culpa de nadie (taller3: «503 Egress is over the account limit» y, minutos
# después, bajó bien): se reintenta con esperas crecientes antes de dar la etapa por fallida
BAJADO=false
for espera in 0 ${HERMES_SDD_REINTENTOS_DESCARGA:-15 30 60 120 240}; do
  [ "$espera" = 0 ] || { echo "descarga fallida; se reintenta en ${espera} s" >> "$ERR"; sleep "$espera" & wait $!; }
  rm -rf "$S"; gh run download "$ID" -R "$GH" -n "sdd-$RUN" -D "$S" 2>> "$ERR" && { BAJADO=true; break; }
done
$BAJADO || salir failed "la caja terminó ($CONCL) sin dejar su trabajo: https://github.com/$GH/actions/runs/$ID" "{\"minutes\":$MIN}"
cp "$S/claude.json" "$OUT" 2>/dev/null; cat "$S/claude.err" >> "$ERR" 2>/dev/null

# ── 3. Validar y aplicar (lib/caja-aplicar.sh: las mismas reglas que la caja local) ──────────────────────────────────
. "$ROOT/lib/caja-aplicar.sh"
caja_aplicar

# ── 4. Resultado (como executors/claude.sh) ───────────────────────────────────────────────────────────────────────
# El artefacto se borra ya (en un repo público lo podría descargar cualquiera durante su día de vida)
for a in $(gh api "repos/$GH/actions/runs/$ID/artifacts" -q '.artifacts[].id' 2>/dev/null); do
  gh api -X DELETE "repos/$GH/actions/artifacts/$a" >/dev/null 2>&1 || echo "no se pudo borrar el artefacto $a" >> "$ERR"
done
CAJA_ENLACE="https://github.com/$GH/actions/runs/$ID"; CAJA_ESTADO=$CONCL
CAJA_TOKEN_AYUDA="vuelve a ponerlo con «claude setup-token» y «gh secret set CLAUDE_CODE_OAUTH_TOKEN -R ${GH}»"
caja_resultado
