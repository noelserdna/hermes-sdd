#!/usr/bin/env bash
# Abre una PUERTA: deja la pregunta en disco para que el canal la publique y el orquestador del gateway cree su
# tarjeta bloqueada (sin assignee: ningún agente la toma). No decide ni avisa por sí mismo.
# No crea la tarjeta él mismo: lo lanza un worker del kanban, y Hermes no deja que los procesos de un worker
# modifiquen el tablero (frontera de seguridad que respetamos).
#
#   puerta.sh <repo> <tipo> [fase]        tipo: requisitos | ruta | plan | fase | entrega | preguntas | mantenimiento
#
# Escribe <repo>/.sdd/hermes/puertas/<id>.json (lo lee el notario) y $HERMES_SDD_HOME/puertas/<id>.json (índice
# global que leen los canales). Imprime el id de la puerta.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SDD="$ROOT/metodo/scripts/sdd.mjs"
HOME_SDD="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}"
REPO=$(cd "$1" && pwd); TIPO=$2; FASE=${3:-}
[ -n "${HERMES_SDD_SIN_KANBAN:-}" ] && BOARD="" || BOARD=${HERMES_KANBAN_BOARD:-$(basename "$REPO" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')}
cd "$REPO"

tests_editados() {  # tests_editados <base> → nº de ficheros de test existentes con líneas que cambian lo que se comprueba
  git diff -U0 --diff-filter=MD "$1..HEAD" -- tests test 2>/dev/null | python3 -c '
import re, sys
ficheros, actual, quitadas, puestas = {}, None, {}, {}
for l in sys.stdin.read().splitlines():
    if l.startswith("diff --git"):
        actual = l.split(" b/")[-1]; quitadas[actual] = []; puestas[actual] = set()
    elif actual and l.startswith("-") and not l.startswith("---"):
        quitadas[actual].append(l[1:].strip())
    elif actual and l.startswith("+") and not l.startswith("+++"):
        puestas[actual].add(l[1:].strip())
trivial = re.compile(r"^(import\b|export \{|from\s|//|#|/\*|\*|\}?\)?;?$|\}\);?$)")
# Solo código de test: los documentos de la carpeta test/ (TEST-PLAN.md, matrices, escenarios) no son tests (sala, FASE-5:
# el plan de pruebas actualizó 8 .md y la puerta avisó de «8 tests cambiados»; Jev no la decidió por eso)
doc = re.compile(r"\.(md|txt|csv|json|ya?ml)$", re.I)
print(sum(1 for f, q in quitadas.items() if not doc.search(f) and any(x and not trivial.match(x) and x not in puestas[f] for x in q)))'
}

# Requisitos sin verificar que solo una persona puede comprobar (Verification: inspection o demo): la puerta los enseña y
# ofrece 🔍 Lo he revisado y acepto; el notario registra la inspección a nombre de quien lo pulsa.
REV_JSON=$(mktemp); trap 'rm -f "$REV_JSON"' EXIT; echo null > "$REV_JSON"
revisar() { { node "$SDD" gate "$@" --json 2>/dev/null || true; } | python3 "$ROOT/plugin/hermes-sdd/hsdd_textos.py" revisar "$REPO" > "$REV_JSON" 2>/dev/null ||
  echo null > "$REV_JSON"; }
hay_rev() { jq -e '(.revisar // []) | length > 0' "$REV_JSON" >/dev/null; }
solo_rev() { jq -e '.solo == true' "$REV_JSON" >/dev/null; }
REVISADO='{"verbo":"revisado","etiqueta":"🔍 Lo he revisado y acepto"}'
# Con imprescindibles sin cumplir: rechazar, o eximirlos con un motivo (🟡). Solo una persona: el notario lo registra como
# exención del método con una referencia de seguimiento (acceptance/PENDIENTES.md). Jev nunca la elige (lleva texto).
EXIMO='{"verbo":"eximo","etiqueta":"🟡 Aceptar sin lo que falta","texto":true}'

# ── Texto de la puerta: lo escribe hsdd_textos.py en castellano llano (lo que pediste, lo que se añadió, qué decidir) ─
TEXTOS="$ROOT/plugin/hermes-sdd/hsdd_textos.py"
GATE_MD=$(mktemp); trap 'rm -f "$GATE_MD" "$REV_JSON"' EXIT
EXTRA=(); EDIT=0; BLOQUEO=false; UNICA=false; rc=0
case "$TIPO" in
  requisitos)
    EXTRA+=(--version "$(sed -n 's/^> \*\*Version:\*\* *//p' requirements/REQUIREMENTS.md | head -1)")
    if [ -f .sdd/hermes/cambio-actual ]; then   # un cambio: primero lo que se pidió y lo que cambia
      INT=$(cat .sdd/hermes/cambio-actual)
      PREV=$(git describe --tags --abbrev=0 --match 'requirements-v*' 2>/dev/null || true)
      # Un cambio que solo toca criterios no añade ni quita cabeceras: grep sin coincidencias no debe tumbar la puerta
      ANADIDOS=$( [ -n "$PREV" ] || exit 0; git diff "$PREV" -- requirements/REQUIREMENTS.md | { grep -E '^\+### REQ-' || true; } | sed -E 's/^\+### (REQ-[^ :]+).*/\1/' | tr '\n' ' ')
      QUITADOS=$( [ -n "$PREV" ] || exit 0; git diff "$PREV" -- requirements/REQUIREMENTS.md | { grep -E '^-### REQ-' || true; } | sed -E 's/^-### //' | tr '\n' '|')
      EXTRA+=(--cambio "$INT" --anadidos "$ANADIDOS" --quitados "$QUITADOS")
    fi
    [ -f .sdd/hermes/adopcion ] && EXTRA+=(--adopcion 1)
    [ -f .sdd/hermes/requisitos-de-partida.md ] && [ ! -f .sdd/hermes/cambio-actual ] && EXTRA+=(--partida .sdd/hermes/requisitos-de-partida.md)
    OPCIONES='[{"verbo":"acepto","etiqueta":"✅ Apruebo"},{"verbo":"cambios","etiqueta":"✏️ Falta o sobra algo","texto":true}]' ;;
  ruta)   # un botón por ruta configurada (SDD → Configuración → Rutas), la recomendada primero; cada opción guarda las
          # etapas que hará, para que el notario firme exactamente lo que se vio
    RUTAS=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" opciones-ruta "${BOARD:-$(basename "$REPO")}" .sdd/hermes/ruta.json) ||
      { echo "no se pudieron leer las rutas configuradas" >&2; exit 1; }
    echo "$RUTAS" > "$GATE_MD"; EXTRA+=(--opciones-ruta "$GATE_MD")
    OPCIONES=$(echo "$RUTAS" | jq -c '[.[] | {verbo, etiqueta, etapas, auto, granularidad, criterio}] + [{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true}]') ;;
  plan)
    OPCIONES='[{"verbo":"conforme","etiqueta":"✅ Conforme"},{"verbo":"cambios","etiqueta":"✏️ Cambiar","texto":true}]' ;;
  fase)
    node "$SDD" gate --fase "$FASE" --md > "$GATE_MD" 2>/dev/null || rc=$?
    # Tests que YA existían y se modificaron desde la última aceptación (art. 12: se arregla el código, no el test).
    # Solo cuentan ficheros con líneas borradas o cambiadas: añadir tests nuevos a un fichero existente no debilita nada.
    # Tampoco cuentan los imports, las líneas en blanco, los comentarios ni las líneas que solo se movieron (coches,
    # FASE-1: ampliar un `import { a, b }` mandaba la puerta a una persona y la tuvo esperando 7 h)
    BASE=$(git describe --tags --abbrev=0 --match 'fase-*-accepted' 2>/dev/null || git describe --tags --abbrev=0 --match 'requirements-v*' 2>/dev/null || git rev-list --max-parents=0 HEAD)
    EDIT=$(tests_editados "$BASE")
    VIDEO=$(ls evidencias/FASE-"$FASE"/*.mp4 evidencias/FASE-"$FASE"/*.webm evidencias/FASE-"$FASE"/*.mov 2>/dev/null | head -1 || true)
    CAPTURAS=$( (ls evidencias/FASE-"$FASE"/*.png evidencias/FASE-"$FASE"/*.jpg 2>/dev/null || true) | wc -l | tr -d ' ')
    EXTRA+=(--gate-md "$GATE_MD" --rc "$rc" --tests-editados "$EDIT" --video "$([ -n "$VIDEO" ] && echo 1 || echo 0)" --capturas "$CAPTURAS")
    OPCIONES='[{"verbo":"ver","etiqueta":"▶ Ver demo","paso":1},{"verbo":"acepto","etiqueta":"✅ Aceptar","paso":2},{"verbo":"observaciones","etiqueta":"📝 Con observaciones","texto":true,"paso":2},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true,"paso":2}]'
    revisar --fase "$FASE"; EXTRA+=(--revisar "$REV_JSON")
    if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then
      if solo_rev; then   # solo faltan inspecciones: se confirman aquí mismo
        OPCIONES=$(jq -nc --argjson r "$REVISADO" '[{"verbo":"ver","etiqueta":"▶ Ver demo","paso":1}, ($r + {paso:2}), {"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true,"paso":2}]')
      else BLOQUEO=true
        OPCIONES=$(jq -nc --argjson x "$EXIMO" '[{"verbo":"ver","etiqueta":"▶ Ver demo","paso":1}, ($x + {paso:2}), {"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true,"paso":2}]'); fi
    elif hay_rev; then OPCIONES=$(echo "$OPCIONES" | jq -c --argjson r "$REVISADO" '.[0:1] + [$r + {paso:2}] + .[1:]'); fi ;;
  entrega)
    node "$SDD" gate --md > "$GATE_MD" 2>/dev/null || rc=$?
    EXTRA+=(--gate-md "$GATE_MD" --rc "$rc" --fases-aceptadas "$(git tag -l 'fase-*-accepted' | tr '\n' ' ')")
    OPCIONES='[{"verbo":"acepto","etiqueta":"✅ Acepto la entrega"},{"verbo":"observaciones","etiqueta":"📝 Con observaciones","texto":true},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true}]'
    # Plan de una sola FASE sin aceptar (y no «fina»): no hubo puerta de FASE, así que esta trae su demo (▶ Ver demo primero)
    if [ -f .sdd/hermes/granularidad-plan ] && [ "$(cat .sdd/hermes/granularidad-plan)" != fina ] && [ "$(ls plan/fases/FASE-*.md 2>/dev/null | wc -l | tr -d ' ')" = 1 ] \
       && ! git tag -l 'fase-*-accepted' | grep -q .; then
      UNICA=true
      VIDEO=$(ls evidencias/FASE-0/*.mp4 evidencias/FASE-0/*.webm evidencias/FASE-0/*.mov 2>/dev/null | head -1 || true)
      CAPTURAS=$( (ls evidencias/FASE-0/*.png evidencias/FASE-0/*.jpg 2>/dev/null || true) | wc -l | tr -d ' ')
      BASE=$(git describe --tags --abbrev=0 --match 'requirements-v*' 2>/dev/null || git rev-list --max-parents=0 HEAD)
      EDIT=$(tests_editados "$BASE")
      EXTRA+=(--unica 1 --video "$([ -n "$VIDEO" ] && echo 1 || echo 0)" --capturas "$CAPTURAS" --tests-editados "$EDIT")
      OPCIONES='[{"verbo":"ver","etiqueta":"▶ Ver demo","paso":1},{"verbo":"acepto","etiqueta":"✅ Acepto la entrega","paso":2},{"verbo":"observaciones","etiqueta":"📝 Con observaciones","texto":true,"paso":2},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true,"paso":2}]'
    fi
    revisar; EXTRA+=(--revisar "$REV_JSON")
    PASO=$([ "$UNICA" = true ] && echo '{paso:2}' || echo '{}')
    if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then
      if solo_rev; then   # solo faltan inspecciones: se confirman aquí mismo
        OPCIONES=$(echo "$OPCIONES" | jq -c --argjson r "$REVISADO" "[.[] | select(.verbo == \"ver\")] + [\$r + $PASO] + [.[] | select(.verbo == \"rechazo\")]")
      else BLOQUEO=true
        OPCIONES=$(echo "$OPCIONES" | jq -c --argjson x "$EXIMO" "[.[] | select(.verbo == \"ver\")] + [\$x + $PASO] + [.[] | select(.verbo == \"rechazo\")]"); fi
    elif hay_rev; then
      OPCIONES=$(echo "$OPCIONES" | jq -c --argjson r "$REVISADO" "[.[] | select(.verbo == \"ver\")] + [\$r + $PASO] + [.[] | select(.verbo != \"ver\")]"); fi ;;
  preguntas)       # lo abre etapa.sh implementar cuando la FASE se para en preguntas [OPEN]
    OPCIONES='[{"verbo":"respondo","etiqueta":"✅ Responder"}]' ;;
  mantenimiento)   # lo abre vigilar.sh con .sdd/hermes/mantenimiento/hallazgos.json
    EXTRA+=(--hallazgos .sdd/hermes/mantenimiento/hallazgos.json)
    OPCIONES='[{"verbo":"cambio","etiqueta":"🛠 Lanzar cambio"},{"verbo":"ignoro","etiqueta":"🔕 Ignorar","texto":true}]' ;;
  *) echo "tipo de puerta desconocido: $TIPO" >&2; exit 2 ;;
esac
T_JSON=$(python3 "$TEXTOS" puerta "$TIPO" "$REPO" --proyecto "${BOARD:-$(basename "$REPO")}" ${FASE:+--fase "$FASE"} ${EXTRA[@]+"${EXTRA[@]}"}) ||
  { echo "no se pudo escribir el texto de la puerta $TIPO" >&2; exit 1; }
TITULO=$(echo "$T_JSON" | jq -r .titulo); TEXTO=$(echo "$T_JSON" | jq -r .texto)
# Revisión mecánica del encargado (hsdd_revision.py, sin LLM): «🧭 Encargado: N avisos» arriba del texto. No bloquea;
# un aviso grave hace que Jev no pueda aprobar esta puerta solo (hsdd_nucleo.puede_jev lee .encargado.graves)
ENC='{"avisos":[],"graves":0}'
case "$TIPO" in requisitos|ruta|plan|fase|entrega)
  IA=""; jq -e --arg t "$TIPO" '(.revision_ia // []) | index($t)' "$HOME_SDD/sdd.json" >/dev/null 2>&1 && IA=--ia
  ENC=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_revision.py" revisar "$REPO" "$TIPO" ${FASE:+--fase "$FASE"} $IA 2>/dev/null) || ENC='{"avisos":[],"graves":0}'
  jq -e '.avisos' <<< "$ENC" >/dev/null 2>&1 || ENC='{"avisos":[],"graves":0}'
  LINEA=$(jq -r '.linea // ""' <<< "$ENC")
  [ -z "$LINEA" ] || TEXTO="$LINEA

$TEXTO" ;;
esac

# Preguntas como datos, para que el canal pueda ofrecerlas como formulario (Q1: A/B/C…)
PREGUNTAS=$(python3 - "$TEXTOS" .sdd/questions-*.md <<'PY' 2>/dev/null || echo '[]'
import importlib.util, json, re, sys
spec = importlib.util.spec_from_file_location("hsdd_textos", sys.argv[1]); X = importlib.util.module_from_spec(spec); spec.loader.exec_module(X)
out, n = [], 0
for p in sorted(a for a in sys.argv[2:] if not a.endswith("*.md")):
    for b in re.findall(r"^## Q-[^\n]*\[OPEN\].*?(?=^## |\Z)", open(p, encoding="utf-8").read(), flags=re.M | re.S):
        n += 1
        out.append({"n": n, "id": b.split()[1], **X.opciones_json(b)})
print(json.dumps(out))
PY
)

SHA=$(git rev-parse HEAD)
ID="g$(date +%s)$(openssl rand -hex 2)"

AHORA=$(date -u +%Y-%m-%dT%H:%M:%SZ)
mkdir -p .sdd/hermes/puertas "$HOME_SDD/puertas"
jq -n --arg id "$ID" --arg t "$TIPO" --arg f "$FASE" --arg b "$BOARD" --arg s "$SHA" --arg c "$AHORA" \
  --arg r "$REPO" --arg ti "$TITULO" --arg tx "$TEXTO" --argjson o "$OPCIONES" --arg v "${VIDEO:-}" --argjson q "$PREGUNTAS" \
  --argjson ad "$([ -f .sdd/hermes/adopcion ] && echo true || echo false)" \
  --argjson hz "$([ "$TIPO" = mantenimiento ] && cat .sdd/hermes/mantenimiento/hallazgos.json || echo null)" \
  --argjson te "${EDIT:-0}" --argjson bl "$BLOQUEO" --argjson un "${UNICA:-false}" --argjson rv "$(cat "$REV_JSON")" \
  --argjson en "$(jq -c '{avisos, graves}' <<< "$ENC")" \
  '{id:$id, tipo:$t, fase:$f, tablero:$b, tarjeta:"", adopcion:$ad, sha:$s, creada:$c, repo:$r, titulo:$ti, texto:$tx,
    opciones:$o, demo:$v, preguntas:$q, hallazgos:$hz, tests_editados:$te, bloqueo:$bl, unica:$un,
    revisar:(($rv // {}).revisar // []), encargado:$en, estado:"abierta"}' > ".sdd/hermes/puertas/$ID.json"
cp ".sdd/hermes/puertas/$ID.json" "$HOME_SDD/puertas/$ID.json"   # índice global para los canales
echo "$ID"
