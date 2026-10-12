#!/usr/bin/env bash
# ORQUESTA el proyecto en su tablero kanban, sin interpretar nada: crea tramos de tarjetas y los encadena.
#
#   lanzar.sh iniciar <repo>                          prepara el repo (sin LLM) y crea el primer tramo
#   lanzar.sh siguiente <repo> <puerta> <resultado>   lo llama el notario al cerrar una puerta
#   lanzar.sh cambio <repo> "<petición>"              un cambio o una funcionalidad nueva (también por /cambio)
#   lanzar.sh adoptar <repo>                          un repo existente sin método: línea base desde el código
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
  hermes kanban boards list --json | jq -e --arg b "$BOARD" 'any(.[]; .slug == $b)' >/dev/null ||
    hermes kanban boards create "$BOARD" --name "$(basename "$REPO")" --default-workdir "$REPO" >/dev/null
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
    cd "$REPO"; mkdir -p intent .sdd/hermes
    N=$(( $(ls intent/INT-*.md 2>/dev/null | wc -l) + 1 )); INT=$(printf 'INT-%03d' "$N")
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
          rm -f "$REPO/.sdd/hermes/cambio-actual"; tarjeta "Ruta" - 20m ruta
        fi ;;
      requisitos:cambios)             tarjeta "Requisitos (cambios)" - 40m requisitos ;;
      ruta:acepto|ruta:completo)      t=$(tarjeta "Plan" - 60m plan); tarjeta "Tareas" "$t" 60m tareas ;;
      ruta:rechazo)                   tarjeta "Ruta (otra vez)" - 20m ruta ;;
      plan:conforme)
        N=$(primera_sin_aceptar); N=${N:-0}
        t=$(tarjeta "Implementar FASE-$N" - 120m implementar "$N"); tarjeta "Aceptar FASE-$N" "$t" 60m aceptar "$N" ;;
      plan:cambios)                   t=$(tarjeta "Plan (cambios)" - 60m plan); tarjeta "Tareas" "$t" 60m tareas ;;
      fase:acepto|fase:observaciones)
        N=$(primera_sin_aceptar)
        if [ -n "$N" ]; then
          t=$(tarjeta "Implementar FASE-$N" - 120m implementar "$N"); tarjeta "Aceptar FASE-$N" "$t" 60m aceptar "$N"
        else tarjeta "Cierre: puerta global y entrega" - 120m cierre; fi ;;
      fase:rechazo)                   t=$(tarjeta "Implementar FASE-$FASE (cambios)" - 120m implementar "$FASE"); tarjeta "Aceptar FASE-$FASE" "$t" 60m aceptar "$FASE" ;;
      entrega:acepto|entrega:observaciones) echo "Proyecto entregado" ;;
      entrega:rechazo)                tarjeta "Cierre (otra vez)" - 120m cierre ;;
      *) echo "Sin tramo siguiente para $TIPO:$RESULTADO" ;;
    esac ;;

  reintentar)   # una etapa fallida se repite con una tarjeta NUEVA (nunca se desbloquea la vieja)
    ETAPA=$3; FASE=${4:-}
    tarjeta "Reintento: $ETAPA${FASE:+ FASE-$FASE}" - 120m "$ETAPA" $FASE ;;

  *) echo "uso: lanzar.sh iniciar <repo> | siguiente <repo> <puerta> <resultado> | reintentar <repo> <etapa> [fase]" >&2; exit 2 ;;
esac
