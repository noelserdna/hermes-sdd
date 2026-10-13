#!/usr/bin/env bash
# MANTENIMIENTO POR UMBRALES: revisa un proyecto ya entregado y, si algo cruza un umbral, abre una PUERTA de
# mantenimiento. No arregla ni lanza nada: propone, y una persona decide (lanzar un cambio o ignorar con motivo).
# Sin LLM. Lo llama el plugin una vez al día (atencion.json → "mantenimiento": "07:00") o /mantenimiento.
#
#   vigilar.sh <repo>            imprime el id de la puerta abierta, o «sin hallazgos nuevos»
#
# Comprobaciones (umbrales en .sdd/hermes/hermes-sdd.json → "mantenimiento"; valores por defecto entre paréntesis):
#   tests       los tests del Stack Profile fallan en HEAD                                   (siempre)
#   gate        la puerta de calidad global ya no se cumple (ni 0 ni 3)                      (siempre)
#   deriva      commits de código/tests desde la última entrega sin pasar por el método      (deriva: 1)
#   seguridad   vulnerabilidades altas o críticas en dependencias (npm audit)                (vulnerabilidades: 1)
#   versiones   dependencias con versión mayor nueva (npm outdated)                          (majors: 3)
# Lo ignorado no vuelve a preguntarse mientras no cambie (la clave de cada hallazgo resume qué falla, no el commit).
# HERMES_SDD_SIN_RED=1 salta seguridad y versiones (pruebas sin red).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SDD="$ROOT/metodo/scripts/sdd.mjs"
HOME_SDD="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}"
REPO=$(cd "$1" && pwd); cd "$REPO"
M=.sdd/hermes/mantenimiento; mkdir -p "$M"
CFG=.sdd/hermes/hermes-sdd.json
umbral() { jq -r --arg k "$1" --argjson d "$2" '.mantenimiento[$k] // $d' "$CFG" 2>/dev/null || echo "$2"; }

# Una puerta de mantenimiento abierta en este repo basta: no se apilan
if grep -lsq '"tipo": "mantenimiento"' .sdd/hermes/puertas/*.json 2>/dev/null; then
  for f in $(grep -ls '"tipo": "mantenimiento"' .sdd/hermes/puertas/*.json); do
    e=$(jq -r .estado "$HOME_SDD/puertas/$(basename "$f")" 2>/dev/null || echo firmada)
    case $e in abierta|decidida) echo "ya hay una puerta de mantenimiento abierta: $(basename "$f" .json)"; exit 0;; esac
  done
fi
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "el árbol tiene cambios sin commit; se revisa otro día"; exit 0; }

HEAD7=$(git rev-parse --short=7 HEAD)
H=$(mktemp); echo '[]' > "$H"
hallazgo() {  # hallazgo <clave> <título> <detalle> <propuesta>
  local t; t=$(mktemp)
  jq --arg c "$1" --arg ti "$2" --arg d "$3" --arg p "$4" '. + [{clave:$c, titulo:$ti, detalle:$d, propuesta:$p}]' "$H" > "$t" && mv "$t" "$H"
}
perfil() { sed -n "/## SDD Stack Profile/,/^## /s/^- $1: *//p" AGENTS.md 2>/dev/null | head -1; }

# 1. tests en HEAD
TEST=$(perfil test)
if [ -n "$TEST" ]; then
  [ -f package-lock.json ] && [ ! -d node_modules ] && npm ci --silent >/dev/null 2>&1 || true
  if ! out=$(bash -c "$TEST" 2>&1); then
    FALLAN=$(echo "$out" | grep -E 'FAIL|failed|Error' | head -4)
    hallazgo "tests:$(echo "$FALLAN" | shasum | cut -c1-10)" "Los tests fallan en $HEAD7" "$FALLAN" \
      "Los tests del proyecto fallan en el commit $HEAD7. Encuentra la causa y arréglala sin debilitar ningún test existente."
  fi
fi

