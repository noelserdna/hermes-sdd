#!/usr/bin/env bash
# Abre una PUERTA: deja la pregunta en disco para que el canal la publique y el orquestador del gateway cree su
# tarjeta bloqueada (sin assignee: ningún agente la toma). No decide ni avisa por sí mismo.
# No crea la tarjeta él mismo: lo lanza un worker del kanban, y Hermes no deja que los procesos de un worker
# modifiquen el tablero (frontera de seguridad que respetamos).
#
#   puerta.sh <repo> <tipo> [fase]        tipo: requisitos | ruta | plan | fase
#
# Escribe <repo>/.sdd/hermes/puertas/<id>.json (lo lee el notario) y $HERMES_SDD_HOME/puertas/<id>.json (índice
# global que leen los canales). Imprime el id de la puerta.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SDD="$ROOT/metodo/scripts/sdd.mjs"
HOME_SDD="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}"
REPO=$(cd "$1" && pwd); TIPO=$2; FASE=${3:-}
BOARD=${HERMES_KANBAN_BOARD:-$(basename "$REPO" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')}
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
    EDIT=$(git log --format= --name-only "$(git describe --tags --abbrev=0 --match 'fase-*' 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD" -- 'tests/*' 'test/*' 2>/dev/null | sort -u | wc -l | tr -d ' ')
    VIDEO=$(ls evidencias/FASE-"$FASE"/*.mp4 2>/dev/null | head -1 || true)
    TEXTO="${ALERTAS:-✅ Sin alertas}
$(echo "$GATE_MD" | grep -E '^\|' | head -12)
Ficheros de test tocados en esta FASE: $EDIT
${VIDEO:+🎬 Hay vídeo de la demo}

Revisa la demo antes de decidir."
    OPCIONES='[{"verbo":"ver","etiqueta":"▶ Ver demo","paso":1},{"verbo":"acepto","etiqueta":"✅ Aceptar","paso":2},{"verbo":"observaciones","etiqueta":"📝 Con observaciones","texto":true,"paso":2},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true,"paso":2}]'
    [ "$rc" = 0 ] || [ "$rc" = 3 ] || OPCIONES='[{"verbo":"ver","etiqueta":"▶ Ver demo","paso":1},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true,"paso":2}]' ;;
  *) echo "tipo de puerta desconocido: $TIPO" >&2; exit 2 ;;
esac

SHA=$(git rev-parse HEAD)
ID="g$(date +%s)$(openssl rand -hex 2)"

AHORA=$(date -u +%Y-%m-%dT%H:%M:%SZ)
mkdir -p .sdd/hermes/puertas "$HOME_SDD/puertas"
jq -n --arg id "$ID" --arg t "$TIPO" --arg f "$FASE" --arg b "$BOARD" --arg s "$SHA" --arg c "$AHORA" \
  --arg r "$REPO" --arg ti "$TITULO" --arg tx "$TEXTO" --argjson o "$OPCIONES" --arg v "${VIDEO:-}" \
  '{id:$id, tipo:$t, fase:$f, tablero:$b, tarjeta:"", sha:$s, creada:$c, repo:$r, titulo:$ti, texto:$tx,
    opciones:$o, demo:$v, estado:"abierta"}' > ".sdd/hermes/puertas/$ID.json"
cp ".sdd/hermes/puertas/$ID.json" "$HOME_SDD/puertas/$ID.json"   # índice global para los canales
echo "$ID"
