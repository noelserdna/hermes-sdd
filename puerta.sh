#!/usr/bin/env bash
# Abre una PUERTA: deja la pregunta en disco para que el canal la publique y el orquestador del gateway cree su
# tarjeta bloqueada (sin assignee: ningún agente la toma). No decide ni avisa por sí mismo.
# No crea la tarjeta él mismo: lo lanza un worker del kanban, y Hermes no deja que los procesos de un worker
# modifiquen el tablero (frontera de seguridad que respetamos).
#
#   puerta.sh <repo> <tipo> [fase]        tipo: requisitos | ruta | plan | fase | entrega | mantenimiento
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
print(sum(1 for f, q in quitadas.items() if any(x and not trivial.match(x) and x not in puestas[f] for x in q)))'
}

# ── Texto de la puerta: lo escribe hsdd_textos.py en castellano llano (lo que pediste, lo que se añadió, qué decidir) ─
TEXTOS="$ROOT/plugin/hermes-sdd/hsdd_textos.py"
GATE_MD=$(mktemp); trap 'rm -f "$GATE_MD"' EXIT
EXTRA=(); EDIT=0; BLOQUEO=false; rc=0
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
    OPCIONES='[{"verbo":"acepto","etiqueta":"✅ Apruebo"},{"verbo":"cambios","etiqueta":"✏️ Falta o sobra algo","texto":true}]' ;;
  ruta)   # un botón por ruta configurada (SDD → Configuración → Rutas), la recomendada primero; cada opción guarda las
          # etapas que hará, para que el notario firme exactamente lo que se vio
    RUTAS=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" opciones-ruta "${BOARD:-$(basename "$REPO")}" .sdd/hermes/ruta.json) ||
      { echo "no se pudieron leer las rutas configuradas" >&2; exit 1; }
    echo "$RUTAS" > "$GATE_MD"; EXTRA+=(--opciones-ruta "$GATE_MD")
    OPCIONES=$(echo "$RUTAS" | jq -c '[.[] | {verbo, etiqueta, etapas, auto, criterio}] + [{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true}]') ;;
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
    if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then BLOQUEO=true
      OPCIONES='[{"verbo":"ver","etiqueta":"▶ Ver demo","paso":1},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true,"paso":2}]'; fi ;;
  entrega)
    node "$SDD" gate --md > "$GATE_MD" 2>/dev/null || rc=$?
    EXTRA+=(--gate-md "$GATE_MD" --rc "$rc" --fases-aceptadas "$(git tag -l 'fase-*-accepted' | tr '\n' ' ')")
    OPCIONES='[{"verbo":"acepto","etiqueta":"✅ Acepto la entrega"},{"verbo":"observaciones","etiqueta":"📝 Con observaciones","texto":true},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true}]'
    if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then BLOQUEO=true; OPCIONES='[{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true}]'; fi ;;
  mantenimiento)   # lo abre vigilar.sh con .sdd/hermes/mantenimiento/hallazgos.json
    EXTRA+=(--hallazgos .sdd/hermes/mantenimiento/hallazgos.json)
    OPCIONES='[{"verbo":"cambio","etiqueta":"🛠 Lanzar cambio"},{"verbo":"ignoro","etiqueta":"🔕 Ignorar","texto":true}]' ;;
  *) echo "tipo de puerta desconocido: $TIPO" >&2; exit 2 ;;
esac
T_JSON=$(python3 "$TEXTOS" puerta "$TIPO" "$REPO" --proyecto "${BOARD:-$(basename "$REPO")}" ${FASE:+--fase "$FASE"} ${EXTRA[@]+"${EXTRA[@]}"}) ||
  { echo "no se pudo escribir el texto de la puerta $TIPO" >&2; exit 1; }
TITULO=$(echo "$T_JSON" | jq -r .titulo); TEXTO=$(echo "$T_JSON" | jq -r .texto)

# Preguntas como datos, para que el canal pueda ofrecerlas como formulario (Q1: A/B/C…)
PREGUNTAS=$(python3 - .sdd/questions-*.md <<'PY' 2>/dev/null || echo '[]'
import json, re, sys
out, n = [], 0
for p in sorted(a for a in sys.argv[1:] if not a.endswith("*.md")):
    for b in re.findall(r"^## Q-[^\n]*\[OPEN\].*?(?=^## |\Z)", open(p).read(), flags=re.M | re.S):
        n += 1
        ops = re.findall(r"^\s+([A-Z])\)", b, re.M)
        rec = re.search(r"^\s+([A-Z])\).*\(recommended\)", b, re.M)
        out.append({"n": n, "id": b.split()[1], "opciones": ops, "recomendada": rec.group(1) if rec else (ops[0] if ops else "")})
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
  --argjson te "${EDIT:-0}" --argjson bl "$BLOQUEO" \
  '{id:$id, tipo:$t, fase:$f, tablero:$b, tarjeta:"", adopcion:$ad, sha:$s, creada:$c, repo:$r, titulo:$ti, texto:$tx,
    opciones:$o, demo:$v, preguntas:$q, hallazgos:$hz, tests_editados:$te, bloqueo:$bl, estado:"abierta"}' > ".sdd/hermes/puertas/$ID.json"
cp ".sdd/hermes/puertas/$ID.json" "$HOME_SDD/puertas/$ID.json"   # índice global para los canales
echo "$ID"
