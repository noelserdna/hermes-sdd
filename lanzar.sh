#!/usr/bin/env bash
# ORQUESTA el proyecto en su tablero kanban, sin interpretar nada: crea tramos de tarjetas y los encadena.
#
#   lanzar.sh iniciar <repo>                          prepara el repo (sin LLM) y crea el primer tramo
#   lanzar.sh siguiente <repo> <puerta> <resultado>   lo llama el notario al cerrar una puerta
#
# Cada tarjeta de etapa la toma el perfil sdd-estacion y ejecuta `etapa.sh`. Las puertas las abre la propia etapa
# (puerta.sh) y las cierra el notario; después, este script crea el tramo siguiente:
#   inicio            → requisitos
#   requisitos ok     → ruta                      requisitos cambios → requisitos (con lo pedido)
#   ruta ok           → plan → tareas             ruta rechazo       → ruta
#   plan conforme     → implementar 0 → aceptar 0 plan cambios       → plan → tareas
#   fase N aceptada   → implementar N+1 → aceptar N+1 (si hay más FASEs)
#   fase N rechazada  → implementar N → aceptar N (con lo pedido)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
CMD=$1; REPO=$(cd "$2" && pwd)
BOARD=$(basename "$REPO" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
K=(hermes kanban --board "$BOARD")

tarjeta() {  # tarjeta <título> <padre|-> <runtime> <etapa> [fase] — imprime el id
  local args=("$1" --assignee sdd-estacion --workspace "dir:$REPO" --max-runtime "$3" --max-retries 1
              --body "Ejecuta: bash $ROOT/etapa.sh $REPO $4${5:+ $5}" --json)
  [ "$2" = - ] || args+=(--parent "$2")
  "${K[@]}" create "${args[@]}" | jq -r .id
}

case "$CMD" in
  iniciar)
    cd "$REPO"
    [ -z "$(git status --porcelain)" ] || { echo "ERROR: $REPO tiene cambios sin commit" >&2; exit 1; }
    mkdir -p .sdd/hermes
    # Política de ficheros: el estado y los ficheros del arnés no se versionan; las evidencias tampoco
    for l in pipeline-state.json .sdd/ evidencias/; do grep -qxF "$l" .gitignore 2>/dev/null || echo "$l" >> .gitignore; done
    [ -f pipeline-state.json ] || cp "$ROOT/metodo/templates/pipeline-state.template.json" pipeline-state.json
    [ -f .sdd/hermes/hermes-sdd.json ] || cp "$ROOT/templates/hermes-sdd.json" .sdd/hermes/hermes-sdd.json
    bash "$ROOT/metodo/scripts/install-git-hooks.sh" -C "$REPO" --quiet
    [ -f AGENTS.md ] || { cp "$ROOT/templates/AGENTS.md" AGENTS.md; echo "AVISO: AGENTS.md creado desde la plantilla; revisa el Stack Profile" >&2; }
    git add -A && { git diff --cached --quiet || git commit -qm "chore(sdd): set up hermes-sdd"; }
    hermes kanban boards list --json | jq -e --arg b "$BOARD" 'any(.[]; .slug == $b)' >/dev/null ||
      hermes kanban boards create "$BOARD" --name "$(basename "$REPO")" --default-workdir "$REPO" >/dev/null
    T=$(tarjeta "Requisitos" - 40m requisitos)
    echo "Proyecto $BOARD en marcha: $T (requisitos)" ;;

  siguiente)
    GATE=$3; RESULTADO=$4
    P="$REPO/.sdd/hermes/puertas/$GATE.json"
    TIPO=$(jq -r .tipo "$P"); FASE=$(jq -r '.fase // empty' "$P")
    case "$TIPO:$RESULTADO" in
      requisitos:aprobado)            tarjeta "Ruta" - 20m ruta ;;
      requisitos:cambios)             tarjeta "Requisitos (cambios)" - 40m requisitos ;;
      ruta:acepto|ruta:completo)      t=$(tarjeta "Plan" - 60m plan); tarjeta "Tareas" "$t" 60m tareas ;;
      ruta:rechazo)                   tarjeta "Ruta (otra vez)" - 20m ruta ;;
      plan:conforme)                  t=$(tarjeta "Implementar FASE-0" - 120m implementar 0); tarjeta "Aceptar FASE-0" "$t" 60m aceptar 0 ;;
      plan:cambios)                   t=$(tarjeta "Plan (cambios)" - 60m plan); tarjeta "Tareas" "$t" 60m tareas ;;
      fase:acepto|fase:observaciones)
        N=$((FASE + 1))
        if ls "$REPO"/plan/fases/FASE-"$N"-*.md >/dev/null 2>&1; then
          t=$(tarjeta "Implementar FASE-$N" - 120m implementar "$N"); tarjeta "Aceptar FASE-$N" "$t" 60m aceptar "$N"
        else echo "Todas las FASEs aceptadas"; fi ;;
      fase:rechazo)                   t=$(tarjeta "Implementar FASE-$FASE (cambios)" - 120m implementar "$FASE"); tarjeta "Aceptar FASE-$FASE" "$t" 60m aceptar "$FASE" ;;
      *) echo "Sin tramo siguiente para $TIPO:$RESULTADO" ;;
    esac ;;

  reintentar)   # una etapa fallida se repite con una tarjeta NUEVA (nunca se desbloquea la vieja)
    ETAPA=$3; FASE=${4:-}
    tarjeta "Reintento: $ETAPA${FASE:+ FASE-$FASE}" - 120m "$ETAPA" $FASE ;;

  *) echo "uso: lanzar.sh iniciar <repo> | siguiente <repo> <puerta> <resultado> | reintentar <repo> <etapa> [fase]" >&2; exit 2 ;;
esac
