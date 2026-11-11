#!/usr/bin/env bash
# ORQUESTA el proyecto en su tablero kanban, sin interpretar nada: crea tramos de tarjetas y los encadena.
#
#   lanzar.sh iniciar <repo>                          prepara el repo (sin LLM) y crea el primer tramo
#   lanzar.sh siguiente <repo> <puerta> <resultado>   lo llama el notario al cerrar una puerta
#   lanzar.sh cambio <repo> "<petición>"              un cambio o una funcionalidad nueva (también por /cambio)
#   lanzar.sh adoptar <repo>                          un repo existente sin método: línea base desde el código
#   lanzar.sh rehacer <repo> <N>                      vuelve a lanzar la FASE N: huecos (si quedan [PLAN GAP]) → implementar → aceptar
#
# Cada tarjeta de etapa la toma el perfil sdd-estacion y ejecuta `etapa.sh`. Las puertas las abre la propia etapa
# (puerta.sh) y las cierra el notario; después, este script crea el tramo siguiente:
#   inicio            → requisitos
#   requisitos ok     → ruta                      requisitos cambios → requisitos (con lo pedido)
#   ruta ok           → plan → tareas             ruta rechazo       → ruta
#   plan conforme     → implementar 0 → aceptar 0 plan cambios       → plan → tareas
#   fase N aceptada   → implementar N+1 → aceptar N+1 (si hay más FASEs)
#   fase N rechazada  → implementar N → aceptar N (con lo pedido)
#   última FASE ok    → cierre (puerta global; cierra huecos si los hay) → PUERTA entrega
#   entrega rechazada → cierre (con lo pedido)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
CMD=$1; REPO=$(cd "$2" && pwd)
BOARD=$(basename "$REPO" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
K=(hermes kanban --board "$BOARD")

primera_sin_aceptar() {  # primera FASE del plan sin tag fase-N-accepted (vacío si todas lo tienen)
  local n
  for n in $(ls "$REPO"/plan/fases/FASE-*.md 2>/dev/null | sed -E 's/.*FASE-([0-9]+).*/\1/' | sort -n -u); do
    git -C "$REPO" rev-parse -q --verify "refs/tags/fase-$n-accepted" >/dev/null || { echo "$n"; return; }
  done
}
preparar() {  # lo común a iniciar y adoptar: sin LLM
  cd "$REPO"
  [ -z "$(git status --porcelain)" ] || { echo "ERROR: $REPO tiene cambios sin commit" >&2; exit 1; }
  mkdir -p .sdd/hermes
  for l in pipeline-state.json .sdd/ evidencias/; do grep -qxF "$l" .gitignore 2>/dev/null || echo "$l" >> .gitignore; done
  [ -f pipeline-state.json ] || cp "$ROOT/metodo/templates/pipeline-state.template.json" pipeline-state.json
  [ -f .sdd/hermes/hermes-sdd.json ] || cp "$ROOT/templates/hermes-sdd.json" .sdd/hermes/hermes-sdd.json
  bash "$ROOT/metodo/scripts/install-git-hooks.sh" -C "$REPO" --quiet
  [ -f AGENTS.md ] || { cp "$ROOT/templates/AGENTS.md" AGENTS.md; echo "AVISO: AGENTS.md creado desde la plantilla; revisa el Stack Profile" >&2; }
  git add -A && { git diff --cached --quiet || git commit -qm "chore(sdd): set up hermes-sdd"; }
  asegurar_tablero
}
asegurar_tablero() {
  hermes kanban boards list --json | jq -e --arg b "$BOARD" 'any(.[]; .slug == $b)' >/dev/null ||
    hermes kanban boards create "$BOARD" --name "$(basename "$REPO")" --default-workdir "$REPO" >/dev/null
}

con_huecos() {  # ¿quedan tareas [PLAN GAP] sin hacer en la FASE N? (sus preguntas se contestaron en la puerta del plan)
  grep -qE '^- \[ \] .*\[PLAN GAP\]' "$REPO/task/TASK-FASE-$1.md" 2>/dev/null
}
unica() {  # ¿plan de una sola FASE, aún sin aceptar (y no «fina»)? Entonces su aceptación va en la puerta de entrega
  [ -f "$REPO/.sdd/hermes/granularidad-plan" ] && [ "$(cat "$REPO/.sdd/hermes/granularidad-plan")" != fina ] &&
    [ "$(ls "$REPO"/plan/fases/FASE-*.md 2>/dev/null | wc -l | tr -d ' ')" = 1 ] &&
    ! git -C "$REPO" tag -l 'fase-*-accepted' | grep -q .
}
fase_n() {  # fase_n <N> [sufijo]: (huecos →) implementar → aceptar la FASE N; imprime el id de la primera tarjeta
  local h="-" t primera=""
  if con_huecos "$1"; then h=$(tarjeta "Completar huecos del plan FASE-$1" - 60m huecos "$1"); primera=$h; fi
  t=$(tarjeta "Implementar FASE-$1${2:-}" "$h" 120m implementar "$1"); primera=${primera:-$t}
  if unica; then   # una sola FASE: sus veredictos y su demo los hace el cierre, y se aceptan con la entrega
    cierre "$t" "Cierre: demo, puerta global y entrega" >/dev/null
  else
    tarjeta "Aceptar FASE-$1" "$t" 60m aceptar "$1" >/dev/null
  fi
  echo "$primera"
}

cambio_corto() {  # ¿el cambio aprobado se puede hacer sin replanificar? Imprime las FASEs a rehacer (vacío si no).
  # Sí cuando no añade ni quita requisitos y cada requisito cambiado ya está en una FASE sin aceptar: el plan sigue
  # valiendo y basta con rehacer esas FASEs. Compara REQUIREMENTS.md con la versión aprobada anterior.
  local prev
  prev=$(git -C "$REPO" tag -l 'requirements-v*' --sort=-v:refname | sed -n 2p)
  [ -n "$prev" ] || return 0
  python3 - "$REPO" "$prev" <<'PY'
import re, subprocess, sys
from pathlib import Path
repo, prev = Path(sys.argv[1]), sys.argv[2]
def bloques(t):
    return {m.group(1): m.group(0) for m in re.finditer(r"^### (REQ-[A-Z]+-\d+).*?(?=^### |^## |\Z)", t, re.M | re.S)}
antes = bloques(subprocess.run(["git", "-C", str(repo), "show", f"{prev}:requirements/REQUIREMENTS.md"], capture_output=True, text=True).stdout)
ahora = bloques((repo / "requirements/REQUIREMENTS.md").read_text())
if not antes or set(antes) != set(ahora):
    sys.exit(0)
cambiados = [r for r in ahora if antes[r] != ahora[r]]
fases = {}
for f in sorted((repo / "plan/fases").glob("FASE-*.md")):
    n = re.match(r"FASE-0*(\d+)", f.name).group(1)
    cab = f.read_text().split("\n## ", 1)[0]
    linea = next((l for l in cab.splitlines() if re.search(r"\b(Requisitos|Requirements)\b[*\s]*:", l, re.I)), "")
    for r in re.findall(r"REQ-[A-Z]+-\d+", linea):
        fases.setdefault(r, set()).add(n)
aceptada = lambda n: subprocess.run(["git", "-C", str(repo), "rev-parse", "-q", "--verify", f"refs/tags/fase-{n}-accepted"], capture_output=True).returncode == 0
rehacer = set()
for r in cambiados:
    if not fases.get(r) or any(aceptada(n) for n in fases[r]):
        sys.exit(0)
    rehacer |= fases[r]
print(" ".join(sorted(rehacer, key=int)))
PY
}

# Etapas opcionales en el orden del método: clave del estado | etapa de etapa.sh | título de la tarjeta
OPCIONALES="specifications-engineer|especificar|Especificaciones
spec-auditor|auditar|Auditoría de especificaciones
test-planner|pruebas|Plan de pruebas
security-auditor|seguridad|Revisión de seguridad
tech-designer|tecnico|Diseño técnico
ux-designer|ux|Diseño visual y de uso"
toca() {  # toca <clave>: ¿la ruta confirmada la ejecuta y aún no está hecha?
  jq -e --arg k "$1" '(.route.stages[$k].run == true) and (.stages[$k].status != "done")' "$REPO/pipeline-state.json" >/dev/null 2>&1
}
tras_ruta() {  # las etapas opcionales que pide la ruta → Plan → Tareas, encadenadas; imprime la primera
  local padre=- primera="" clave etapa titulo t
  while IFS='|' read -r clave etapa titulo; do
    toca "$clave" || continue
    t=$(tarjeta "$titulo" "$padre" 90m "$etapa"); padre=$t; primera=${primera:-$t}
  done <<< "$OPCIONALES"
  t=$(tarjeta "Plan" "$padre" 60m plan); primera=${primera:-$t}
  tarjeta "Tareas" "$t" 60m tareas >/dev/null
  echo "$primera"
}
cierre() {  # cierre [padre] [título]: (huecos entre especificación y código, si la ruta los pide →) cierre
  local p=${1:--}
  toca gap-detector && p=$(tarjeta "Huecos entre especificación y código" "$p" 60m brechas)
  tarjeta "${2:-Cierre: puerta global y entrega}" "$p" 120m cierre
}

tarjeta() {  # tarjeta <título> <padre|-> <runtime> <etapa> [fase] — imprime el id
  local args=("$1" --assignee sdd-estacion --workspace "dir:$REPO" --max-runtime "$3" --max-retries 1
              --body "Ejecuta: bash $ROOT/etapa.sh $REPO $4${5:+ $5}" --json)
  [ "$2" = - ] || args+=(--parent "$2")
  "${K[@]}" create "${args[@]}" | jq -r .id
}

case "$CMD" in
  iniciar)
    preparar
    T=$(tarjeta "Requisitos" - 40m requisitos)
    echo "Proyecto $BOARD en marcha: $T (requisitos)" ;;

  adoptar)
    preparar
    touch .sdd/hermes/adopcion
    T=$(tarjeta "Adoptar: requisitos desde el código" - 60m adoptar)
    echo "Adopción de $BOARD en marcha: $T" ;;

  cambio)
    PETICION=$3
    asegurar_tablero
    cd "$REPO"; mkdir -p intent .sdd/hermes
    N=$(( $(find intent -name 'INT-*.md' | wc -l) + 1 )); INT=$(printf 'INT-%03d' "$N")
    { echo "# $INT"; echo; echo "Petición literal ($(date +%Y-%m-%d)):"; echo; printf '%s\n' "$PETICION" | sed 's/^/> /'; } > "intent/$INT.md"
    git add "intent/$INT.md" && git commit -qm "docs(intent): $INT" && echo "$INT" > .sdd/hermes/cambio-actual
    T=$(tarjeta "Cambio $INT" - 60m cambio)
    echo "Cambio $INT en marcha en $BOARD: $T" ;;

  siguiente)
    GATE=$3; RESULTADO=$4
    P="$REPO/.sdd/hermes/puertas/$GATE.json"
    TIPO=$(jq -r .tipo "$P"); FASE=$(jq -r '.fase // empty' "$P")
    case "$TIPO:$RESULTADO" in
      requisitos:aprobado)
        if [ "$(jq -r '.adopcion // false' "$P")" = true ]; then
          rm -f "$REPO/.sdd/hermes/adopcion"; echo "Línea base aprobada: los cambios entran con /cambio"
        else
          rm -f "$REPO/.sdd/hermes/cambio-actual"
          RF=$(cambio_corto)
          N=$(primera_sin_aceptar)
          if [ -n "$RF" ] && [ -n "$N" ] && [ "${RF%% *}" -ge "$N" ]; then
            # Cambio sin replanificar: el plan sigue valiendo; la FASE en curso se rehace con los requisitos nuevos
            # (las FASEs posteriores ya los leerán al implementarse)
            mkdir -p "$REPO/.sdd/hermes/feedback"
            { echo "Los requisitos cambiaron (aprobados en $(git -C "$REPO" tag -l 'requirements-v*' --sort=-v:refname | head -1)): ajusta el código y los tests de la FASE-$N a los criterios actuales (sus números pueden haber cambiado)."
              (cd "$REPO" && node "$ROOT/metodo/scripts/sdd.mjs" accept --fase "$N" --json 2>/dev/null) | jq -r '
                (.scope.requirements // []) as $s
                | [.requirements[] | select(.verdict != "VERIFIED" and (($s | length) == 0 or (.id as $i | $s | index($i))))
                   | .id as $id | .criteria[]? | select(.state != "pass")
                   | "- \($id) AC\(.n // .index): \(.state)"
                     + (if ((.literal_gaps // []) | length) > 0 then " — el test no lleva la letra literal: " + ([.literal_gaps[].literal] | unique | join(", ")) else "" end)
                     + (if .visual == "missing" then " — falta su captura" else "" end)]
                | if length > 0 then "Criterios de la FASE que no pasan la aceptación (corrígelos todos):", .[] else empty end' || true
            } > "$REPO/.sdd/hermes/feedback/implementar-$N.txt" 2>/dev/null || true
            echo "Cambio sin replanificar (requisitos de las FASEs $RF): se rehace la FASE-$N"
            fase_n "$N" " (requisitos nuevos)"
          else
            tarjeta "Ruta" - 20m ruta
          fi
        fi ;;
      requisitos:cambios)             tarjeta "Requisitos (cambios)" - 40m requisitos ;;
      ruta:acepto|ruta:completo|ruta:ruta-*) tras_ruta ;;
      ruta:rechazo)                   tarjeta "Ruta (otra vez)" - 20m ruta ;;
      plan:conforme)
        N=$(primera_sin_aceptar); fase_n "${N:-0}" ;;
      plan:cambios)                   t=$(tarjeta "Plan (cambios)" - 60m plan); tarjeta "Tareas" "$t" 60m tareas ;;
      fase:acepto|fase:observaciones)
        N=$(primera_sin_aceptar)
        if [ -n "$N" ]; then fase_n "$N"
        else cierre; fi ;;
      fase:rechazo)                   fase_n "$FASE" " (cambios)" ;;
      entrega:acepto|entrega:observaciones) echo "Proyecto entregado" ;;
      entrega:rechazo)                tarjeta "Cierre (otra vez)" - 120m cierre ;;
      mantenimiento:cambio)           bash "$ROOT/lanzar.sh" cambio "$REPO" "$(cat "$REPO/.sdd/hermes/mantenimiento/peticion-$GATE.txt")" ;;
      mantenimiento:ignoro)           echo "Hallazgos ignorados; no se vuelve a preguntar mientras no cambien" ;;
      *) echo "Sin tramo siguiente para $TIPO:$RESULTADO" ;;
    esac ;;

  rehacer)      # la FASE N otra vez, con tarjetas NUEVAS: huecos (si quedan [PLAN GAP]) → implementar → aceptar
    N=$3; [ -f "$REPO/task/TASK-FASE-$N.md" ] || { echo "no existe task/TASK-FASE-$N.md" >&2; exit 2; }
    T=$(fase_n "$N")
    echo "FASE-$N de $BOARD otra vez: $T$(con_huecos "$N" && echo ' (primero completa los huecos del plan)')" ;;

  limpiar)      # archiva las tarjetas de etapa ya resueltas: bloqueadas (o en espera de un padre bloqueado) cuya misma
                # etapa (y FASE) se repitió después en otra tarjeta que terminó (o que está en marcha: etapa.sh al acabar bien)
    "${K[@]}" list --json 2>/dev/null | jq -r '
      [.[] | select(.assignee == "sdd-estacion") | . + {etapa: ((.body // "") | capture("etapa\\.sh (?<e>.+)$").e // "")}
           | select(.etapa != "")] as $ts
      | $ts[] | select(.status == "blocked" or .status == "todo") as $b
      | ($ts | map(select(.etapa == $b.etapa and .created_at > $b.created_at and (.status == "done" or .status == "running")))
             | sort_by(.created_at) | last) as $n
      | select($n != null) | "\($b.id) \($n.id) \($n.title)"' | while read -r viejo nuevo titulo; do
        "${K[@]}" comment "$viejo" "Obsoleta: esta etapa se repitió y se resolvió en $nuevo ($titulo). Archivada por el arnés; sigue consultable." >/dev/null 2>&1 || true
        "${K[@]}" archive "$viejo" >/dev/null 2>&1 && echo "archivada $viejo (resuelta en $nuevo)"
      done ;;

  reintentar)   # una etapa fallida se repite con una tarjeta NUEVA (nunca se desbloquea la vieja)
    ETAPA=$3; FASE=${4:-}
    tarjeta "Reintento: $ETAPA${FASE:+ FASE-$FASE}" - 120m "$ETAPA" $FASE ;;

  *) echo "uso: lanzar.sh iniciar <repo> | siguiente <repo> <puerta> <resultado> | rehacer <repo> <N> | reintentar <repo> <etapa> [fase] | limpiar <repo>" >&2; exit 2 ;;
esac
