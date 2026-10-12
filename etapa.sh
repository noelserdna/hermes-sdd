#!/usr/bin/env bash
# PROPONE: ejecuta una etapa del método con el ejecutor y, si la etapa termina en una decisión humana, abre la puerta.
# La lanza la estación de Hermes desde una tarjeta del kanban; también se puede lanzar a mano.
#
#   etapa.sh <repo> <etapa> [fase]
#     requisitos     si ya hay requisitos, abre la puerta; si no, el ejecutor los escribe desde intent/
#     ruta           propone qué etapas necesita el proyecto (factores por el ejecutor si no hay Jev) → puerta
#     plan           plan por FASEs
#     tareas         tareas de todas las FASEs → puerta de plan (conformidad con el orden de entrega)
#     implementar N  implementa la FASE N y verifica (tareas hechas, commits válidos)
#     aceptar N      veredictos y demo de la FASE N → puerta de aceptación
#     cierre         puerta de calidad GLOBAL; si quedan Must sin verificar, el ejecutor cierra los huecos y se
#                    repite la aceptación global → puerta de entrega
#
# Si existe .sdd/hermes/feedback/<etapa>[-N].txt (lo deja el notario tras un "cambios"/"rechazo"), se pasa al
# ejecutor como lo que la persona pidió cambiar.
# Última línea de stdout: JSON {outcome: done|failed|scheduled|busy, reason, resumen, puerta, run, cost_usd, …}.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SDD="$ROOT/metodo/scripts/sdd.mjs"; STATE="$ROOT/metodo/scripts/sdd-state.sh"
REPO=$(cd "$1" && pwd); ETAPA=$2; FASE=${3:-}
cd "$REPO"
modelo() { jq -r --arg e "$1" '.modelos[$e] // .modelos.defecto // empty' .sdd/hermes/hermes-sdd.json 2>/dev/null; }
fin() {  # fin <json-del-ejecutor-o-propio> [resumen] [puerta]
  echo "$1" | jq -c --arg r "${2:-}" --arg p "${3:-}" '. + {resumen:$r} + (if $p != "" then {puerta:$p} else {} end)'
  exit 0
}
falla() { fin "$(jq -nc --arg r "$1" '{outcome:"failed", reason:$r}')"; }

FB=".sdd/hermes/feedback/${ETAPA}${FASE:+-$FASE}.txt"
PEDIDO=""; [ -s "$FB" ] && PEDIDO=" La persona revisó la propuesta anterior y pidió estos cambios, que son la prioridad de esta ejecución: «$(cat "$FB")»."
ARNES="Modo arnés (hermes-sdd): sin persona en la sesión; sigue references/modo-arnes.md del plugin.$PEDIDO"

claude_etapa() {  # claude_etapa <clave-de-estado> <prompt>
  local clave=$1 res st
  res=$(bash "$ROOT/executors/claude.sh" "$REPO" "$ETAPA${FASE:+-$FASE}" "$2" "$(modelo "$ETAPA")" | tail -1)
  [ "$(echo "$res" | jq -r .outcome)" = done ] || fin "$res" "$(echo "$res" | jq -r .reason)"
  # Post-condición: la etapa no puede quedar a medias en el estado del método
  st=$(bash "$STATE" get "$clave" 2>/dev/null || echo "?")
  if [ "$st" = running ]; then
    bash "$STATE" set "$clave" stale --reason "el ejecutor terminó sin cerrar la etapa" >/dev/null 2>&1
    fin "$(echo "$res" | jq -c '.outcome="failed" | .reason="la etapa quedó en running: marcada stale"')"
  fi
  [ -s "$FB" ] && mv "$FB" "$FB.aplicado"
  RES=$res
}
puerta() { bash "$ROOT/puerta.sh" "$REPO" "$@"; }

