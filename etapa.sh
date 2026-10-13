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
#     cambio         aplica la petición de intent/INT-NNN.md a los requisitos (versión nueva) → puerta de requisitos
#     adoptar        ingeniería inversa de un repo existente: requisitos y FASEs retroactivas → puerta de requisitos
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
# Ejecutor por etapa: .ejecutores[<etapa>] o, si no, .ejecutor (claude | hermes | replay); el modelo, en .modelos[<etapa>]
ejecutor() { jq -r --arg e "$1" '.ejecutores[$e] // .ejecutor // "claude"' .sdd/hermes/hermes-sdd.json 2>/dev/null || echo claude; }
EJEC=$(ejecutor "$ETAPA")
modelo() { jq -r --arg e "$1" '.modelos[$e] // .modelos.defecto // empty' .sdd/hermes/hermes-sdd.json 2>/dev/null; }
fin() {  # fin <json-del-ejecutor-o-propio> [resumen] [puerta]
  echo "$1" | jq -c --arg r "${2:-}" --arg p "${3:-}" '. + {resumen:$r} + (if $p != "" then {puerta:$p} else {} end)'
  exit 0
}
falla() { fin "$(jq -nc --arg r "$1" '{outcome:"failed", reason:$r}')"; }

# ── Antes de gastar nada: ¿el proyecto está en pausa? ¿la cuota de Claude está agotada? ────────────────────────────
HOME_SDD=${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}
BOARD=$(basename "$REPO" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
if [ -f "$HOME_SDD/pausa/_todo" ] || [ -f "$HOME_SDD/pausa/$BOARD" ]; then
  fin '{"outcome":"scheduled","reason":"proyecto en pausa: /reanudar para seguir"}'
fi
if [ "$EJEC" = claude ] && [ -f "$HOME_SDD/cuota.json" ]; then
  R=$(jq -r '.reset_at // 0' "$HOME_SDD/cuota.json")
  [ "$R" -gt "$(date +%s)" ] && fin "$(jq -nc --arg r "$R" '{outcome:"scheduled", reason:"cuota de Claude agotada", reset_at:$r}')"
fi

FB=".sdd/hermes/feedback/${ETAPA}${FASE:+-$FASE}.txt"
PEDIDO=""; [ -s "$FB" ] && PEDIDO=" La persona revisó la propuesta anterior y pidió estos cambios, que son la prioridad de esta ejecución: «$(cat "$FB")»."
ARNES="Modo arnés (hermes-sdd): sin persona en la sesión; sigue references/modo-arnes.md del plugin.$PEDIDO"

registros_ajenos() {  # registros_ajenos <head-antes> → imprime qué está mal y sale 0; nada y sale 1 si todo es de la CLI
  local f d m
  for f in acceptance/decisions.jsonl acceptance/challenges.jsonl; do
    [ -f "$f" ] || { git cat-file -e "$1:$f" 2>/dev/null && { echo "$f: borrado"; return 0; }; continue; }
    # cada línea que había antes de la etapa sigue ahí (lo nuevo puede quedar en medio: merge=union en el replay)
    d=$(diff <(git show "$1:$f" 2>/dev/null) "$f" || true)
    printf '%s\n' "$d" | grep -q '^<' && { echo "$f: líneas borradas o cambiadas"; return 0; }
    [ "$f" = acceptance/challenges.jsonl ] && continue
    m=$(printf '%s\n' "$d" | sed -n 's/^> //p' | jq -rs '[.[] | select((.type == "measurement" and .by == "command"
      and .role == "automated" and (.command | type) == "string") | not) | "\(.type) por \(.by)"] | unique | join(", ")' 2>/dev/null) ||
      m="líneas que no son JSON"
    [ -z "$m" ] || { echo "$f: registros que no son mediciones de la CLI ($m)"; return 0; }
  done
  return 1
}
claude_etapa() {  # claude_etapa <clave-de-estado> <prompt>
  local clave=$1 res st head0 malo
  head0=$(git rev-parse HEAD)
  res=$(bash "$ROOT/executors/$EJEC.sh" "$REPO" "$ETAPA${FASE:+-$FASE}" "$2" "$(modelo "$ETAPA")" | tail -1)
  [ "$(echo "$res" | jq -r .outcome)" = done ] || fin "$res" "$(echo "$res" | jq -r .reason)"
  # Post-condición: la etapa no puede quedar a medias en el estado del método
  st=$(bash "$STATE" get "$clave" 2>/dev/null || echo "?")
  if [ "$st" = running ]; then
    bash "$STATE" set "$clave" stale --reason "el ejecutor terminó sin cerrar la etapa" >/dev/null 2>&1
    fin "$(echo "$res" | jq -c '.outcome="failed" | .reason="la etapa quedó en running: marcada stale"')"
  fi
  [ -s "$FB" ] && mv "$FB" "$FB.aplicado"
  # Los registros solo crecen, y el ejecutor solo puede añadir lo que escribe la CLI: mediciones de un comando
  # (`accept measure`) en decisions.jsonl y hallazgos (`accept challenge add`) en challenges.jsonl. Lo demás es una
  # decisión humana: se para la etapa sin commitear nada y lo ve una persona.
  if malo=$(registros_ajenos "$head0"); then
    fin "$(echo "$res" | jq -c --arg r "el ejecutor tocó registros humanos: $malo" '.outcome="failed" | .reason=$r')"
  fi
  # Lo que el ejecutor dejó versionado y sin commit (p. ej. un registro de medición): se commitea, a la vista, para
  # que la puerta se abra sobre un árbol limpio (el notario se niega a firmar con cambios pendientes)
  git add -- $(ls acceptance/decisions.jsonl acceptance/challenges.jsonl 2>/dev/null) >/dev/null 2>&1  # ya validados (un registro nuevo también)
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    git add -u && git commit -qm "docs(sdd): changes left uncommitted by the $clave stage" >/dev/null 2>&1 &&
      res=$(echo "$res" | jq -c '.reason = "ok (el arnés hizo commit de cambios que el ejecutor dejó pendientes)"')
  fi
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
      bash "$ROOT/executors/$(ejecutor ruta).sh" "$REPO" ruta-factores "Read requirements/CUSTOMER-NEEDS.md and requirements/REQUIREMENTS.md. Estimate the seven route factors (external_customer, sensitive_data, multi_actor, integrations, ui_flows, long_lived, complex_state) as probabilities 0-1, honestly, 0.5 when the text does not say. Write ONLY .sdd/route-answers.json as {\"factors\": {...}}. Do not run anything else." "$(modelo ruta)" >/dev/null
      node "$SDD" route --json --answers .sdd/route-answers.json > .sdd/hermes/ruta.json || falla "sdd route falló"
    fi
    P=$(puerta ruta) || falla "no se pudo abrir la puerta de ruta"
    fin '{"outcome":"done","reason":"ok"}' "Ruta propuesta" "$P" ;;

  plan)
    INC=""; git tag -l 'fase-*-accepted' | grep -q . && INC=" INCREMENTAL: the requirements changed after some FASEs were accepted (tags fase-N-accepted, see changes/). Keep every accepted FASE file untouched and add new FASE(s) after the last one, covering only the new or modified requirements."
    claude_etapa plan-architect "/sdd-plan-architect --skip-clarify — $ARNES Generate plan/.$INC"
    node "$SDD" lint --plan >/dev/null 2>&1 || falla "sdd lint --plan encuentra errores: $(node "$SDD" lint --plan 2>&1 | tail -3 | tr '\n' ' ')"
    fin "$RES" "Plan generado ($(ls plan/fases/FASE-*.md 2>/dev/null | wc -l | tr -d ' ') FASEs)" ;;

  tareas)
    INC=""; git tag -l 'fase-*-accepted' | grep -q . && INC=" INCREMENTAL: generate task files only for the FASEs that do not have one yet; do not touch the task files of accepted FASEs."
    claude_etapa task-generator "/sdd-task-generator — $ARNES Generate task/ for all FASEs.$INC"
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

  cambio)
    INT=$(cat .sdd/hermes/cambio-actual 2>/dev/null) || falla "no hay ningún cambio en curso (.sdd/hermes/cambio-actual)"
    claude_etapa req-change "/sdd-req-change --batch --cascade=manual --file intent/$INT.md — $ARNES Apply this change request to requirements/ as the next version (Version +1, Status: Review)."
    P=$(puerta requisitos) || falla "no se pudo abrir la puerta de requisitos"
    fin "$RES" "Cambio $INT aplicado a los requisitos (pendiente de aprobar)" "$P" ;;

  adoptar)
    claude_etapa reverse-engineer "/sdd-reverse-engineer — $ARNES Adopt this existing repository: derive requirements/CUSTOMER-NEEDS.md and requirements/REQUIREMENTS.md (Version 1.0, Status: Review) with verifiable criteria, plus retroactive FASEs and findings."
    P=$(puerta requisitos) || falla "no se pudo abrir la puerta de requisitos"
    fin "$RES" "Línea base propuesta a partir del código" "$P" ;;

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
