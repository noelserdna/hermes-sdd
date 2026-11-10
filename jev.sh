#!/usr/bin/env bash
# Modo de Jev (TypeSafe) en las puertas. Lo decide una persona en esta máquina (o con /jev en Telegram).
#
#   jev.sh                         modos actuales
#   jev.sh <modo>                  modo por defecto para todos los proyectos
#   jev.sh <proyecto> <modo>       modo de un proyecto (su tablero del kanban)
#   jev.sh umbral <0..1>           seguridad mínima de Jev para decidir él (por defecto 0.9)
#   jev.sh piloto <tipo>[,<tipo>]  puertas que decide en modo piloto (por defecto ruta,plan)
#   jev.sh probar <puerta>         pregunta a Jev por una puerta abierta y enseña su respuesta, sin decidir nada
#   jev.sh rejuzgar <puerta>       el gateway vuelve a preguntar a Jev por una puerta abierta (y decide si el modo lo deja)
#
# Modos: humano (Jev no interviene) · consejo (recomienda; decides tú) · piloto (decide las puertas de "piloto") ·
#        auto (decide cualquier puerta, FASEs y entrega incluidas). En todos, Jev solo da por buena una puerta: pedir
#        cambios o rechazar necesita un motivo escrito y eso queda siempre para una persona. Ver docs/jev.md.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export HERMES_SDD_HOME="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}"
NUCLEO="$ROOT/plugin/hermes-sdd/hsdd_nucleo.py"
CFG="$HERMES_SDD_HOME/jev.json"
ajustar() {  # ajustar <filtro jq>: sobre la configuración completa (con los valores por defecto si aún no existe)
  local t; t=$(mktemp); python3 "$NUCLEO" modo | jq "$1" > "$t" && mkdir -p "$HERMES_SDD_HOME" && mv "$t" "$CFG"
  python3 "$NUCLEO" modo; }

case "${1:-}" in
  "") python3 "$NUCLEO" modo ;;
  umbral)
    [[ "${2:-}" =~ ^(0(\.[0-9]+)?|1(\.0+)?)$ ]] || { echo "umbral entre 0 y 1, p. ej. 0.9" >&2; exit 2; }
    ajustar ".umbral = $2" ;;
  piloto)
    [ -n "${2:-}" ] || { echo "uso: jev.sh piloto ruta,plan" >&2; exit 2; }
    for t in ${2//,/ }; do case $t in requisitos|ruta|plan|fase|entrega|mantenimiento) ;; *) echo "tipo desconocido: $t" >&2; exit 2;; esac; done
    ajustar ".piloto = (\"$2\" | split(\",\"))" ;;
  rejuzgar) python3 "$NUCLEO" rejuzgar "${2:?uso: jev.sh rejuzgar <puerta>}" ;;
  probar)
    P="$HERMES_SDD_HOME/puertas/${2:?uso: jev.sh probar <puerta>}.json"
    [ -f "$P" ] || { echo "No conozco la puerta $2" >&2; exit 2; }
    D=$(mktemp -d); trap 'rm -rf "$D"' EXIT
    python3 - "$NUCLEO" "$P" "$D" <<'PY'
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("hsdd_nucleo", sys.argv[1]); N = importlib.util.module_from_spec(spec); spec.loader.exec_module(N)
p = json.load(open(sys.argv[2]))
json.dump({"questions": N.pregunta_jev(p)}, open(f"{sys.argv[3]}/q.json", "w"))
open(f"{sys.argv[3]}/i.jsonl", "w").write(json.dumps({"id": p["id"], "state": N.estado_jev(p)}) + "\n")
ok, motivo = N.puede_jev(p)
print(f"Puerta {p['id']} ({p.get('tipo')}, proyecto {p.get('tablero') or 'local'}): modo {N.modo_jev(p.get('tablero', ''))}; "
      f"{'Jev podría decidirla' if ok else 'Jev no la decidiría: ' + motivo}")
PY
    node "$ROOT/metodo/scripts/sdd-jev.mjs" judge --questions "$D/q.json" --items "$D/i.jsonl" |
      jq -r '(.items[0].answers.decision // {}) as $a
             | if $a.choice then "Jev elige: \($a.choice) (p \($a.p[$a.choice]), confianza \($a.confidence))\nProbabilidades: \($a.p | tostring)"
               else "Sin respuesta: \(.errors)" end' ;;
  *)
    if [ $# -ge 2 ]; then python3 "$NUCLEO" modo "$2" "$1"; else python3 "$NUCLEO" modo "$1"; fi ;;
esac
