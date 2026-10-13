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

# ── Texto de la puerta: primero lo que conviene mirar, después el resumen ─────────────────────────────────────────
case "$TIPO" in
  requisitos)
    TITULO="Requisitos"
    TEXTO=$(awk '/^### REQ-/{sub(/^### /,""); t=$0} /\*\*Priority:\*\*/{p=$0; sub(/.*\*\*Priority:\*\* */,"",p); if(t){print "• " t " (" p ")"; t=""}}' \
      requirements/REQUIREMENTS.md | head -20)
    NEC=$(grep -c '^### N-' requirements/CUSTOMER-NEEDS.md 2>/dev/null || echo 0)
    TEXTO="$NEC necesidades → requisitos:
$TEXTO

¿Son estos los requisitos que quieres? Al aprobarlos quedan como línea base (tag)."
    if [ -f .sdd/hermes/cambio-actual ]; then   # un cambio: primero lo que se pidió y lo que cambia
      INT=$(cat .sdd/hermes/cambio-actual)
      PREV=$(git describe --tags --abbrev=0 --match 'requirements-v*' 2>/dev/null || true)
      DIFF=$( [ -n "$PREV" ] && git diff "$PREV" -- requirements/REQUIREMENTS.md | grep -E '^[+-]### REQ-' | sed -E 's/^\+### /➕ /; s/^-### /➖ /' | head -15)
      TITULO="Requisitos (cambio $INT)"
      TEXTO="Pediste: «$(sed -n '/^> /{s/^> //;p;}' "intent/$INT.md" | head -5 | tr '\n' ' ')»
Versión $(sed -n 's/^> \*\*Version:\*\* *//p' requirements/REQUIREMENTS.md | head -1) de los requisitos. Cambia:
${DIFF:-(los mismos requisitos con criterios modificados; mira el Change Report en changes/)}

¿Apruebas esta versión? Después se replanifica solo lo nuevo; las FASEs aceptadas no se tocan."
    fi
    [ -f .sdd/hermes/adopcion ] && TITULO="Requisitos deducidos del código" && TEXTO="$TEXTO

Proyecto adoptado: estos requisitos salen de leer el código. Corrige lo que no sea lo que quieres."
    OPCIONES='[{"verbo":"acepto","etiqueta":"✅ Apruebo"},{"verbo":"cambios","etiqueta":"✏️ Falta o sobra algo","texto":true}]' ;;
  ruta)
    TITULO="Ruta del proyecto"
    TEXTO=$(jq -r '(.stages | to_entries | map(select(.value.run)) | map(.key) | "Se ejecuta: " + join(" → ")),
      (.stages | to_entries | map(select(.value.run|not)) | if length>0 then "Se salta: " + (map(.key) | join(", ")) else empty end),
      ([.factors | to_entries[] | select(.value.value=="doubt") | .key] | if length>0 then "⚠️ Dudas (cuentan como sí): " + join(", ") else "Sin dudas" end)' \
      .sdd/hermes/ruta.json)
    # Etapas que la ruta pide y este arnés aún no ejecuta: la persona debe saberlo antes de aceptar
    SIN_SOPORTE=$(jq -r '[.stages | to_entries[] | select(.value.run) | .key
      | select(IN("requirements-engineer","plan-architect","task-generator","task-implementer","acceptance") | not)] | join(", ")' .sdd/hermes/ruta.json)
    [ -n "$SIN_SOPORTE" ] && TEXTO="$TEXTO
⛔ Este arnés aún no ejecuta: $SIN_SOPORTE. Si aceptas, esas etapas quedarán pendientes; rechaza con un motivo si no encaja."
    OPCIONES='[{"verbo":"acepto","etiqueta":"✅ Aprobar ruta"},{"verbo":"completo","etiqueta":"🔁 Pipeline completo"},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true}]' ;;
  plan)
    TITULO="Plan por FASEs"
    TEXTO=$(for f in plan/fases/FASE-*.md; do
      n=$(basename "$f" .md); t=$(grep -c '^- \[ \] TASK-' "task/TASK-$(echo "$n" | cut -d- -f1-2).md" 2>/dev/null || echo "?")
      echo "• $n ($t tareas)"; done)
    TEXTO="$TEXTO