case "$ETAPA" in
  requisitos)
    if [ ! -s requirements/REQUIREMENTS.md ] || [ -s "$FB" ]; then
      claude_etapa requirements-engineer "/sdd-requirements-engineer — $ARNES Escribe las necesidades y los requisitos a partir de la petición literal de intent/ (y de lo que ya haya en requirements/)."
    else RES='{"outcome":"done","reason":"requisitos ya escritos"}'; fi
    sed -i '' -E 's/^> \*\*Status:\*\* *Approved.*/> **Status:** Review/' requirements/REQUIREMENTS.md 2>/dev/null || true
    git add requirements/ && { git diff --cached --quiet || git commit -qm "docs(requirements): requirements ready for review"; }
    P=$(puerta requisitos) || falla "no se pudo abrir la puerta de requisitos"
    fin "$RES" "Requisitos listos para revisar" "$P" ;;

  ruta)
    rc=0; node "$SDD" route --json > .sdd/hermes/ruta.json 2>/dev/null || rc=$?
    if [ "$rc" = 3 ]; then   # sin Jev: el ejecutor estima los siete factores; el código decide la ruta
      bash "$ROOT/executors/claude.sh" "$REPO" ruta-factores "Read requirements/CUSTOMER-NEEDS.md and requirements/REQUIREMENTS.md. Estimate the seven route factors (external_customer, sensitive_data, multi_actor, integrations, ui_flows, long_lived, complex_state) as probabilities 0-1, honestly, 0.5 when the text does not say. Write ONLY .sdd/route-answers.json as {\"factors\": {...}}. Do not run anything else." "$(modelo ruta)" >/dev/null
      node "$SDD" route --json --answers .sdd/route-answers.json > .sdd/hermes/ruta.json || falla "sdd route falló"
    fi
    P=$(puerta ruta) || falla "no se pudo abrir la puerta de ruta"
    fin '{"outcome":"done","reason":"ok"}' "Ruta propuesta" "$P" ;;

  plan)
    claude_etapa plan-architect "/sdd-plan-architect --skip-clarify — $ARNES Generate plan/."
    node "$SDD" lint --plan >/dev/null 2>&1 || falla "sdd lint --plan encuentra errores: $(node "$SDD" lint --plan 2>&1 | tail -3 | tr '\n' ' ')"
    fin "$RES" "Plan generado ($(ls plan/fases/FASE-*.md 2>/dev/null | wc -l | tr -d ' ') FASEs)" ;;

  tareas)
    claude_etapa task-generator "/sdd-task-generator — $ARNES Generate task/ for all FASEs."
    node "$SDD" lint --dir task >/dev/null 2>&1 || falla "sdd lint de tareas encuentra errores"
    P=$(puerta plan) || falla "no se pudo abrir la puerta de plan"
    fin "$RES" "Tareas generadas: $(node "$SDD" tasks status 2>/dev/null | tail -1)" "$P" ;;

  implementar)
    [ -n "$FASE" ] || falla "falta la FASE"
    claude_etapa task-implementer "/sdd-task-implementer --fase=$FASE — $ARNES Implement FASE-$FASE completely, test-first, one commit per task with Refs:/Task: trailers."
    st=$(node "$SDD" tasks status --fase "$FASE" --require-done 2>&1) || falla "quedan tareas de la FASE-$FASE sin hacer: $(echo "$st" | tail -1)"
    base=$(git describe --tags --abbrev=0 --match 'fase-*-accepted' 2>/dev/null || git describe --tags --abbrev=0 --match 'requirements-v*' 2>/dev/null || git rev-list --max-parents=0 HEAD)
    node "$SDD" verify --range "$base..HEAD" >/dev/null 2>&1 || falla "sdd verify --range $base..HEAD encuentra commits inválidos"
    fin "$RES" "FASE-$FASE implementada: $(echo "$st" | tail -1)" ;;

  aceptar)
    [ -n "$FASE" ] || falla "falta la FASE"
    claude_etapa acceptance "/sdd-acceptance --fase $FASE — $ARNES Produce the per-requirement verdicts with evidence and the FASE demo (captures and a short video in evidencias/FASE-$FASE/). Do not sign off."
    P=$(puerta fase "$FASE") || falla "no se pudo abrir la puerta de la FASE-$FASE"
    fin "$RES" "Veredictos y demo de la FASE-$FASE listos" "$P" ;;

  cierre)
    rc=0; node "$SDD" gate >/dev/null 2>&1 || rc=$?
    if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then
      HUECOS=$(node "$SDD" gate 2>/dev/null | grep -E 'MISSING|FAILING|STALE' | awk '{print $1" "$2}' | tr '\n' ';')
      ULT=$(ls plan/fases/FASE-*.md | sed -E 's/.*FASE-([0-9]+).*/\1/' | sort -n | tail -1)
      claude_etapa task-implementer "/sdd-task-implementer --fase=$ULT — $ARNES The GLOBAL acceptance gate is not met. Requirements without evidence: $HUECOS. For each one, first append a task to task/TASK-FASE-$ULT.md (next TASK-F$ULT id, same grammar, Refs the requirement), then implement it test-first (the test name carries the requirement id and criterion, e.g. 'REQ-C-001 AC1'), one commit per task with Task:/Refs: trailers. Do not touch tests that already exist."
      claude_etapa acceptance "/sdd-acceptance — $ARNES Compute the GLOBAL per-requirement verdicts (all FASEs) with evidence. Do not sign off."
    fi
    P=$(puerta entrega) || falla "no se pudo abrir la puerta de entrega"
    [ -n "${RES:-}" ] || RES='{"outcome":"done","reason":"ok"}'
    fin "$RES" "Cierre: puerta de calidad global calculada" "$P" ;;

  *) falla "etapa desconocida: $ETAPA" ;;
esac