# 2. puerta de calidad global (solo si el proyecto ya tuvo una entrega)
if git tag -l 'entrega-*' | grep -q .; then
  rc=0; node "$SDD" gate >/dev/null 2>&1 || rc=$?
  if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then
    MAL=$(node "$SDD" gate --md 2>/dev/null | grep -E 'MISSING|FAIL|UNVERIFIED|NOT' | cut -d'|' -f2,5 | head -6 || true)
    hallazgo "gate:$rc:$(echo "$MAL" | shasum | cut -c1-10)" "La puerta de calidad global ya no se cumple (código $rc)" "$MAL" \
    "La puerta de calidad global ha dejado de cumplirse. Vuelve a verificar los requisitos afectados."
  fi
fi

# 3. deriva: código o tests cambiados fuera del método desde la última entrega o FASE aceptada
BASE=$(git describe --tags --abbrev=0 --match 'entrega-*' 2>/dev/null || git describe --tags --abbrev=0 --match 'fase-*-accepted' 2>/dev/null || true)
if [ -n "$BASE" ]; then
  RUTAS=$( (perfil code_paths; perfil test_paths) | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep . || true)
  FUERA=""
  for c in $(git rev-list "$BASE..HEAD" -- ${RUTAS:-src tests} 2>/dev/null); do
    git log -1 --format=%B "$c" | grep -qE '^(Task|Gate-Id|Change|Refs): ' || FUERA="$FUERA $c"
  done
  N=$(echo $FUERA | wc -w | tr -d ' ')
  if [ "$N" -ge "$(umbral deriva 1)" ]; then
    ULT=$(echo $FUERA | awk '{print $1}')
    hallazgo "deriva:$ULT" "$N commit(s) de código fuera del método desde $BASE" \
      "$(for c in $FUERA; do git log -1 --format='%h %s' "$c"; done | head -5)" \
      "Hay commits que cambian código o tests sin tarea ni requisito ($(echo $FUERA | tr ' ' '\n' | cut -c1-7 | tr '\n' ' ')). Reconcilia: si añaden o cambian comportamiento, recógelo en los requisitos con sus criterios y tests; si no, justifícalo."
  fi
fi

# 4 y 5. dependencias (necesitan red)
if [ -z "${HERMES_SDD_SIN_RED:-}" ] && [ -f package-lock.json ]; then
  A=$(npm audit --json 2>/dev/null || true); [ -n "$A" ] || A='{}'
  NA=$(echo "$A" | jq '[.vulnerabilities // {} | to_entries[] | select(.value.severity == "high" or .value.severity == "critical")] | length' 2>/dev/null || echo 0)
  if [ "$NA" -ge "$(umbral vulnerabilidades 1)" ]; then
    LISTA=$(echo "$A" | jq -r '[.vulnerabilities | to_entries[] | select(.value.severity == "high" or .value.severity == "critical") | "\(.key) (\(.value.severity))"] | join(", ")')
    hallazgo "seguridad:$(echo "$LISTA" | shasum | cut -c1-10)" "$NA dependencia(s) con vulnerabilidades altas o críticas" "$LISTA" \
      "Actualiza estas dependencias vulnerables sin cambiar el comportamiento: $LISTA."
  fi
  O=$(npm outdated --json 2>/dev/null || true); [ -n "$O" ] || O='{}'
  MAJ=$(echo "$O" | jq -r 'to_entries[] | select((.value.latest|split(".")[0]) != ((.value.current // "0")|split(".")[0])) | "\(.key) \(.value.current)→\(.value.latest)"' 2>/dev/null || true)
  NM=$(echo "$MAJ" | grep -c . || true)
  if [ "$NM" -ge "$(umbral majors 3)" ]; then
    hallazgo "versiones:$(echo "$MAJ" | shasum | cut -c1-10)" "$NM dependencia(s) con una versión mayor nueva" "$MAJ" \
      "Valora subir de versión mayor: $(echo "$MAJ" | tr '\n' ';'). Hazlo solo si los tests siguen en verde sin tocarlos."
  fi
fi

# Quitar lo ya ignorado (misma clave) y abrir la puerta si queda algo
SIL="$M/silenciados.json"; [ -f "$SIL" ] || echo '{}' > "$SIL"
jq --slurpfile s "$SIL" '[.[] | select(.clave as $c | ($s[0] | has($c)) | not)]' "$H" > "$M/hallazgos.json"; rm -f "$H"
if [ "$(jq length "$M/hallazgos.json")" = 0 ]; then echo "sin hallazgos nuevos"; exit 0; fi
bash "$ROOT/puerta.sh" "$REPO" mantenimiento