Nada se implementa sin un plan aceptado. ¿Conforme con este orden de entrega?"
    OPCIONES='[{"verbo":"conforme","etiqueta":"✅ Conforme"},{"verbo":"cambios","etiqueta":"✏️ Cambiar","texto":true}]' ;;
  fase)
    TITULO="Aceptar FASE-$FASE"
    rc=0; GATE_MD=$(node "$SDD" gate --fase "$FASE" --md 2>/dev/null) || rc=$?
    ALERTAS=""
    case $rc in 0) ;; 3) ALERTAS="⚠️ Cumple con exenciones";; *) ALERTAS="⛔ La puerta de calidad no se cumple (código $rc): solo se puede rechazar";; esac
    # Tests que YA existían y se modificaron desde la última aceptación (art. 12: se arregla el código, no el test)
    BASE=$(git describe --tags --abbrev=0 --match 'fase-*-accepted' 2>/dev/null || git describe --tags --abbrev=0 --match 'requirements-v*' 2>/dev/null || git rev-list --max-parents=0 HEAD)
    # Solo cuentan ficheros con líneas borradas o cambiadas: añadir tests nuevos a un fichero existente no debilita nada
    EDIT=$(git diff --numstat --diff-filter=MD "$BASE..HEAD" -- tests test 2>/dev/null | awk '$2 > 0' | wc -l | tr -d ' ')
    VIDEO=$(ls evidencias/FASE-"$FASE"/*.mp4 evidencias/FASE-"$FASE"/*.webm evidencias/FASE-"$FASE"/*.mov 2>/dev/null | head -1 || true)
    TEXTO="${ALERTAS:-✅ Sin alertas}
$(echo "$GATE_MD" | grep -E '^\|' | head -12)
Tests existentes con líneas borradas o cambiadas: $EDIT
${VIDEO:+🎬 Hay vídeo de la demo}

Revisa la demo antes de decidir."
    OPCIONES='[{"verbo":"ver","etiqueta":"▶ Ver demo","paso":1},{"verbo":"acepto","etiqueta":"✅ Aceptar","paso":2},{"verbo":"observaciones","etiqueta":"📝 Con observaciones","texto":true,"paso":2},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true,"paso":2}]'
    [ "$rc" = 0 ] || [ "$rc" = 3 ] || OPCIONES='[{"verbo":"ver","etiqueta":"▶ Ver demo","paso":1},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true,"paso":2}]' ;;
  entrega)
    TITULO="Entrega final"
    rc=0; GATE_MD=$(node "$SDD" gate --md 2>/dev/null) || rc=$?
    case $rc in 0) ALERTAS="✅ Todos los Must verificados";; 3) ALERTAS="⚠️ Cumple con exenciones";;
      *) ALERTAS="⛔ La puerta de calidad global no se cumple (código $rc): solo se puede rechazar";; esac
    TEXTO="$ALERTAS
$(echo "$GATE_MD" | grep -E '^\|' | grep -v '^|---' | cut -d'|' -f2,3,5,6 | head -20)
FASEs aceptadas: $(git tag -l 'fase-*-accepted' | tr '\n' ' ')

¿Aceptas la entrega del proyecto?"
    OPCIONES='[{"verbo":"acepto","etiqueta":"✅ Acepto la entrega"},{"verbo":"observaciones","etiqueta":"📝 Con observaciones","texto":true},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true}]'
    [ "$rc" = 0 ] || [ "$rc" = 3 ] || OPCIONES='[{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true}]' ;;
  mantenimiento)   # lo abre vigilar.sh con .sdd/hermes/mantenimiento/hallazgos.json
    TITULO="Mantenimiento"
    TEXTO="La revisión periódica encontró:
$(jq -r '.[] | "• \(.titulo)" + (if .detalle != "" then "\n" + (.detalle | split("\n") | map("   " + .) | join("\n")) else "" end)' .sdd/hermes/mantenimiento/hallazgos.json)

¿Lanzo un cambio para resolverlo? Pasará por tus puertas como cualquier cambio (requisitos, plan, FASE).
Si lo ignoras, explica por qué: no se volverá a preguntar mientras no cambie."
    OPCIONES='[{"verbo":"cambio","etiqueta":"🛠 Lanzar cambio"},{"verbo":"ignoro","etiqueta":"🔕 Ignorar","texto":true}]' ;;
  *) echo "tipo de puerta desconocido: $TIPO" >&2; exit 2 ;;
esac

# ── Preguntas abiertas (clase C): la persona las ve en la puerta; conformar = aceptar la opción recomendada ──────
PREG=$(awk '/^## Q-.*\[OPEN\]/{q=1; next} q && /^Question:/{sub(/^Question: */,""); print "❓ " $0} q && /^  [A-Z]\)/{print "   " $0} /^Blocks:/{q=0}' .sdd/questions-*.md 2>/dev/null | head -30 || true)
if [ -n "$PREG" ]; then
  TEXTO="$TEXTO

Preguntas abiertas (marca tu opción con los botones Q1·A, Q1·B…; la recomendada viene marcada):
$PREG"
fi

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
  '{id:$id, tipo:$t, fase:$f, tablero:$b, tarjeta:"", adopcion:$ad, sha:$s, creada:$c, repo:$r, titulo:$ti, texto:$tx,
    opciones:$o, demo:$v, preguntas:$q, hallazgos:$hz, estado:"abierta"}' > ".sdd/hermes/puertas/$ID.json"
cp ".sdd/hermes/puertas/$ID.json" "$HOME_SDD/puertas/$ID.json"   # índice global para los canales
echo "$ID"
